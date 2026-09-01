// Pagos fijos: las plantillas de lo que sale SÍ O SÍ todos los meses.
//
// Una plantilla se crea sola cuando marcas un gasto como recurrente, y se
// administra en Ajustes → Ingresos y planilla → Pagos fijos. Cada mes nuevo
// nace ya con sus pagos fijos puestos, sin tener que copiarlos a mano.
import type { Expense, MonthData, RecurringTemplate } from '../types/finance'
import { monthDiff, todayISO } from './dates'
import { uid } from './finance'

/** Cada cuántos meses toca cada recurrencia */
const EVERY: Record<string, number> = {
  once: 0, weekly: 1, biweekly: 1, monthly: 1,
  bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12,
}

/** ¿Esta plantilla toca en ese mes? */
export function templateHits(t: RecurringTemplate, monthId: string): boolean {
  if (!t.active) return false
  if (t.recurrence === 'once') return false
  if (monthId < t.anchorMonthId) return false
  if (t.endMonthId && monthId > t.endMonthId) return false
  const every = EVERY[t.recurrence] ?? 1
  if (every <= 1) return true
  const diff = monthDiff(t.anchorMonthId, monthId)
  return diff >= 0 && diff % every === 0
}

/** Crea el pago del mes a partir de la plantilla */
export function expenseFromTemplate(t: RecurringTemplate, monthId: string): Expense {
  const anchor = t.anchorMonthId || monthId
  return {
    id: uid(),
    name: t.name,
    amount: t.amount,
    paid: false,
    dueDay: t.dueDay,
    period: t.dueDay && t.dueDay <= 15 ? 'q1' : 'q2',
    kind: t.kind,
    recurrence: t.recurrence,
    children: [],
    icon: t.icon,
    note: t.note,
    accountId: t.accountId,
    categoryId: t.categoryId,
    budgetId: t.budgetId,
    reminder: t.reminder,
    anchorMonthId: anchor,
    templateId: t.id,
    createdAt: todayISO(),
  }
}

/**
 * Pagos que le faltan a un mes según sus plantillas.
 *
 * No duplica: si el mes ya tiene el pago de esa plantilla (por `templateId`,
 * o uno con el mismo nombre creado a mano antes), no lo vuelve a crear.
 */
export function missingFromTemplates(
  month: MonthData,
  templates: RecurringTemplate[],
): Expense[] {
  const porPlantilla = new Set(month.expenses.map((e) => e.templateId).filter(Boolean))
  const porNombre = new Set(month.expenses.map((e) => e.name.trim().toLowerCase()))
  return templates
    .filter((t) => templateHits(t, month.id))
    .filter((t) => !porPlantilla.has(t.id) && !porNombre.has(t.name.trim().toLowerCase()))
    .map((t) => expenseFromTemplate(t, month.id))
}

/** Plantilla a partir de un gasto que el usuario marcó como recurrente */
export function templateFromExpense(e: Expense, monthId: string): RecurringTemplate {
  return {
    id: uid(),
    name: e.name,
    amount: e.amount,
    kind: e.kind,
    dueDay: e.dueDay,
    recurrence: e.recurrence,
    anchorMonthId: e.anchorMonthId ?? monthId,
    icon: e.icon,
    note: e.note,
    accountId: e.accountId,
    categoryId: e.categoryId,
    budgetId: e.budgetId,
    reminder: e.reminder,
    active: true,
    createdAt: todayISO(),
  }
}

/** Total mensual de los pagos fijos activos (para el resumen) */
export function recurringMonthlyTotal(templates: RecurringTemplate[], monthId: string): number {
  const total = templates
    .filter((t) => templateHits(t, monthId))
    .reduce((s, t) => s + t.amount, 0)
  return Math.round(total * 100) / 100
}

/** Etiqueta de cada cuánto se repite */
export const RECURRENCE_EVERY_LABEL: Record<string, string> = {
  weekly: 'Cada semana',
  biweekly: 'Cada quincena',
  monthly: 'Todos los meses',
  bimonthly: 'Cada 2 meses',
  quarterly: 'Cada 3 meses',
  semiannual: 'Cada 6 meses',
  annual: 'Una vez al año',
}
