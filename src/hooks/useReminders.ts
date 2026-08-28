import { useEffect, useState } from 'react'
import type { PendingAlarm } from '../types/finance'
import { useFinanceStore } from '../store/useFinanceStore'
import { cancelAll, popDueAlarm, scheduleAll } from '../lib/notifications'

/** Reprograma recordatorios al cambiar datos y detecta alarmas que deben sonar */
export function useReminders() {
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const settings = useFinanceStore((s) => s.settings)
  const [alarm, setAlarm] = useState<PendingAlarm | null>(null)

  // Reprogramar (con debounce para no saturar el plugin nativo)
  useEffect(() => {
    const t = setTimeout(() => {
      if (settings.notifications.enabled) void scheduleAll(months, debts, settings)
      else void cancelAll()
    }, 800)
    return () => clearTimeout(t)
  }, [months, debts, settings])

  // Alarma intrusiva dentro de la app (punto 12)
  useEffect(() => {
    const check = () => {
      const due = popDueAlarm()
      if (due) setAlarm(due)
    }
    check()
    const t = setInterval(check, 20_000)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  return { alarm, dismissAlarm: () => setAlarm(null) }
}
