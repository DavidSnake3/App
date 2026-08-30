// Saldo real: control total del dinero (mejora del usuario).
// Refleja lo que hay EN EL BANCO: base que el usuario escribe + lo que llega
// por quincenas − lo pagado − gastos hormiga − aportes al ahorro. El sobrante
// de cada mes se arrastra solo al siguiente (no es ahorro: es lo que sobró).
import type { AppSettings, Debt, FundConfig, MonthData } from '../types/finance'
import { currentMonthId, daysInMonth, parseMonthId } from './dates'
import { getMonthSummary } from './finance'

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** 'yyyy-MM' de una fecha ISO 'yyyy-MM-dd…' */
function monthOfISO(iso: string): string {
  return iso.slice(0, 7)
}

/** Cuánto salario del mes YA llegó al día de hoy (según el plan de pago) */
export function receivedInMonth(m: MonthData, settings: AppSettings, today = new Date()): number {
  const nowId = currentMonthId()
  const total = m.income.salary + m.income.additional
  if (m.id < nowId) return total
  if (m.id > nowId) return 0

  const salary = m.income.salary
  if (salary <= 0) return m.income.additional

  const sch = settings.paySchedule
  const day = today.getDate()

  if (sch.frequency === 'weekly') {
    // pagos semanales ocurridos en el mes hasta hoy
    const targetJs = (sch.weekday + 1) % 7
    const { year, month } = parseMonthId(m.id)
    let count = 0
    for (let d = 1; d <= day; d++) {
      if (new Date(year, month - 1, d).getDay() === targetJs) count++
    }
    const perWeek = (salary * 12) / 52
    return round2(Math.min(salary * 1.3, count * perWeek) + m.income.additional)
  }

  // Cada pago = parte igual del neto (quincenal: mitad y mitad, con las
  // deducciones repartidas entre las dos quincenas)
  const paydays = (sch.paydays.length ? sch.paydays : [30]).slice().sort((a, b) => a - b)
  const amounts = paydays.map(() => salary / paydays.length)

  const max = daysInMonth(m.id)
  let received = 0
  paydays.forEach((pd, i) => {
    if (Math.min(pd, max) <= day) received += amounts[i] ?? 0
  })
  return round2(received + m.income.additional)
}

/** Total de gastos hormiga del mes */
export function hormigasTotal(m: MonthData): number {
  return round2((m.hormigas ?? []).reduce((s, h) => s + h.amount, 0))
}

/** Aportes al ahorro hechos dentro de un mes concreto */
export function depositsInMonth(settings: AppSettings, monthId: string): number {
  return round2(settings.savings.deposits
    .filter((d) => monthOfISO(d.dateISO) === monthId)
    .reduce((s, d) => s + d.amount, 0))
}

/** Total ahorrado real (todos los aportes menos retiros) */
export function savingsTotal(settings: AppSettings): number {
  return round2(settings.savings.deposits.reduce((s, d) => s + d.amount, 0))
}

/** Flujo neto de un mes: recibido − pagado − hormigas − aportes al ahorro */
export function monthFlow(m: MonthData, debts: Debt[], settings: AppSettings, today = new Date()): number {
  const s = getMonthSummary(m, debts)
  return round2(
    receivedInMonth(m, settings, today) - s.paidAmount - hormigasTotal(m) - depositsInMonth(settings, m.id),
  )
}

/**
 * Flujo acumulado desde el mes ancla hasta hoy. Incluye también aportes al
 * ahorro de meses sin registro (por si el mes aún no existe en la app).
 */
export function fundFlow(
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
  anchorMonthId: string,
  today = new Date(),
): number {
  const nowId = currentMonthId()
  let flow = 0
  const covered = new Set<string>()
  for (const m of Object.values(months)) {
    if (m.id < anchorMonthId || m.id > nowId) continue
    covered.add(m.id)
    flow += monthFlow(m, debts, settings, today)
  }
  // aportes en meses sin registro (no quedaron cubiertos arriba)
  for (const d of settings.savings.deposits) {
    const mid = monthOfISO(d.dateISO)
    if (mid >= anchorMonthId && mid <= nowId && !covered.has(mid)) flow -= d.amount
  }
  return round2(flow)
}

/** Saldo real ahora (null si el usuario no lo ha activado) */
export function realBalance(
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
  today = new Date(),
): number | null {
  const f = settings.fund
  if (!f?.enabled || !f.anchorMonthId) return null
  return round2(f.baseAmount + fundFlow(months, debts, settings, f.anchorMonthId, today) - f.snapshot)
}

/** Config lista para guardar al fijar "tengo X hoy" (captura el snapshot) */
export function makeFundConfig(
  baseAmount: number,
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
): FundConfig {
  const anchorMonthId = currentMonthId()
  return {
    enabled: true,
    baseAmount,
    anchorMonthId,
    snapshot: fundFlow(months, debts, settings, anchorMonthId),
    setAtISO: new Date().toISOString(),
  }
}

/** Sobrante arrastrado de meses ANTERIORES al actual (desde que se activó) */
export function carryOver(
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
): number {
  const f = settings.fund
  if (!f?.enabled || !f.anchorMonthId) return 0
  const nowId = currentMonthId()
  let flow = 0
  for (const m of Object.values(months)) {
    if (m.id < f.anchorMonthId || m.id >= nowId) continue
    flow += monthFlow(m, debts, settings)
  }
  return round2(flow)
}

/** Cuánto del salario llega en cada quincena según el plan de pago */
export function quincenaSplit(salary: number, settings: AppSettings): { q1: number; q2: number } {
  if (salary <= 0) return { q1: 0, q2: 0 }
  const sch = settings.paySchedule
  if (sch.frequency === 'weekly') return { q1: round2(salary / 2), q2: round2(salary / 2) }
  const paydays = (sch.paydays.length ? sch.paydays : [30]).slice().sort((a, b) => a - b)
  const amounts = paydays.map(() => salary / paydays.length)
  let q1 = 0
  let q2 = 0
  paydays.forEach((pd, i) => {
    if (pd <= 15) q1 += amounts[i] ?? 0
    else q2 += amounts[i] ?? 0
  })
  return { q1: round2(q1), q2: round2(q2) }
}

/** Meta sugerida de fondo de emergencia: 3 meses de gastos promedio */
export function suggestedEmergencyGoal(months: Record<string, MonthData>, debts: Debt[]): number {
  const withData = Object.values(months).filter((m) => m.expenses.length > 0)
  if (!withData.length) return 0
  const avg = withData.reduce((s, m) => s + getMonthSummary(m, debts).totalExpenses, 0) / withData.length
  return Math.round(avg * 3)
}
