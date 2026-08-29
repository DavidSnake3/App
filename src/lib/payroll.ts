// Comprobante salarial y plan de pago del salario (mejoras 2, 3 y 8)
import type { PayrollConfig, PaySchedule } from '../types/finance'
import { daysInMonth } from './dates'

export const DEFAULT_CCSS_PCT = 10.83 // CCSS empleado (Costa Rica)

export interface PayrollBreakdown {
  gross: number
  ccss: number
  deductions: { name: string; amount: number; debtId?: string }[]
  totalDeductions: number
  net: number
}

/** Calcula el desglose del comprobante: bruto − CCSS − deducciones = neto */
export function payrollBreakdown(p: PayrollConfig): PayrollBreakdown {
  const gross = Math.max(0, p.gross)
  const ccss = Math.round(gross * (p.ccssPct / 100) * 100) / 100
  const deductions = p.deductions.map((d) => ({ name: d.name, amount: d.amount, debtId: d.debtId }))
  const other = deductions.reduce((s, d) => s + d.amount, 0)
  const totalDeductions = ccss + other
  return { gross, ccss, deductions, totalDeductions, net: Math.max(0, gross - totalDeductions) }
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
}

/** Próximas n fechas de pago según el plan, con monto neto por pago */
export function nextPaydays(schedule: PaySchedule, netMonthly: number, n = 4, from = new Date()): PaydayInfo[] {
  const out: PaydayInfo[] = []
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())

  if (schedule.frequency === 'weekly') {
    // día de la semana (0=Lun … 6=Dom) → JS (0=Dom)
    const targetJs = (schedule.weekday + 1) % 7
    const d = new Date(start)
    while (d.getDay() !== targetJs) d.setDate(d.getDate() + 1)
    for (let i = 0; i < n; i++) {
      const pay = adjustForWeekend(new Date(d), schedule.adjustWeekend)
      out.push({ date: pay, amount: netMonthly * 12 / 52, adjusted: pay.getTime() !== d.getTime() })
      d.setDate(d.getDate() + 7)
    }
    return out
  }

  const paydays = (schedule.paydays.length ? schedule.paydays : [30]).slice().sort((a, b) => a - b)
  const perPay = netMonthly / paydays.length
  let y = start.getFullYear()
  let m = start.getMonth() // 0-11
  let guard = 0
  while (out.length < n && guard++ < 24) {
    for (const day of paydays) {
      const max = daysInMonth(`${y}-${String(m + 1).padStart(2, '0')}`)
      const exact = new Date(y, m, Math.min(day, max))
      const pay = adjustForWeekend(exact, schedule.adjustWeekend)
      if (pay >= start && out.length < n) {
        out.push({ date: pay, amount: perPay, adjusted: pay.getTime() !== exact.getTime() })
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
