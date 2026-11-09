// Testa o schema num Postgres em memória (PGlite) com duas empresas.
// Simula auth.uid() e o schema storage do Supabase. Rode com: npm run test:db
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const db = new PGlite()
const stub = `
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text); alter table storage.objects enable row level security;
grant usage on schema public to authenticated;
`
await db.exec(stub)
let schema = fs.readFileSync(new URL('../schema.sql', import.meta.url),'utf8').replace('create extension if not exists pgcrypto;','')
await db.exec(schema)
const A='00000000-0000-4000-8000-00000000000a', B='00000000-0000-4000-8000-00000000000b', S='00000000-0000-4000-8000-00000000000c'
await db.exec(`insert into auth.users values('${A}'),('${B}'),('${S}')`)
const as = async (uid, sql, params=[]) => {
  await db.exec(`reset role; select set_config('test.uid','${uid}',false); set role authenticated;`)
  try { const r = await db.query(sql, params); return r.rows } finally { await db.exec('reset role') }
}
let pass=0, fail=0
const ok=(cond,msg)=>{ if(cond){pass++;console.log('OK  ',msg)} else {fail++;console.log('FAIL',msg)} }
const throws=async(fn,msg)=>{ try{ await fn(); fail++; console.log('FAIL (não bloqueou)',msg)}catch(e){pass++;console.log('OK  ',msg,'→',e.message.slice(0,70))} }

const ca=(await as(A,`select public.create_company('Estudio A') id`))[0].id
const cb=(await as(B,`select public.create_company('Estudio B') id`))[0].id
await db.exec(`insert into public.profiles(id,company_id,role) values('${S}','${ca}','staff')`)
const cliA=(await as(A,`insert into public.clients(company_id,name) values($1,'Cliente A') returning id`,[ca]))[0].id
const vehA=(await as(A,`insert into public.vehicles(company_id,client_id,plate,brand,model) values($1,$2,'ABC1D23','Fiat','Argo') returning id`,[ca,cliA]))[0].id
const svA=(await as(A,`insert into public.services(company_id,name,price_cents,coins) values($1,'Lavagem',10000,100) returning id`,[ca]))[0].id
const cliB=(await as(B,`insert into public.clients(company_id,name) values($1,'Cliente B') returning id`,[cb]))[0].id
const vehB=(await as(B,`insert into public.vehicles(company_id,client_id,plate,brand,model) values($1,$2,'XYZ1234','VW','Gol') returning id`,[cb,cliB]))[0].id
const svB=(await as(B,`insert into public.services(company_id,name,price_cents,coins) values($1,'Polimento',50000,500) returning id`,[cb]))[0].id

// Isolamento
ok((await as(B,`select count(*)::int n from public.clients`))[0].n===1,'B só enxerga o próprio cliente')
await throws(()=>as(B,`insert into public.vehicles(company_id,client_id,plate,brand,model) values($1,$2,'AAA1111','x','y')`,[cb,cliA]),'B não liga veículo a cliente de A')
await throws(()=>as(B,`insert into public.clients(company_id,name) values($1,'intruso')`,[ca]),'B não grava na empresa de A')
ok((await as(B,`update public.clients set name='hack' where id=$1 returning id`,[cliA])).length===0,'B não altera cliente de A')

// Orçamentos atômicos e numeração por empresa
const items=JSON.stringify([{service_id:svA,description:'Lavagem',quantity:2,unit_cents:10000}])
await as(A,`select public.create_quote($1::jsonb,$2::jsonb)`,[JSON.stringify({client_id:cliA,vehicle_id:vehA,discount_cents:0,notes:''}),items])
await as(A,`select public.create_quote($1::jsonb,$2::jsonb)`,[JSON.stringify({client_id:cliA,vehicle_id:vehA,discount_cents:500}),items])
await as(B,`select public.create_quote($1::jsonb,$2::jsonb)`,[JSON.stringify({client_id:cliB,vehicle_id:vehB,discount_cents:0}),JSON.stringify([{service_id:svB,description:'P',quantity:1,unit_cents:50000}])])
const na=(await as(A,`select array_agg(quote_number order by quote_number) n from public.quotes`))[0].n
const nb=(await as(B,`select array_agg(quote_number) n from public.quotes`))[0].n
ok(JSON.stringify(na)==='[1,2]' && JSON.stringify(nb)==='[1]','Numeração por empresa: A=[1,2], B=[1]')
ok((await as(A,`select count(*)::int n from public.quote_items`))[0].n===2,'Cada orçamento gravou seus itens')
await throws(()=>as(A,`select public.create_quote($1::jsonb,'[]'::jsonb)`,[JSON.stringify({client_id:cliA,vehicle_id:vehA})]),'Orçamento sem itens é recusado')
await throws(()=>as(A,`select public.create_quote($1::jsonb,$2::jsonb)`,[JSON.stringify({client_id:cliA,vehicle_id:vehA,discount_cents:999999}),items]),'Desconto maior que subtotal é recusado')
const before=(await as(A,`select count(*)::int n from public.quotes`))[0].n
await throws(()=>as(A,`select public.create_quote($1::jsonb,$2::jsonb)`,[JSON.stringify({client_id:cliA,vehicle_id:vehA}),JSON.stringify([{service_id:svA,description:'x',quantity:0,unit_cents:1}])]),'Item inválido desfaz o orçamento inteiro')
ok((await as(A,`select count(*)::int n from public.quotes`))[0].n===before,'Nenhum orçamento órfão ficou gravado')
await throws(()=>as(A,`update public.quotes set quote_number=99`),'Número do orçamento não pode ser alterado')

// Agendamento atômico
await throws(()=>as(A,`select public.create_appointment($1::jsonb,$2::jsonb)`,[JSON.stringify({client_id:cliA,vehicle_id:vehA,starts_at:'2026-11-10T10:00:00Z'}),JSON.stringify([{service_id:svB}])]),'Serviço de outra empresa é recusado no agendamento')
const ap=(await as(A,`select public.create_appointment($1::jsonb,$2::jsonb) id`,[JSON.stringify({client_id:cliA,vehicle_id:vehA,starts_at:'2026-11-10T10:00:00Z',address:'Na unidade'}),JSON.stringify([{service_id:svA,price_cents:1}])]))[0].id
ok((await as(A,`select price_cents from public.appointment_items where appointment_id=$1`,[ap]))[0].price_cents==10000,'Preço do agendamento vem do catálogo (ignora valor do navegador)')
await throws(()=>as(A,`update public.appointments set status='completed' where id=$1`,[ap]),'Status "concluído" direto é bloqueado')
const order=(await as(A,`select public.complete_appointment($1) id`,[ap]))[0].id
ok(Boolean(order),'Conclusão gera ordem de serviço')
await throws(()=>as(A,`insert into public.appointment_items(company_id,appointment_id,description,price_cents) values($1,$2,'extra',1)`,[ca,ap]),'Não adiciona serviço em agendamento concluído')
await throws(()=>as(A,`update public.appointments set status='scheduled' where id=$1`,[ap]),'Agendamento concluído não volta a "agendado"')

// Pagamentos e moedas
await as(A,`insert into public.payments(company_id,order_id,amount_cents,method) values($1,$2,4000,'pix')`,[ca,order])
ok((await as(A,`select count(*)::int n from public.loyalty_ledger`))[0].n===0,'Pagamento parcial não credita moedas')
await throws(()=>as(A,`insert into public.payments(company_id,order_id,amount_cents,method) values($1,$2,7000,'pix')`,[ca,order]),'Pagamento acima do saldo é recusado')
await as(A,`insert into public.payments(company_id,order_id,amount_cents,method) values($1,$2,6000,'cash')`,[ca,order])
ok((await as(A,`select coalesce(sum(change),0)::int n from public.loyalty_ledger`))[0].n===100,'Quitação credita 100 moedas uma única vez')
await throws(()=>as(B,`insert into public.payments(company_id,order_id,amount_cents,method) values($1,$2,1,'pix')`,[cb,order]),'B não paga OS de A')

// Resgate
const rw=(await as(A,`insert into public.loyalty_rewards(company_id,name,cost) values($1,'Brinde',80) returning id`,[ca]))[0].id
await as(A,`select public.redeem_loyalty($1,$2)`,[cliA,rw])
await throws(()=>as(A,`select public.redeem_loyalty($1,$2)`,[cliA,rw]),'Segundo resgate sem saldo é recusado')
await throws(()=>as(A,`insert into public.loyalty_ledger(company_id,client_id,change,kind,source_id,event_key,description) values($1,$2,1000,'earn',$2,'x','fraude')`,[ca,cliA]),'Usuário não credita moedas manualmente')

// Papéis
ok((await as(S,`update public.company_settings set name='Hack' where id=$1 returning id`,[ca])).length===0,'Staff não altera dados da empresa')
ok((await as(A,`update public.company_settings set name='Estudio A2' where id=$1 returning id`,[ca])).length===1,'Admin altera dados da empresa')
console.log(`\n${pass} passaram, ${fail} falharam`); if (fail) process.exit(1)
