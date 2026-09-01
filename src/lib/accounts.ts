// Cuentas contables: efectivo, cuenta corriente, ahorros, inversión y tarjetas
// de crédito. De aquí sale el EFECTIVO REAL (lo que de verdad tienes) y la
// DEUDA de las tarjetas (lo que gastaste con ellas y aún no has pagado).
//
// Regla de oro para no contar dos veces:
//   · Un gasto con tarjeta de crédito NO baja tu efectivo: sube la deuda.
//   · Pagar la tarjeta SÍ baja tu efectivo y baja la deuda.
//   · Las cuentas de crédito nunca suman al efectivo real.
import type {
  Account, AccountType, AppSettings, Debt, Installment, Loan, MonthData, Movement,
} from '../types/finance'
import { addMonthsToId, currentMonthId, daysInMonth, monthDiff, parseMonthId } from './dates'
import { debtIsActiveInMonth } from './finance'

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export const ACCOUNT_TYPES: { type: AccountType; label: string; desc: string; icon: string }[] = [
  { type: 'efectivo', label: 'Efectivo', desc: 'Plata en la mano o en la casa', icon: 'efectivo' },
  { type: 'corriente', label: 'Cuenta corriente', desc: 'Donde te cae el salario, débito', icon: 'banco' },
  { type: 'ahorros', label: 'Cuenta de ahorros', desc: 'Plata guardada aparte', icon: 'ahorro' },
  { type: 'credito', label: 'Tarjeta de crédito', desc: 'Lo que gastes se vuelve deuda', icon: 'tarjeta' },
  { type: 'inversion', label: 'Inversión', desc: 'Certificados, bolsa, cripto', icon: 'trabajo' },
]

export function accountTypeLabel(t: AccountType): string {
  return ACCOUNT_TYPES.find((a) => a.type === t)?.label ?? 'Cuenta'
}

export function isCredit(a: Account): boolean {
  return a.type === 'credito'
}

/** Cuentas activas (sin archivar) */
export function activeAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => !a.archived)
}

/** Cuenta principal: donde cae el salario y de donde salen los pagos sin cuenta */
export function mainAccount(accounts: Account[]): Account | undefined {
  const act = activeAccounts(accounts)
  return act.find((a) => a.isMain && !isCredit(a))
    ?? act.find((a) => !isCredit(a) && a.includeInTotal)
}

export function accountById(accounts: Account[], id?: string): Account | undefined {
  if (!id) return undefined
  return accounts.find((a) => a.id === id)
}

// ─── Movimientos ─────────────────────────────────────────────────────────────

/** Todos los movimientos de todos los meses, ordenados del más nuevo al viejo */
export function allMovements(months: Record<string, MonthData>): Movement[] {
  const list: Movement[] = []
  for (const m of Object.values(months)) list.push(...(m.movements ?? []))
  return list.sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0))
}

/** Movimientos de un mes */
export function monthMovements(m: MonthData | undefined): Movement[] {
  return [...(m?.movements ?? [])].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1))
}

/**
 * Efecto de un movimiento sobre el EFECTIVO de una cuenta concreta.
 * Las cuentas de crédito no manejan efectivo: su saldo se calcula en cardDebt.
 */
export function movementDelta(mv: Movement, accountId: string, accounts: Account[]): number {
  const cuenta = accountById(accounts, accountId)
  if (cuenta && isCredit(cuenta)) return 0
  if (mv.accountId === accountId) {
    // sale de esta cuenta (gasto o transferencia) o entra (ingreso)
    return mv.kind === 'ingreso' ? mv.amount : -mv.amount
  }
  if (mv.toAccountId === accountId && mv.kind === 'transferencia') {
    // llega desde otra cuenta (incluye adelanto de efectivo de una tarjeta)
    return mv.amount
  }
  return 0
}

/**
 * Movimientos que SÍ mueven efectivo en un mes (neto: ingresos − gastos).
 * Los gastos con tarjeta quedan fuera: esos suben la deuda, no bajan el banco.
 */
export function cashMovementsNet(m: MonthData | undefined, accounts: Account[]): number {
  let net = 0
  for (const mv of m?.movements ?? []) {
    const origen = accountById(accounts, mv.accountId)
    const destino = accountById(accounts, mv.toAccountId)
    const origenEsCredito = Boolean(origen && isCredit(origen))
    if (mv.kind === 'ingreso') {
      if (!origenEsCredito) net += mv.amount
    } else if (mv.kind === 'gasto') {
      if (!origenEsCredito) net -= mv.amount
    } else {
      // transferencia: solo mueve el total si sale del efectivo hacia una tarjeta
      const destinoEsCredito = Boolean(destino && isCredit(destino))
      if (!origenEsCredito && destinoEsCredito) net -= mv.amount
      if (origenEsCredito && destino && !destinoEsCredito) net += mv.amount
    }
  }
  return round2(net)
}

/** Total de gastos del mes registrados como movimientos (con o sin tarjeta) */
export function movementsExpense(m: MonthData | undefined): number {
  return round2((m?.movements ?? []).filter((x) => x.kind === 'gasto').reduce((s, x) => s + x.amount, 0))
}

/** Total de ingresos extra registrados como movimientos */
export function movementsIncome(m: MonthData | undefined): number {
  return round2((m?.movements ?? []).filter((x) => x.kind === 'ingreso').reduce((s, x) => s + x.amount, 0))
}

// ─── Saldo de cada cuenta ────────────────────────────────────────────────────

export interface BalanceCtx {
  months: Record<string, MonthData>
  accounts: Account[]
  installments: Installment[]
  debts: Debt[]
  settings: AppSettings
  loans?: Loan[]
  today?: Date
  /**
   * Flujo general del sistema de meses (salario recibido − pagos en efectivo −
   * aportes al ahorro + préstamos). Se atribuye a la cuenta principal.
   */
  generalFlow?: number
}

/** Saldo de una cuenta que NO es de crédito */
export function accountBalance(a: Account, ctx: BalanceCtx): number {
  if (isCredit(a)) return -cardDebt(a, ctx)
  let saldo = a.openingBalance
  for (const mv of allMovements(ctx.months)) {
    if (mv.dateISO < a.openingISO) continue
    saldo += movementDelta(mv, a.id, ctx.accounts)
  }
  const esPrincipal = mainAccount(ctx.accounts)?.id === a.id
  if (esPrincipal) saldo += (ctx.generalFlow ?? 0) - (a.flowSnapshot ?? 0)
  return round2(saldo)
}

/** Efectivo real: la suma de lo que hay en las cuentas que no son de crédito */
export function totalCash(ctx: BalanceCtx): number {
  return round2(activeAccounts(ctx.accounts)
    .filter((a) => !isCredit(a) && a.includeInTotal)
    .reduce((s, a) => s + accountBalance(a, ctx), 0))
}

// ─── Tarjetas de crédito ─────────────────────────────────────────────────────

/** Interés mensual efectivo de la tarjeta, en % */
export function monthlyRate(a: Account): number {
  const c = a.credit
  if (!c || !c.rate) return 0
  return c.ratePeriod === 'annual' ? c.rate / 12 : c.rate
}

/** Cuotas de compras a plazos que caen en un mes concreto */
export function installmentsInMonth(list: Installment[], accountId: string, monthId: string): Installment[] {
  return list.filter((i) => {
    if (i.accountId !== accountId) return false
    const idx = monthDiff(i.startMonthId, monthId)
    return idx >= 0 && idx < i.count
  })
}

/** Número de cuota que corresponde a un mes (1-based) */
export function installmentNumber(i: Installment, monthId: string): number {
  return monthDiff(i.startMonthId, monthId) + 1
}

export function installmentPaidCount(i: Installment): number {
  return Object.values(i.payments).filter((p) => p.paid).length
}

export function installmentRemaining(i: Installment): number {
  const pagadas = installmentPaidCount(i)
  return round2(Math.max(0, (i.count - pagadas) * i.monthly))
}

export function installmentEndMonthId(i: Installment): string {
  return addMonthsToId(i.startMonthId, Math.max(0, i.count - 1))
}

export function installmentIsDone(i: Installment): boolean {
  return installmentPaidCount(i) >= i.count
}

/**
 * Deuda actual de una tarjeta: lo que arrastraba + todo lo gastado con ella
 * (movimientos + gastos y cuotas de deuda pagados con la tarjeta + cuotas de
 * compras a plazos ya devengadas) − lo que ya le has pagado + intereses.
 */
export function cardDebt(a: Account, ctx: BalanceCtx): number {
  if (!isCredit(a)) return 0
  const nowId = currentMonthId()
  let deuda = a.credit?.openingDebt ?? 0

  for (const mv of allMovements(ctx.months)) {
    if (mv.accountId === a.id) {
      if (mv.kind === 'gasto') deuda += mv.amount
      if (mv.kind === 'ingreso') deuda -= mv.amount // reverso / nota de crédito
      if (mv.kind === 'transferencia') deuda += mv.amount // adelanto de efectivo
    }
    // pago de la tarjeta: entra plata a la tarjeta y baja la deuda
    if (mv.toAccountId === a.id && mv.kind === 'transferencia') deuda -= mv.amount
  }

  // gastos del mes marcados como pagados con esta tarjeta
  for (const m of Object.values(ctx.months)) {
    for (const e of m.expenses) {
      if (e.accountId === a.id && e.paid) deuda += e.amount
    }
  }
  // cuotas de deudas pagadas con esta tarjeta
  for (const d of ctx.debts) {
    for (const p of Object.values(d.payments)) {
      if (p.accountId === a.id && p.paid) deuda += p.amount
    }
  }

  // cuotas de compras a plazos ya devengadas (desde su mes hasta el actual)
  for (const i of ctx.installments) {
    if (i.accountId !== a.id) continue
    for (let n = 0; n < i.count; n++) {
      const mid = addMonthsToId(i.startMonthId, n)
      if (mid > nowId) break
      if (!i.payments[mid]?.paid) deuda += i.monthly
    }
  }

  return round2(Math.max(0, deuda))
}

export interface CardStatement {
  /** deuda total de la tarjeta hoy */
  debt: number
  /** fecha de corte del ciclo que se está pagando */
  cutoffISO: string
  /** fecha límite de pago de ese corte */
  dueISO: string
  /** lo que cerró en el último corte y hay que pagar */
  statementBalance: number
  /** lo que ya se abonó después del corte */
  paidAfterCutoff: number
  /** lo que falta para dejar la tarjeta en cero de ese corte */
  pending: number
  /** días que faltan para la fecha de pago (negativo = ya venció) */
  daysToDue: number
  /** true si ya pasó la fecha de pago con saldo pendiente */
  overdue: boolean
  /** interés YA acumulado por atrasos (0 si va al día) */
  interest: number
  /** lo que le cobrarían de interés si no paga este corte a tiempo */
  interestIfUnpaid: number
  /** total a pagar con interés incluido */
  totalWithInterest: number
  /** gastos del ciclo nuevo (aún no cortado) */
  currentCycle: number
  /** crédito disponible */
  available: number
  /** % del límite usado (0-1) */
  usage: number
  /** interés mensual aplicado */
  monthlyRate: number
  /** interés mensual de mora (corriente + los puntos que cobre el banco) */
  moratoryRate: number
  /** pago mínimo del mes, con su desglose */
  minimum: CardMinimum
  /** cargo por gestión de cobranza si está en mora */
  lateFee: number
  /** % del límite usado medido al corte (es el que "reporta" el banco) */
  usageAtCutoff: number
}

/**
 * Pago mínimo del mes, desglosado como lo exige el estado de cuenta
 * (Costa Rica: Decreto 35867-MEIC, art. 15 inciso e).
 */
export interface CardMinimum {
  /** parte que baja la deuda: principal ÷ plazo, o el % del saldo */
  amortization: number
  /** intereses corrientes del saldo financiado */
  interest: number
  /** cuotas del mes de las compras a plazos */
  installments: number
  /** intereses de mora acumulados */
  moratory: number
  /** cargos por gestión de cobranza */
  fees: number
  /** total a pagar como mínimo */
  total: number
  /** qué parte del mínimo baja de verdad la deuda (0-1) */
  toCapital: number
  /** monto del mínimo que baja la deuda (amortización + cuotas de planes) */
  capital: number
}

/** Simulación: qué pasa si pagas SOLO el mínimo, mes a mes */
export interface PayoffSim {
  /** meses que tardarías (null = no se termina en un plazo razonable) */
  months: number | null
  /** intereses que pagarías en total */
  interest: number
  /** total desembolsado */
  paid: number
  /** true cuando pagando el mínimo la deuda no se liquida */
  perpetual: boolean
  /** horizonte con el que se explica el caso perpetuo (el plazo de la tarjeta) */
  horizonMonths: number
  /** cuánto seguirías debiendo al final de ese horizonte */
  balanceAtHorizon: number
  /** cuánto habrías pagado en ese horizonte */
  paidAtHorizon: number
}

/** Fecha (Date) de un día del mes, ajustada si el mes es más corto */
function dateOf(monthId: string, day: number): Date {
  const { year, month } = parseMonthId(monthId)
  return new Date(year, month - 1, Math.min(Math.max(1, day), daysInMonth(monthId)))
}

function isoOf(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Estado de cuenta de la tarjeta: qué cerró en el último corte, cuándo hay que
 * pagarlo, cuánto se lleva abonado y cuánto interés se cobraría si no se paga.
 *
 * Ciclo: los gastos hechos hasta el día de CORTE forman el saldo del estado de
 * cuenta; ese saldo se paga el día de PAGO (si el día de pago es menor o igual
 * al de corte, cae en el mes siguiente).
 */
export function cardStatement(a: Account, ctx: BalanceCtx): CardStatement {
  const hoy = ctx.today ?? new Date()
  const c = a.credit
  const debt = cardDebt(a, ctx)
  const rate = monthlyRate(a)

  if (!c) {
    return {
      debt, cutoffISO: '', dueISO: '', statementBalance: debt, paidAfterCutoff: 0,
      pending: debt, daysToDue: 0, overdue: false, interest: 0, interestIfUnpaid: 0,
      totalWithInterest: debt,
      currentCycle: 0, available: 0, usage: 0, usageAtCutoff: 0,
      monthlyRate: rate, moratoryRate: moratoryMonthlyRate(a), lateFee: 0,
      minimum: cardMinimum(a, debt, 0, 0),
    }
  }

  const nowId = currentMonthId()
  const movs = allMovements(ctx.months)

  /** Todo lo cargado a la tarjeta hasta una fecha (compras, cuotas, adelantos) */
  const cargadoHasta = (hastaISO: string): number => {
    let total = c.openingDebt ?? 0
    for (const mv of movs) {
      if (mv.accountId !== a.id || mv.dateISO > hastaISO) continue
      total += mv.kind === 'ingreso' ? -mv.amount : mv.amount
    }
    for (const m of Object.values(ctx.months)) {
      for (const e of m.expenses) {
        if (e.accountId !== a.id || !e.paid) continue
        const iso = (e.paidAt ?? `${m.id}-15`).slice(0, 10)
        if (iso <= hastaISO) total += e.amount
      }
    }
    for (const d of ctx.debts) {
      for (const [mid, pago] of Object.entries(d.payments)) {
        if (pago.accountId !== a.id || !pago.paid) continue
        const iso = (pago.paidAt ?? `${mid}-15`).slice(0, 10)
        if (iso <= hastaISO) total += pago.amount
      }
    }
    for (const i of ctx.installments) {
      if (i.accountId !== a.id) continue
      for (let n = 0; n < i.count; n++) {
        const mid = addMonthsToId(i.startMonthId, n)
        if (i.payments[mid]?.paid) continue
        if (isoOf(dateOf(mid, i.dueDay || 1)) <= hastaISO) total += i.monthly
      }
    }
    return round2(total)
  }

  /** Todo lo abonado a la tarjeta hasta una fecha */
  const abonadoHasta = (hastaISO: string): number => round2(movs.reduce((sum, mv) => (
    mv.toAccountId === a.id && mv.kind === 'transferencia' && mv.dateISO <= hastaISO
      ? sum + mv.amount
      : sum
  ), 0))

  /** Fecha de pago que corresponde al corte de un mes */
  const pagoDeCorte = (corteMonthId: string): Date => {
    const mesPago = c.dueDay > c.cutoffDay ? corteMonthId : addMonthsToId(corteMonthId, 1)
    return dateOf(mesPago, c.dueDay)
  }

  // último corte ya ocurrido
  let corte = dateOf(nowId, c.cutoffDay)
  if (corte > hoy) corte = dateOf(addMonthsToId(nowId, -1), c.cutoffDay)
  const corteISO = isoOf(corte)
  const corteMonthId = corteISO.slice(0, 7)
  const pago = pagoDeCorte(corteMonthId)
  const pagoISO = isoOf(pago)

  // saldo que cerró en este corte y cuánto se ha abonado desde entonces
  const cerrado = cargadoHasta(corteISO)
  const abonadoAntes = abonadoHasta(corteISO)
  const statementBalance = round2(Math.max(0, cerrado - abonadoAntes))
  const abonadoDespues = round2(abonadoHasta(isoOf(hoy)) - abonadoAntes)
  const pending = round2(Math.max(0, statementBalance - abonadoDespues))

  const msDia = 86_400_000
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const daysToDue = Math.round((pago.getTime() - hoy0.getTime()) / msDia)
  const overdue = daysToDue < 0 && pending > 0

  /**
   * Interés. Si paga el corte completo antes de su fecha de pago, es CERO.
   *  · Atraso del ciclo vigente: se cobra por los días de atraso.
   *  · Ciclos anteriores sin pagar: se cobra un mes de interés por cada uno
   *    (así un atraso que ya cruzó otro corte no se pierde de vista).
   */
  let interest = 0
  if (rate > 0) {
    if (overdue) {
      interest += round2(pending * (rate / 100) * (Math.abs(daysToDue) / 30))
    }
    // hasta 6 cortes hacia atrás: lo que quedó sin pagar tras su fecha límite
    for (let k = 1; k <= 6; k++) {
      const prevMonthId = addMonthsToId(corteMonthId, -k)
      const prevCorteISO = isoOf(dateOf(prevMonthId, c.cutoffDay))
      const prevPago = pagoDeCorte(prevMonthId)
      if (prevPago > hoy0) continue
      const prevPendiente = round2(Math.max(0, cargadoHasta(prevCorteISO) - abonadoHasta(isoOf(prevPago))))
      if (prevPendiente <= 0) break
      interest += round2(prevPendiente * (rate / 100))
    }
  }
  interest = round2(interest)

  // cuotas de compras a plazos que caen en el mes del corte
  const cuotasDelMes = round2(ctx.installments
    .filter((i) => i.accountId === a.id)
    .filter((i) => {
      const idx = monthDiff(i.startMonthId, nowId)
      return idx >= 0 && idx < i.count && !i.payments[nowId]?.paid
    })
    .reduce((sum, i) => sum + i.monthly, 0))

  // cargo por gestión de cobranza (Costa Rica: 5% del principal en mora)
  const cfg = minSettings(a)
  let lateFee = 0
  if (overdue && Math.abs(daysToDue) >= cfg.lateFeeAfterDays && cfg.lateFeePct > 0) {
    lateFee = round2(pending * (cfg.lateFeePct / 100))
    if (cfg.lateFeeCap > 0) lateFee = Math.min(lateFee, cfg.lateFeeCap)
  }

  // intereses corrientes del período: lo que se cobraría si no paga de contado
  const interesesDelPeriodo = round2(Math.max(0, statementBalance - cuotasDelMes) * (rate / 100))
  const minimum = cardMinimum(a, statementBalance, interesesDelPeriodo, cuotasDelMes, {
    interest: interest,
    fee: lateFee,
  })

  const limite = c.limit || 0
  return {
    debt,
    cutoffISO: corteISO,
    dueISO: pagoISO,
    statementBalance,
    paidAfterCutoff: round2(Math.max(0, abonadoDespues)),
    pending,
    daysToDue,
    overdue,
    interest,
    interestIfUnpaid: round2(pending * (rate / 100)),
    totalWithInterest: round2(pending + interest + lateFee),
    currentCycle: round2(Math.max(0, cargadoHasta(isoOf(hoy)) - cerrado)),
    available: limite > 0 ? round2(Math.max(0, limite - debt)) : 0,
    usage: limite > 0 ? Math.min(1, debt / limite) : 0,
    usageAtCutoff: limite > 0 ? Math.min(1, statementBalance / limite) : 0,
    monthlyRate: rate,
    moratoryRate: moratoryMonthlyRate(a),
    lateFee,
    minimum,
  }
}

/** Valores por defecto del pago mínimo cuando el usuario no los configuró */
export function minSettings(a: Account) {
  const c = a.credit
  return {
    mode: c?.minMode ?? 'plazo',
    // Costa Rica: el plazo de financiamiento típico es 60 meses
    months: Math.max(1, c?.financingMonths ?? 60),
    pct: c?.minPaymentPct ?? 5,
    floor: c?.minPaymentFloor ?? 0,
    moratoryExtra: c?.moratoryExtra ?? 2,
    lateFeePct: c?.lateFeePct ?? 5,
    lateFeeCap: c?.lateFeeCap ?? 0,
    lateFeeAfterDays: c?.lateFeeAfterDays ?? 5,
  }
}

/** Interés mensual de mora: el corriente más los puntos que cobre el banco */
export function moratoryMonthlyRate(a: Account): number {
  const cfg = minSettings(a)
  const anual = (a.credit?.ratePeriod === 'monthly' ? (a.credit?.rate ?? 0) * 12 : a.credit?.rate ?? 0)
  return (anual + cfg.moratoryExtra) / 12
}

/**
 * Pago mínimo del mes.
 *
 * En Costa Rica el pago mínimo NO es un porcentaje del saldo: es una cuota de
 * plazo (saldo del principal ÷ plazo de financiamiento) más los intereses del
 * período, las cuotas de los planes y lo que esté en mora. En otros países sí
 * es un porcentaje del saldo; el modo se elige por tarjeta.
 */
export function cardMinimum(
  a: Account,
  statementBalance: number,
  interesesDelPeriodo: number,
  cuotasDelMes: number,
  mora: { interest: number; fee: number } = { interest: 0, fee: 0 },
): CardMinimum {
  const cfg = minSettings(a)
  // el principal del corte no incluye las cuotas de planes ni los intereses
  const principal = Math.max(0, statementBalance - cuotasDelMes)
  let amortizacion = cfg.mode === 'plazo'
    ? principal / cfg.months
    : principal * (cfg.pct / 100)
  if (cfg.floor > 0) amortizacion = Math.max(amortizacion, Math.min(principal, cfg.floor))
  const total = round2(amortizacion + interesesDelPeriodo + cuotasDelMes + mora.interest + mora.fee)
  // la cuota de una compra a plazos también baja la deuda de la tarjeta
  const capital = round2(amortizacion + cuotasDelMes)
  return {
    amortization: round2(amortizacion),
    interest: round2(interesesDelPeriodo),
    installments: round2(cuotasDelMes),
    moratory: round2(mora.interest),
    fees: round2(mora.fee),
    // nunca se pide más de lo que se debe
    total: round2(Math.min(total, statementBalance + mora.interest + mora.fee)),
    toCapital: total > 0 ? Math.min(1, capital / total) : 0,
    capital,
  }
}

/**
 * Si pagas SOLO el mínimo: cuánto tardarías y cuánto pagarías de intereses.
 *
 * Se simula mes a mes con la misma regla del banco. Los intereses NO se
 * capitalizan (en Costa Rica está prohibido: art. 15 inciso h del decreto),
 * así que se llevan aparte del principal. Si el mínimo no cubre ni los
 * intereses, la deuda nunca baja: eso se reporta como `perpetual`.
 */
export function payoffWithMinimum(a: Account, saldo: number): PayoffSim {
  const cfg = minSettings(a)
  const i = monthlyRate(a) / 100
  const horizonte = cfg.mode === 'plazo' ? cfg.months : 60
  let principal = Math.max(0, saldo)
  if (principal <= 0) {
    return {
      months: 0, interest: 0, paid: 0, perpetual: false,
      horizonMonths: horizonte, balanceAtHorizon: 0, paidAtHorizon: 0,
    }
  }

  const fraccion = cfg.mode === 'plazo' ? 1 / cfg.months : cfg.pct / 100
  let meses = 0
  let intereses = 0
  let pagado = 0
  let saldoEnHorizonte = principal
  let pagadoEnHorizonte = 0
  // Tope realista: más de 10 años pagando el mínimo es, en la práctica, no
  // salir nunca. Sin piso de pago el saldo decae en geométrica y jamás llega a
  // cero, así que reportar "823 meses" seria inventar precisión.
  const MAX = 121
  while (principal > 1 && meses < MAX) {
    const interesMes = principal * i
    let amort = principal * fraccion
    if (cfg.floor > 0) amort = Math.max(amort, Math.min(principal, cfg.floor))
    const pago = amort + interesMes
    if (pago <= interesMes + 0.01) break
    principal = principal - amort
    intereses += interesMes
    pagado += pago
    meses++
    if (meses === horizonte) {
      saldoEnHorizonte = principal
      pagadoEnHorizonte = pagado
    }
  }
  const seLiquida = principal <= 1 && meses < MAX
  if (meses < horizonte) {
    saldoEnHorizonte = principal
    pagadoEnHorizonte = pagado
  }
  return {
    months: seLiquida ? meses : null,
    interest: round2(intereses),
    paid: round2(pagado),
    perpetual: !seLiquida,
    horizonMonths: horizonte,
    balanceAtHorizon: round2(Math.max(0, saldoEnHorizonte)),
    paidAtHorizon: round2(pagadoEnHorizonte),
  }
}

/** Cuota fija necesaria para pagar un saldo en N meses (con interés) */
export function fixedPaymentFor(a: Account, saldo: number, meses: number): number {
  const i = monthlyRate(a) / 100
  if (saldo <= 0 || meses <= 0) return 0
  if (i <= 0) return round2(saldo / meses)
  const factor = Math.pow(1 + i, meses)
  return round2((saldo * i * factor) / (factor - 1))
}

/** Cuánto abonar antes del corte para que la tarjeta reporte ≤ pct del límite */
export function payToReachUsage(a: Account, deuda: number, pct: number): number {
  const limite = a.credit?.limit ?? 0
  if (limite <= 0) return 0
  return round2(Math.max(0, deuda - limite * pct))
}

/** Deuda total de todas las tarjetas */
export function totalCardDebt(ctx: BalanceCtx): number {
  return round2(activeAccounts(ctx.accounts)
    .filter(isCredit)
    .reduce((s, a) => s + cardDebt(a, ctx), 0))
}

/** Interés que se está cobrando ahora mismo por atrasos en tarjetas */
export function totalCardInterest(ctx: BalanceCtx): number {
  return round2(activeAccounts(ctx.accounts)
    .filter(isCredit)
    .reduce((s, a) => s + cardStatement(a, ctx).interest, 0))
}

/**
 * Simulación clara para el usuario: cuánto paga si abona hoy y cuánto le
 * costaría atrasarse los meses que indique.
 */
export function interestForecast(a: Account, pending: number, meses: number): number {
  const r = monthlyRate(a) / 100
  if (r <= 0 || pending <= 0 || meses <= 0) return 0
  // interés compuesto mes a mes sobre el saldo sin pagar
  return round2(pending * (Math.pow(1 + r, meses) - 1))
}

// ─── Reportes por categoría ──────────────────────────────────────────────────

export interface CategoryTotal {
  categoryId: string
  total: number
  count: number
}

/** Suma de movimientos por categoría entre dos fechas ('yyyy-MM-dd') */
export function categoryTotals(
  months: Record<string, MonthData>,
  fromISO: string,
  toISO: string,
  kind: 'gasto' | 'ingreso' = 'gasto',
): CategoryTotal[] {
  const acc = new Map<string, CategoryTotal>()
  for (const mv of allMovements(months)) {
    if (mv.kind !== kind) continue
    if (mv.dateISO < fromISO || mv.dateISO > toISO) continue
    const cur = acc.get(mv.categoryId) ?? { categoryId: mv.categoryId, total: 0, count: 0 }
    cur.total = round2(cur.total + mv.amount)
    cur.count += 1
    acc.set(mv.categoryId, cur)
  }
  return [...acc.values()].sort((a, b) => b.total - a.total)
}

/** Suma de movimientos por cuenta entre dos fechas */
export function accountTotals(
  months: Record<string, MonthData>,
  accounts: Account[],
  fromISO: string,
  toISO: string,
  kind: 'gasto' | 'ingreso' = 'gasto',
): { accountId: string; name: string; total: number; count: number }[] {
  const acc = new Map<string, { accountId: string; name: string; total: number; count: number }>()
  for (const mv of allMovements(months)) {
    if (mv.kind !== kind) continue
    if (mv.dateISO < fromISO || mv.dateISO > toISO) continue
    const cuenta = accountById(accounts, mv.accountId)
    const key = mv.accountId
    const cur = acc.get(key) ?? { accountId: key, name: cuenta?.name ?? 'Sin cuenta', total: 0, count: 0 }
    cur.total = round2(cur.total + mv.amount)
    cur.count += 1
    acc.set(key, cur)
  }
  return [...acc.values()].sort((a, b) => b.total - a.total)
}

/** Serie por mes de gastos e ingresos registrados como movimientos */
export function monthlySeries(
  months: Record<string, MonthData>,
  fromMonthId: string,
  toMonthId: string,
): { monthId: string; gasto: number; ingreso: number }[] {
  const out: { monthId: string; gasto: number; ingreso: number }[] = []
  let id = fromMonthId
  let guard = 0
  while (id <= toMonthId && guard++ < 240) {
    const m = months[id]
    out.push({ monthId: id, gasto: movementsExpense(m), ingreso: movementsIncome(m) })
    id = addMonthsToId(id, 1)
  }
  return out
}

/** Cuotas de compras a plazos que hay que pagar en un mes (todas las tarjetas) */
export function monthInstallments(list: Installment[], monthId: string): Installment[] {
  return list.filter((i) => {
    const idx = monthDiff(i.startMonthId, monthId)
    return idx >= 0 && idx < i.count
  })
}

/** Cuánto hay que pagar de cuotas en un mes */
export function monthInstallmentsTotal(list: Installment[], monthId: string): number {
  return round2(monthInstallments(list, monthId).reduce((s, i) => s + i.monthly, 0))
}

/** Deudas activas en un mes que se pagan con una tarjeta (para el ciclo) */
export function debtsOnCard(debts: Debt[], accountId: string, monthId: string): Debt[] {
  return debts.filter((d) => debtIsActiveInMonth(d, monthId) && d.payments[monthId]?.accountId === accountId)
}
