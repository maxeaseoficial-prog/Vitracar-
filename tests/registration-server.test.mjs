// All Supabase calls are mocked; this test does not access a real account or API.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
const source=await readFile(new URL('../supabase/functions/register-account/index.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const origin='https://vitracar.vercel.app'
const valid={action:'signup',email:'sample@example.invalid',password:'Example1!',confirmPassword:'Example1!'}
const nativeSession={access_token:'mock-user-access',refresh_token:'mock-user-refresh'}
const pendingId='11111111-1111-4111-8111-111111111111'
function setup({grant=[{status:200,data:nativeSession}],limit=true,adminStatus=200,lookupStatus=200,throwFetch=false}={}){
 const calls=[];let handler
 const env={SUPABASE_URL:'https://auth-test.invalid',SUPABASE_SERVICE_ROLE_KEY:'mock-server-key',SUPABASE_ANON_KEY:'mock-public-key'}
 const ctx=vm.createContext({TextEncoder,TextDecoder,AbortSignal,Request,Response,crypto:webcrypto,
  Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn}},
  fetch:async(url,options)=>{
   calls.push({url,method:options.method,body:JSON.parse(options.body)})
   if(throwFetch)throw Error('must not disclose details')
   let status=200,data
   if(url.endsWith('/vitracar_take_auth_attempt'))data=limit
   else if(url.includes('/token?'))({status,data}=grant.shift()||{status:400,data:{code:'invalid_credentials'}})
   else if(url.endsWith('/vitracar_pending_user_id')){status=lookupStatus;data=pendingId}
   else if(url.includes('/admin/users')){status=adminStatus;data=adminStatus===200?{id:pendingId}:{code:'email_exists'}}
   else throw Error('Unexpected request')
   return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
  }})
 vm.runInContext(js,ctx)
 const run=(body=valid,overrides={})=>handler(new Request('https://function-test.invalid/',{method:'POST',headers:{apikey:'mock-public-key',Origin:origin,'Content-Type':'application/json',...overrides},body:JSON.stringify(body)}))
 return {run,calls,handler}
}
let count=0
async function test(name,fn){await fn();count++;console.log('PASS',name)}
await test('weak password denied before any Auth call',async()=>{const t=setup();assert.equal((await t.run({...valid,password:'weak',confirmPassword:'weak'})).status,400);assert.equal(t.calls.length,0)})
await test('password confirmation required server-side',async()=>{const t=setup();assert.equal((await t.run({...valid,confirmPassword:'wrong'})).status,400);assert.equal(t.calls.length,0)})
await test('untrusted origin blocked',async()=>{const t=setup();assert.equal((await t.run(valid,{Origin:'https://untrusted.invalid'})).status,403);assert.equal(t.calls.length,0)})
await test('Lavoo production and team preview origins allowed, lookalikes blocked',async()=>{for(const o of ['https://lavooapp.vercel.app','https://lavoo-abc123-henriquecastroeditor-5558s-projects.vercel.app']){const t=setup();const res=await t.handler(new Request('https://function-test.invalid/',{method:'OPTIONS',headers:{Origin:o}}));assert.equal(res.status,204);assert.equal(res.headers.get('Access-Control-Allow-Origin'),o)}for(const o of ['https://lavooapp.vercel.app.evil.com','https://lavoo-abc-otherteam.vercel.app','http://lavooapp.vercel.app']){const t=setup();assert.equal((await t.run(valid,{Origin:o})).status,403)}})
await test('missing app key blocked',async()=>{const t=setup();assert.equal((await t.run(valid,{apikey:''})).status,401);assert.equal(t.calls.length,0)})
await test('new registration confirms only its newly created user and returns native session',async()=>{
 const t=setup()
 const res=await t.run();assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store')
 assert.deepEqual(await res.json(),{session:nativeSession});const created=t.calls.find(x=>x.url.endsWith('/admin/users'))
 assert.equal(created.body.email_confirm,true);assert.equal(created.body.password,valid.password);assert.ok(!('role' in created.body))
})
await test('existing correct password returns session without account mutation',async()=>{
 const t=setup();assert.equal((await t.run({...valid,action:'finish-pending'})).status,200);assert.ok(t.calls.every(x=>!x.url.includes('/admin/')&&!x.url.includes('pending_user')))
})
await test('duplicate email with wrong password is not replaced or confirmed',async()=>{
 const t=setup({adminStatus:422});const res=await t.run();assert.equal(res.status,409);assert.equal((await res.json()).code,'email_exists');assert.ok(!t.calls.some(x=>x.url.includes('/token?')))
 assert.ok(t.calls.every(x=>x.method!=='PUT'));assert.ok(t.calls.every(x=>!x.url.includes('pending_user')))
})
await test('pending account needs Auth-validated password before confirmation',async()=>{
 const t=setup({grant:[{status:400,data:{code:'email_not_confirmed'}},{status:200,data:nativeSession}]})
 const res=await t.run({action:'finish-pending',email:valid.email,password:'legacy-password'});assert.equal(res.status,200)
 const tokenIndex=t.calls.findIndex(x=>x.url.includes('/token?'));const updateIndex=t.calls.findIndex(x=>x.method==='PUT')
 assert.ok(tokenIndex>=0&&updateIndex>tokenIndex);assert.deepEqual(t.calls[updateIndex].body,{email_confirm:true})
})
await test('wrong password cannot finish pending registration',async()=>{
 const t=setup({grant:[{status:400,data:{code:'invalid_credentials'}}]});assert.equal((await t.run({action:'finish-pending',email:valid.email,password:'wrong'})).status,400)
 assert.ok(t.calls.every(x=>!x.url.includes('/admin/')&&!x.url.includes('pending_user')))
})
await test('rate limit rejects before any password grant',async()=>{const t=setup({limit:false});const res=await t.run();assert.equal(res.status,429);assert.equal(res.headers.get('Retry-After'),'900');assert.equal(t.calls.length,1)})
await test('lookup failure cannot confirm any account',async()=>{const t=setup({grant:[{status:400,data:{code:'email_not_confirmed'}}],lookupStatus:403});assert.equal((await t.run({...valid,action:'finish-pending'})).status,400);assert.ok(t.calls.every(x=>!x.url.includes('/admin/')))})
await test('upstream failure is sanitized',async()=>{const t=setup({throwFetch:true});const res=await t.run();assert.equal(res.status,503);assert.ok(!(await res.text()).includes('must not disclose'))})
await test('oversized request is rejected',async()=>{const t=setup();assert.equal((await t.run({...valid,padding:'x'.repeat(5000)})).status,400);assert.equal(t.calls.length,0)})
await test('preflight succeeds without creating anything',async()=>{const t=setup();const res=await t.handler(new Request('https://function-test.invalid/',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(res.status,204);assert.equal(res.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(t.calls.length,0)})
await test('duplicate registration with correct password never logs in or activates',async()=>{
 const t=setup({adminStatus:422,grant:[{status:200,data:nativeSession}]});const res=await t.run();assert.equal(res.status,409)
 assert.match((await res.json()).message,/Este e-mail já está cadastrado/)
 assert.ok(!t.calls.some(x=>x.url.includes('/token?')||x.method==='PUT'||x.url.includes('pending_user')))
})
await test('native login outage is not misreported as wrong password',async()=>{
 const t=setup({grant:[{status:503,data:{}}]});assert.equal((await t.run({...valid,action:'finish-pending'})).status,503)
 assert.ok(!t.calls.some(x=>x.url.includes('/admin/')))
})
await test('new signup session failure reports that the account was created',async()=>{
 const t=setup({grant:[{status:503,data:{}}]});const res=await t.run();assert.equal(res.status,503)
 assert.equal((await res.json()).code,'session_unavailable')
})
console.log(`${count} mocked server checks passed; no real accounts used.`)

