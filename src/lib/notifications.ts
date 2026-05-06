import type { MonthData, AppSettings } from '../types/finance'

function hasWebNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && typeof Notification !== 'undefined'
}

async function getLocalNotifications() {
  try {
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (cap?.isNativePlatform?.()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      return LocalNotifications
    }
  } catch {}
  return null
}

export async function requestNotificationPermission(): Promise<boolean> {
  const ln = await getLocalNotifications()
  if (ln) {
    const { display } = await ln.requestPermissions()
    return display === 'granted'
  }
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
let notifIdCounter = 1000

function makeNotifId(): number {
  return notifIdCounter++
}

export async function scheduleNotifications(
  months: Record<string, MonthData>,
  settings: AppSettings
): Promise<void> {
  if (!settings.notificationsEnabled) return

  const ln = await getLocalNotifications()
  const now = Date.now()

  if (ln) {
    await ln.cancel({ notifications: Array.from({ length: 500 }, (_, i) => ({ id: 1000 + i })) }).catch(() => {})
    const notifications = []
    for (const month of Object.values(months)) {
      for (const section of month.sections) {
        for (const item of section.items) {
          if (item.paid || !item.dueDay) continue
          for (const daysBefore of settings.notificationDays) {
            const dueDate = new Date(month.year, month.month - 1, item.dueDay, 9, 0, 0)
            const fireAt = dueDate.getTime() - daysBefore * 86_400_000
            if (fireAt <= now) continue
            const amount = new Intl.NumberFormat('es-CR', {
              style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
            }).format(item.amount)
            notifications.push({
              id: makeNotifId(),
              title: `Pago pendiente: ${item.name}`,
              body: `Monto: ${amount}${daysBefore > 0 ? ` · vence en ${daysBefore} día${daysBefore > 1 ? 's' : ''}` : ' · hoy'}`,
              schedule: { at: new Date(fireAt) },
              sound: undefined,
            })
          }
        }
      }
    }
    if (notifications.length > 0) {
      await ln.schedule({ notifications }).catch(console.error)
    }
    return
  }

  if (!hasWebNotifications() || Notification.permission !== 'granted') return

  clearAllWebTimers()
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
    const delay = notif.fireAt - now
    const timer = setTimeout(() => showWebNotification(notif), delay)
    webTimers.set(notif.id, timer)
  }
}

function showWebNotification(notif: ScheduledNotif) {
  if (!hasWebNotifications()) return
  const amount = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(notif.amount)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: `Pago pendiente: ${notif.expenseName}`,
      body: `Monto: ${amount}`,
      tag: notif.id,
    })
  } else if (Notification.permission === 'granted') {
    new Notification(`Pago pendiente: ${notif.expenseName}`, { body: `Monto: ${amount}` })
  }
}

function clearAllWebTimers() {
  for (const t of webTimers.values()) clearTimeout(t)
  webTimers.clear()
}

export async function cancelAllNotifications(): Promise<void> {
  clearAllWebTimers()
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
  const ln = await getLocalNotifications()
  if (ln) {
    await ln.cancel({ notifications: Array.from({ length: 500 }, (_, i) => ({ id: 1000 + i })) }).catch(() => {})
  }
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
      const timer = setTimeout(() => showWebNotification(notif), notif.fireAt - now)
      webTimers.set(notif.id, timer)
    }
  } catch {}
}
