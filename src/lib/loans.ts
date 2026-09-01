// Préstamos propios: plata que le presté a alguien (cuentas por cobrar).
import type { Loan } from '../types/finance'

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Cuánto me ha abonado */
export function loanPaid(l: Loan): number {
  return round2(l.payments.reduce((s, p) => s + p.amount, 0))
}

/** Cuánto me debe todavía */
export function loanRemaining(l: Loan): number {
  return Math.max(0, round2(l.amount - loanPaid(l)))
}

export function loanIsSettled(l: Loan): boolean {
  return loanRemaining(l) <= 0
}

export function loanProgress(l: Loan): number {
  if (l.amount <= 0) return 1
  return Math.min(1, loanPaid(l) / l.amount)
}

/** Días que han pasado desde que le presté */
export function daysSince(dateISO: string, today = new Date()): number {
  const d = new Date(dateISO)
  if (Number.isNaN(d.getTime())) return 0
  const ms = today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

/** "hace 3 días", "hace 2 meses"… */
export function sinceLabel(dateISO: string, today = new Date()): string {
  const d = daysSince(dateISO, today)
  if (d === 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  const meses = Math.floor(d / 30)
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anios = Math.floor(meses / 12)
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`
}

export interface LoanTotals {
  prestado: number
  abonado: number
  pendiente: number
  personas: number
  activos: number
}

export function loanTotals(loans: Loan[]): LoanTotals {
  const activos = loans.filter((l) => !loanIsSettled(l))
  return {
    prestado: round2(loans.reduce((s, l) => s + l.amount, 0)),
    abonado: round2(loans.reduce((s, l) => s + loanPaid(l), 0)),
    pendiente: round2(activos.reduce((s, l) => s + loanRemaining(l), 0)),
    personas: new Set(activos.map((l) => l.person.trim().toLowerCase())).size,
    activos: activos.length,
  }
}

/**
 * Efecto de los préstamos en el dinero de un mes: lo que presté SALE del
 * banco y lo que me abonaron ENTRA. Se usa para el saldo real.
 */
export function loanFlowInMonth(loans: Loan[], monthId: string): number {
  let flow = 0
  for (const l of loans) {
    if (l.dateISO.slice(0, 7) === monthId) flow -= l.amount
    for (const p of l.payments) {
      if (p.dateISO.slice(0, 7) === monthId) flow += p.amount
    }
  }
  return round2(flow)
}
