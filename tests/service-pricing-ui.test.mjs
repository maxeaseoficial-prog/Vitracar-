// Production build + mocked Supabase. Does not use real accounts or modify hosted data.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {chromium} from 'playwright-core'
const root=path.resolve('dist'),port=4187
const server=http.createServer((req,res)=>{let file=path.join(root,new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file))})
await new Promise(r=>server.listen(port,'127.0.0.1',r))
const browser=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']})
const id='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222',now=new Date().toISOString()
const user={id,email:'qa@example.invalid',aud:'authenticated',role:'authenticated',created_at:now,user_metadata:{},app_metadata:{provider:'email'}}
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),exp=Math.floor(Date.now()/1000)+86400
const token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,role:'authenticated',exp})+'.test-only'
const session={access_token:token,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer',user}
const company={id:cid,name:'VitraCar QA',timezone:'America/Sao_Paulo',address:'Rua da Base, 1'},profile={id,company_id:cid,name:'QA',role:'admin'}
const existing={id:'existing',company_id:cid,name:'Lavagem original',description:'Descrição preservada',price_cents:10000,duration_minutes:45,coins:40,active:false,created_at:now}
const services=[existing],writes=[],errors=[],network=[];let losePost=false
const context=await browser.newContext({viewport:{width:1512,height:982}})
await context.addInitScript(s=>localStorage.setItem('sb-perf-test-auth-token',JSON.stringify(s)),session)
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>network.push(r.url()))
await page.route('https://perf-test.invalid/**',async route=>{
 const req=route.request(),u=new URL(req.url()),name=u.pathname.split('/').at(-1);let body=[]
 if(u.pathname==='/auth/v1/user')body=user
 else if(u.pathname==='/auth/v1/token')body=session
 else if(u.pathname.startsWith('/rest/v1/')){
  if(name==='profiles')body=profile
  else if(name==='company_settings')body=company
  else if(name==='services'){
   const sid=u.searchParams.get('id')?.replace('eq.',''),old=u.searchParams.get('price_cents')?.replace('eq.','')
   if(req.method()==='POST'){
    const row=req.postDataJSON();assert.equal(row.company_id,cid);assert(!services.some(s=>s.id===row.id));writes.push({method:'POST',row:{...row}});body={...row,created_at:now};services.push(body)
    if(losePost){losePost=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Resposta perdida de teste'})})}
   }else if(req.method()==='PATCH'){
    assert.equal(u.searchParams.get('company_id'),'eq.'+cid)
    const row=services.find(s=>s.id===sid&&s.price_cents===Number(old)),changes=req.postDataJSON()
    assert.deepEqual(Object.keys(changes),['price_cents'])
    if(row){Object.assign(row,changes);writes.push({method:'PATCH',id:sid,changes});body=row}else body=null
   }else{body=sid?services.filter(s=>s.id===sid):services}
  }
 }else throw new Error('Unexpected mocked endpoint: '+u.pathname)
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
})
let count=0;async function test(name,fn){await fn();count++;console.log('PASS',name)}
const field=label=>page.getByLabel(label,{exact:true})
const button=name=>page.getByRole('button',{name,exact:true})
const compute=async()=>{await button('Calcular preço do serviço').click();await page.waitForTimeout(100)}
const suggestion=async()=>await page.locator('.pc-main-price strong').textContent()
const textPrice=(text,value)=>assert.equal(text.replace(/\s/g,''),value.replace(/\s/g,''))
try{
 await page.goto(`http://127.0.0.1:${port}/`);await page.locator('main h1').waitFor()
 await test('sidebar has calculator after Services and route opens',async()=>{const names=await page.getByRole('navigation',{name:'Menu principal'}).getByRole('link').allTextContents();assert.equal(names[names.indexOf('Serviços')+1],'Calcular preço');await page.getByRole('link',{name:'Calcular preço',exact:true}).click();await page.getByRole('heading',{name:'Calcular preço',exact:true}).waitFor();assert(page.url().endsWith('/calcular-preco'))})
 await test('empty form gives red ATENÇÃO without saving',async()=>{await compute();await page.getByRole('alert').filter({hasText:'ATENÇÃO'}).waitFor();assert.equal(writes.length,0)})
 await test('store wage cost and 25 percent margin give correct price',async()=>{await field('Nome do serviço').fill('Lavagem calculada QA');await field('Descrição do serviço').fill('Descrição pública de lavagem');await field('Duração do serviço (min)').fill('60');await field('Custo por hora por profissional (R$)').fill('60');await field('Margem de resultado desejada (%)').fill('25');await field('Impostos sobre a venda (%)').fill('0');await compute();textPrice(await suggestion(),'R$ 80,00');assert.equal(writes.length,0)})
 await test('dilution adds only consumed concentrate',async()=>{await field('Adicionar produto comum').selectOption('Shampoo automotivo');await field('Quantidade da embalagem 1 (l)').fill('1');await field('Preço da embalagem 1 (R$)').fill('100');await page.getByLabel('Uso diluído — informar volume da mistura pronta').check();await field('Consumo da mistura 1 (ml)').fill('110');await field('Partes de água para 1 de produto 1').fill('10');await compute();textPrice(await suggestion(),'R$ 81,34')})
 await page.screenshot({path:'/tmp/price-calculator-desktop.png',fullPage:true})
 await test('external round trip includes fuel wear and paid travel time',async()=>{await button('No endereço do cliente Deslocamento e estrutura móvel.').click();await field('Distância de ida (km)').fill('10');await field('Combustível (R$/L)').fill('6');await field('Consumo do veículo (km/L)').fill('10');await field('Tempo total da viagem (min)').fill('30');await field('Manutenção e desgaste (R$/km)').fill('0,5');await field('Pedágios totais (R$)').fill('5');await field('Estacionamento (R$)').fill('3');await compute();textPrice(await suggestion(),'R$ 161,34')})
 await test('Maps destination is encoded and never fetched automatically',async()=>{await field('Destino para consultar a rota').fill('Rua São João, 20 & esquina');const url=new URL(await page.getByRole('link',{name:/Consultar distância no Maps/}).getAttribute('href'));assert.equal(url.searchParams.get('destination'),'Rua São João, 20 & esquina');assert.equal(url.searchParams.get('origin'),'Rua da Base, 1');assert(!network.some(n=>n.includes('google.com/maps')))})
 await test('switching to store drops travel without deleting inputs',async()=>{await button('Na loja Estrutura, água, energia e operação.').click();await compute();textPrice(await suggestion(),'R$ 81,34');assert.equal(await field('Distância de ida (km)').count(),0)})
 await test('invalid sum of fees and margin blocks result',async()=>{await field('Margem de resultado desejada (%)').fill('90');await field('Taxa de recebimento (%)').fill('10');await compute();await page.getByRole('alert').filter({hasText:'menor que 100%'}).waitFor();assert.equal(await button('Criar serviço').count(),0);await field('Margem de resultado desejada (%)').fill('25');await field('Taxa de recebimento (%)').fill('0');await compute()})
 await test('creating a service requires explicit confirmation and uses the real catalog payload',async()=>{await button('Criar serviço').click();assert.equal(writes.length,0);await field('Moedas de fidelidade do novo serviço').fill('12');await button('Confirmar criação').click();await page.getByRole('status').filter({hasText:'Serviço criado:'}).waitFor();assert.equal(writes.length,1);const row=services.find(s=>s.name==='Lavagem calculada QA');assert.equal(row.price_cents,8134);assert.equal(row.duration_minutes,60);assert.equal(row.coins,12);assert.equal(row.active,true);assert.equal(row.description,'Descrição pública de lavagem');assert(!row.description.includes('custo'))})
 await test('apply confirmation can be cancelled without any write',async()=>{await field('Preço que vou cobrar (R$)').fill('90');await field('Serviço para atualizar').selectOption('existing');await button('Aplicar ao serviço selecionado').click();const before=writes.length;await button('Cancelar').click();assert.equal(writes.length,before)})
 await test('applying changes only price and preserves other catalog fields',async()=>{await button('Aplicar ao serviço selecionado').click();await button('Confirmar novo preço').click();await page.getByRole('status').filter({hasText:'Preço atualizado:'}).waitFor();assert.equal(existing.price_cents,9000);assert.equal(existing.name,'Lavagem original');assert.equal(existing.description,'Descrição preservada');assert.equal(existing.coins,40);assert.equal(existing.duration_minutes,45);assert.equal(existing.active,false)})
 await test('concurrent price change is not silently overwritten',async()=>{await field('Preço que vou cobrar (R$)').fill('95');await button('Aplicar ao serviço selecionado').click();existing.price_cents=9300;const n=writes.length;await button('Confirmar novo preço').click();await page.getByRole('alert').filter({hasText:'outra sessão'}).waitFor();assert.equal(writes.length,n);assert.equal(existing.price_cents,9300);await button('Cancelar').click()})
 await test('loss-making price requires separate acknowledgement',async()=>{await field('Preço que vou cobrar (R$)').fill('1');await button('Aplicar ao serviço selecionado').click();assert(await button('Confirmar novo preço').isDisabled());await page.getByLabel('Entendo que o preço não cobre os custos informados.').check();assert(!(await button('Confirmar novo preço').isDisabled()));await button('Cancelar').click();await field('Preço que vou cobrar (R$)').fill('')})
 await test('calculation memory downloads as text',async()=>{const pending=page.waitForEvent('download');await button('Baixar memória do cálculo').click();const download=await pending;assert(download.suggestedFilename().endsWith('.txt'));assert.equal(await download.failure(),null)})
 await test('lost create response can be retried without duplicate insert',async()=>{await field('Nome do serviço').fill('Lavagem retry QA');await compute();await button('Criar serviço').click();losePost=true;const n=writes.filter(w=>w.method==='POST').length;await button('Confirmar criação').click();await page.getByRole('alert').filter({hasText:'Resposta perdida'}).waitFor();await button('Confirmar criação').click();await page.getByRole('status').filter({hasText:'Serviço criado: Lavagem retry QA'}).waitFor();assert.equal(writes.filter(w=>w.method==='POST').length,n+1);assert.equal(services.filter(s=>s.name==='Lavagem retry QA').length,1)})
 await test('mobile layout has no outer overflow and navigation is intact',async()=>{await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'/tmp/price-calculator-mobile.png',fullPage:true});await button('Abrir menu').click();await page.getByRole('navigation',{name:'Menu principal'}).getByRole('link',{name:'Agenda',exact:true}).click();await page.getByRole('heading',{name:'Serviços do dia'}).waitFor()})
 assert.deepEqual(errors,[])
 assert(!network.some(n=>n.includes('bgwpymtqmblntqqzxxms.supabase.co')))
 console.log(`${count} pricing browser scenarios passed. Mock API only; no production writes.`)
}catch(error){await page.screenshot({path:'/tmp/price-ui-failure.png',fullPage:true});console.log('PAGE_TAIL',(await page.locator('body').innerText()).slice(-2000));throw error}finally{await browser.close();await new Promise(r=>server.close(r))}
