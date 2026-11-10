/** Only code is cached here; never customer data, credentials or session tokens. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined
  return () => pending ??= load().catch(error => { pending = undefined; throw error })
}
export const loadDashboard = once(() => import('../pages/Dashboard'))
export const loadClients = once(() => import('../pages/Clients'))
export const loadServices = once(() => import('../pages/Services'))
export const loadQuotes = once(() => import('../pages/Quotes'))
export const loadAgenda = once(() => import('../pages/Agenda'))
export const loadFinance = once(() => import('../pages/Finance'))
export const loadLoyalty = once(() => import('../pages/Loyalty'))
export const loadSettings = once(() => import('../pages/Settings'))
const routes: Record<string, () => Promise<unknown>> = {
  '/': loadDashboard, '/agenda': loadAgenda, '/clientes': loadClients,
  '/servicos': loadServices, '/orcamentos': loadQuotes,
  '/financeiro': loadFinance, '/fidelidade': loadLoyalty, '/configuracoes': loadSettings,
}
function economicalConnection() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')
}
export function preloadRoute(pathname: string): void {
  if (economicalConnection()) return
  const load = routes[pathname] || (pathname.startsWith('/clientes/') || pathname.startsWith('/veiculos/') ? loadClients : undefined)
  if (load) void load().catch(() => { /* Navigation remains usable when a prefetch fails. */ })
}
/** Sequential idle prefetch after the shell mounts. Heavy optional features stay deferred. */
export function warmNavigation(currentPath: string): () => void {
  if (economicalConnection()) return () => {}
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let idle: number | undefined
  const pending = Object.keys(routes).filter(path => path !== currentPath && path !== '/configuracoes')
  const schedule = () => {
    if (cancelled || !pending.length) return
    timer = setTimeout(() => {
      if (cancelled) return
      if (document.visibilityState === 'hidden') { schedule(); return }
      const run = () => {
        if (cancelled) return
        const next = pending.shift()!
        void routes[next]().catch(() => {}).finally(schedule)
      }
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(run, { timeout: 2000 })
      else run()
    }, 500)
  }
  schedule()
  return () => { cancelled = true; if (timer) clearTimeout(timer); if (idle !== undefined) window.cancelIdleCallback(idle) }
}
