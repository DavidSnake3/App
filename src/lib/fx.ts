// Efectos visuales: confeti, lluvia de billetes y vibración (puntos 20, 22, 25)
import confetti from 'canvas-confetti'
import type { AnimationPrefs } from '../types/finance'
import { playCash, playPaid, playSuccess } from './sound'

// Billete: rectángulo redondeado dibujado como path (sin emojis)
const BILL = confetti.shapeFromPath({
  path: 'M0 6 Q0 0 6 0 L34 0 Q40 0 40 6 L40 18 Q40 24 34 24 L6 24 Q0 24 0 18 Z M20 5 A7 7 0 1 0 20 19 A7 7 0 1 0 20 5',
})

const COIN = confetti.shapeFromPath({
  path: 'M12 0 A12 12 0 1 0 12 24 A12 12 0 1 0 12 0',
})

function reduced(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function accent(): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim() || '#7c5cff'
  } catch {
    return '#7c5cff'
  }
}

export function vibrate(pattern: number | number[], prefs: AnimationPrefs) {
  if (!prefs.haptics) return
  try { navigator.vibrate?.(pattern) } catch { /* no soportado */ }
}

/** Confeti que sale del botón al marcar un pago (punto 20) */
export function payBurst(el: HTMLElement | null, prefs: AnimationPrefs) {
  if (prefs.sounds) (prefs.cash ? playCash : playPaid)()
  vibrate(35, prefs)
  if (reduced()) return

  let x = 0.5, y = 0.6
  if (el) {
    const r = el.getBoundingClientRect()
    x = (r.left + r.width / 2) / window.innerWidth
    y = (r.top + r.height / 2) / window.innerHeight
  }

  if (prefs.confetti) {
    void confetti({
      particleCount: 42,
      spread: 65,
      startVelocity: 28,
      scalar: 0.8,
      ticks: 130,
      origin: { x, y },
      colors: [accent(), '#2dd4a0', '#ffd166', '#ffffff'],
      disableForReducedMotion: true,
    })
  }
  if (prefs.cash) {
    void confetti({
      particleCount: 14,
      spread: 50,
      startVelocity: 24,
      gravity: 0.85,
      scalar: 1.15,
      ticks: 160,
      origin: { x, y },
      shapes: [BILL, COIN],
      colors: ['#2dd4a0', '#1baf7a', '#ffd166'],
      disableForReducedMotion: true,
    })
  }
}

/** Celebración al completar todos los pagos del mes (punto 22) */
export function celebrate(prefs: AnimationPrefs) {
  if (prefs.sounds) playSuccess()
  vibrate([60, 40, 60, 40, 120], prefs)
  if (reduced() || !prefs.celebration) return

  const end = Date.now() + 1600
  const colors = [accent(), '#2dd4a0', '#ffd166', '#ff7ab8', '#ffffff']

  const frame = () => {
    void confetti({
      particleCount: 5, angle: 60, spread: 60, startVelocity: 45,
      origin: { x: 0, y: 0.75 }, colors, disableForReducedMotion: true,
    })
    void confetti({
      particleCount: 5, angle: 120, spread: 60, startVelocity: 45,
      origin: { x: 1, y: 0.75 }, colors, disableForReducedMotion: true,
    })
    if (prefs.cash) {
      void confetti({
        particleCount: 2, spread: 90, startVelocity: 32, gravity: 0.8,
        scalar: 1.2, shapes: [BILL], origin: { x: Math.random(), y: -0.05 },
        colors: ['#2dd4a0', '#1baf7a'], disableForReducedMotion: true,
      })
    }
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}
