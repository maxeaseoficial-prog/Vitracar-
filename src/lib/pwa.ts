/** Instalação do Lavoo como app (PWA). O evento de instalação do Android/Chrome pode disparar
 *  antes da página /download abrir, então ele é capturado aqui, logo no carregamento do app. */
type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string }
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<InstallChoice> }

let deferred: InstallEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault() // guarda para abrir só quando a pessoa clicar em "Instalar"
    deferred = event as InstallEvent
    emit()
  })
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; emit() })
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => { /* app segue normal sem SW */ }) })
}

export function isStandalone(): boolean {
  if (installed) return true
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export type Platform = 'ios' | 'android' | 'desktop'
export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}
/** No iPhone, só o Safari mostra o caminho "Adicionar à Tela de Início" de forma confiável. */
export function isIosSafari(): boolean {
  return !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(navigator.userAgent)
}

export const canPromptInstall = (): boolean => deferred !== null

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred
  if (!event) return 'unavailable'
  deferred = null // o navegador só deixa usar o evento uma vez
  emit()
  await event.prompt()
  const { outcome } = await event.userChoice
  if (outcome === 'accepted') installed = true
  emit()
  return outcome
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
