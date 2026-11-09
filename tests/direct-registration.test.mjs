// Isolated tests: every request and session is mocked. No production account is created.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
const policy = await readFile(new URL('../src/lib/password-policy.ts', import.meta.url), 'utf8')
const policyJs = ts.transpileModule(policy, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { validateRegistration } = await import('data:text/javascript;base64,' + Buffer.from(policyJs).toString('base64'))
const source = await readFile(new URL('../src/lib/direct-registration.ts', import.meta.url), 'utf8')
const testSource = source.replace(/^import .*$/gm,'').replaceAll('import.meta.env','testEnv').replace('export async function','async function')
const js = ts.transpileModule(testSource, { compilerOptions: {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS} }).outputText
const input={action:'signup',email:' EXAMPLE@EXAMPLE.COM ',password:'Example1!',confirmPassword:'Example1!'}
function setup({body={session:{access_token:'mock-access',refresh_token:'mock-refresh'}},status=200,setError=null,setData={session:{},user:{}},offline=false}={}){
 const calls=[],sessions=[]
 const ctx=vm.createContext({validateRegistration,AbortSignal,Response,testEnv:{VITE_SUPABASE_URL:'https://test.invalid/',VITE_SUPABASE_PUBLISHABLE_KEY:'mock-public-key'},
  supabase:{auth:{setSession:async value=>{sessions.push(value);return {data:setData,error:setError}}}},
  fetch:async(url,options)=>{calls.push({url,options});if(offline)throw Error('offline');return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})} })
 vm.runInContext(js,ctx)
 return {run:ctx.enterWithRegistration,calls,sessions}
}
let tests=0
async function test(name,fn){await fn();tests++;console.log('PASS',name)}
await test('successful signup establishes one native user session',async()=>{
 const t=setup();await t.run(input);assert.equal(t.sessions.length,1);assert.equal(t.calls.length,1)
 const payload=JSON.parse(t.calls[0].options.body);assert.equal(payload.email,'example@example.com');assert.equal(payload.action,'signup')
 assert.equal(t.calls[0].options.cache,'no-store');assert.equal(t.sessions[0].access_token,'mock-access')
})
await test('pending registration uses its own action and does not reset password',async()=>{
 const t=setup();await t.run({action:'finish-pending',email:'EXAMPLE@EXAMPLE.COM',password:'legacy1'})
 assert.equal(JSON.parse(t.calls[0].options.body).action,'finish-pending');assert.equal(t.sessions.length,1)
})
for(const patch of [{password:'weak',confirmPassword:'weak'},{confirmPassword:'not-the-same'}]){
 await test('invalid signup never sends a request',async()=>{const t=setup();await assert.rejects(t.run({...input,...patch}));assert.equal(t.calls.length,0);assert.equal(t.sessions.length,0)})
}
for(const status of [400,401,403,429,503]){
 await test(`HTTP ${status} never authenticates`,async()=>{const t=setup({status,body:{message:'Expected rejection'}});await assert.rejects(t.run(input),/Expected rejection/);assert.equal(t.sessions.length,0)})
}
for(const body of [null,{}, {session:{}},{session:{access_token:'',refresh_token:'mock-refresh'}},{session:{access_token:'mock-access'}}]){
 await test('missing or malformed session never authenticates',async()=>{const t=setup({body});await assert.rejects(t.run(input),/sessão/);assert.equal(t.sessions.length,0)})
}
await test('network failure is handled without storing credentials',async()=>{const t=setup({offline:true});await assert.rejects(t.run(input),/conexão/);assert.equal(t.sessions.length,0)})
await test('native Auth session error does not report success',async()=>{const t=setup({setError:Error('invalid token')});await assert.rejects(t.run(input),/sessão/)})
await test('native Auth must return both session and user',async()=>{const t=setup({setData:{session:null,user:null}});await assert.rejects(t.run(input),/sessão/)})
const login=await readFile(new URL('../src/pages/Login.tsx',import.meta.url),'utf8')
assert.ok(!login.includes('auth.signUp'))
assert.ok(!login.includes('O servidor ainda exige'))
assert.ok(login.includes("action:'signup'"));assert.ok(login.includes("action:'finish-pending'"))
console.log(`${tests} mocked session checks passed; no real credentials or accounts used.`)
