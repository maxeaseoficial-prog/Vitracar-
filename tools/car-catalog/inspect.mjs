// Lista os materiais de um carro do catálogo: node tools/car-catalog/inspect.mjs <id> (assets em /tmp/carros)
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
const server = await createServer({ root: '/home/claude/vitracar-', logLevel: 'error', server: { port: 5198, fs: { allow: ['/'] } } })
await server.listen()
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const pg = await b.newPage()
await pg.goto('http://localhost:5198/tools/car-catalog/index.html'); await pg.waitForFunction('window.ready===true')
const res = await pg.evaluate(u => window.inspectCar(u), '/@fs/tmp/carros/assets/' + process.argv[2] + '.glb')
console.log(res.join('\n'))
await b.close(); await server.close()
