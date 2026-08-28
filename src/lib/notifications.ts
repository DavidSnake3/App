// Recordatorios y alarmas de pago (puntos 9 y 12).
// - En Android (APK): notificaciones locales nativas con canal de alta prioridad.
// - En navegador/PWA: Notification API + temporizadores mientras la app vive.
// - Alarma intrusiva dentro de la app: overlay a pantalla completa con sonido.
import { Capacitor } from '@capacitor/core'
import type { AppSettings, Debt, MonthData, PendingAlarm, ReminderPref } from '../types/finance'
import { buildPayables } from './finance'
import { dueDate } from './dates'
import { formatMoney } from './format'

export interface ReminderTask {
  id: string
  title: string
  body: string
  fireAt: number
  alarm: boolean
  itemName: string
  amount: number
}

const ALARM_STORE_KEY = 'snb-pending-alarms'
const MAX_WEB_TIMER = 6 * 86_400_000 // setTimeout fiable hasta ~6 días

function isNative(): boolean {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

function hasWebNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && typeof Notification !== 'undefined'
}

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export async function getPermission(): Promise<PermissionState> {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const st = await LocalNotifications.checkPermissions()
      return st.display === 'granted' ? 'granted' : st.display === 'denied' ? 'denied' : 'default'
    } catch { return 'unsupported' }
  }
  if (!hasWebNotifications()) return 'unsupported'
  return Notification.permission
}

export async function requestPermission(): Promise<boolean> {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const st = await LocalNotifications.requestPermissions()
      return st.display === 'granted'
    } catch { return false }
  }
  if (!hasWebNotifications()) return false
  if (Notification.permission === 'granted') return true
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch { return false }
}

/** Construye la lista de recordatorios futuros según preferencias (punto 9) */
export function buildReminderTasks(
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
): ReminderTask[] {
  const prefs = settings.notifications
  if (!prefs.enabled) return []

  const tasks: ReminderTask[] = []
  const now = Date.now()
  const horizon = now + 60 * 86_400_000 // próximos 60 días

  const parseTime = (t: string): [number, number] => {
    const [h, m] = (t || '09:00').split(':').map(Number)
    return [isNaN(h) ? 9 : h, isNaN(m) ? 0 : m]
  }

  const push = (
    key: string, name: string, amount: number, monthId: string,
    dueDay: number, itemPref: ReminderPref | undefined,
  ) => {
    const daysBefore = itemPref?.enabled ? itemPref.daysBefore : prefs.daysBefore
    const [hh, mm] = parseTime(itemPref?.enabled ? itemPref.time : prefs.time)
    const alarm = itemPref?.enabled ? itemPref.alarm : prefs.alarmMode
    const due = dueDate(monthId, dueDay)
    for (const d of daysBefore) {
      const fire = new Date(due.getFullYear(), due.getMonth(), due.getDate() - d, hh, mm, 0)
      const fireAt = fire.getTime()
      if (fireAt <= now || fireAt > horizon) continue
      tasks.push({
        id: `${key}-${d}`,
        title: d === 0 ? `Hoy vence: ${name}` : `${name} vence en ${d} día${d === 1 ? '' : 's'}`,
        body: `Monto: ${formatMoney(amount)}. Toca para abrir SNBusiness.`,
        fireAt,
        alarm,
        itemName: name,
        amount,
      })
    }
  }

  for (const month of Object.values(months)) {
    const items = buildPayables(month, debts)
    for (const it of items) {
      if (it.paid || !it.dueDay) continue
      push(`${month.id}-${it.id}`, it.name, it.amount, month.id, it.dueDay, undefined)
    }
    // preferencias por elemento (override)
    for (const e of month.expenses) {
      if (e.paid || !e.dueDay || !e.reminder?.enabled) continue
      push(`ov-${month.id}-${e.id}`, e.name, e.amount, month.id, e.dueDay, e.reminder)
    }
  }

  return tasks.sort((a, b) => a.fireAt - b.fireAt).slice(0, 64)
}

// ─── Programación ────────────────────────────────────────────────────────────

const webTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearWebTimers() {
  for (const t of webTimers.values()) clearTimeout(t)
  webTimers.clear()
}

function showWebNotification(task: ReminderTask) {
  if (!hasWebNotifications() || Notification.permission !== 'granted') return
  try {
    new Notification(task.title, { body: task.body, tag: task.id })
  } catch { /* algunos WebView lo bloquean */ }
}

function numericId(key: string): number {
  let h = 5381
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0
  return Math.abs(h) % 2_000_000_000
}

async function scheduleNative(tasks: ReminderTask[]): Promise<void> {
  const { LocalNotifications } = await import('@capacitor/local-notifications')

  try {
    await LocalNotifications.createChannel({
      id: 'pagos',
      name: 'Recordatorios de pago',
      description: 'Avisos antes de la fecha de vencimiento',
      importance: 4,
      visibility: 1,
      vibration: true,
    })
    await LocalNotifications.createChannel({
      id: 'alarmas',
      name: 'Alarmas de pago',
      description: 'Alarmas intrusivas para pagos críticos',
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } catch { /* canales ya creados */ }

  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  }

  if (!tasks.length) return
  await LocalNotifications.schedule({
    notifications: tasks.map((t) => ({
      id: numericId(t.id),
      title: t.title,
      body: t.body,
      channelId: t.alarm ? 'alarmas' : 'pagos',
      schedule: { at: new Date(t.fireAt), allowWhileIdle: true },
      smallIcon: 'ic_stat_name',
      autoCancel: !t.alarm,
      ongoing: false,
    })),
  })
}

/** Reprograma todos los recordatorios (se llama al cambiar datos/preferencias) */
export async function scheduleAll(
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
): Promise<void> {
  const tasks = buildReminderTasks(months, debts, settings)

  // Alarmas dentro de la app (overlay intrusivo, punto 12)
  const alarms: PendingAlarm[] = tasks
    .filter((t) => t.alarm)
    .map((t) => ({ id: t.id, title: t.title, body: t.body, fireAt: t.fireAt, itemName: t.itemName, amount: t.amount }))
  try { localStorage.setItem(ALARM_STORE_KEY, JSON.stringify(alarms)) } catch { /* lleno */ }

  if (isNative()) {
    try { await scheduleNative(tasks) } catch { /* plugin no disponible */ }
    return
  }

  clearWebTimers()
  if (!hasWebNotifications() || Notification.permission !== 'granted') return
  const now = Date.now()
  for (const t of tasks) {
    const delay = t.fireAt - now
    if (delay <= 0 || delay > MAX_WEB_TIMER) continue
    webTimers.set(t.id, setTimeout(() => showWebNotification(t), delay))
  }
}

export async function cancelAll(): Promise<void> {
  clearWebTimers()
  try { localStorage.removeItem(ALARM_STORE_KEY) } catch { /* nada */ }
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const pending = await LocalNotifications.getPending()
      if (pending.notifications.length) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
      }
    } catch { /* plugin no disponible */ }
  }
}

// ─── Alarmas en la app ───────────────────────────────────────────────────────

const FIRED_KEY = 'snb-fired-alarms'

/** Devuelve la alarma que debe sonar ahora (si hay) y la marca como disparada */
export function popDueAlarm(): PendingAlarm | null {
  try {
    const alarms = JSON.parse(localStorage.getItem(ALARM_STORE_KEY) ?? '[]') as PendingAlarm[]
    const fired = new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]') as string[])
    const now = Date.now()
    const due = alarms.find((a) => a.fireAt <= now && a.fireAt > now - 3_600_000 && !fired.has(a.id))
    if (!due) return null
    fired.add(due.id)
    localStorage.setItem(FIRED_KEY, JSON.stringify([...fired].slice(-200)))
    return due
  } catch {
    return null
  }
}

/** Pospone una alarma n minutos */
export function snoozeAlarm(alarm: PendingAlarm, minutes: number) {
  try {
    const alarms = JSON.parse(localStorage.getItem(ALARM_STORE_KEY) ?? '[]') as PendingAlarm[]
    const next: PendingAlarm = { ...alarm, id: `${alarm.id}-s${Date.now()}`, fireAt: Date.now() + minutes * 60_000 }
    localStorage.setItem(ALARM_STORE_KEY, JSON.stringify([...alarms, next]))
  } catch { /* nada */ }
}
