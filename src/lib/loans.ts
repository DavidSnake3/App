// Préstamos informales en las dos direcciones: lo que le presté a alguien
// (me deben) y lo que alguien me prestó a mí (yo debo). Misma mecánica, signo
// contrario: cada movimiento entra o sale de la cuenta que se elija.
import type { Loan, LoanAdvance, LoanKind, LoanPayment } from '../types/finance'

/** Los préstamos guardados antes de esta versión son "le presté" */
export function loanKind(l: Loan): LoanKind {
  return l.kind ?? 'lent'
}

/** Textos de cada dirección, para no repetir la vista dos veces */
export const LOAN_COPY = {
  lent: {
    titulo: 'Le presté',
    subtitulo: 'Lo que te deben y sus abonos',
    saldo: 'Te deben',
    abonado: 'Ya te abonaron',
    totalLabel: 'prestados',
    nuevo: 'Presté plata a alguien',
    masBoton: 'Prestarle más',
    abonoBoton: 'Registrar abono',
    eventoPrestamo: 'Le presté',
    eventoAbono: 'Me abonó',
    vacioTitulo: 'Nadie te debe nada',
    vacioTexto: 'Cuando le prestes plata a alguien, anótalo aquí: llevás cuánto le prestaste, desde cuándo y lo que te va abonando.',
    saldadosTitulo: 'Ya te pagaron',
    personaLabel: '¿A quién le prestaste?',
    cuentaLabel: '¿De cuál cuenta salió la plata?',
    cuentaAbonoLabel: '¿A cuál cuenta entró el abono?',
    pie: 'Lo que prestás sale de la cuenta que elijas y cada abono vuelve a ella. Todo queda anotado en Movimientos.',
  },
  borrowed: {
    titulo: 'Me prestaron',
    subtitulo: 'Lo que debés y lo que ya abonaste',
    saldo: 'Debés',
    abonado: 'Ya abonaste',
    totalLabel: 'que te prestaron',
    nuevo: 'Alguien me prestó plata',
    masBoton: 'Me prestó más',
    abonoBoton: 'Registrar mi abono',
    eventoPrestamo: 'Me prestó',
    eventoAbono: 'Le aboné',
    vacioTitulo: 'No debés nada',
    vacioTexto: 'Si alguien te presta plata (sin fecha ni papeles), anotalo aquí: entra a la cuenta que elijas y llevás cuánto le has abonado.',
    saldadosTitulo: 'Ya pagaste',
    personaLabel: '¿Quién te prestó?',
    cuentaLabel: '¿A cuál cuenta entró la plata?',
    cuentaAbonoLabel: '¿De cuál cuenta salió el abono?',
    pie: 'Lo que te prestan entra a la cuenta que elijas y cada abono sale de ella. Todo queda anotado en Movimientos.',
  },
} as const

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Total del préstamo: el inicial más los que se sumaron después */
export function loanLent(l: Loan): number {
  return round2(l.amount + (l.advances ?? []).reduce((s, a) => s + a.amount, 0))
}

/** Cuánto se ha abonado */
export function loanPaid(l: Loan): number {
  return round2(l.payments.reduce((s, p) => s + p.amount, 0))
}

/** Cuánto falta por saldar */
export function loanRemaining(l: Loan): number {
  return Math.max(0, round2(loanLent(l) - loanPaid(l)))
}

export type LoanEvent =
  | ({ tipo: 'prestamo' } & LoanAdvance)
  | ({ tipo: 'abono' } & LoanPayment)

/** Historial completo del préstamo, de lo más nuevo a lo más viejo */
export function loanHistory(l: Loan): LoanEvent[] {
  const eventos: LoanEvent[] = [
    { tipo: 'prestamo', id: `inicial-${l.id}`, amount: l.amount, dateISO: l.dateISO, note: 'Préstamo inicial', movementId: l.movementId, accountId: l.accountId },
    ...(l.advances ?? []).map((a) => ({ tipo: 'prestamo' as const, ...a })),
    ...l.payments.map((p) => ({ tipo: 'abono' as const, ...p })),
  ]
  return eventos.sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0))
}

export function loanIsSettled(l: Loan): boolean {
  return loanRemaining(l) <= 0
}

export function loanProgress(l: Loan): number {
  const total = loanLent(l)
  if (total <= 0) return 1
  return Math.min(1, loanPaid(l) / total)
}

/**
 * Días que han pasado desde esa fecha.
 *
 * Se leen año-mes-día del texto: `new Date('2026-09-01')` se interpreta como
 * medianoche UTC y en América eso caía en el día anterior ("ayer" para algo
 * anotado hoy).
 */
export function daysSince(dateISO: string, today = new Date()): number {
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return 0
  const desde = new Date(y, m - 1, d).getTime()
  const hoy = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.max(0, Math.floor((hoy - desde) / 86_400_000))
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
    prestado: round2(loans.reduce((s, l) => s + loanLent(l), 0)),
    abonado: round2(loans.reduce((s, l) => s + loanPaid(l), 0)),
    pendiente: round2(activos.reduce((s, l) => s + loanRemaining(l), 0)),
    personas: new Set(activos.map((l) => l.person.trim().toLowerCase())).size,
    activos: activos.length,
  }
}

/**
 * Efecto de los préstamos en el dinero de un mes: lo que presté SALE de la
 * cuenta y lo que me abonaron ENTRA.
 *
 * Los préstamos y abonos que ya generaron su propio MOVIMIENTO no se cuentan
 * aquí: ese movimiento ya mueve la cuenta. Así conviven los registros viejos
 * (sin movimiento) con los nuevos sin contar nada dos veces.
 */
export function loanFlowInMonth(loans: Loan[], monthId: string): number {
  let flow = 0
  for (const l of loans) {
    // si me prestaron a mí, el préstamo ENTRA y el abono SALE
    const signo = loanKind(l) === 'borrowed' ? -1 : 1
    if (!l.movementId && l.dateISO.slice(0, 7) === monthId) flow -= signo * l.amount
    for (const a of l.advances ?? []) {
      if (!a.movementId && a.dateISO.slice(0, 7) === monthId) flow -= signo * a.amount
    }
    for (const p of l.payments) {
      if (!p.movementId && p.dateISO.slice(0, 7) === monthId) flow += signo * p.amount
    }
  }
  return round2(flow)
}

/** Solo los de una dirección */
export function loansOfKind(loans: Loan[], kind: LoanKind): Loan[] {
  return loans.filter((l) => loanKind(l) === kind)
}
