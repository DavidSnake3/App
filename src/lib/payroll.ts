// Comprobante salarial y plan de pago del salario (app universal).
// El comprobante REAL del usuario puede ser diario, semanal, cada 14 días,
// quincenal o mensual: todos los montos se guardan en ese período
// (inputPeriod) y se convierten con exactitud de céntimos.
import type {
  PayPeriod, PayrollConfig, PaySchedule, StatutoryDeduction, TaxBracket,
} from '../types/finance'
import { daysInMonth } from './dates'

export const DEFAULT_CCSS_PCT = 10.83 // CCSS empleado (Costa Rica)
export const DEFAULT_STATUTORY_NAME = 'CCSS'

export {
  COUNTRY_PRESETS, countryPreset, presetLabel, presetPct, presetStatutory,
  presetExtraPays, LEGAL_NOTICE,
} from './countries'
export type { CountryPreset } from './countries'

/** Factor período → mensual (cuántos pagos de ese período caben en un mes) */
export function periodToMonthlyFactor(p: PayPeriod): number {
  if (p === 'daily') return 30
  if (p === 'weekly') return 52 / 12
  if (p === 'fortnightly') return 26 / 12 // cada 14 días
  if (p === 'biweekly') return 2          // quincenal: 2 pagos al mes
  return 1
}

/** Convierte un monto entre períodos (vía base mensual), con céntimos */
export function convertPeriod(value: number, from: PayPeriod, to: PayPeriod): number {
  const monthly = value * periodToMonthlyFactor(from)
  return round2(monthly / periodToMonthlyFactor(to))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Etiquetas según cómo recibe su dinero el usuario */
export const WORKER_LABEL: Record<string, string> = {
  asalariado: 'Asalariado',
  independiente: 'Independiente',
  ambos: 'Asalariado + independiente',
  pensionado: 'Pensionado',
  sinIngreso: 'Sin ingreso fijo',
}

/** ¿La app debe calcular deducciones de planilla para este tipo? */
export function hasPayrollDeductions(t?: string): boolean {
  return t === 'asalariado' || t === 'ambos' || t === 'pensionado' || t === undefined
}

/** Nombre a mostrar de la deducción de ley principal (universal) */
export function statutoryLabel(p: { statutoryName?: string; statutory?: StatutoryDeduction[] }): string {
  if (p.statutory?.length) {
    return p.statutory.length === 1 ? p.statutory[0].name : 'Deducciones de ley'
  }
  return p.statutoryName?.trim() || DEFAULT_STATUTORY_NAME
}

export interface StatutoryRow {
  name: string
  pct: number
  /** monto en el período del comprobante */
  amount: number
  /** true si el techo de cotización limitó la base */
  capped: boolean
}

export interface PayrollBreakdown {
  /** período en el que están expresados gross/ccss/deducciones/net */
  period: PayPeriod
  gross: number
  /** total de deducciones de ley en el período (seguro social, pensión…) */
  ccss: number
  /** detalle de cada deducción de ley */
  statutoryRows: StatutoryRow[]
  /** impuesto sobre la renta del período (0 si está desactivado) */
  tax: number
  /** deducciones reales (créditos, embargos…) — SIN contar adelantos */
  deductions: { name: string; amount: number; debtId?: string }[]
  /** adelantos de salario: parte de tu pago (ej. tu 1ª quincena) */
  advances: { name: string; amount: number }[]
  advanceTotal: number
  totalDeductions: number
  /** líquido del comprobante en su período (exacto, con céntimos) */
  net: number
  settlementNet: number
  /** agregados mensuales (para presupuesto, salario y proyecciones) */
  monthlyNet: number
  monthlyAdvance: number
  monthlySettlement: number
  /** ingreso mensual gravable (bruto mensual − deducciones de ley) */
  monthlyTaxable: number
}

/** Impuesto progresivo sobre el ingreso mensual gravable */
export function progressiveTax(monthlyTaxable: number, brackets: TaxBracket[]): number {
  if (monthlyTaxable <= 0 || !brackets.length) return 0
  // los tramos deben ir de menor a mayor; el "sin límite" siempre al final
  const sorted = [...brackets].sort((a, b) => {
    if (a.upTo == null) return 1
    if (b.upTo == null) return -1
    return a.upTo - b.upTo
  })
  let tax = 0
  let prev = 0
  for (const b of sorted) {
    const top = b.upTo == null ? Infinity : b.upTo
    if (monthlyTaxable <= prev) break
    const slice = Math.min(monthlyTaxable, top) - prev
    if (slice > 0) tax += slice * (b.pct / 100)
    prev = top
    if (!Number.isFinite(top)) break
  }
  return round2(tax)
}

/**
 * Deducciones de ley efectivas. Una lista vacía A PROPÓSITO (independientes)
 * se respeta; solo cuando el campo no existe se usa el % legado.
 */
export function statutoryList(p: PayrollConfig): StatutoryDeduction[] {
  if (p.statutory) return p.statutory
  return [{ id: 'legacy', name: statutoryLabel(p), pct: p.ccssPct ?? 0, cap: 0 }]
}

export function payrollBreakdown(p: PayrollConfig): PayrollBreakdown {
  const period: PayPeriod = p.inputPeriod ?? 'monthly'
  const gross = Math.max(0, p.gross)
  const f = periodToMonthlyFactor(period)
  const monthlyGross = gross * f

  // Deducciones de ley: el techo de cotización se aplica al bruto MENSUAL
  const rows: StatutoryRow[] = statutoryList(p).map((d) => {
    const cap = d.cap && d.cap > 0 ? d.cap : 0
    const base = cap > 0 ? Math.min(monthlyGross, cap) : monthlyGross
    const monthlyAmount = base * (d.pct / 100)
    return {
      name: d.name,
      pct: d.pct,
      amount: round2(monthlyAmount / f),
      capped: cap > 0 && monthlyGross > cap,
    }
  })
  const ccss = round2(rows.reduce((t, r) => t + r.amount, 0))

  // Impuesto sobre la renta por tramos (sobre el gravable mensual)
  const monthlyTaxable = Math.max(0, round2(monthlyGross - ccss * f))
  const monthlyTax = p.taxEnabled && p.taxBrackets?.length
    ? progressiveTax(monthlyTaxable, p.taxBrackets)
    : 0
  const tax = round2(monthlyTax / f)

  // Una deducción vinculada a deuda NUNCA es adelanto (la cuota es plata que sale)
  const deductions = p.deductions
    .filter((d) => !d.isAdvance || d.debtId)
    .map((d) => ({ name: d.name, amount: d.amount, debtId: d.debtId }))
  const advances = p.deductions
    .filter((d) => d.isAdvance && !d.debtId)
    .map((d) => ({ name: d.name, amount: d.amount }))
  const other = round2(deductions.reduce((s, d) => s + d.amount, 0))
  const advanceTotal = round2(advances.reduce((s, d) => s + d.amount, 0))
  const totalDeductions = round2(ccss + tax + other)
  const net = Math.max(0, round2(gross - totalDeductions))
  const settlementNet = Math.max(0, round2(net - advanceTotal))

  return {
    period, gross, ccss, statutoryRows: rows, tax, deductions, advances,
    advanceTotal, totalDeductions, net, settlementNet,
    monthlyNet: round2(net * f),
    // El adelanto es un evento del MES (tu 1ª quincena): no se escala por período
    monthlyAdvance: round2(advanceTotal),
    monthlySettlement: Math.max(0, round2(net * f - advanceTotal)),
    monthlyTaxable,
  }
}

/** Pagos extraordinarios que caen en un mes (aguinaldo, 13.º, 14.º…) */
export function extraPaysInMonth(
  p: PayrollConfig,
  monthNumber: number,
  monthlyNet: number,
): { name: string; amount: number }[] {
  return (p.extraPays ?? [])
    .filter((e) => e.month === monthNumber)
    .map((e) => ({
      name: e.name,
      amount: Math.round(e.mode === 'fixed' ? e.amount : monthlyNet * (e.factor || 1)),
    }))
    .filter((e) => e.amount > 0)
}

/** Total anual de pagos extraordinarios */
export function extraPaysYearTotal(p: PayrollConfig, monthlyNet: number): number {
  return Math.round((p.extraPays ?? []).reduce(
    (t, e) => t + (e.mode === 'fixed' ? e.amount : monthlyNet * (e.factor || 1)),
    0,
  ))
}

/** Un valor del comprobante (en bd.period) mostrado en otro período de vista */
export function inView(bd: PayrollBreakdown, value: number, view: PayPeriod): number {
  return convertPeriod(value, bd.period, view)
}

export const PERIOD_LABEL: Record<PayPeriod, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  fortnightly: 'Cada 14 días',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
}

export const PERIOD_UNIT: Record<PayPeriod, string> = {
  daily: 'por día',
  weekly: 'por semana',
  fortnightly: 'cada 14 días',
  biweekly: 'por quincena',
  monthly: 'por mes',
}

/** Los tres períodos con los que se puede VER el dinero en la app */
export const VIEW_PERIODS: PayPeriod[] = ['weekly', 'biweekly', 'monthly']

/** Todos los períodos en los que puede venir un comprobante real */
export const INPUT_PERIODS: PayPeriod[] = ['daily', 'weekly', 'fortnightly', 'biweekly', 'monthly']

// ─── Fechas de pago (plan de ingresos, mejora 3) ─────────────────────────────

function adjustForWeekend(date: Date, rule: PaySchedule['adjustWeekend']): Date {
  if (rule === 'none') return date
  const d = new Date(date)
  const dow = d.getDay() // 0=Dom, 6=Sáb
  if (dow !== 0 && dow !== 6) return d
  if (rule === 'before') {
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
  } else {
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  }
  return d
}

export interface PaydayInfo {
  date: Date
  amount: number
  adjusted: boolean
  label?: string
}

/**
 * Montos por día de pago del mes. Quincenal: cada quincena recibe la MITAD
 * del neto (las deducciones se reparten mitad y mitad entre las dos
 * quincenas, como en las planillas reales).
 */
export function paydayAmounts(schedule: PaySchedule, bd: PayrollBreakdown): { amount: number; label?: string }[] {
  const paydays = (schedule.paydays.length ? schedule.paydays : [30]).slice().sort((a, b) => a - b)
  if (schedule.frequency === 'biweekly' && paydays.length >= 2) {
    const q1 = round2(bd.monthlyNet / 2)
    const q2 = round2(bd.monthlyNet - q1)
    const hasAdvance = bd.monthlyAdvance > 0
    return [
      { amount: q1, label: hasAdvance ? 'adelanto' : undefined },
      { amount: q2, label: hasAdvance ? 'liquidación' : undefined },
    ]
  }
  const per = bd.monthlyNet / paydays.length
  return paydays.map(() => ({ amount: per }))
}

/** Próximas n fechas de pago según el plan, con monto por pago */
export function nextPaydays(schedule: PaySchedule, bd: PayrollBreakdown, n = 4, from = new Date()): PaydayInfo[] {
  const out: PaydayInfo[] = []
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())

  // Diario: todos los días, el neto mensual repartido entre 30
  if (schedule.frequency === 'daily') {
    const per = round2(bd.monthlyNet / 30)
    for (let i = 0; i < n; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      out.push({ date: d, amount: per, adjusted: false })
    }
    return out
  }

  // Cada 14 días: se cuenta desde la fecha de referencia (anchorISO)
  if (schedule.frequency === 'fortnightly') {
    const per = round2((bd.monthlyNet * 12) / 26)
    const anchor = schedule.anchorISO ? new Date(schedule.anchorISO) : new Date(start)
    const d = Number.isNaN(anchor.getTime()) ? new Date(start) : anchor
    const cursor = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    while (cursor < start) cursor.setDate(cursor.getDate() + 14)
    for (let i = 0; i < n; i++) {
      const pay = adjustForWeekend(new Date(cursor), schedule.adjustWeekend)
      out.push({ date: pay, amount: per, adjusted: pay.getTime() !== cursor.getTime() })
      cursor.setDate(cursor.getDate() + 14)
    }
    return out
  }

  if (schedule.frequency === 'weekly') {
    // día de la semana (0=Lun … 6=Dom) → JS (0=Dom)
    const targetJs = (schedule.weekday + 1) % 7
    const d = new Date(start)
    while (d.getDay() !== targetJs) d.setDate(d.getDate() + 1)
    for (let i = 0; i < n; i++) {
      const pay = adjustForWeekend(new Date(d), schedule.adjustWeekend)
      out.push({ date: pay, amount: round2(bd.monthlyNet * 12 / 52), adjusted: pay.getTime() !== d.getTime() })
      d.setDate(d.getDate() + 7)
    }
    return out
  }

  const paydays = (schedule.paydays.length ? schedule.paydays : [30]).slice().sort((a, b) => a - b)
  const amounts = paydayAmounts(schedule, bd)
  let y = start.getFullYear()
  let m = start.getMonth() // 0-11
  let guard = 0
  while (out.length < n && guard++ < 24) {
    for (let i = 0; i < paydays.length; i++) {
      const max = daysInMonth(`${y}-${String(m + 1).padStart(2, '0')}`)
      const exact = new Date(y, m, Math.min(paydays[i], max))
      const pay = adjustForWeekend(exact, schedule.adjustWeekend)
      if (pay >= start && out.length < n) {
        out.push({
          date: pay,
          amount: amounts[i]?.amount ?? bd.monthlyNet / paydays.length,
          adjusted: pay.getTime() !== exact.getTime(),
          label: amounts[i]?.label,
        })
      }
    }
    m++
    if (m > 11) { m = 0; y++ }
  }
  return out
}

export function formatPayday(d: Date): string {
  const week = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${week[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}
