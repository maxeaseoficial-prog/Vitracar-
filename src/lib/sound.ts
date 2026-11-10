/** Som de dinheiro tocado quando um pagamento é confirmado na Agenda. */
const SRC = '/sounds/dinheiro.mp3'
let audio: HTMLAudioElement | null = null
let armed = false

function element() {
  if (typeof Audio === 'undefined') return null
  if (!audio) { audio = new Audio(SRC); audio.preload = 'auto'; audio.volume = 0.8 }
  return audio
}

/** Navegadores de celular só liberam áudio depois de um toque. Destrava no primeiro toque na tela. */
export function armSound() {
  if (armed || typeof window === 'undefined') return
  armed = true
  const unlock = () => {
    const a = element()
    if (a) { a.muted = true; void a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false }).catch(() => { a.muted = false }) }
  }
  window.addEventListener('pointerdown', unlock, { once: true })
}

export function playMoneySound() {
  const a = element()
  if (!a) return
  try { a.muted = false; a.currentTime = 0; void a.play().catch(() => undefined) } catch { /* som é opcional */ }
}
