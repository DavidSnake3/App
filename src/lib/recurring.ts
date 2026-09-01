// Pagos fijos: lo que sale SÍ O SÍ todos los meses.
//
// Cuando marcás un gasto como "se repite", nace su plantilla y desde ese
// momento el pago aparece en TODOS los meses de ahí en adelante: en los que
// ya existían y en los que se vayan creando. No hay que administrar nada.
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
 * Deja el mes al día con los pagos fijos. SOLO agrega y adopta, nunca borra.
 *
 * Tres reglas, en orden:
 *  1. lápida: el usuario quitó ese pago fijo en ESTE mes → no vuelve.
 *  2. ya está: hay un gasto con ese templateId → no se duplica.
 *  3. huérfano: hay un gasto sin plantilla con el mismo nombre → se ADOPTA
 *     (se le pone el templateId) en vez de crear otro al lado. Así se reparan
 *     solas las copias que perdieron el vínculo y los gastos hechos a mano.
 */
export function seedMonth(month: MonthData, templates: RecurringTemplate[]): MonthData {
  const lapidas = new Set(month.skipTemplates ?? [])
  const usados = new Set(
    month.expenses.map((e) => e.templateId).filter(Boolean) as string[],
  )
  const huerfanos = new Map<string, string>() // nombre → id del gasto
  for (const e of month.expenses) {
    if (e.templateId) continue
    const k = e.name.trim().toLowerCase()
    if (!huerfanos.has(k)) huerfanos.set(k, e.id)
  }

  const adopciones = new Map<string, string>() // id del gasto → id de plantilla
  const nuevos: Expense[] = []

  for (const t of templates) {
    if (lapidas.has(t.id) || usados.has(t.id)) continue
    if (!templateHits(t, month.id)) continue
    usados.add(t.id)
    const clave = t.name.trim().toLowerCase()
    const huerfano = huerfanos.get(clave)
    if (huerfano) { huerfanos.delete(clave); adopciones.set(huerfano, t.id); continue }
    nuevos.push(expenseFromTemplate(t, month.id))
  }

  if (!adopciones.size && !nuevos.length) return month // misma referencia: no re-renderiza
  const base = adopciones.size
    ? month.expenses.map((e) => {
        const tid = adopciones.get(e.id)
        return tid ? { ...e, templateId: tid } : e
      })
    : month.expenses
  return { ...month, expenses: [...base, ...nuevos] }
}

/**
 * Pone al día TODOS los meses guardados. `floorMonthId` protege el historial:
 * los meses anteriores no se tocan. Devuelve el MISMO mapa si nada cambió.
 */
export function seedAllMonths(
  months: Record<string, MonthData>,
  templates: RecurringTemplate[],
  floorMonthId: string,
): Record<string, MonthData> {
  if (!templates.length) return months
  let cambio = false
  const out: Record<string, MonthData> = {}
  for (const [mid, m] of Object.entries(months)) {
    if (mid < floorMonthId) { out[mid] = m; continue }
    const next = seedMonth(m, templates)
    if (next !== m) cambio = true
    out[mid] = next
  }
  return cambio ? out : months
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
    // ancla en el mes donde el usuario lo marcó como fijo: una copia traída
    // de un mes viejo no debe sembrar hacia atrás meses ya cerrados
    anchorMonthId: monthId,
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
