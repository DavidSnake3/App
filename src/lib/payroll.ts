// Comprobante salarial y plan de pago del salario (mejoras 2, 3, 8 y 9)
// El comprobante REAL del usuario puede ser semanal, quincenal o mensual:
// todos los montos se guardan en ese período (inputPeriod) y se convierten
// con exactitud de céntimos, igual que una planilla real.
import type { PayPeriod, PayrollConfig, PaySchedule } from '../types/finance'
import { daysInMonth } from './dates'

export const DEFAULT_CCSS_PCT = 10.83 // CCSS empleado (Costa Rica)
export const DEFAULT_STATUTORY_NAME = 'CCSS'

/**
 * Deducción de ley del empleado por país (referencia editable, mejora 10).
 * Son porcentajes orientativos del aporte del EMPLEADO: cada usuario puede
 * corregir el nombre y el % en Ajustes, así la app sirve en cualquier país.
 */
export interface CountryPreset {
  id: string
  country: string
  label: string
  pct: number
  currency: string
}

export const COUNTRY_PRESETS: CountryPreset[] = [
  { id: 'cr', country: 'Costa Rica', label: 'CCSS', pct: 10.83, currency: 'CRC' },
  { id: 'mx', country: 'México', label: 'IMSS', pct: 2.78, currency: 'MXN' },
  { id: 'gt', country: 'Guatemala', label: 'IGSS', pct: 4.83, currency: 'GTQ' },
  { id: 'sv', country: 'El Salvador', label: 'ISSS + AFP', pct: 10.25, currency: 'USD' },
  { id: 'hn', country: 'Honduras', label: 'IHSS + RAP', pct: 5.5, currency: 'HNL' },
  { id: 'ni', country: 'Nicaragua', label: 'INSS', pct: 7, currency: 'NIO' },
  { id: 'pa', country: 'Panamá', label: 'Seguro Social', pct: 9.75, currency: 'PAB' },
  { id: 'do', country: 'Rep. Dominicana', label: 'TSS (SFS + AFP)', pct: 5.91, currency: 'DOP' },
  { id: 'co', country: 'Colombia', label: 'Salud + Pensión', pct: 8, currency: 'COP' },
  { id: 'pe', country: 'Perú', label: 'ONP / AFP', pct: 13, currency: 'PEN' },
  { id: 'ec', country: 'Ecuador', label: 'IESS', pct: 9.45, currency: 'USD' },
  { id: 'cl', country: 'Chile', label: 'AFP + Salud', pct: 17, currency: 'CLP' },
  { id: 'ar', country: 'Argentina', label: 'Jubilación + Obra social', pct: 17, currency: 'ARS' },
  { id: 'es', country: 'España', label: 'Seguridad Social', pct: 6.47, currency: 'EUR' },
  { id: 'us', country: 'Estados Unidos', label: 'FICA', pct: 7.65, currency: 'USD' },
  { id: 'other', country: 'Otro país', label: 'Deducción de ley', pct: 0, currency: '' },
]

export function countryPreset(id?: string): CountryPreset | undefined {
  return COUNTRY_PRESETS.find((c) => c.id === id)
}

/** Nombre a mostrar de la deducción de ley (universal) */
export function statutoryLabel(p: { statutoryName?: string; countryId?: string }): string {
  return p.statutoryName?.trim() || countryPreset(p.countryId)?.label || DEFAULT_STATUTORY_NAME
}

/** Factor período → mensual (semanal usa 52 semanas / 12 meses) */
export function periodToMonthlyFactor(p: PayPeriod): number {
  if (p === 'weekly') return 52 / 12
  if (p === 'biweekly') return 2
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

export interface PayrollBreakdown {
  /** período en el que están expresados gross/ccss/deducciones/net */
  period: PayPeriod
  gross: number
  /** monto que quita la CCSS en el período del comprobante (automático) */
  ccss: number
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
}

export function payrollBreakdown(p: PayrollConfig): PayrollBreakdown {
  const period: PayPeriod = p.inputPeriod ?? 'monthly'
  const gross = Math.max(0, p.gross)
  // exacto a céntimos, como los comprobantes reales (ej. 10,916.64)
  const ccss = round2(gross * (p.ccssPct / 100))
  // Una deducción vinculada a deuda NUNCA es adelanto (la cuota es plata que sale)
  const deductions = p.deductions
    .filter((d) => !d.isAdvance || d.debtId)
    .map((d) => ({ name: d.name, amount: d.amount, debtId: d.debtId }))
  const advances = p.deductions
    .filter((d) => d.isAdvance && !d.debtId)
    .map((d) => ({ name: d.name, amount: d.amount }))
  const other = round2(deductions.reduce((s, d) => s + d.amount, 0))
  const advanceTotal = round2(advances.reduce((s, d) => s + d.amount, 0))
  const totalDeductions = round2(ccss + other)
  const net = Math.max(0, round2(gross - totalDeductions))
  const settlementNet = Math.max(0, round2(net - advanceTotal))
  const f = periodToMonthlyFactor(period)
  return {
    period, gross, ccss, deductions, advances, advanceTotal, totalDeductions,
    net, settlementNet,
    monthlyNet: round2(net * f),
    // El adelanto es un evento del MES (tu 1ª quincena): no se escala por período
    monthlyAdvance: round2(advanceTotal),
    monthlySettlement: Math.max(0, round2(net * f - advanceTotal)),
  }
}

/** Un valor del comprobante (en bd.period) mostrado en otro período de vista */
export function inView(bd: PayrollBreakdown, value: number, view: PayPeriod): number {
  return convertPeriod(value, bd.period, view)
}

export const PERIOD_LABEL: Record<PayPeriod, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
}

export const PERIOD_UNIT: Record<PayPeriod, string> = {
  weekly: 'por semana',
  biweekly: 'por quincena',
  monthly: 'por mes',
}

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
 * Montos por día de pago del mes (en colones mensuales). Quincenal: cada
 * quincena recibe la MITAD del neto (la CCSS y las deducciones se reparten
 * mitad y mitad entre las dos quincenas, como en las planillas reales).
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
