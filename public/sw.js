/* Service worker do Lavoo (PWA).
 * Propositalmente mínimo: NÃO guarda dados de clientes, sessões nem respostas do banco.
 * Serve apenas para o app ser instalável e mostrar um aviso se abrir sem internet. */
const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Lavoo | Sem conexão</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0D12;color:#fff;
font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px}
h1{font-size:22px;margin:0 0 8px}p{color:#9aa3b2;margin:0 0 24px;line-height:1.5}
button{background:#B9FC01;color:#0B0D12;border:0;border-radius:12px;padding:14px 22px;font-size:15px;font-weight:700}</style></head>
<body><main><h1>Sem conexão</h1><p>Não foi possível abrir o Lavoo agora.<br>Confira sua internet e tente novamente.</p>
<button onclick="location.reload()">Tentar novamente</button></main></body></html>`

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key) // limpa qualquer cache antigo
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || request.mode !== 'navigate') return // só páginas; o resto vai direto à rede
  event.respondWith(
    fetch(request).catch(() => new Response(OFFLINE_HTML, {
      status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    }))
  )
})
