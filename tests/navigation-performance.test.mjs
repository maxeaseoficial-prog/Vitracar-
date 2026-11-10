// Local, isolated production-build benchmark. Never calls the live database.
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium } from 'playwright-core'
const root=path.resolve(process.env.PERF_DIST || 'dist')
const port=Number(process.env.PERF_PORT||4173)
const reportPath=process.env.PERF_REPORT||'/tmp/navigation-report.json'
const userId='11111111-1111-4111-8111-111111111111',companyId='22222222-2222-4222-8222-222222222222'
const now=new Date().toISOString()
const user={id:userId,email:'qa@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:now}
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url')
const token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:userId,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test-only'
const session={access_token:token,refresh_token:'test-only',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}
const company={id:companyId,name:'VitraCar QA',timezone:'America/Sao_Paulo',phone:null,email:null,address:null,tax_id:null,logo_url:null}
const profile={id:userId,company_id:companyId,name:'QA',role:'admin'}
const client={id:'qa-client',company_id:companyId,name:'Cliente QA',whatsapp:'65999999999',photo_path:null,avatar_kind:'male',notes:null,birth_date:null,created_at:now}
const vehicle={id:'qa-vehicle',company_id:companyId,client_id:client.id,plate:'ABC1D23',brand:'Teste',model:'Sedã QA',category:'sedan',color:'Prata',year:2024,upholstery:'Tecido',model_3d_id:null,notes:null,created_at:now}
const service={id:'qa-service',company_id:companyId,name:'Lavagem QA',description:'Teste isolado',price_cents:12000,duration_minutes:60,coins:10,active:true,created_at:now}
const quote={id:'qa-quote',company_id:companyId,client_id:client.id,vehicle_id:vehicle.id,quote_number:1,status:'draft',discount_cents:0,notes:null,created_at:now}
const dataset={clients:[client],vehicles:[vehicle],services:[service],quotes:[quote],quote_items:[{id:'qa-item',company_id:companyId,quote_id:quote.id,service_id:service.id,description:'Lavagem QA',quantity:1,unit_cents:12000}]}
const cache=new Map()
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');const rel=decodeURIComponent(url.pathname);let file=path.join(root,rel)
 if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html')
 let item=cache.get(file)
 if(!item){const data=fs.readFileSync(file);const ext=path.extname(file);item={body:gzipSync(data),mime:({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'})[ext]||'application/octet-stream'};cache.set(file,item)}
 res.writeHead(200,{'Content-Type':item.mime,'Content-Encoding':'gzip','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=31536000, immutable'});res.end(item.body)
})
await new Promise(r=>server.listen(port,'127.0.0.1',r))
const browser=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']})
const runs=[]
try{
 for(let run=0;run<(process.env.PERF_FUNCTIONAL?'1':3);run++){
  const context=await browser.newContext({viewport:{width:1440,height:950}})
  await context.addInitScript(s=>localStorage.setItem('sb-perf-test-auth-token',JSON.stringify(s)),session)
  const page=await context.newPage(),errors=[],rest=[],assets=[]
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/assets/'))assets.push(r.url())})
  await page.route('https://perf-test.invalid/**',async route=>{
   const u=new URL(route.request().url());let body
   await new Promise(r=>setTimeout(r,100))
   if(u.pathname==='/auth/v1/user')body=user
   else if(u.pathname==='/auth/v1/token')body=session
   else if(u.pathname.startsWith('/rest/v1/')){
    const table=u.pathname.split('/').pop();rest.push(table)
    body=table==='profiles'?profile:table==='company_settings'?company:dataset[table]||[]
   }else throw Error('Unexpected test network request: '+u.pathname)
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
  })
  const cdp=await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:250000,uploadThroughput:100000})
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
  const start=performance.now()
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.locator('main h1').waitFor({timeout:30000})
  const initialMs=Math.round(performance.now()-start)
  const times={}
  for(const [url,label] of [['/clientes','Clientes e veículos'],['/orcamentos','Orçamentos'],['/servicos','Serviços'],['/agenda','Agenda'],['/financeiro','Financeiro'],['/fidelidade','Fidelidade'],['/clientes','Clientes e veículos']]){
   const prev=await page.locator('main h1').textContent(),t=performance.now()
   await page.getByRole('navigation',{name:'Menu principal'}).getByRole('link',{name:label,exact:true}).click()
   await page.waitForFunction(({url,prev})=>location.pathname===url&&!!document.querySelector('main h1')&&document.querySelector('main h1').textContent!==prev,{url,prev},{timeout:30000})
   times[url+(times[url]?'_warm':'')]=Math.round(performance.now()-t)
  }
  if(process.env.PERF_FUNCTIONAL){
    assert(!assets.some(url=>/\/(CarViewer|QuickCarViewer|VehicleStudioForm|pdf)-/.test(url)),'Optional 3D/PDF downloaded before use')
    await page.getByRole('button',{name:'Novo cliente',exact:true}).click()
    await page.getByLabel('Nome completo').fill('Rascunho preservado')
    const beforeRefresh=rest.length
    for(const event of ['SIGNED_IN','TOKEN_REFRESHED']){
      await page.evaluate(({event,session})=>{const channel=new BroadcastChannel('sb-perf-test-auth-token');channel.postMessage({event,session});setTimeout(()=>channel.close(),100)},{event,session})
      await page.waitForTimeout(500)
      assert.equal(await page.getByLabel('Nome completo').inputValue(),'Rascunho preservado')
    }
    assert.deepEqual(rest.slice(beforeRefresh),['profiles'],'Token refresh should recheck only permissions, not reload all data')
    await page.getByRole('button',{name:'Cancelar',exact:true}).click()
    console.log('PASS same-user auth events keep the form and data mounted; permissions still refresh')
    await page.getByRole('button',{name:'Ver perfil',exact:true}).click()
    await page.getByRole('button',{name:'Adicionar veículo',exact:true}).click()
    await page.getByRole('button',{name:'Cadastrar sem modelo 3D'}).waitFor()
    assert(assets.some(url=>/VehicleStudioForm-/.test(url)))
    await page.getByRole('button',{name:'Cadastrar sem modelo 3D'}).click()
    await page.waitForFunction(()=>document.querySelector('.viewer-quick canvas')||document.querySelector('.viewer-quick .viewer-fallback'))
    assert(assets.some(url=>/QuickCarViewer-/.test(url)))
    await page.getByRole('button',{name:'Cancelar',exact:true}).click()
    console.log('PASS vehicle form and 3D viewer load only when opened')
    await page.getByRole('navigation',{name:'Menu principal'}).getByRole('link',{name:'Orçamentos',exact:true}).click()
    await page.getByRole('button',{name:'Ver PDF',exact:true}).click()
    await page.locator('iframe[title="Documento PDF do orçamento"]').waitFor({timeout:30000})
    assert(assets.some(url=>/\/pdf-/.test(url)))
    assert((await page.locator('iframe[title="Documento PDF do orçamento"]').getAttribute('src')).startsWith('blob:'))
    await page.getByRole('button',{name:'Fechar prévia',exact:true}).click()
    const downloadPromise=page.waitForEvent('download')
    await page.getByRole('button',{name:/Baixar PDF do orçamento/}).click()
    const download=await downloadPromise
    assert(download.suggestedFilename().endsWith('.pdf'));assert.equal(await download.failure(),null)
    console.log('PASS PDF preview and download are generated on demand')
    await page.setViewportSize({width:390,height:844})
    await page.getByRole('button',{name:'Abrir menu'}).click()
    await page.getByRole('navigation',{name:'Menu principal'}).getByRole('link',{name:'Agenda',exact:true}).click()
    await page.waitForFunction(()=>location.pathname==='/agenda'&&!!document.querySelector('main h1'))
    assert(await page.locator('.sidebar-brand-image').getAttribute('src'))
    await page.getByRole('heading',{name:'Agenda de serviços',exact:true}).waitFor()
    await page.waitForTimeout(300)
    console.log('MOBILE_GEOMETRY',JSON.stringify(await page.evaluate(()=>({viewport:window.innerWidth,width:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>window.innerWidth+1).slice(0,5).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right}))}))))
    console.log('PASS mobile navigation and official logo preserved')
    // Simulate a sign-out from another tab. Prior customer data must disappear.
    await page.evaluate(()=>{localStorage.removeItem('sb-perf-test-auth-token');const c=new BroadcastChannel('sb-perf-test-auth-token');c.postMessage({event:'SIGNED_OUT',session:null});setTimeout(()=>c.close(),100)})
    await page.getByRole('heading',{name:'Bem-vindo de volta'}).waitFor()
    assert.equal(await page.locator('.sidebar').count(),0)
    assert.equal(errors.length,0,errors.join('\n'))
    console.log('PASS logout unmounts private workspace; no JavaScript errors')
    await context.close();continue
  }
  const queriesBefore=rest.length
  // Reproduces SIGNED_IN from an already authenticated tab; no new credentials.
  await page.evaluate(s=>{const c=new BroadcastChannel('sb-perf-test-auth-token');c.postMessage({event:'SIGNED_IN',session:s});setTimeout(()=>c.close(),200)},session)
  await page.waitForTimeout(1800)
  const duplicateQueries=rest.length-queriesBefore
  assert.equal(errors.length,0,errors.join('\n'))
  const output={initialMs,times,initialQueries:queriesBefore,duplicateQueries,assets:[...new Set(assets)].map(u=>new URL(u).pathname)}
  runs.push(output);console.log(JSON.stringify({run:run+1,...output,assets:output.assets.length}))
  await context.close()
 }
 fs.writeFileSync(reportPath,JSON.stringify({conditions:'local production build, 250 KB/s, 80ms network, 4x CPU slowdown, 100ms mocked database, 3 cold browser sessions',runs},null,2))
 console.log('REPORT',reportPath)
}finally{await browser.close();server.close()}
