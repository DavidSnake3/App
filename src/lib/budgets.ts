// Presupuestos propios: un límite que el usuario define (ej. "Comida de la U")
// y va anotando lo que gasta. Avisa cuando se acerca o se pasa del límite.
import type { Budget, MonthData } from '../types/finance'

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Umbral en el que se avisa "te estás acercando" */
export const WARN_AT = 0.8

/** Inicio del período actual del presupuesto ('yyyy-MM-dd') */
export function periodStart(b: Budget, today = new Date()): string {
  if (b.period === 'weekly') {
    // semana que empieza el lunes
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const dow = (d.getDay() + 6) % 7 // 0 = lunes
    d.setDate(d.getDate() - dow)
    return d.toISOString().slice(0, 10)
  }
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
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
): BudgetStatus {
  const from = periodStart(b, today)
  const own = b.entries.filter((e) => e.dateISO >= from)
  let spent = own.reduce((s, e) => s + e.amount, 0)

  // movimientos asignados a este presupuesto (solo salidas)
  for (const mv of month?.movements ?? []) {
    if (mv.budgetId === b.id && mv.kind === 'gasto' && mv.dateISO >= from) spent += mv.amount
  }
  // gastos hormiga viejos que aún no se migraron
  for (const h of month?.hormigas ?? []) {
    if (h.budgetId === b.id && h.dateISO >= from) spent += h.amount
  }
  // pagos del mes asignados (solo los ya pagados cuentan como gasto real)
  for (const e of month?.expenses ?? []) {
    if (e.budgetId === b.id && e.paid) spent += e.amount
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
): { budget: Budget; status: BudgetStatus }[] {
  return budgets
    .map((b) => ({ budget: b, status: budgetStatus(b, month, today) }))
    .filter((x) => x.status.level !== 'ok' && x.status.limit > 0)
    .sort((a, z) => z.status.ratio - a.status.ratio)
}

/** Total presupuestado y total gastado del período (para resúmenes) */
export function budgetsTotals(budgets: Budget[], month: MonthData | undefined, today = new Date()) {
  let limit = 0
  let spent = 0
  for (const b of budgets) {
    const s = budgetStatus(b, month, today)
    limit += s.limit
    spent += s.spent
  }
  return { limit: round2(limit), spent: round2(spent), left: round2(limit - spent) }
}
