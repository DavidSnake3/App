import { useEffect } from 'react'
import { AlarmClock, BellOff, Clock } from 'lucide-react'
import type { PendingAlarm } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { snoozeAlarm } from '../../lib/notifications'
import { startAlarmSound, stopAlarmSound } from '../../lib/sound'
import { formatMoney } from '../../lib/format'

interface Props {
  alarm: PendingAlarm
  onDismiss: () => void
}

/** Alarma intrusiva a pantalla completa, como alarma de teléfono (punto 12) */
export function AlarmOverlay({ alarm, onDismiss }: Props) {
  const sounds = useFinanceStore((s) => s.settings.animations.sounds)
  const haptics = useFinanceStore((s) => s.settings.animations.haptics)
  const alarmSound = useFinanceStore((s) => s.settings.animations.alarmSound)

  useEffect(() => {
    const stop = sounds ? startAlarmSound(alarmSound ?? 'clasica') : undefined
    let vibTimer: ReturnType<typeof setInterval> | null = null
    if (haptics) {
      try { navigator.vibrate?.([400, 200, 400]) } catch { /* no soportado */ }
      vibTimer = setInterval(() => {
        try { navigator.vibrate?.([400, 200, 400]) } catch { /* no soportado */ }
      }, 1500)
    }
    return () => {
      stop?.()
      stopAlarmSound()
      if (vibTimer) clearInterval(vibTimer)
      try { navigator.vibrate?.(0) } catch { /* nada */ }
    }
  }, [sounds, haptics, alarmSound])

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-8 max-w-[520px] mx-auto anim-fade"
      style={{ background: 'color-mix(in oklab, var(--c-bg-base) 88%, var(--c-danger))' }}
    >
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{
          background: 'color-mix(in oklab, var(--c-danger) 25%, transparent)',
          animation: 'ringPulse 1.2s ease-out infinite',
        }}
      >
        <AlarmClock size={44} style={{ color: 'var(--c-danger)' }} className="anim-shake" />
      </div>

      <p className="text-[13px] font-bold uppercase tracking-widest mt-8" style={{ color: 'var(--c-danger)' }}>
        Alarma de pago
      </p>
      <h2 className="font-display text-[26px] font-bold text-ink text-center mt-2 leading-tight">
        {alarm.itemName}
      </h2>
      <p className="num text-[34px] font-bold text-ink mt-2">{formatMoney(alarm.amount)}</p>
      <p className="text-[14px] text-muted mt-1 text-center">{alarm.title}</p>

      <div className="flex flex-col gap-3 w-full mt-10">
        <button
          onClick={onDismiss}
          className="pressable w-full rounded-2xl py-4 font-bold text-[16px] text-white"
          style={{ background: 'var(--c-income)', color: '#08281c' }}
        >
          <span className="inline-flex items-center gap-2"><BellOff size={18} /> Entendido, lo pago</span>
        </button>
        <button
          onClick={() => { snoozeAlarm(alarm, 10); onDismiss() }}
          className="pressable btn-ghost w-full !py-4 flex items-center justify-center gap-2"
        >
          <Clock size={17} /> Posponer 10 minutos
        </button>
      </div>
    </div>
  )
}
