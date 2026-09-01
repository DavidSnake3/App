import type { Urgency } from '../types/finance'

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export const WEEKDAY_SHORT = ['L', 'K', 'M', 'J', 'V', 'S', 'D']

export function todayISO(): string {
  return new Date().toISOString()
}

/**
 * Fecha de hoy 'yyyy-MM-dd' en la hora LOCAL del usuario.
 *
 * `new Date().toISOString()` da la fecha en UTC: en América, después de las
 * 6 p.m. eso ya es el día siguiente, y todo lo que se anotara de noche
 * quedaba con la fecha de mañana.
 */
export function todayLocalISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}

export function currentMonthId(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthIdOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function parseMonthId(monthId: string): { year: number; month: number } {
  const [year, month] = monthId.split('-').map(Number)
  return { year, month }
}

export function addMonthsToId(monthId: string, delta: number): string {
  const { year, month } = parseMonthId(monthId)
  const d = new Date(year, month - 1 + delta, 1)
  return monthIdOf(d.getFullYear(), d.getMonth() + 1)
}

export function monthDiff(fromId: string, toId: string): number {
  const a = parseMonthId(fromId)
  const b = parseMonthId(toId)
  return (b.year - a.year) * 12 + (b.month - a.month)
}

export function monthLabel(monthId: string, short = false): string {
  const { year, month } = parseMonthId(monthId)
  const names = short ? MONTH_SHORT : MONTH_NAMES
  return `${names[month - 1]} ${year}`
}

export function daysInMonth(monthId: string): number {
  const { year, month } = parseMonthId(monthId)
  return new Date(year, month, 0).getDate()
}

/** Día de la semana (0=Lunes … 6=Domingo) del día 1 del mes */
export function firstWeekday(monthId: string): number {
  const { year, month } = parseMonthId(monthId)
  const js = new Date(year, month - 1, 1).getDay() // 0=Dom
  return (js + 6) % 7
}

export function isCurrentMonth(monthId: string): boolean {
  return monthId === currentMonthId()
}

export function todayDay(): number {
  return new Date().getDate()
}

export function dueDate(monthId: string, dueDay: number): Date {
  const { year, month } = parseMonthId(monthId)
  const max = daysInMonth(monthId)
  return new Date(year, month - 1, Math.min(dueDay, max), 23, 59, 59)
}

/**
 * Urgencia de un pago: se va "poniendo rojo" conforme se acerca la fecha
 * (punto 11). t va de 0 (lejos) a 1 (hoy o vencido).
 */
export function getUrgency(monthId: string, dueDay: number | undefined, paid: boolean): Urgency {
  if (paid) return { level: 'paid', t: 0, daysLeft: null }
  if (!dueDay) return { level: 'ok', t: 0, daysLeft: null }

  // diferencia en días de calendario (no de milisegundos)
  const now = new Date()
  const due = dueDate(monthId, dueDay)
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  const daysLeft = Math.round((dueMid - todayMid) / 86_400_000)

  if (daysLeft < 0) return { level: 'overdue', t: 1, daysLeft }
  if (daysLeft === 0) return { level: 'urgent', t: 1, daysLeft }
  if (daysLeft <= 3) return { level: 'urgent', t: 1 - daysLeft / 8, daysLeft }
  if (daysLeft <= 7) return { level: 'soon', t: 1 - daysLeft / 14, daysLeft }
  const t = Math.max(0, Math.min(0.4, 1 - daysLeft / 30))
  return { level: 'ok', t, daysLeft }
}

/** Color CSS para la urgencia: verde → ámbar → rojo (punto 11) */
export function urgencyColor(u: Urgency): string {
  if (u.level === 'paid') return 'var(--c-income)'
  if (u.level === 'overdue') return 'var(--c-overdue)'
  const pct = Math.round(u.t * 100)
  return `color-mix(in oklab, var(--c-danger) ${pct}%, var(--c-safe))`
}

export function urgencyLabel(u: Urgency): string {
  if (u.level === 'paid') return 'Pagado'
  if (u.daysLeft === null) return 'Sin fecha'
  if (u.level === 'overdue') return `Vencido hace ${Math.abs(u.daysLeft)} d`
  if (u.daysLeft === 0) return 'Vence hoy'
  if (u.daysLeft === 1) return 'Vence mañana'
  return `Vence en ${u.daysLeft} d`
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export function longToday(): string {
  const d = new Date()
  const week = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  return `${week[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()].toLowerCase()}`
}
