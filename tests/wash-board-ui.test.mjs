// Chromium integration test with isolated, mutable API fixtures. No real account or writes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {chromium} from 'playwright-core'
const root=path.resolve('dist'),port=4182
const server=http.createServer((req,res)=>{let file=path.join(root,new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file))})
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve))
const browser=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']})
const id='11111111-1111-4111-8111-111111111111',companyId='22222222-2222-4222-8222-222222222222',now='2026-11-09T15:00:00Z'
const user={id,email:'qa@example.invalid',aud:'authenticated',role:'authenticated',created_at:now,user_metadata:{},app_metadata:{provider:'email'}}
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),exp=Math.floor(Date.now()/1000)+86400
const token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,role:'authenticated',exp})+'.mock'
const session={access_token:token,refresh_token:'mock',expires_at:exp,expires_in:86400,token_type:'bearer',user}
const company={id:companyId,name:'VitraCar QA',timezone:'America/Cuiaba'},profile={id,company_id:companyId,name:'QA',role:'admin'}
const clients=[{id:'c',company_id:companyId,name:'Cliente de teste',avatar_kind:'male',whatsapp:'65999999999',created_at:now}]
const services=[{id:'s',company_id:companyId,name:'Lavagem completa',price_cents:10000,coins:10,duration_minutes:60,active:true}]
const stages=['scheduled','washing','finished','delivered','paid']
const vehicles=stages.map((_,i)=>({id:'v'+i,company_id:companyId,client_id:'c',brand:'Marca',model:['Onix','Corolla','Civic','Compass','Polo'][i],plate:`ABC${i}D23`,color:'Prata',category:'sedan',model_3d_id:null,created_at:now}))
const appointments=stages.map((stage,i)=>({id:'a'+i,company_id:companyId,client_id:'c',vehicle_id:'v'+i,starts_at:`2026-11-09T${String(13+i).padStart(2,'0')}:00:00Z`,status:i>1?'completed':i?'in_progress':'scheduled',workflow_stage:stage,workflow_version:0,duration_minutes:60,created_at:now,address:'Na unidade',notes:null}))
appointments.push({...appointments[0],id:'old',starts_at:'2026-11-08T13:00:00Z'})
const appointment_items=appointments.map(a=>({id:'i'+a.id,company_id:companyId,appointment_id:a.id,service_id:'s',description:'Lavagem completa',price_cents:10000,coins:10}))
const service_orders=appointments.filter(a=>a.status==='completed').map(a=>({id:'o'+a.id,company_id:companyId,client_id:'c',vehicle_id:a.vehicle_id,appointment_id:a.id,status:'completed',total_cents:10000,completed_at:now,created_at:now}))
const dataset={clients,vehicles,services,appointments,appointment_items,service_orders,payments:[{id:'p',company_id:companyId,order_id:'oa4',amount_cents:10000,method:'pix',paid_at:now}],service_order_items:[],loyalty_ledger:[],quotes:[],quote_items:[],expenses:[],loyalty_rewards:[],loyalty_redemptions:[]}
let failNext=false;const mutations=[],errors=[],assets=[]
function complete(a){let order=service_orders.find(o=>o.appointment_id===a.id);if(!order){order={id:'o'+a.id,company_id:companyId,client_id:a.client_id,vehicle_id:a.vehicle_id,appointment_id:a.id,status:'completed',total_cents:10000,completed_at:now};service_orders.push(order)}a.status='completed';return order}
const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Tokyo'})
await ctx.addInitScript(s=>localStorage.setItem('sb-perf-test-auth-token',JSON.stringify(s)),session)
const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/assets/'))assets.push(r.url())})
await page.clock.install({time:new Date(now)})
await page.route('https://perf-test.invalid/**',async route=>{
 const req=route.request(),u=new URL(req.url()),parts=u.pathname.split('/'),name=parts.at(-1)
 let body=[],status=200
 if(u.pathname==='/auth/v1/user')body=user
 else if(u.pathname==='/auth/v1/token')body=session
 else if(u.pathname.includes('/rest/v1/rpc/')){
  const p=req.postDataJSON();mutations.push({name,p})
  if(failNext){failNext=false;return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Atualização concorrente de teste'})})}
  const a=appointments.find(x=>x.id===p.p_appointment_id)
  if(name==='move_wash_stage'){if(['finished','delivered','paid'].includes(p.p_stage))complete(a);a.workflow_stage=p.p_stage;a.workflow_version++;if(a.status!=='completed')a.status=p.p_stage==='washing'?'in_progress':'scheduled';body=a.id}
  else if(name==='pay_wash_appointment'){const o=complete(a);if(p.p_amount_cents>0)dataset.payments.push({id:'p'+mutations.length,company_id:companyId,order_id:o.id,amount_cents:p.p_amount_cents,method:p.p_method,paid_at:now});const paid=dataset.payments.filter(x=>x.order_id===o.id).reduce((n,x)=>n+x.amount_cents,0);a.workflow_stage=paid>=o.total_cents?'paid':a.workflow_stage==='delivered'?'delivered':'finished';a.workflow_version++;body=o.id}
  else if(name==='create_appointment'){const aid='new'+mutations.length;const ap={...p.p_appointment,id:aid,company_id:companyId,status:'scheduled',workflow_stage:'scheduled',workflow_version:0,created_at:now};appointments.push(ap);appointment_items.push(...p.p_items.map((s,i)=>({...s,id:aid+i,appointment_id:aid,company_id:companyId})));body=aid}
  else throw Error('Unexpected mocked RPC '+name)
 }else if(u.pathname.startsWith('/rest/v1/')){
  if(req.method()==='PATCH'){const changes=req.postDataJSON();const aid=u.searchParams.get('id')?.replace('eq.','');const a=appointments.find(x=>x.id===aid);Object.assign(a,changes);body=a;mutations.push({name:'patch',p:changes})}
  else body=name==='profiles'?profile:name==='company_settings'?company:dataset[name]||[]
 }else throw Error('Unexpected network '+u.pathname)
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
})
const column=stage=>page.locator(`[data-wash-stage="${stage}"]`)
const card=aid=>page.locator(`[data-job-id="${aid}"]`)
async function stageIs(aid,stage){await column(stage).locator(`[data-job-id="${aid}"]`).waitFor();await page.waitForFunction(()=>!document.querySelector('.wash-card.is-busy'));assert.equal(appointments.find(a=>a.id===aid).workflow_stage,stage)}
async function arrow(aid,next=true){await card(aid).locator('.wash-card-footer button').nth(next?1:0).click()}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS',name)}
try{
 await page.goto(`http://127.0.0.1:${port}/agenda`);await page.getByRole('heading',{name:'Serviços do dia',exact:true}).waitFor()
 await test('default is five-column board, no calendar or financial KPI clutter',async()=>{assert.equal(await page.locator('.wash-column').count(),5);assert.equal(await page.locator('.wash-calendar').count(),0);assert.equal(await page.getByRole('button',{name:'Mês',exact:true}).count(),0);assert.equal(await page.getByLabel('Data dos serviços').inputValue(),'2026-11-09');assert.equal(await card('old').count(),0);assert(!assets.some(x=>/\/(CarViewer|QuickCarViewer|pdf)-/.test(x)))})
 await page.screenshot({path:'/tmp/wash-board-desktop.png',fullPage:true})
 await test('missing services warning uses red text and the attention tag',async()=>{
  services[0].active=false
  await page.getByRole('button',{name:'Atualizar atendimentos'}).click()
  await page.waitForFunction(()=>!document.querySelector('.wash-icon-button:disabled'))
  await page.getByRole('button',{name:'Marcar lavagem',exact:true}).first().click()
  const warning=page.locator('.wash-editor .vc-attention').filter({hasText:'Cadastre um serviço ativo'})
  await warning.waitFor();assert.equal(await warning.locator('.vc-attention-tag').innerText(),'ATENÇÃO')
  assert.equal(await warning.locator('.vc-attention-content').evaluate(el=>getComputedStyle(el).color),'rgb(180, 35, 24)')
  await page.screenshot({path:'/tmp/attention-warning.png',fullPage:true})
  await page.getByRole('button',{name:'Cancelar',exact:true}).click()
  services[0].active=true
  await page.getByRole('button',{name:'Atualizar atendimentos'}).click()
  await page.waitForFunction(()=>!document.querySelector('.wash-icon-button:disabled'))
 })
 await test('customer address is required and persisted with a booking',async()=>{
  await page.getByRole('button',{name:'Marcar lavagem',exact:true}).first().click()
  assert(await page.getByRole('radio',{name:'Na loja',exact:true}).isChecked())
  assert.equal(await page.getByLabel('Endereço do cliente',{exact:true}).count(),0)
  await page.getByRole('radio',{name:'No endereço do cliente',exact:true}).check()
  await page.getByLabel('Endereço do cliente',{exact:true}).waitFor()
  await page.locator('.cx-client-trigger').click();await page.getByRole('option').first().click();await page.locator('.cx-vehicle-option').first().click()
  await page.getByRole('button',{name:/Lavagem completa/}).click()
  const old=mutations.length
  await page.getByRole('button',{name:'Marcar lavagem',exact:true}).last().click()
  await page.getByRole('alert').filter({hasText:'endereço completo'}).waitFor()
  assert.equal(mutations.length-old,0)
  assert.equal(await page.getByRole('alert').locator('.vc-attention-tag').innerText(),'ATENÇÃO')
  await page.getByLabel('Endereço do cliente',{exact:true}).fill('Rua São João, 123, Centro, Cuiabá - MT')
  await page.getByLabel('Data e horário').fill('2026-11-09T18:30')
  await page.getByRole('button',{name:'Marcar lavagem',exact:true}).last().click()
  await page.locator('.wash-editor-modal').waitFor({state:'detached'})
  const added=appointments.find(x=>x.address==='Rua São João, 123, Centro, Cuiabá - MT');assert(added)
  await card(added.id).waitFor()
  assert((await card(added.id).innerText()).includes('No endereço do cliente'))
 })
 await test('external card has correct WhatsApp and encoded Maps links without automatic requests',async()=>{
  const added=appointments.find(x=>x.address==='Rua São João, 123, Centro, Cuiabá - MT'),c=card(added.id)
  const wa=c.getByRole('link',{name:'WhatsApp',exact:true}),maps=c.getByRole('link',{name:'Ir até o cliente',exact:true})
  assert.equal(await wa.getAttribute('href'),'https://wa.me/5565999999999')
  const u=new URL(await maps.getAttribute('href'));assert.equal(u.searchParams.get('destination'),added.address);assert.equal(u.pathname,'/maps/dir/')
  assert.equal(await maps.getAttribute('target'),'_blank');assert.match(await maps.getAttribute('rel'),/noopener/)
  assert.equal(await maps.getAttribute('draggable'),'false')
  assert.equal(await card('a1').getByRole('link',{name:'Ir até o cliente',exact:true}).count(),0)
 })
 await test('editing between customer location and store does not retain a stale route',async()=>{
  const added=appointments.find(x=>x.address==='Rua São João, 123, Centro, Cuiabá - MT')
  await card(added.id).locator('.wash-car-button').click();await page.getByRole('button',{name:'Editar horário',exact:true}).click()
  assert(await page.getByRole('radio',{name:'No endereço do cliente',exact:true}).isChecked())
  assert.equal(await page.getByLabel('Endereço do cliente',{exact:true}).inputValue(),added.address)
  await page.getByRole('radio',{name:'Na loja',exact:true}).check()
  assert.equal(await page.getByLabel('Endereço do cliente',{exact:true}).count(),0)
  await page.getByRole('button',{name:'Salvar horário',exact:true}).click();await page.locator('.wash-editor-modal').waitFor({state:'detached'})
  assert.equal(added.address,'Na loja');assert.equal(await card(added.id).getByRole('link',{name:'Ir até o cliente',exact:true}).count(),0)
 })

 await test('arrows advance and return a job with persistence',async()=>{await arrow('a0');await stageIs('a0','washing');await arrow('a0',false);await stageIs('a0','scheduled')})
 await test('native drag/drop moves a car',async()=>{await page.waitForTimeout(150);await card('a0').locator('.wash-drag-handle').dragTo(column('washing'),{targetPosition:{x:40,y:90}});await stageIs('a0','washing')})
 await test('failed move restores the old column and explains error',async()=>{failNext=true;await arrow('a0');await page.getByRole('alert').filter({hasText:'concorrente'}).waitFor();await stageIs('a0','washing')})
 await test('finish and delivery remain distinct steps',async()=>{await arrow('a0');await stageIs('a0','finished');await arrow('a0');await stageIs('a0','delivered')})
 await test('going to Paid asks for receipt, cancellation makes no payment',async()=>{const n=dataset.payments.length;await arrow('a0');await page.getByRole('heading',{name:'Registrar pagamento'}).waitFor();assert.equal(dataset.payments.length,n);await page.getByRole('button',{name:'Cancelar',exact:true}).click();await stageIs('a0','delivered')})
 await test('partial then full payment updates finance and only then Paid',async()=>{await arrow('a0');await page.getByLabel('Valor recebido (R$)').fill('40,00');await page.getByRole('button',{name:'Confirmar recebimento'}).click();await stageIs('a0','delivered');await page.locator('.wash-payment-modal').waitFor({state:'detached'});await arrow('a0');await page.getByRole('button',{name:'Confirmar recebimento'}).click();await stageIs('a0','paid');assert.equal(dataset.payments.filter(p=>p.order_id==='oa0').reduce((n,p)=>n+p.amount_cents,0),10000)})
 await test('paid backward transition explicitly preserves receipts',async()=>{const n=dataset.payments.length;await arrow('a0',false);await page.getByRole('heading',{name:'Voltar uma etapa'}).waitFor();await page.getByRole('button',{name:'Confirmar retorno'}).click();await stageIs('a0','delivered');assert.equal(dataset.payments.length,n);assert.equal(await card('a0').locator('.wash-paid-badge').count(),1)})
 await test('previous-day pending work is opt-in and never removed',async()=>{await page.getByRole('button',{name:/pendência anterior/}).click();await card('old').waitFor();await page.getByRole('button',{name:/pendência anterior/}).click();assert.equal(await card('old').count(),0)})
 await test('calendar is exclusive and supports month week and day',async()=>{await page.getByRole('tab',{name:'Agenda',exact:true}).click();await page.locator('.wash-month-grid').waitFor();assert.equal(await page.locator('.wash-board').count(),0);assert.equal(await page.locator('.wash-month-cell').count(),42);await page.getByRole('button',{name:'Semana',exact:true}).click();await page.locator('.wash-time-grid.is-week').waitFor();assert.equal(await page.locator('.wash-time-day').count(),7);await page.getByRole('button',{name:'Dia',exact:true}).click();assert.equal(await page.locator('.wash-time-day').count(),1)})
 await page.screenshot({path:'/tmp/wash-calendar-desktop.png',fullPage:true})
 await test('calendar appointment opens details',async()=>{await page.locator('.wash-time-event').first().click();await page.getByRole('heading',{name:'Detalhes do atendimento'}).waitFor();await page.getByRole('button',{name:'Fechar',exact:true}).click()})
 await test('booking form uses customer avatar and vehicle picker',async()=>{await page.getByRole('button',{name:'Marcar lavagem',exact:true}).click();await page.getByRole('heading',{name:'Marcar lavagem'}).waitFor();await page.locator('.cx-client-trigger').click();await page.getByRole('option').first().click();await page.locator('.cx-vehicle-option').first().click();await page.getByRole('button',{name:/Lavagem completa/}).click();await page.getByLabel('Data e horário').fill('2026-11-09T18:00');await page.getByRole('button',{name:'Marcar lavagem',exact:true}).last().click();await page.locator('.wash-editor-modal').waitFor({state:'detached'});assert(mutations.some(x=>x.name==='create_appointment'&&x.p.p_appointment.starts_at==='2026-11-09T22:00:00.000Z'))})
 await test('mobile has no outer horizontal overflow, navigation works',async()=>{await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Serviços do dia',exact:true}).click();await page.waitForTimeout(250);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('tab',{name:'Agenda',exact:true}).click();await page.getByRole('button',{name:'Mês',exact:true}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('button',{name:'Semana',exact:true}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('tab',{name:'Serviços do dia',exact:true}).click()})
 await page.screenshot({path:'/tmp/wash-board-mobile.png',fullPage:true})
 await test('touch drag on the handle moves to the adjacent column',async()=>{
  await page.setViewportSize({width:850,height:1000});await page.locator('.wash-board-scroll').evaluate(el=>el.scrollLeft=0)
  const grip=card('a1').locator('.wash-drag-handle');await grip.scrollIntoViewIfNeeded();const start=await grip.boundingBox(),target=await column('scheduled').boundingBox()
  const cdp=await ctx.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x+10,y:start.y+10,id:1}]})
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+10+((target.x+80)-(start.x+10))*i/8,y:start.y+10,id:1}]})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await stageIs('a1','scheduled');await cdp.detach()
 })
 await test('daily board follows midnight only when on Today',async()=>{await page.clock.setSystemTime(new Date('2026-11-10T03:59:50Z'));await page.clock.runFor(30000);await page.clock.setSystemTime(new Date('2026-11-10T04:00:01Z'));await page.clock.runFor(30000);assert.equal(await page.getByLabel('Data dos serviços').inputValue(),'2026-11-10');await page.getByLabel('Data dos serviços').fill('2026-11-08');await page.clock.setSystemTime(new Date('2026-11-11T04:00:01Z'));await page.clock.runFor(30000);assert.equal(await page.getByLabel('Data dos serviços').inputValue(),'2026-11-08')})
 assert.deepEqual(errors,[])
 console.log(`${passed} browser scenarios passed; API fixtures only; no production data created.`)
}catch(error){await page.screenshot({path:'/tmp/wash-test-failure.png',fullPage:true});console.log('PAGE_TEXT',(await page.locator('body').innerText()).slice(-3000));throw error}finally{await browser.close();await new Promise(r=>server.close(r))}

