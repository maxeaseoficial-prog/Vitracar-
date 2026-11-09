// Gera public/car-thumbs/<id>.webp (foto com fundo branco) e
// src/data/car-catalog.json (catálogo + materiais da lataria + validação).
//
// Uso: node tools/car-catalog/build.mjs --assets /caminho/carros [--only id1,id2] [--jobs 3]
//   --assets: clone de github.com/pedrosoandre/carros com cars.json e assets/*.glb
//   CHROME_PATH: navegador Chrome/Chromium (padrão /usr/bin/google-chrome)
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d }
const root = path.resolve(new URL('../..', import.meta.url).pathname)
const assets = path.resolve(arg('assets', '../carros'))
const only = arg('only', '')?.split(',').filter(Boolean)
const jobs = Number(arg('jobs', 3))
const thumbs = path.join(root, 'public/car-thumbs')
const outJson = path.join(root, 'src/data/car-catalog.json')
fs.mkdirSync(thumbs, { recursive: true }); fs.mkdirSync(path.dirname(outJson), { recursive: true })

const source = JSON.parse(fs.readFileSync(path.join(assets, 'cars.json'), 'utf8')).cars
const reportPath = path.join(root, 'tools/car-catalog/report.json')
const previous = fs.existsSync(reportPath) ? Object.fromEntries(JSON.parse(fs.readFileSync(reportPath, 'utf8')).map(c => [c.id, c])) : {}
const todo = source.filter(c => !only?.length || only.includes(c.id))

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, fs: { allow: ['/'] } } })
await server.listen()
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

const results = { ...previous }
// Revisão visual das fotos: arquivos que passam nas regras automáticas mas não são um carro único e limpo.
const MANUAL_ISSUES = JSON.parse(fs.readFileSync(path.join(root, 'tools/car-catalog/manual-issues.json'), 'utf8'))
// Recoloração por textura só nos carros aprovados na revisão visual (nos outros mancha a pintura).
const TINT_APPROVED = new Set(JSON.parse(fs.readFileSync(path.join(root, 'tools/car-catalog/tint-approved.json'), 'utf8')))
let done = 0
async function openPage() {
  const page = await browser.newPage()
  await page.goto('http://localhost:5199/tools/car-catalog/index.html')
  await page.waitForFunction('window.ready === true', null, { timeout: 60000 })
  return page
}
async function worker() {
  let page = await openPage(), count = 0
  while (todo.length) {
    const car = todo.shift()
    const url = '/@fs' + path.join(assets, 'assets', car.file)
    let r
    for (let attempt = 0; attempt < 2; attempt++) {
      // Página nova a cada 20 carros (ou após falha) para não acumular memória da GPU.
      if (count++ >= 20 || attempt) { await page.close().catch(() => {}); page = await openPage(); count = 1 }
      try { r = await page.evaluate(u => window.renderCar(u), url) } catch (e) { r = { error: String(e).slice(0, 160) } }
      if (r && !r.error) break
    }
    const { photo, ...info } = r || {}
    if (photo) fs.writeFileSync(path.join(thumbs, car.id + '.webp'), Buffer.from(photo.split(',')[1], 'base64'))
    results[car.id] = { id: car.id, brand: car.brand, model: car.model, years: car.years, category: car.category,
      file: car.file, bytes: car.bytes, credit: car.credit, photo: Boolean(photo), paint: info.paint || [], tint: info.tint || null,
      paintShare: info.paintShare || 0, check: { frame: info.frame, dims: info.dims, materials: info.materials, tests: info.tests, error: info.error } }
    const issue = issueOf(results[car.id])
    done++
    if (done % 20 === 0 || only?.length) console.log(`${done} · ${car.id} · pintura ${info.paintShare ?? '-'} · ${issue || 'ok'}`)
    if (done % 50 === 0) save()
  }
  await page.close()
}
// Recusa arquivos que não são um carro completo. Proporções largas de propósito:
// só pegam motores, rodas, volantes, cenários e vários carros juntos.
function issueOf(c) {
  const { error, frame, dims: d } = c.check || {}
  if (error || !c.photo) return 'Arquivo não carregou'
  if (frame < 0.04) return 'Modelo pequeno demais ou disperso'
  const ratio = d.length / d.height, aspect = d.width / d.length
  if (ratio < 1.5 || ratio > 6 || aspect > 0.75) return 'Proporções não parecem de um carro completo'
  return null
}
function save() {
  const full = source.map(c => results[c.id]).filter(Boolean)
  for (const c of full) c.issue = (MANUAL_ISSUES[c.id] ?? issueOf(c))
  // Pintura que cobre ~100% do carro = arquivo de material único (pintaria pneus
  // e vidros junto): nesses casos a troca de cor fica desativada.
  const cars = full.map(({ check, paintShare, ...lean }) => ({ ...lean, paint: paintShare >= 0.97 ? [] : lean.paint, tint: lean.tint && TINT_APPROVED.has(lean.id) ? { materials: lean.tint.materials, base: lean.tint.base } : null }))
  fs.writeFileSync(outJson, JSON.stringify({ source: 'github.com/pedrosoandre/carros', generated: new Date().toISOString().slice(0, 10), cars }))
  fs.writeFileSync(path.join(root, 'tools/car-catalog/report.json'), JSON.stringify(full, null, 1))
}
await Promise.all(Array.from({ length: jobs }, worker))
save()
await browser.close(); await server.close()
const list = Object.values(results)
console.log(`Concluído: ${list.length} carros · ${list.filter(c => !c.issue).length} válidos · ${list.filter(c => !c.issue && (c.paint.length && c.paintShare < 0.97 || (c.tint && TINT_APPROVED.has(c.id)))).length} com troca de cor`)
