// Comprobante salarial y plan de pago del salario (mejoras 2, 3 y 8)
import type { PayrollConfig, PaySchedule } from '../types/finance'
import { daysInMonth } from './dates'

export const DEFAULT_CCSS_PCT = 10.83 // CCSS empleado (Costa Rica)

export interface PayrollBreakdown {
  gross: number
  /** monto que quita la CCSS (automático a partir del %) */
  ccss: number
  /** deducciones reales (créditos, embargos…) — SIN contar adelantos */
  deductions: { name: string; amount: number; debtId?: string }[]
  /** adelantos de salario: parte de tu pago (ej. tu 1ª quincena) */
  advances: { name: string; amount: number }[]
  advanceTotal: number
  /** deducciones reales totales (CCSS + otras, sin adelantos) */
  totalDeductions: number
  /** tu ingreso mensual REAL: bruto − CCSS − deducciones reales */
  net: number
  /** lo que llega en la liquidación (neto − adelantos ya recibidos) */
  settlementNet: number
}

/**
 * Desglose del comprobante. Los adelantos NO reducen tu ingreso mensual:
 * solo cambian CUÁNDO te llega (1ª quincena vs. liquidación).
 */
export function payrollBreakdown(p: PayrollConfig): PayrollBreakdown {
  const gross = Math.max(0, p.gross)
  // CCSS a colón entero: así las filas visibles siempre suman el total visible
  const ccss = Math.round(gross * (p.ccssPct / 100))
  // Una deducción vinculada a deuda NUNCA es adelanto (la cuota es plata que sale)
  const deductions = p.deductions
    .filter((d) => !d.isAdvance || d.debtId)
    .map((d) => ({ name: d.name, amount: d.amount, debtId: d.debtId }))
  const advances = p.deductions
    .filter((d) => d.isAdvance && !d.debtId)
    .map((d) => ({ name: d.name, amount: d.amount }))
  const other = deductions.reduce((s, d) => s + d.amount, 0)
  const advanceTotal = advances.reduce((s, d) => s + d.amount, 0)
  const totalDeductions = ccss + other
  const net = Math.max(0, gross - totalDeductions)
  return {
    gross, ccss, deductions, advances, advanceTotal, totalDeductions,
    net,
    settlementNet: Math.max(0, net - advanceTotal),
  }
}

/** Divide un monto mensual según el período de vista del comprobante */
export function perPeriod(monthly: number, period: PayrollConfig['viewPeriod']): number {
  if (period === 'biweekly') return monthly / 2
  if (period === 'weekly') return monthly * 12 / 52
  return monthly
}

export const PERIOD_LABEL: Record<PayrollConfig['viewPeriod'], string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
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
 * Montos por día de pago del mes. Si te pagan quincenal y tienes un adelanto
 * configurado, la 1ª quincena = adelanto y la 2ª = liquidación (neto − adelanto).
 */
export function paydayAmounts(schedule: PaySchedule, bd: PayrollBreakdown): { amount: number; label?: string }[] {
  const paydays = (schedule.paydays.length ? schedule.paydays : [30]).slice().sort((a, b) => a - b)
  if (schedule.frequency === 'biweekly' && paydays.length >= 2 && bd.advanceTotal > 0 && bd.advanceTotal < bd.net) {
    return [
      { amount: bd.advanceTotal, label: 'adelanto' },
      { amount: bd.settlementNet, label: 'liquidación' },
    ]
  }
  const per = bd.net / paydays.length
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
      out.push({ date: pay, amount: bd.net * 12 / 52, adjusted: pay.getTime() !== d.getTime() })
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
          amount: amounts[i]?.amount ?? bd.net / paydays.length,
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
