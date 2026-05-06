import type { MonthData, AppSettings } from '../types/finance'

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

interface ScheduledNotif {
  id: string
  monthId: string
  expenseId: string
  expenseName: string
  amount: number
  fireAt: number
}

const STORAGE_KEY = 'finance-scheduled-notifs'
const timers: Map<string, ReturnType<typeof setTimeout>> = new Map()

export function scheduleNotifications(
  months: Record<string, MonthData>,
  settings: AppSettings
): void {
  if (!settings.notificationsEnabled) return
  if (Notification.permission !== 'granted') return

  clearAllTimers()
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
          const notif: ScheduledNotif = {
            id,
            monthId: month.id,
            expenseId: item.id,
            expenseName: item.name,
            amount: item.amount,
            fireAt,
          }
          scheduled.push(notif)
        }
      }
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scheduled))
  } catch {}

  for (const notif of scheduled) {
    const delay = notif.fireAt - now
    const timer = setTimeout(() => {
      showLocalNotification(notif)
    }, delay)
    timers.set(notif.id, timer)
  }
}

function showLocalNotification(notif: ScheduledNotif): void {
  const amount = new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(notif.amount)

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: `Pago pendiente: ${notif.expenseName}`,
      body: `Monto: ${amount}`,
      tag: notif.id,
    })
  } else if (Notification.permission === 'granted') {
    new Notification(`Pago pendiente: ${notif.expenseName}`, {
      body: `Monto: ${amount}`,
      icon: '/icons/icon-192.svg',
    })
  }
}

function clearAllTimers(): void {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
}

export function cancelAllNotifications(): void {
  clearAllTimers()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function restoreScheduledNotifications(): void {
  if (Notification.permission !== 'granted') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const scheduled: ScheduledNotif[] = JSON.parse(raw)
    const now = Date.now()
    for (const notif of scheduled) {
      if (notif.fireAt <= now) continue
      const delay = notif.fireAt - now
      const timer = setTimeout(() => showLocalNotification(notif), delay)
      timers.set(notif.id, timer)
    }
  } catch {}
}
