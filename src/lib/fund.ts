// Saldo real: control total del dinero (mejora del usuario).
// Refleja lo que hay EN EL BANCO: base que el usuario escribe + lo que llega
// por quincenas − lo pagado − gastos hormiga − aportes al ahorro. El sobrante
// de cada mes se arrastra solo al siguiente (no es ahorro: es lo que sobró).
import type {
  Account, AppSettings, Debt, FundConfig, Installment, Loan, MonthData,
  SavingsDeposit, SavingsEnvelope,
} from '../types/finance'
import { loanFlowInMonth } from './loans'
import { currentMonthId, daysInMonth, parseMonthId } from './dates'
import { buildPayables, getMonthSummary, remainingAmount } from './finance'
import { payrollBreakdown } from './payroll'
import { accountById, cashMovementsNet, isCredit, totalCash } from './accounts'

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
    // si el mes tiene 5 viernes, se reciben 5 pagos: es real, no se topa
    const perWeek = (salary * 12) / 52
    return round2(count * perWeek + m.income.additional)
  }

  if (sch.frequency === 'daily') {
    const perDay = salary / daysInMonth(m.id)
    return round2(perDay * day + m.income.additional)
  }

  if (sch.frequency === 'fortnightly') {
    // pagos cada 14 días contados desde la fecha de referencia
    const perPay = (salary * 12) / 26
    const anchor = sch.anchorISO ? new Date(sch.anchorISO) : null
    const { year, month } = parseMonthId(m.id)
    let count = 0
    if (anchor && !Number.isNaN(anchor.getTime())) {
      const cur = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
      let guard = 0
      while (cur <= today && guard++ < 400) {
        if (cur.getFullYear() === year && cur.getMonth() === month - 1) count++
        cur.setDate(cur.getDate() + 14)
      }
    } else {
      count = day >= 28 ? 2 : day >= 14 ? 1 : 0
    }
    return round2(count * perPay + m.income.additional)
  }

  const max = daysInMonth(m.id)
  const paydays = (sch.paydays.length ? sch.paydays : [30]).slice().sort((a, b) => a - b)

  /**
   * Adelantos con día propio: si te adelantan parte del salario a mitad de
   * mes, esa plata YA entró ese día. El resto llega el día de pago.
   */
  const bd = payrollBreakdown(settings.payroll)
  const adelantos = bd.advances.filter((a) => a.day && a.day >= 1 && a.day <= 31)
  const adelantoTotal = Math.min(salary, round2(adelantos.reduce((s, a) => s + a.amount, 0)))

  let received = 0
  if (adelantoTotal > 0) {
    for (const a of adelantos) {
      if (Math.min(a.day ?? 1, max) <= day) {
        received += Math.min(a.amount, salary)
      }
    }
    const resto = Math.max(0, salary - adelantoTotal)
    paydays.forEach((pd) => {
      if (Math.min(pd, max) <= day) received += resto / paydays.length
    })
    return round2(received + m.income.additional)
  }

  // Sin adelantos: cada pago es una parte igual del neto (quincenal: mitad y
  // mitad, con las deducciones repartidas entre las dos quincenas)
  const amounts = paydays.map(() => salary / paydays.length)
  paydays.forEach((pd, i) => {
    if (Math.min(pd, max) <= day) received += amounts[i] ?? 0
  })
  return round2(received + m.income.additional)
}

/**
 * LEGADO: total de gastos hormiga del mes. Desde la v9 los gastos hormiga son
 * movimientos; se mantiene para leer datos viejos que no se hayan migrado.
 */
export function hormigasTotal(m: MonthData): number {
  return round2((m.hormigas ?? []).reduce((s, h) => s + h.amount, 0))
}

/**
 * Lo que DE VERDAD se gastó en un mes, repartido por tipo. Es lo que va en los
 * reportes: solo cuenta lo pagado y lo adelantado, nunca lo que sigue pendiente.
 *
 * Sin doble conteo: al marcar un pago como pagado se crea su movimiento, así
 * que ese movimiento se atribuye a su tipo (servicio/gasto/personal/deuda) y se
 * excluye de la bolsa de "movimientos sueltos".
 */
export function monthSpend(m: MonthData | undefined, debts: Debt[]): {
  servicio: number
  gasto: number
  personal: number
  deuda: number
  movimientos: number
  total: number
} {
  const vacio = { servicio: 0, gasto: 0, personal: 0, deuda: 0, movimientos: 0, total: 0 }
  if (!m) return vacio

  // movimientos que nacieron de un pago o de un adelanto: ya se cuentan por su tipo
  const deUnPago = new Set<string>()
  for (const e of m.expenses) {
    if (e.movementId) deUnPago.add(e.movementId)
    for (const ad of e.advances ?? []) if (ad.movementId) deUnPago.add(ad.movementId)
  }
  for (const d of debts) {
    const p = d.payments[m.id]
    if (p?.movementId) deUnPago.add(p.movementId)
  }

  const porTipo = { servicio: 0, gasto: 0, personal: 0, deuda: 0 }
  for (const k of kindTotals(m, debts)) porTipo[k.kind] += k.paid

  const movimientos = round2(
    (m.movements ?? [])
      .filter((x) => x.kind === 'gasto' && !deUnPago.has(x.id))
      .reduce((s, x) => s + x.amount, 0)
    + hormigasTotal(m),
  )

  return {
    servicio: round2(porTipo.servicio),
    gasto: round2(porTipo.gasto),
    personal: round2(porTipo.personal),
    deuda: round2(porTipo.deuda),
    movimientos,
    total: round2(porTipo.servicio + porTipo.gasto + porTipo.personal + porTipo.deuda + movimientos),
  }
}

/**
 * Lo PAGADO del mes que salio de efectivo. Un pago hecho con tarjeta de
 * credito no baja el banco: se convierte en deuda de la tarjeta.
 */
export function paidInCash(m: MonthData, debts: Debt[], accounts: Account[] = []): number {
  const conTarjeta = (accountId?: string) => {
    const a = accountById(accounts, accountId)
    return Boolean(a && isCredit(a))
  }
  let total = 0
  for (const e of m.expenses) {
    // adelantos que aún no llegaron a ser movimiento (sin cuentas creadas)
    for (const ad of e.advances ?? []) {
      if (ad.movementId) continue
      if (conTarjeta(ad.accountId ?? e.accountId)) continue
      total += ad.amount
    }
    if (!e.paid) continue
    // si al pagarlo se creó un movimiento, ese movimiento ya movió la cuenta
    if (e.movementId) continue
    if (conTarjeta(e.accountId)) continue
    // solo el PENDIENTE: lo adelantado ya se contó arriba
    total += remainingAmount(e)
  }
  for (const d of debts) {
    if (d.viaPlanilla) continue
    const p = d.payments[m.id]
    if (!p?.paid) continue
    if (p.movementId) continue
    if (conTarjeta(p.accountId)) continue
    total += p.amount
  }
  return round2(total)
}

/** Todos los aportes de ahorro (sobres + legado) */
export function allDeposits(settings: AppSettings): SavingsDeposit[] {
  const env = settings.savings.envelopes ?? []
  return [...env.flatMap((e) => e.deposits), ...(env.length ? [] : settings.savings.deposits ?? [])]
}

/** Aportes al ahorro hechos dentro de un mes concreto */
export function depositsInMonth(settings: AppSettings, monthId: string): number {
  return round2(allDeposits(settings)
    .filter((d) => monthOfISO(d.dateISO) === monthId)
    .reduce((s, d) => s + d.amount, 0))
}

/**
 * Lo apartado al ahorro que TODAVÍA no movió una cuenta.
 *
 * Un aporte con cuenta genera su propio movimiento, y ese movimiento ya baja
 * el saldo. Restarlo otra vez aquí lo contaría dos veces.
 */
export function depositsWithoutMovement(settings: AppSettings, monthId: string): number {
  return round2(allDeposits(settings)
    .filter((d) => monthOfISO(d.dateISO) === monthId && !d.movementId)
    .reduce((s, d) => s + d.amount, 0))
}

/**
 * Total ahorrado real: lo que ya tenía guardado en cada sobre (initial) más
 * los aportes hechos desde la app, menos los retiros.
 */
export function savingsTotal(settings: AppSettings): number {
  const env = settings.savings.envelopes ?? []
  const initial = env.reduce((s, e) => s + Math.max(0, e.initial), 0)
  return round2(initial + allDeposits(settings).reduce((s, d) => s + d.amount, 0))
}

/** Total de un sobre (lo que ya tenía + aportes − retiros) */
export function envelopeTotal(e: SavingsEnvelope): number {
  return round2(Math.max(0, e.initial) + e.deposits.reduce((s, d) => s + d.amount, 0))
}

/**
 * Flujo neto de un mes: recibido − pagado − hormigas − aportes al ahorro,
 * más el efecto de los préstamos propios (prestar saca plata, el abono la
 * devuelve). `loans` es opcional para no romper llamadas antiguas.
 */
export function monthFlow(
  m: MonthData,
  debts: Debt[],
  settings: AppSettings,
  today = new Date(),
  loans: Loan[] = [],
  accounts: Account[] = [],
): number {
  const pagado = accounts.length ? paidInCash(m, debts, accounts) : getMonthSummary(m, debts).paidAmount
  // los movimientos reemplazaron a los gastos hormiga (v9)
  const movs = cashMovementsNet(m, accounts)
  return round2(
    receivedInMonth(m, settings, today) - pagado - hormigasTotal(m) + movs
    - depositsWithoutMovement(settings, m.id) + loanFlowInMonth(loans, m.id),
  )
}

/**
 * Flujo general que alimenta la CUENTA PRINCIPAL: igual que monthFlow pero sin
 * los movimientos, porque esos ya estan atribuidos a su propia cuenta.
 */
export function generalMonthFlow(
  m: MonthData,
  debts: Debt[],
  settings: AppSettings,
  today = new Date(),
  loans: Loan[] = [],
  accounts: Account[] = [],
): number {
  return round2(
    receivedInMonth(m, settings, today) - paidInCash(m, debts, accounts) - hormigasTotal(m)
    - depositsWithoutMovement(settings, m.id) + loanFlowInMonth(loans, m.id),
  )
}

/** Flujo general acumulado desde un mes ancla (para la cuenta principal) */
export function generalFlow(
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
  anchorMonthId: string,
  today = new Date(),
  loans: Loan[] = [],
  accounts: Account[] = [],
): number {
  const nowId = currentMonthId()
  let flow = 0
  const covered = new Set<string>()
  for (const m of Object.values(months)) {
    if (m.id < anchorMonthId || m.id > nowId) continue
    covered.add(m.id)
    flow += generalMonthFlow(m, debts, settings, today, loans, accounts)
  }
  for (const d of allDeposits(settings)) {
    const mid = monthOfISO(d.dateISO)
    if (mid >= anchorMonthId && mid <= nowId && !covered.has(mid)) flow -= d.amount
  }
  return round2(flow)
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
  loans: Loan[] = [],
  accounts: Account[] = [],
): number {
  const nowId = currentMonthId()
  let flow = 0
  const covered = new Set<string>()
  for (const m of Object.values(months)) {
    if (m.id < anchorMonthId || m.id > nowId) continue
    covered.add(m.id)
    flow += monthFlow(m, debts, settings, today, loans, accounts)
  }
  // aportes en meses sin registro (no quedaron cubiertos arriba)
  for (const d of allDeposits(settings)) {
    const mid = monthOfISO(d.dateISO)
    if (mid >= anchorMonthId && mid <= nowId && !covered.has(mid)) flow -= d.amount
  }
  return round2(flow)
}

/**
 * Efectivo real ahora: lo que de verdad tienes.
 *
 * Si ya hay CUENTAS creadas, el total sale de ellas (efectivo + cuentas de
 * banco + ahorros marcados, nunca tarjetas). Si el usuario todavia no tiene
 * cuentas, se usa el calculo clasico del saldo real (base + flujo).
 * Devuelve null si el control no esta activado.
 */
export function realBalance(
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
  today = new Date(),
  loans: Loan[] = [],
  accounts: Account[] = [],
  installments: Installment[] = [],
): number | null {
  const f = settings.fund
  const usables = accounts.filter((a) => !a.archived && !isCredit(a) && a.includeInTotal)
  if (usables.length) {
    const principal = usables.find((a) => a.isMain) ?? usables[0]
    const anchor = (principal.openingISO || '').slice(0, 7) || currentMonthId()
    return totalCash({
      months,
      accounts,
      installments,
      debts,
      settings,
      loans,
      today,
      generalFlow: generalFlow(months, debts, settings, anchor, today, loans, accounts),
    })
  }
  if (!f?.enabled || !f.anchorMonthId) return null
  return round2(
    f.baseAmount + fundFlow(months, debts, settings, f.anchorMonthId, today, loans, accounts) - f.snapshot,
  )
}

/** Config lista para guardar al fijar "tengo X hoy" (captura el snapshot) */
export function makeFundConfig(
  baseAmount: number,
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
  loans: Loan[] = [],
  accounts: Account[] = [],
): FundConfig {
  const anchorMonthId = currentMonthId()
  return {
    enabled: true,
    baseAmount,
    anchorMonthId,
    snapshot: fundFlow(months, debts, settings, anchorMonthId, new Date(), loans, accounts),
    setAtISO: new Date().toISOString(),
  }
}

/** Sobrante arrastrado de meses ANTERIORES al actual (desde que se activó) */
export function carryOver(
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
  loans: Loan[] = [],
  accounts: Account[] = [],
): number {
  const f = settings.fund
  const anchor = f?.anchorMonthId
    || accounts.find((a) => a.isMain && !a.archived)?.openingISO?.slice(0, 7)
  if (!anchor) return 0
  const nowId = currentMonthId()
  let flow = 0
  for (const m of Object.values(months)) {
    if (m.id < anchor || m.id >= nowId) continue
    flow += monthFlow(m, debts, settings, new Date(), loans, accounts)
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

/** Lo que sobró en el mes anterior a `monthId` (ingresos − pagos − hormigas − ahorro) */
export function prevMonthLeftover(
  months: Record<string, MonthData>,
  debts: Debt[],
  settings: AppSettings,
  monthId: string,
  loans: Loan[] = [],
  accounts: Account[] = [],
): number {
  const ids = Object.keys(months).filter((id) => id < monthId).sort()
  const prevId = ids[ids.length - 1]
  const prev = prevId ? months[prevId] : undefined
  if (!prev) return 0
  return monthFlow(prev, debts, settings, new Date(), loans, accounts)
}

/** Desglose por tipo de pago con subtotales (mejora 17) */
export interface KindTotal {
  kind: 'servicio' | 'gasto' | 'personal' | 'deuda'
  label: string
  total: number
  paid: number
  pending: number
  count: number
  countPaid: number
}

export function kindTotals(m: MonthData, debts: Debt[]): KindTotal[] {
  const items = buildPayables(m, debts)
  const defs: { kind: KindTotal['kind']; label: string }[] = [
    { kind: 'servicio', label: 'Servicios' },
    { kind: 'gasto', label: 'Gastos' },
    { kind: 'personal', label: 'Personales' },
    { kind: 'deuda', label: 'Deudas' },
  ]
  return defs.map(({ kind, label }) => {
    const list = items.filter((i) => i.kind === kind)
    const total = round2(list.reduce((s, i) => s + i.amount, 0))
    const paid = round2(list.reduce((s, i) => s + (i.paid ? i.amount : i.advanced), 0))
    return {
      kind, label, total, paid,
      pending: round2(total - paid),
      count: list.length,
      countPaid: list.filter((i) => i.paid).length,
    }
  })
}
