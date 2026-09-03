// Presupuestos propios: un límite que el usuario define (ej. "Comida de la U")
// y va anotando lo que gasta. Avisa cuando se acerca o se pasa del límite.
import type { Budget, MonthData } from '../types/finance'
import { remainingAmount } from './finance'

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Umbral en el que se avisa "te estás acercando" */
export const WARN_AT = 0.8

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Etiqueta corta del período, para la UI */
export function periodLabel(b: Budget): string {
  if (b.period === 'weekly') return 'por semana'
  if (b.period === 'biweekly') return 'por quincena'
  if (b.period === 'days') return `cada ${Math.max(1, b.everyDays ?? 15)} días`
  return 'por mes'
}

/** Inicio del período actual del presupuesto ('yyyy-MM-dd') */
export function periodStart(b: Budget, today = new Date()): string {
  const hoy = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (b.period === 'weekly') {
    // semana que empieza el lunes
    const d = new Date(hoy)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return iso(d)
  }

  if (b.period === 'biweekly') {
    // quincenas del mes: del 1 al 15 y del 16 al final
    const dia = hoy.getDate() <= 15 ? 1 : 16
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  if (b.period === 'days') {
    // ciclos de N días contados desde el arranque que eligió el usuario
    const cada = Math.max(1, Math.round(b.everyDays ?? 15))
    const base = b.startISO || b.createdAt.slice(0, 10)
    const [y, m, d] = base.split('-').map(Number)
    const inicio = new Date(y, (m || 1) - 1, d || 1)
    if (!Number.isFinite(inicio.getTime()) || inicio > hoy) return iso(hoy)
    const dias = Math.floor((hoy.getTime() - inicio.getTime()) / 86400000)
    const ciclo = Math.floor(dias / cada)
    const arranque = new Date(inicio)
    arranque.setDate(arranque.getDate() + ciclo * cada)
    return iso(arranque)
  }

  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
}

/** Fin del período actual ('yyyy-MM-dd', inclusive) */
export function periodEnd(b: Budget, today = new Date()): string {
  const desde = periodStart(b, today)
  const [y, m, d] = desde.split('-').map(Number)
  const fin = new Date(y, m - 1, d)
  if (b.period === 'weekly') fin.setDate(fin.getDate() + 6)
  else if (b.period === 'biweekly') {
    if (d === 1) fin.setDate(15)
    else { fin.setMonth(fin.getMonth() + 1); fin.setDate(0) }
  } else if (b.period === 'days') fin.setDate(fin.getDate() + Math.max(1, Math.round(b.everyDays ?? 15)) - 1)
  else { fin.setMonth(fin.getMonth() + 1); fin.setDate(0) }
  return iso(fin)
}

export interface BudgetStatus {
  /** gastado en el período actual */
  spent: number
  /** límite del período */
  limit: number
  /** 0..1+ (puede pasar de 1 si se excedió) */
  ratio: number
  /** cuánto queda (puede ser negativo) */
  left: number
  /** movimientos del período actual, del más nuevo al más viejo */
  entries: Budget['entries']
  level: 'ok' | 'warn' | 'over'
}

/**
 * Estado del presupuesto: suma sus aportes propios, los movimientos del mes
 * asignados a él y los pagos del mes que el usuario le cargó.
 */
export function budgetStatus(
  b: Budget,
  month: MonthData | undefined,
  today = new Date(),
  /** todos los meses: un presupuesto quincenal o por días cruza de mes */
  months?: Record<string, MonthData>,
): BudgetStatus {
  const from = periodStart(b, today)
  const to = periodEnd(b, today)
  const dentro = (d: string) => d >= from && d <= to
  const own = b.entries.filter((e) => dentro(e.dateISO))
  let spent = own.reduce((s, e) => s + e.amount, 0)

  const meses = months ? Object.values(months) : month ? [month] : []
  for (const m of meses) {
    // movimientos asignados a este presupuesto (solo salidas)
    for (const mv of m.movements ?? []) {
      if (mv.budgetId === b.id && mv.kind === 'gasto' && dentro(mv.dateISO)) spent += mv.amount
    }
    // gastos hormiga viejos que aún no se migraron
    for (const h of m.hormigas ?? []) {
      if (h.budgetId === b.id && dentro(h.dateISO)) spent += h.amount
    }
    // pagos del mes asignados. Lo que ya generó movimiento se contó arriba:
    // aquí solo entra lo que no lo hizo, para no cobrar dos veces.
    for (const e of m.expenses ?? []) {
      if (e.budgetId !== b.id) continue
      for (const ad of e.advances ?? []) {
        if (!ad.movementId && dentro(ad.dateISO)) spent += ad.amount
      }
      if (e.paid && !e.movementId && dentro((e.paidAt ?? '').slice(0, 10))) spent += remainingAmount(e)
    }
  }

  spent = round2(spent)
  const limit = Math.max(0, b.amount)
  const ratio = limit > 0 ? spent / limit : 0
  return {
    spent,
    limit,
    ratio,
    left: round2(limit - spent),
    entries: own.slice().sort((a, z) => (a.dateISO < z.dateISO ? 1 : -1)),
    level: ratio >= 1 ? 'over' : ratio >= WARN_AT ? 'warn' : 'ok',
  }
}

/** Presupuestos que necesitan atención (cerca del límite o pasados) */
export function budgetsNeedingAttention(
  budgets: Budget[],
  month: MonthData | undefined,
  today = new Date(),
  months?: Record<string, MonthData>,
): { budget: Budget; status: BudgetStatus }[] {
  return budgets
    .map((b) => ({ budget: b, status: budgetStatus(b, month, today, months) }))
    .filter((x) => x.status.level !== 'ok' && x.status.limit > 0)
    .sort((a, z) => z.status.ratio - a.status.ratio)
}

/** Total presupuestado y total gastado del período (para resúmenes) */
export function budgetsTotals(
  budgets: Budget[],
  month: MonthData | undefined,
  today = new Date(),
  months?: Record<string, MonthData>,
) {
  let limit = 0
  let spent = 0
  for (const b of budgets) {
    const s = budgetStatus(b, month, today, months)
    limit += s.limit
    spent += s.spent
  }
  return { limit: round2(limit), spent: round2(spent), left: round2(limit - spent) }
}
