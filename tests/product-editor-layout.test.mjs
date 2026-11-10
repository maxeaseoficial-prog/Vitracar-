// Geometry regression for the product editor. API reads are mocked; writes are forbidden.
// Build first with VITE_SUPABASE_URL=https://perf-test.invalid and a mock public key.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {chromium} from 'playwright-core'
const root=path.resolve('dist'),port=4189
const server=http.createServer((req,res)=>{
 let file=path.join(root,new URL(req.url,'http://localhost').pathname)
 if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html')
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream')
 res.end(fs.readFileSync(file))
})
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve))
const browser=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']})
const uid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222'
const exp=Math.floor(Date.now()/1000)+3600,enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url')
const user={id:uid,email:'qa@example.invalid',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),user_metadata:{},app_metadata:{provider:'email'}}
const session={user,access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:uid,role:'authenticated',exp})+'.mock',refresh_token:'mock',expires_at:exp,expires_in:3600,token_type:'bearer'}
const context=await browser.newContext({viewport:{width:1440,height:1000}})
await context.addInitScript(s=>{if(window.top===window&&location.hostname==='127.0.0.1')localStorage.setItem('sb-perf-test-auth-token',JSON.stringify(s))},session)
const page=await context.newPage(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
await page.route('https://perf-test.invalid/**',async route=>{
 const req=route.request(),u=new URL(req.url());let body=[]
 if(u.pathname==='/auth/v1/user')body=user
 else if(u.pathname==='/auth/v1/token')body=session
 else if(u.pathname.startsWith('/rest/v1/')){
  assert.equal(req.method(),'GET','Layout tests must never mutate records')
  const name=u.pathname.split('/').pop()
  if(name==='profiles')body={id:uid,company_id:cid,name:'QA',role:'admin'}
  if(name==='company_settings')body={id:cid,name:'VitraCar QA',timezone:'America/Sao_Paulo'}
 }else throw Error('Unexpected request '+u.pathname)
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
})
const open=()=>page.getByRole('button',{name:'Cadastrar produto',exact:true}).first().click()
const close=()=>page.getByRole('button',{name:'Cancelar',exact:true}).click()
const top=()=>page.locator('.inv-editor-layout').evaluate(el=>el.scrollTop=0)
async function geometry(){return page.evaluate(()=>{
 const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}}
 const sc=document.querySelector('.inv-editor-layout')
 return {preview:box('.inv-editor-preview'),fields:box('.inv-editor-fields'),name:box('input[aria-label="Nome do produto"]'),footer:box('.inv-editor-footer'),modal:box('.inv-editor-modal'),overflow:sc.scrollWidth-sc.clientWidth}
})}
let count=0
async function test(name,fn){await fn();count++;console.log('PASS',name)}
try{
 await page.goto(`http://127.0.0.1:${port}/estoque`)
 await page.getByRole('heading',{name:'Estoque',exact:true}).waitFor()
 await test('desktop and tablet align photo and fields at the top',async()=>{
  await open()
  for(const [width,height] of [[1440,1000],[1366,768],[1024,768],[800,900],[768,1024]]){
   await page.setViewportSize({width,height});await top();const g=await geometry()
   assert(g.fields.x>=g.preview.right+10,`${width}: fields must be beside the preview`)
   assert(Math.abs(g.fields.y-g.preview.y)<3,`${width}: top alignment`)
   assert(g.name.bottom<g.footer.y,`${width}: first input must be visible on opening`)
   assert(g.overflow<=1&&g.modal.width<=1121&&g.footer.bottom<=height,`${width}: dialog geometry`)
  }
  await page.setViewportSize({width:1440,height:1000});await top()
  await page.screenshot({path:'/tmp/product-editor-layout-desktop.png'})
  await close()
 })
 await test('mobile keeps a compact photo uploader and visible action buttons',async()=>{
  await open()
  for(const [width,height] of [[720,900],[640,800],[520,844],[390,844],[320,740]]){
   await page.setViewportSize({width,height});await top();const g=await geometry()
   assert(g.fields.y>=g.preview.bottom&&g.preview.height<255,`${width}: compact mobile preview`)
   assert(g.footer.bottom<=height&&g.modal.right<=width&&g.overflow<=1,`${width}: modal overflow`)
   assert(await page.getByLabel('Foto do produto',{exact:true}).isVisible())
   await page.getByLabel('Link para comprar mais',{exact:true}).scrollIntoViewIfNeeded()
   const button=await page.locator('.inv-editor-modal').getByRole('button',{name:'Cadastrar produto',exact:true}).boundingBox()
   assert(button&&button.y>=0&&button.y+button.height<=height,`${width}: footer action must stay visible`)
  }
  await page.setViewportSize({width:390,height:844});await top()
  await page.screenshot({path:'/tmp/product-editor-layout-mobile.png'})
  await close();await page.setViewportSize({width:1440,height:1000})
 })
 await test('late global form rules cannot stack the desktop editor',async()=>{
  const injected=await page.addStyleTag({content:'.modal-content form{display:flex;flex-direction:column;gap:17px}.inv-editor{display:grid;grid-template-columns:225px minmax(0,1fr);gap:25px}'})
  await open();await page.getByLabel('Nome do produto',{exact:true}).fill('Produto de nome longo '.repeat(7))
  const g=await geometry();assert(g.fields.x>g.preview.right)
  assert.equal(await page.locator('.inv-editor-layout').evaluate(el=>getComputedStyle(el).display),'grid')
  await page.getByLabel('Link para comprar mais',{exact:true}).scrollIntoViewIfNeeded()
  assert((await geometry()).footer.bottom<=1000)
  await close();await injected.evaluate(el=>el.remove())
 })
 await test('short landscape window keeps header and footer inside the viewport',async()=>{
  await page.setViewportSize({width:844,height:390});await open()
  await page.getByLabel('Link para comprar mais',{exact:true}).scrollIntoViewIfNeeded()
  const g=await geometry();assert(g.footer.bottom<=390&&g.modal.y>=0&&g.overflow<=1)
  await close()
 })
 assert.deepEqual(errors,[])
 console.log(`${count} product-editor layout scenarios passed. No real accounts or database writes.`)
}catch(error){await page.screenshot({path:'/tmp/product-editor-layout-failure.png'});throw error}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
