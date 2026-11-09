// Lista os materiais de um carro do catálogo: node tools/car-catalog/inspect.mjs <id> (assets em /tmp/carros)
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
const server = await createServer({ root: '/home/claude/vitracar-', logLevel: 'error', server: { port: 5198, fs: { allow: ['/'] } } })
await server.listen()
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const pg = await b.newPage()
await pg.goto('http://localhost:5198/tools/car-catalog/index.html'); await pg.waitForFunction('window.ready===true')
const res = [await pg.evaluate(([u,s]) => window.paintPreview(u,s), ['/@fs/tmp/carros/assets/' + process.argv[2] + '.glb', JSON.parse(process.argv[3])])]; (await import('node:fs')).writeFileSync('/tmp/prev.png', Buffer.from(res[0].split(',')[1],'base64'))
console.log('ok')
await b.close(); await server.close()
