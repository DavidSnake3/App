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

export type PaySoundId = 'ding' | 'caja' | 'monedas'
export const PAY_SOUNDS: { id: PaySoundId; label: string; play: () => void }[] = [
  { id: 'caja', label: 'Cha-ching (caja)', play: playCash },
  { id: 'ding', label: 'Ding suave', play: playPaid },
  { id: 'monedas', label: 'Monedas', play: playCoins },
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

export type AlarmSoundId = 'clasica' | 'digital' | 'suave'
export const ALARM_SOUNDS: { id: AlarmSoundId; label: string; beep: () => void; interval: number }[] = [
  { id: 'clasica', label: 'Clásica', beep: beepClasica, interval: 1100 },
  { id: 'digital', label: 'Digital', beep: beepDigital, interval: 900 },
  { id: 'suave', label: 'Campanas suaves', beep: beepSuave, interval: 1500 },
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
