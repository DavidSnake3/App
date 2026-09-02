// Sonidos sintetizados con WebAudio — sin archivos de audio (punto 20)

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = 'sine',
  gain = 0.12,
) {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ac.currentTime + start)
  g.gain.setValueAtTime(0.0001, ac.currentTime + start)
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(ac.currentTime + start)
  osc.stop(ac.currentTime + start + dur + 0.05)
}

/** Ding suave al marcar pagado */
export function playPaid() {
  const ac = audio(); if (!ac) return
  tone(ac, 880, 0, 0.12, 'sine', 0.10)
  tone(ac, 1318.5, 0.07, 0.22, 'sine', 0.12)
}

/** "Cha-ching" de caja registradora */
export function playCash() {
  const ac = audio(); if (!ac) return
  tone(ac, 987.8, 0, 0.08, 'square', 0.05)
  tone(ac, 1318.5, 0.06, 0.09, 'square', 0.05)
  tone(ac, 1567.98, 0.12, 0.28, 'triangle', 0.12)
  tone(ac, 2093, 0.12, 0.28, 'sine', 0.08)
}

/** Fanfarria corta de éxito (mes completado, punto 22) */
export function playSuccess() {
  const ac = audio(); if (!ac) return
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((n, i) => tone(ac, n, i * 0.09, 0.35, 'triangle', 0.11))
  tone(ac, 1318.5, 0.4, 0.5, 'sine', 0.09)
}

/** Tap sutil para interacciones */
export function playTap() {
  const ac = audio(); if (!ac) return
  tone(ac, 1200, 0, 0.04, 'sine', 0.04)
}

/** Monedas cayendo (variante de sonido de pago) */
export function playCoins() {
  const ac = audio(); if (!ac) return
  const freqs = [2093, 1760, 2349, 1976, 2637]
  freqs.forEach((f, i) => tone(ac, f, i * 0.07, 0.1, 'triangle', 0.09))
  tone(ac, 1046.5, 0.4, 0.3, 'sine', 0.07)
}

/** Soplido corto al abrir una hoja o cambiar de pantalla */
export function playSwoosh() {
  const ac = audio()
  if (!ac) return
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(220, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.14)
  g.gain.setValueAtTime(0.0001, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18)
  osc.connect(g).connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.22)
}

/** "Pop" al agregar o marcar un producto */
export function playPop() {
  const ac = audio()
  if (!ac) return
  tone(ac, 660, 0, 0.06, 'triangle', 0.09)
  tone(ac, 990, 0.03, 0.07, 'sine', 0.06)
}

/** Tic seco al desmarcar o quitar algo */
export function playTick() {
  const ac = audio()
  if (!ac) return
  tone(ac, 330, 0, 0.05, 'square', 0.04)
}

/** Campana de logro: tres notas que suben, con cola */
export function playCampana() {
  const ac = audio(); if (!ac) return
  tone(ac, 1046.5, 0, 0.5, 'sine', 0.11)
  tone(ac, 1567.98, 0.05, 0.6, 'sine', 0.07)
  tone(ac, 2093, 0.12, 0.7, 'sine', 0.05)
}

/** Burbuja: un "blup" redondo y satisfactorio */
export function playBurbuja() {
  const ac = audio(); if (!ac) return
  const osc = ac.createOscillator(); const g = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(420, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1400, ac.currentTime + 0.09)
  g.gain.setValueAtTime(0.0001, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.13, ac.currentTime + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.16)
  osc.connect(g).connect(ac.destination)
  osc.start(); osc.stop(ac.currentTime + 0.2)
}

/** Arpa: cinco notas rápidas, como pasar el dedo por las cuerdas */
export function playArpa() {
  const ac = audio(); if (!ac) return
  const notas = [523.25, 659.25, 783.99, 1046.5, 1318.5]
  notas.forEach((n, i) => tone(ac, n, i * 0.045, 0.4, 'sine', 0.075))
}

/** Marimba: cálido y muy tico */
export function playMarimba() {
  const ac = audio(); if (!ac) return
  tone(ac, 659.25, 0, 0.22, 'triangle', 0.12)
  tone(ac, 987.77, 0.06, 0.26, 'triangle', 0.10)
  tone(ac, 1318.5, 0.12, 0.34, 'sine', 0.08)
}

/** Videojuego: la moneda clásica de dos tonos */
export function playArcade() {
  const ac = audio(); if (!ac) return
  tone(ac, 987.77, 0, 0.07, 'square', 0.09)
  tone(ac, 1318.5, 0.07, 0.28, 'square', 0.09)
}

/** Silencio: para quien quiere el confeti pero sin ruido */
function playNada() { /* a propósito, no suena */ }

export type PaySoundId =
  | 'ding' | 'caja' | 'monedas' | 'campana' | 'burbuja' | 'arpa'
  | 'marimba' | 'arcade' | 'exito' | 'ninguno'

export const PAY_SOUNDS: { id: PaySoundId; label: string; play: () => void }[] = [
  { id: 'caja', label: 'Cha-ching (caja)', play: playCash },
  { id: 'ding', label: 'Ding suave', play: playPaid },
  { id: 'monedas', label: 'Monedas', play: playCoins },
  { id: 'campana', label: 'Campana', play: playCampana },
  { id: 'burbuja', label: 'Burbuja', play: playBurbuja },
  { id: 'arpa', label: 'Arpa', play: playArpa },
  { id: 'marimba', label: 'Marimba', play: playMarimba },
  { id: 'arcade', label: 'Videojuego', play: playArcade },
  { id: 'exito', label: 'Fanfarria', play: playSuccess },
  { id: 'ninguno', label: 'Sin sonido', play: playNada },
]

export function playPayFx(id: PaySoundId) {
  ;(PAY_SOUNDS.find((s) => s.id === id) ?? PAY_SOUNDS[0]).play()
}

// ─── Alarmas (3 estilos a elegir, mejora 11) ─────────────────────────────────

let alarmTimer: ReturnType<typeof setInterval> | null = null

function beepClasica() {
  const ac = audio(); if (!ac) return
  tone(ac, 880, 0, 0.18, 'square', 0.16)
  tone(ac, 660, 0.22, 0.18, 'square', 0.16)
  tone(ac, 880, 0.44, 0.18, 'square', 0.16)
}

function beepDigital() {
  const ac = audio(); if (!ac) return
  for (let i = 0; i < 4; i++) tone(ac, 1567, i * 0.12, 0.07, 'square', 0.15)
}

function beepSuave() {
  const ac = audio(); if (!ac) return
  tone(ac, 659.25, 0, 0.3, 'sine', 0.13)
  tone(ac, 830.6, 0.32, 0.3, 'sine', 0.13)
  tone(ac, 987.8, 0.64, 0.42, 'sine', 0.13)
}

/** Sirena: sube y baja, imposible de ignorar */
function beepSirena() {
  const ac = audio(); if (!ac) return
  const osc = ac.createOscillator(); const g = ac.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(520, ac.currentTime)
  osc.frequency.linearRampToValueAtTime(980, ac.currentTime + 0.35)
  osc.frequency.linearRampToValueAtTime(520, ac.currentTime + 0.7)
  g.gain.setValueAtTime(0.10, ac.currentTime)
  g.gain.setValueAtTime(0.10, ac.currentTime + 0.65)
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.75)
  osc.connect(g).connect(ac.destination)
  osc.start(); osc.stop(ac.currentTime + 0.8)
}

/** Timbre de puerta: dos notas descendentes */
function beepTimbre() {
  const ac = audio(); if (!ac) return
  tone(ac, 659.25, 0, 0.45, 'sine', 0.16)
  tone(ac, 523.25, 0.35, 0.6, 'sine', 0.16)
}

/** Tres golpes secos, como tocar la puerta */
function beepToque() {
  const ac = audio(); if (!ac) return
  for (let i = 0; i < 3; i++) tone(ac, 220, i * 0.16, 0.1, 'square', 0.17)
}

/** Marimba insistente: firme pero amable */
function beepMarimbaAlarma() {
  const ac = audio(); if (!ac) return
  tone(ac, 783.99, 0, 0.2, 'triangle', 0.15)
  tone(ac, 1046.5, 0.18, 0.22, 'triangle', 0.15)
  tone(ac, 783.99, 0.4, 0.24, 'triangle', 0.13)
}

export type AlarmSoundId =
  | 'clasica' | 'digital' | 'suave' | 'sirena' | 'timbre' | 'toque' | 'marimba'

export const ALARM_SOUNDS: { id: AlarmSoundId; label: string; beep: () => void; interval: number }[] = [
  { id: 'clasica', label: 'Clásica', beep: beepClasica, interval: 1100 },
  { id: 'digital', label: 'Digital', beep: beepDigital, interval: 900 },
  { id: 'suave', label: 'Campanas suaves', beep: beepSuave, interval: 1500 },
  { id: 'sirena', label: 'Sirena', beep: beepSirena, interval: 1000 },
  { id: 'timbre', label: 'Timbre', beep: beepTimbre, interval: 1300 },
  { id: 'toque', label: 'Toques', beep: beepToque, interval: 1200 },
  { id: 'marimba', label: 'Marimba', beep: beepMarimbaAlarma, interval: 1400 },
]

/** Alarma intrusiva en bucle (punto 12). Devuelve función para detenerla. */
export function startAlarmSound(id: AlarmSoundId = 'clasica'): () => void {
  stopAlarmSound()
  const def = ALARM_SOUNDS.find((s) => s.id === id) ?? ALARM_SOUNDS[0]
  def.beep()
  alarmTimer = setInterval(def.beep, def.interval)
  return stopAlarmSound
}

export function stopAlarmSound() {
  if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null }
}

/** Reproduce una muestra corta de una alarma (para elegir en Ajustes) */
export function previewAlarm(id: AlarmSoundId) {
  ;(ALARM_SOUNDS.find((s) => s.id === id) ?? ALARM_SOUNDS[0]).beep()
}
