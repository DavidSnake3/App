import type { MonthData, AppSettings } from '../types/finance'

function hasWebNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && typeof Notification !== 'undefined'
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!hasWebNotifications()) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!hasWebNotifications()) return 'unsupported'
  return Notification.permission
}

interface ScheduledNotif {
  id: string
  expenseName: string
  amount: number
  fireAt: number
}

const STORAGE_KEY = 'finance-scheduled-notifs'
const webTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

export async function scheduleNotifications(
  months: Record<string, MonthData>,
  settings: AppSettings
): Promise<void> {
  if (!settings.notificationsEnabled) return
  if (!hasWebNotifications() || Notification.permission !== 'granted') return

  clearAllWebTimers()
  const now = Date.now()
  const scheduled: ScheduledNotif[] = []

  for (const month of Object.values(months)) {
    for (const section of month.sections) {
      for (const item of section.items) {
        if (item.paid || !item.dueDay) continue
        for (const daysBefore of settings.notificationDays) {
          const dueDate = new Date(month.year, month.month - 1, item.dueDay, 9, 0, 0)
          const fireAt = dueDate.getTime() - daysBefore * 86_400_000
          if (fireAt <= now) continue
          const id = `${month.id}-${item.id}-${daysBefore}`
          scheduled.push({ id, expenseName: item.name, amount: item.amount, fireAt })
        }
      }
    }
  }

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scheduled)) } catch {}
  for (const notif of scheduled) {
    const timer = setTimeout(() => showNotification(notif), notif.fireAt - now)
    webTimers.set(notif.id, timer)
  }
}

function showNotification(notif: ScheduledNotif) {
  if (!hasWebNotifications() || Notification.permission !== 'granted') return
  const amount = new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(notif.amount)
  new Notification(`Pago pendiente: ${notif.expenseName}`, { body: `Monto: ${amount}` })
}

function clearAllWebTimers() {
  for (const t of webTimers.values()) clearTimeout(t)
  webTimers.clear()
}

export function cancelAllNotifications(): void {
  clearAllWebTimers()
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

export function restoreScheduledNotifications(): void {
  if (!hasWebNotifications() || Notification.permission !== 'granted') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const scheduled: ScheduledNotif[] = JSON.parse(raw)
    const now = Date.now()
    for (const notif of scheduled) {
      if (notif.fireAt <= now) continue
      const timer = setTimeout(() => showNotification(notif), notif.fireAt - now)
      webTimers.set(notif.id, timer)
    }
  } catch {}
}
