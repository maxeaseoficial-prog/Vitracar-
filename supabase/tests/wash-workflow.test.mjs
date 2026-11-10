// Isolated PostgreSQL tests. Never connects to the hosted project.
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const db=new PGlite()
await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema public to authenticated;`)
await db.exec(fs.readFileSync('supabase/schema.sql','utf8').replace('create extension if not exists pgcrypto;',''))
await db.exec(fs.readFileSync('supabase/wash-workflow.sql','utf8'))
const A='00000000-0000-4000-8000-00000000000a',B='00000000-0000-4000-8000-00000000000b'
await db.exec(`insert into auth.users values('${A}'),('${B}')`)
const as=async(uid,sql,params=[])=>{await db.exec(`reset role;select set_config('test.uid','${uid}',false);set role authenticated;`);try{return (await db.query(sql,params)).rows}finally{await db.exec('reset role')}}
const ca=(await as(A,"select public.create_company('QA A') id"))[0].id,cb=(await as(B,"select public.create_company('QA B') id"))[0].id
const client=(await as(A,"insert into clients(company_id,name) values($1,'QA cliente') returning id",[ca]))[0].id
const vehicle=(await as(A,"insert into vehicles(company_id,client_id,plate,brand,model) values($1,$2,'ABC1D23','QA','Sedan') returning id",[ca,client]))[0].id
const service=(await as(A,"insert into services(company_id,name,price_cents,coins,duration_minutes) values($1,'QA lavagem',10000,100,90) returning id",[ca]))[0].id
const base={client_id:client,vehicle_id:vehicle,starts_at:'2026-11-09T14:00:00Z',address:'Na unidade',notes:null}
const create=(patch={},items=[{service_id:service}])=>as(A,'select create_appointment($1::jsonb,$2::jsonb) id',[JSON.stringify({...base,...patch}),JSON.stringify(items)]).then(r=>r[0].id)
const ap=id=>as(A,'select * from appointments where id=$1',[id]).then(r=>r[0])
const move=async(id,stage,uid=A,version)=>as(uid,'select move_wash_stage($1,$2,$3)',[id,stage,version??(await ap(id)).workflow_version])
const pay=async(id,amount,method='pix',uid=A,version)=>as(uid,'select pay_wash_appointment($1,$2,$3,$4)',[id,amount,method,version??(await ap(id)).workflow_version])
let passed=0
async function test(name,fn){await fn();passed++;console.log('PASS',name)}
const id=await create()
await test('new booking begins scheduled with duration snapshot',async()=>{const a=await ap(id);assert.equal(a.workflow_stage,'scheduled');assert.equal(a.duration_minutes,90);assert.equal(a.workflow_version,0)})
await test('washing and return to scheduled persist',async()=>{await move(id,'washing');assert.equal((await ap(id)).status,'in_progress');await move(id,'scheduled');assert.equal((await ap(id)).status,'scheduled')})
await test('stale concurrent update is rejected',async()=>{const a=await ap(id);await move(id,'washing');await assert.rejects(()=>move(id,'scheduled',A,a.workflow_version),/outra tela/)})
await test('another company cannot move or pay this job',async()=>{await assert.rejects(()=>move(id,'finished',B),/não encontrado/);await assert.rejects(()=>pay(id,10000,'pix',B),/não encontrado/)})
await test('finish creates exactly one order',async()=>{await move(id,'finished');await move(id,'delivered');assert.equal((await ap(id)).workflow_stage,'delivered');assert.equal(Number((await as(A,'select count(*) n from service_orders where appointment_id=$1',[id]))[0].n),1)})
await test('cannot mark paid without receipts, even through direct table update',async()=>{await assert.rejects(()=>move(id,'paid'),/saldo/);await assert.rejects(()=>as(A,"update appointments set workflow_stage='paid' where id=$1",[id]),/saldo/)})
await test('partial payment stays delivered and earns no coins',async()=>{await pay(id,4000);assert.equal((await ap(id)).workflow_stage,'delivered');assert.equal(Number((await as(A,'select count(*) n from loyalty_ledger'))[0].n),0)})
await test('overpayment and invalid methods are rejected',async()=>{await assert.rejects(()=>pay(id,7000),/saldo/);await assert.rejects(()=>pay(id,100,'bad'),/Forma/);await assert.rejects(()=>pay(id,0),/saldo/)})
await test('full settlement moves paid and credits once',async()=>{await pay(id,6000);assert.equal((await ap(id)).workflow_stage,'paid');assert.equal(Number((await as(A,'select sum(change) n from loyalty_ledger'))[0].n),100)})
await test('paid reversal preserves order receipts coins and completed status',async()=>{await move(id,'washing');const a=await ap(id);assert.equal(a.status,'completed');assert.equal(a.workflow_stage,'washing');assert.equal(Number((await as(A,'select sum(amount_cents) n from payments'))[0].n),10000);assert.equal(Number((await as(A,'select sum(change) n from loyalty_ledger'))[0].n),100)})
await test('re-finishing never creates duplicate order',async()=>{await move(id,'finished');assert.equal(Number((await as(A,'select count(*) n from service_orders'))[0].n),1)})
await test('zero remaining closure never duplicates payments or coins',async()=>{await pay(id,0);assert.equal((await ap(id)).workflow_stage,'paid');assert.equal(Number((await as(A,'select count(*) n from payments'))[0].n),2);assert.equal(Number((await as(A,'select count(*) n from loyalty_ledger'))[0].n),1)})
await test('closed job financial snapshot and dates remain immutable',async()=>{await assert.rejects(()=>as(A,"update appointments set starts_at=now() where id=$1",[id]),/dados/);await assert.rejects(()=>as(A,"update appointments set status='scheduled' where id=$1",[id]),/dados/)})
await test('invalid stage and durations cannot be saved',async()=>{await assert.rejects(()=>move(id,'unknown'),/Etapa/);await assert.rejects(()=>create({duration_minutes:3}),/duração/);await assert.rejects(()=>create({duration_minutes:1441}),/duração/)})
await test('repeated or unauthorized services rejected atomically',async()=>{await assert.rejects(()=>create({},[{service_id:service},{service_id:service}]),/repetido/);await assert.rejects(()=>create({},[{service_id:'11111111-1111-4111-8111-111111111111'}]),/inválido/)})
await test('cancelled booking cannot move pay or re-open',async()=>{const aid=await create();await as(A,"update appointments set status='cancelled' where id=$1",[aid]);await assert.rejects(()=>move(aid,'washing'),/cancelado/);await assert.rejects(()=>pay(aid,10000),/cancelado/);await assert.rejects(()=>as(A,"update appointments set status='scheduled' where id=$1",[aid]),/cancelado/)})
await test('zero-price service closes without fake receipt',async()=>{const sid=(await as(A,"insert into services(company_id,name,price_cents,coins) values($1,'QA gratuito',0,0) returning id",[ca]))[0].id;const aid=await create({},[{service_id:sid}]);await pay(aid,0);assert.equal((await ap(aid)).workflow_stage,'paid');assert.equal(Number((await as(A,'select count(*) n from payments'))[0].n),2)})
await test('public RPCs deny anonymous access; tenant visibility preserved',async()=>{assert.equal((await db.query("select has_function_privilege('anon','public.move_wash_stage(uuid,text,integer)','execute') ok")).rows[0].ok,false);assert.equal((await db.query("select has_function_privilege('anon','public.pay_wash_appointment(uuid,bigint,text,integer)','execute') ok")).rows[0].ok,false);assert.equal(Number((await as(B,'select count(*) n from appointments'))[0].n),0)})
console.log(`${passed} wash workflow tests passed. Production data untouched.`)
await db.close()
