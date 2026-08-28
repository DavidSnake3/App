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

let alarmTimer: ReturnType<typeof setInterval> | null = null

/** Alarma intrusiva en bucle (punto 12). Devuelve función para detenerla. */
export function startAlarmSound(): () => void {
  stopAlarmSound()
  const beep = () => {
    const ac = audio(); if (!ac) return
    tone(ac, 880, 0, 0.18, 'square', 0.16)
    tone(ac, 660, 0.22, 0.18, 'square', 0.16)
    tone(ac, 880, 0.44, 0.18, 'square', 0.16)
  }
  beep()
  alarmTimer = setInterval(beep, 1100)
  return stopAlarmSound
}

export function stopAlarmSound() {
  if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null }
}
