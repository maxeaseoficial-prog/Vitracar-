// Testa o teste grátis de 20 dias e o bloqueio da assinatura (billing.sql) num Postgres em memória.
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const db = new PGlite()
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text); alter table storage.objects enable row level security;
grant usage on schema public to authenticated;`)
await db.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url),'utf8').replace('create extension if not exists pgcrypto;',''))
const A='00000000-0000-4000-8000-00000000000a', B='00000000-0000-4000-8000-00000000000b', OLD='00000000-0000-4000-8000-00000000000d'
await db.exec(`insert into auth.users values('${A}'),('${B}'),('${OLD}')`)
const as = async (uid, sql, params=[]) => {
  await db.exec(`reset role; select set_config('test.uid','${uid}',false); set role authenticated;`)
  try { return (await db.query(sql, params)).rows } finally { await db.exec('reset role') }
}
let pass=0, fail=0
const ok=(c,m)=>{ if(c){pass++;console.log('OK  ',m)} else {fail++;console.log('FAIL',m)} }
const throws=async(fn,m)=>{ try{await fn();fail++;console.log('FAIL (não bloqueou)',m)}catch(e){pass++;console.log('OK  ',m,'→',e.message.slice(0,60))} }

// Empresa criada ANTES do billing.sql (cliente que já usa o sistema).
const cOld=(await as(OLD,`select public.create_company('Antiga') id`))[0].id
await db.exec(fs.readFileSync(new URL('../billing.sql', import.meta.url),'utf8'))
await db.exec(fs.readFileSync(new URL('../billing.sql', import.meta.url),'utf8')) // idempotente
const status=async uid=>(await as(uid,`select public.billing_status() s`))[0].s

const old=await status(OLD)
ok(old.allowed && old.trial_days_left===20,'Empresa existente recebe 20 dias a partir da migração')

const ca=(await as(A,`select public.create_company('Lava A') id`))[0].id
await as(B,`select public.create_company('Lava B') id`)
let s=await status(A)
ok(s.status==='trialing' && s.allowed && s.trial_days_left===20 && s.trial_days_total===20,'Conta nova: 20 dias grátis e liberada')
ok(s.welcome_seen===false && s.is_admin===true,'Mensagem de parabéns pendente para o admin')
await as(A,`select public.billing_mark_welcome_seen()`)
ok((await status(A)).welcome_seen===true,'Parabéns marcada como vista')
ok((await status(B)).welcome_seen===false,'Marcar A não afeta B')

ok((await as(B,`select count(*)::int n from public.company_billing`))[0].n===1,'B só enxerga a própria cobrança')
await throws(()=>as(A,`update public.company_billing set trial_ends_at=now()+interval '999 days'`),'Usuário não consegue estender o próprio teste')
await throws(()=>as(A,`update public.company_billing set status='active'`),'Usuário não consegue se marcar como pago')
await throws(()=>as(A,`insert into public.company_billing(company_id) values(gen_random_uuid())`),'Usuário não insere cobrança')

await db.exec(`update public.company_billing set trial_ends_at=now()-interval '1 minute' where company_id='${ca}'`)
s=await status(A)
ok(!s.allowed && s.trial_days_left===0 && !s.paid,'Depois dos 20 dias: sistema bloqueado')
await db.exec(`update public.company_billing set status='active' where company_id='${ca}'`)
ok((await status(A)).allowed,'Assinatura ativa libera de novo')
await db.exec(`update public.company_billing set status='past_due' where company_id='${ca}'`)
ok((await status(A)).allowed,'Pagamento atrasado (Stripe ainda tentando) mantém acesso')
await db.exec(`update public.company_billing set status='canceled' where company_id='${ca}'`)
ok(!(await status(A)).allowed,'Assinatura cancelada bloqueia')
await throws(()=>db.exec(`update public.company_billing set status='qualquer' where company_id='${ca}'`),'Status inválido é recusado')

console.log(`\n${pass} ok, ${fail} falhas`); process.exit(fail?1:0)
