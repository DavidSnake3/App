import type {
  AnnualProjection, AppSettings, Debt, Expense, MonthData, PayableItem,
  ProjectedMonth, Recurrence,
} from '../types/finance'
import { addMonthsToId, monthDiff, monthLabel, parseMonthId, todayISO } from './dates'

let _idCounter = 0
export function uid(): string {
  return `${Date.now().toString(36)}-${(++_idCounter).toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: 'Pago único',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  bimonthly: 'Cada 2 meses',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
}

/** Opciones recomendadas al marcar un gasto como recurrente (punto 8) */
export const RECOMMENDED_RECURRENCES: Recurrence[] = ['monthly', 'biweekly', 'weekly', 'quarterly', 'annual']

const RECURRENCE_EVERY: Record<Recurrence, number> = {
  once: 0, weekly: 1, biweekly: 1, monthly: 1,
  bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12,
}

/** Si un gasto tiene sub-hijos, su monto efectivo es la suma de ellos (punto 3) */
export function effectiveAmount(e: Expense): number {
  if (e.children.length > 0) return e.children.reduce((s, c) => s + c.amount, 0)
  return e.amount
}

// ─── Deudas ──────────────────────────────────────────────────────────────────

export function debtEndMonthId(d: Debt): string {
  return addMonthsToId(d.startMonthId, Math.max(0, d.installments - 1))
}

export function debtIsActiveInMonth(d: Debt, monthId: string): boolean {
  const idx = monthDiff(d.startMonthId, monthId)
  return idx >= 0 && idx < d.installments
}

export function debtInstallmentNumber(d: Debt, monthId: string): number {
  return monthDiff(d.startMonthId, monthId) + 1
}

export function debtPaidCount(d: Debt): number {
  return Object.values(d.payments).filter((p) => p.paid).length
}

export function debtPaidAmount(d: Debt): number {
  return Object.values(d.payments).filter((p) => p.paid).reduce((s, p) => s + p.amount, 0)
}

export function debtRemaining(d: Debt): number {
  return Math.max(0, d.total - debtPaidAmount(d))
}

export function debtIsSettled(d: Debt): boolean {
  return debtPaidCount(d) >= d.installments || debtRemaining(d) <= 0
}

// ─── Elementos del mes ───────────────────────────────────────────────────────

/** Une gastos + cuotas de deuda del mes en una sola lista para las vistas */
export function buildPayables(month: MonthData, debts: Debt[]): PayableItem[] {
  const items: PayableItem[] = month.expenses.map((e) => ({
    id: `e-${e.id}`,
    source: 'expense',
    refId: e.id,
    name: e.name,
    amount: effectiveAmount(e),
    paid: e.paid,
    paidAt: e.paidAt,
    dueDay: e.dueDay,
    period: e.period,
    kind: e.kind,
    recurrence: e.recurrence,
    children: e.children,
    icon: e.icon,
  }))

  for (const d of debts) {
    if (d.viaPlanilla) continue // se deduce de la planilla, no del mes
    if (!debtIsActiveInMonth(d, month.id)) continue
    const pay = d.payments[month.id]
    const n = debtInstallmentNumber(d, month.id)
    items.push({
      id: `d-${d.id}-${month.id}`,
      source: 'debt',
      refId: d.id,
      name: d.name,
      amount: pay?.amount ?? d.monthlyPayment,
      paid: pay?.paid ?? false,
      paidAt: pay?.paidAt,
      dueDay: d.dueDay,
      period: d.dueDay <= 15 ? 'q1' : 'q2',
      kind: 'deuda',
      recurrence: 'monthly',
      children: [],
      icon: d.icon,
      debtProgress: { current: n, total: d.installments, remaining: debtRemaining(d) },
    })
  }

  return items.sort((a, b) => (a.dueDay ?? 32) - (b.dueDay ?? 32))
}

export interface MonthSummary {
  totalIncome: number
  totalExpenses: number
  paidAmount: number
  pendingAmount: number
  savings: number
  countTotal: number
  countPaid: number
  progress: number
  allPaid: boolean
  servicios: number
  gastos: number
  personales: number
  deudas: number
}

export function getMonthSummary(month: MonthData, debts: Debt[]): MonthSummary {
  const items = buildPayables(month, debts)
  const totalIncome = month.income.salary + month.income.additional
  const totalExpenses = items.reduce((s, i) => s + i.amount, 0)
  const paidAmount = items.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0)
  const countTotal = items.length
  const countPaid = items.filter((i) => i.paid).length
  const sumKind = (k: string) => items.filter((i) => i.kind === k).reduce((s, i) => s + i.amount, 0)
  return {
    totalIncome,
    totalExpenses,
    paidAmount,
    pendingAmount: totalExpenses - paidAmount,
    savings: totalIncome - totalExpenses,
    countTotal,
    countPaid,
    progress: countTotal === 0 ? 0 : countPaid / countTotal,
    allPaid: countTotal > 0 && countPaid === countTotal,
    servicios: sumKind('servicio'),
    gastos: sumKind('gasto'),
    personales: sumKind('personal'),
    deudas: sumKind('deuda'),
  }
}

// ─── Generación de mes (mejora 12: nunca se copia solo, se pregunta) ─────────

/** ¿El gasto recurrente toca en este mes según su frecuencia? */
export function recurrenceHits(e: Expense, targetMonthId: string): boolean {
  if (e.recurrence === 'once') return false
  const every = RECURRENCE_EVERY[e.recurrence]
  if (every <= 1) return true
  const anchor = e.anchorMonthId ?? targetMonthId
  const diff = monthDiff(anchor, targetMonthId)
  return diff >= 0 && diff % every === 0
}

/** Gastos recurrentes de un mes que aplicarían en el mes destino */
export function recurringCandidates(from: MonthData, targetMonthId: string): Expense[] {
  return from.expenses.filter((e) => recurrenceHits(e, targetMonthId))
}

/** Copia de un gasto para otro mes (nuevo id, sin pagar) */
export function cloneExpenseForMonth(e: Expense): Expense {
  return {
    ...e,
    id: uid(),
    paid: false,
    paidAt: undefined,
    children: e.children.map((c) => ({ ...c, id: uid() })),
    createdAt: todayISO(),
  }
}

/** Crea un mes VACÍO (las deudas siguen solas; los gastos se copian solo si el usuario acepta) */
export function makeMonth(monthId: string, settings: AppSettings): MonthData {
  const { year, month } = parseMonthId(monthId)
  return {
    id: monthId,
    year,
    month,
    income: { salary: settings.defaultSalary, additional: 0, additionalLabel: 'Ingresos adicionales' },
    expenses: [],
    celebrated: false,
  }
}

// ─── Proyección anual (punto 13) ─────────────────────────────────────────────

export function buildAnnualProjection(
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
  fromMonthId: string,
): AnnualProjection {
  const result: ProjectedMonth[] = []
  const actuals = Object.values(months)
  const avgExpenses = actuals.length
    ? actuals.reduce((s, m) => s + getMonthSummary(m, debts).totalExpenses, 0) / actuals.length
    : 0

  const startId = `${parseMonthId(fromMonthId).year}-01`
  for (let i = 0; i < 12; i++) {
    const monthId = addMonthsToId(startId, i)
    const actual = months[monthId]
    const { month } = parseMonthId(monthId)
    if (actual) {
      const s = getMonthSummary(actual, debts)
      result.push({
        monthId, month, label: monthLabel(monthId, true),
        income: s.totalIncome, expenses: s.totalExpenses, savings: s.savings, isActual: true,
      })
    } else {
      // proyección: salario por defecto + cuotas de deuda activas + promedio de gastos
      const debtLoad = debts
        .filter((d) => debtIsActiveInMonth(d, monthId))
        .reduce((s, d) => s + d.monthlyPayment, 0)
      const income = settings.defaultSalary
      const expenses = Math.round(avgExpenses > 0 ? avgExpenses : debtLoad)
      result.push({
        monthId, month, label: monthLabel(monthId, true),
        income, expenses, savings: income - expenses, isActual: false,
      })
    }
  }

  return {
    months: result,
    totalIncome: result.reduce((s, m) => s + m.income, 0),
    totalExpenses: result.reduce((s, m) => s + m.expenses, 0),
    totalSavings: result.reduce((s, m) => s + m.savings, 0),
  }
}

/** Serie acumulada día a día del mes para la línea de pérdidas/ganancias */
export function buildMonthFlow(month: MonthData, debts: Debt[], payday: number) {
  const items = buildPayables(month, debts)
  const days = new Date(month.year, month.month, 0).getDate()
  const income = month.income.salary + month.income.additional
  const points: { day: number; balance: number; spent: number }[] = []
  let spent = 0
  for (let day = 1; day <= days; day++) {
    const dayItems = items.filter((i) => (i.dueDay ?? days) === day)
    spent += dayItems.reduce((s, i) => s + i.amount, 0)
    const received = day >= Math.min(payday || 1, days) ? income : 0
    points.push({ day, balance: received - spent, spent })
  }
  return points
}
