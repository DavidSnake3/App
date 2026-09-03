import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Account, AnimationPrefs, AppSettings, Budget, Category, Debt, DebtPayment, Expense,
  FundConfig, Installment, Loan, LoanAdvance, MonthData, Movement, NotificationPrefs, PayrollConfig,
  PaySchedule, RecurringTemplate, SavingsConfig, SavingsEnvelope, TabId, ThemeSettings,
  UsageState, UserProfile, ViewMode, WidgetConf,
  ExpenseAdvance, ShoppingProduct,
} from '../types/finance'
import { currentMonthId, todayISO, todayLocalISO} from '../lib/dates'
import { DEFAULT_CATEGORIES, guessCategory, mergeCategories } from '../lib/categories'
import { cloneExpenseForMonth, makeMonth, recurringCandidates, remainingAmount, uid } from '../lib/finance'
import { seedAllMonths, seedMonth, templateFromExpense } from '../lib/recurring'
import { shoppingChecked, syncShoppingAmount } from '../lib/shopping'
import {
  DEFAULT_CCSS_PCT, DEFAULT_STATUTORY_NAME, convertPeriod, countryPreset, payrollBreakdown,
} from '../lib/payroll'
import { generalFlow, makeFundConfig, realBalance } from '../lib/fund'

// ─── Valores por defecto ─────────────────────────────────────────────────────

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  lastName: '',
  workerType: 'asalariado',
  locale: 'es-CR',
  email: '',
  phone: '',
  photoUrl: '',
  currency: 'CRC',
  payday: 1,
  payFrequency: 'monthly',
  planMode: 'monthly',
  onboarded: false,
  tourDone: false,
  // quien ya usa la app no recibe la bienvenida del onboarding
  snakeIntro: 'done',
  widgetsTip: true,
  snakePlan: 'gratis',
}

/** Widgets del inicio por defecto (el usuario los personaliza a su gusto) */
export const DEFAULT_WIDGETS: WidgetConf[] = [
  { id: 'cuentas', size: 'lg' },
  { id: 'comprobante', size: 'lg' },
  { id: 'ahorro', size: 'lg' },
  { id: 'estado', size: 'sm' },
  { id: 'dona', size: 'sm' },
  { id: 'calendario', size: 'lg' },
  { id: 'saldo', size: 'lg' },
  { id: 'resumen', size: 'lg' },
  { id: 'acciones', size: 'lg' },
  { id: 'pendientes', size: 'lg' },
]

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'dark',
  paletteId: 'aurora',
  background: { type: 'default', value: 'noche' },
}

export const DEFAULT_ANIMATIONS: AnimationPrefs = {
  confetti: true,
  cash: true,
  sounds: true,
  haptics: true,
  transitions: true,
  celebration: true,
  paySound: 'caja',
  alarmSound: 'clasica',
  transitionStyle: 'deslizar',
}

const CR = countryPreset('cr')!

export const DEFAULT_PAYROLL: PayrollConfig = {
  inputPeriod: 'monthly',
  countryId: 'cr',
  statutoryName: DEFAULT_STATUTORY_NAME,
  gross: 0,
  ccssPct: DEFAULT_CCSS_PCT,
  statutory: [{ id: 'cr-ccss', name: CR.statutory[0].name, pct: CR.statutory[0].pct, cap: 0 }],
  taxEnabled: false,
  taxBrackets: CR.taxBrackets,
  extraPays: [],
  deductions: [],
  viewPeriod: 'monthly',
}

export const DEFAULT_PAY_SCHEDULE: PaySchedule = {
  frequency: 'monthly',
  paydays: [30],
  weekday: 4, // viernes
  adjustWeekend: 'before',
}

export const DEFAULT_SAVINGS: SavingsConfig = {
  enabled: false,
  mode: 'percent',
  value: 10,
  goal: 0,
  goalName: '',
  deposits: [],
  envelopes: [],
}

export const DEFAULT_FUND: FundConfig = {
  enabled: false,
  baseAmount: 0,
  anchorMonthId: '',
  snapshot: 0,
  setAtISO: '',
}

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  enabled: false,
  daysBefore: [3, 1, 0],
  time: '09:00',
  alarmMode: false,
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultSalary: 0,
  viewMode: 'cards',
  theme: DEFAULT_THEME,
  animations: DEFAULT_ANIMATIONS,
  notifications: DEFAULT_NOTIFICATIONS,
  aiEnabled: true,
  geminiKey: '',
  autoRollover: true,
  planChoice: 'propio',
  homeWidgets: DEFAULT_WIDGETS,
  payroll: DEFAULT_PAYROLL,
  paySchedule: DEFAULT_PAY_SCHEDULE,
  savings: DEFAULT_SAVINGS,
  fund: DEFAULT_FUND,
}

// ─── Estado ──────────────────────────────────────────────────────────────────

export const EMPTY_USAGE: UsageState = {
  dayKey: '', msgs: 0, tokens: 0, attachments: 0,
  monthKey: '', monthMsgs: 0, monthTokens: 0,
}

interface FinanceState {
  months: Record<string, MonthData>
  /** cuentas contables: efectivo, banco, ahorros, tarjetas de credito */
  accounts: Account[]
  /** compras a cuotas con tarjeta de credito */
  installments: Installment[]
  /** pagos fijos que se repiten todos los meses */
  recurring: RecurringTemplate[]
  /** consumo de Snake (mensajes y tokens reales) */
  usage: UsageState
  debts: Debt[]
  /** préstamos que YO hice (cuentas por cobrar) */
  loans: Loan[]
  /** presupuestos propios por categoría */
  budgets: Budget[]
  profile: UserProfile
  settings: AppSettings
  activeMonthId: string
  activeTab: TabId
  /** submenu activo dentro de cada seccion (navegacion de 2 niveles) */
  subs: Record<string, string>
  updatedAt: number
}

interface FinanceActions {
  setActiveTab(tab: TabId): void
  setSub(tab: TabId, sub: string): void
  setActiveMonth(monthId: string): void
  ensureMonthExists(monthId: string): void
  deleteMonth(monthId: string): void

  updateIncome(monthId: string, patch: Partial<MonthData['income']>): void

  addExpense(monthId: string, e: Omit<Expense, 'id' | 'createdAt'>): void
  /** `scope` 'siempre' aplica el cambio tambien a los meses siguientes */
  updateExpense(monthId: string, id: string, patch: Partial<Expense>, scope?: 'mes' | 'siempre'): void
  /** `scope` 'mes' lo quita solo de aqui - 'siempre' deja de repetirlo */
  deleteExpense(monthId: string, id: string, scope?: 'mes' | 'siempre'): void

  // ── Adelantos de un pago ─────────────────────────────────────────────────
  /** Adelanta parte de un pago: crea el movimiento real y baja el pendiente */
  addExpenseAdvance(monthId: string, expenseId: string, data: {
    amount: number; dateISO?: string; accountId?: string; note?: string
  }): void
  /** Borra un adelanto y su movimiento; si ya estaba pagado, recalcula el final */
  deleteExpenseAdvance(monthId: string, expenseId: string, advanceId: string): void

  // ── Listas de compras ────────────────────────────────────────────────────
  /** crea el gasto-lista del mes y devuelve su id para abrirlo de una vez */
  createShoppingList(monthId: string, data: {
    name: string; dueDay?: number; accountId?: string
    categoryId?: string; icon?: string; color?: string; store?: string
  }): string
  addShoppingProduct(monthId: string, expenseId: string, p: Omit<ShoppingProduct, 'id' | 'checked' | 'checkedAt'>): void
  updateShoppingProduct(monthId: string, expenseId: string, productId: string, patch: Partial<ShoppingProduct>): void
  deleteShoppingProduct(monthId: string, expenseId: string, productId: string): void
  /** marca/desmarca un producto: NO mueve plata, solo el subtotal en vivo */
  toggleShoppingProduct(monthId: string, expenseId: string, productId: string): void
  /** finaliza (o reabre) la compra: aquí y solo aquí se mueve la plata */
  toggleShoppingDone(monthId: string, expenseId: string): void
  togglePaid(monthId: string, id: string): void

  addDebt(d: Omit<Debt, 'id' | 'createdAt' | 'payments'>): void
  updateDebt(id: string, patch: Partial<Debt>): void
  deleteDebt(id: string): void
  toggleDebtPaid(debtId: string, monthId: string): void
  /** registra un abono con desglose capital/interés (estilo recibo) */
  payDebtInstallment(debtId: string, monthId: string, detail: Partial<DebtPayment>): void

  /** copia los recurrentes del mes anterior al mes destino (mejora 12) */
  importRecurring(targetMonthId: string, fromMonthId: string): void
  markCarryAsked(monthId: string): void
  /** copia pagos concretos de un mes a otro */
  copyExpensesFrom(targetMonthId: string, fromMonthId: string, ids: string[]): void

  setProfile(patch: Partial<UserProfile>): void
  setSettings(patch: Partial<AppSettings>): void
  setTheme(patch: Partial<ThemeSettings>): void
  setAnimations(patch: Partial<AnimationPrefs>): void
  setNotifications(patch: Partial<NotificationPrefs>): void
  setPayroll(patch: Partial<PayrollConfig>): void
  setPaySchedule(patch: Partial<PaySchedule>): void
  setSavings(patch: Partial<SavingsConfig>): void
  /** aporta (o retira, con monto negativo) al sobre principal */
  addSavingsDeposit(amount: number, note?: string, accountId?: string): void
  deleteSavingsDeposit(id: string): void

  /** sobres de ahorro: varios ahorros a la vez (mejora 5) */
  addEnvelope(e: { name: string; goal: number; initial: number }): void
  updateEnvelope(id: string, patch: Partial<Omit<SavingsEnvelope, 'id' | 'deposits'>>): void
  deleteEnvelope(id: string): void
  /** aporte (+) o retiro (−) a un sobre concreto */
  /** Aporta (o retira, con monto negativo) a un sobre. Si hay cuenta, mueve la plata de verdad. */
  addEnvelopeDeposit(envelopeId: string, amount: number, note?: string, accountId?: string): void
  deleteEnvelopeDeposit(envelopeId: string, depositId: string): void

  /** activa/ajusta el saldo real: "hoy tengo X en el banco" */
  setFundNow(baseAmount: number): void
  disableFund(): void

  /** LEGADO: crea un movimiento (los gastos hormiga son movimientos desde v9) */
  addHormiga(monthId: string, h: { name: string; amount: number; budgetId?: string }): void
  deleteHormiga(monthId: string, id: string): void

  // ── Cuentas ──────────────────────────────────────────────────────────────
  addAccount(a: Omit<Account, 'id' | 'createdAt'>): string
  updateAccount(id: string, patch: Partial<Omit<Account, 'id'>>): void
  deleteAccount(id: string): void
  setMainAccount(id: string): void
  /** ajusta el saldo de una cuenta a lo que el usuario dice que tiene hoy */
  setAccountBalance(id: string, amount: number, currentBalance: number): void

  // ── Movimientos del mes ──────────────────────────────────────────────────
  addMovement(mv: Omit<Movement, 'id' | 'createdAt'>): void
  /** igual que addMovement pero devuelve el id del movimiento creado */
  addMovementReturningId(mv: Omit<Movement, 'id' | 'createdAt'>): string
  updateMovement(id: string, patch: Partial<Omit<Movement, 'id'>>): void
  deleteMovement(id: string): void

  // ── Compras a cuotas con tarjeta ─────────────────────────────────────────
  addInstallment(i: Omit<Installment, 'id' | 'createdAt' | 'payments'>): void
  updateInstallment(id: string, patch: Partial<Omit<Installment, 'id' | 'payments'>>): void
  deleteInstallment(id: string): void
  toggleInstallmentPaid(id: string, monthId: string): void

  // ── Categorias ───────────────────────────────────────────────────────────
  addCategory(c: Omit<Category, 'id'>): void
  updateCategory(id: string, patch: Partial<Omit<Category, 'id'>>): void
  deleteCategory(id: string): void

  /** préstamos propios: le presté plata a alguien (mejora 1) */
  addLoan(l: Omit<Loan, 'id' | 'createdAt' | 'payments'>): void
  updateLoan(id: string, patch: Partial<Omit<Loan, 'id' | 'payments'>>): void
  deleteLoan(id: string): void
  addLoanPayment(loanId: string, amount: number, note?: string, dateISO?: string, accountId?: string): void
  deleteLoanPayment(loanId: string, paymentId: string): void
  /** le presté MÁS a la misma persona: aumenta lo que me debe */
  addLoanAdvance(loanId: string, amount: number, note?: string, dateISO?: string, accountId?: string): void
  deleteLoanAdvance(loanId: string, advanceId: string): void

  /** registra el consumo REAL de un mensaje de Snake */
  recordUsage(tokens: number, hadAttachment: boolean): void

  /** presupuestos propios (mejora 4) */
  addBudget(b: Omit<Budget, 'id' | 'createdAt' | 'entries'>): void
  updateBudget(id: string, patch: Partial<Omit<Budget, 'id' | 'entries'>>): void
  deleteBudget(id: string): void
  addBudgetEntry(budgetId: string, amount: number, note?: string): void
  deleteBudgetEntry(budgetId: string, entryId: string): void
  /** salario neto manual (sin planilla): actualiza default + mes actual y futuros */
  setDefaultSalaryEverywhere(v: number): void
  setViewMode(mode: ViewMode): void

  /** Marca (o desmarca) la felicitacion del mes ya vista */
  markCelebrated(monthId: string, value?: boolean): void
  /** Reemplaza todo el estado (sincronización con la nube) */
  hydrateFrom(data: PersistedShape): void
  resetAll(): void
}

export interface PersistedShape {
  /** versión del esquema (9 = cuentas, movimientos y cuotas) */
  schema?: number
  months: Record<string, MonthData>
  accounts?: Account[]
  installments?: Installment[]
  recurring?: RecurringTemplate[]
  debts: Debt[]
  loans?: Loan[]
  budgets?: Budget[]
  usage?: UsageState
  profile: UserProfile
  settings: AppSettings
  activeMonthId: string
  updatedAt: number
}

function touch() {
  return { updatedAt: Date.now() }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Cuenta de la que sale/entra la plata cuando no se indica una */
/** Día por defecto de un adelanto: hoy si estamos en ese mes; si no, el 1.º */
function diaDeAdelanto(monthId: string): string {
  const hoy = todayLocalISO()
  return hoy.slice(0, 7) === monthId ? hoy : `${monthId}-01`
}

function cuentaPorDefecto(s: { accounts: Account[] }): string {
  const act = s.accounts.filter((a) => !a.archived && a.type !== 'credito')
  return (act.find((a) => a.isMain) ?? act[0])?.id ?? ''
}

/**
 * Meses sanos: los gastos hormiga viejos se convierten en MOVIMIENTOS con su
 * categoria adivinada, para que nadie pierda lo que ya habia anotado.
 */
/** Un gasto viejo (v9 y anteriores) traia su desglose en `children` */
interface GastoConHijos { children?: { id: string; name: string; amount: number }[] }

function healMonths(
  months: Record<string, MonthData>,
  accounts: Account[] = [],
): Record<string, MonthData> {
  const cuenta = accounts.find((a) => a.isMain && !a.archived)
    ?? accounts.find((a) => a.type !== 'credito' && !a.archived)
  let cambio = false
  const out: Record<string, MonthData> = {}
  for (const [id, m] of Object.entries(months)) {
    let mes = m

    // (1) SUB-ITEMS viejos -> el monto queda consolidado y el desglose en la nota
    if ((mes.expenses ?? []).some((e) => 'children' in (e as object))) {
      cambio = true
      mes = {
        ...mes,
        expenses: mes.expenses.map((raw) => {
          const { children, ...limpio } = raw as Expense & GastoConHijos
          const hijos = children ?? []
          if (!hijos.length) return limpio as Expense
          const suma = hijos.reduce((t, c) => t + (c.amount || 0), 0)
          const desglose = hijos.map((c) => `${c.name} ${c.amount}`).join(' - ')
          return {
            ...limpio,
            // el mismo numero que el usuario ya veia en pantalla
            amount: suma,
            note: [limpio.note, desglose].filter(Boolean).join(' - '),
          } as Expense
        }),
      }
    }

    // (2) gastos hormiga -> movimientos
    const viejas = mes.hormigas ?? []
    if (!viejas.length) { out[id] = mes; continue }
    const yaMigradas = new Set((mes.movements ?? []).map((x) => x.id))
    const nuevos: Movement[] = viejas
      .filter((h) => !yaMigradas.has(h.id))
      .map((h) => ({
        id: h.id,
        name: h.name,
        amount: h.amount,
        kind: 'gasto' as const,
        categoryId: guessCategory(h.name, 'gasto'),
        accountId: cuenta?.id ?? '',
        dateISO: h.dateISO || `${id}-15`,
        budgetId: h.budgetId,
        createdAt: h.dateISO || `${id}-15`,
      }))
    if (!nuevos.length) { out[id] = mes; continue }
    cambio = true
    out[id] = { ...mes, hormigas: [], movements: [...(mes.movements ?? []), ...nuevos] }
  }
  return cambio ? out : months
}

/**
 * Barre los movimientos que sobraron de un pago que ya no está.
 *
 * Un movimiento nacido de un pago lleva el rastro de ese pago (`sourceId`) y
 * el pago guarda el id del movimiento. Si desmarcás el pago, el movimiento se
 * va con él. Pero una versión anterior no limpiaba en todos los casos y
 * quedaban movimientos huérfanos descontando plata de una cuenta por algo que
 * el usuario nunca hizo, o el mismo pago anotado dos veces.
 *
 * Solo toca lo que generó la app: lo que anotás a mano no lleva rastro y no
 * se borra nunca.
 */
function pruneOrphanMovements(
  months: Record<string, MonthData>,
  debts: Debt[],
): Record<string, MonthData> {
  // ids de movimiento que algún pago vivo sigue reclamando
  const vivos = new Set<string>()
  // rastros de pagos que hoy están pagados (para detectar copias repetidas)
  const fuentesVivas = new Set<string>()
  for (const m of Object.values(months)) {
    for (const e of m.expenses ?? []) {
      if (e.paid && e.movementId) { vivos.add(e.movementId); fuentesVivas.add(e.id) }
      for (const ad of e.advances ?? []) {
        if (ad.movementId) vivos.add(ad.movementId)
        fuentesVivas.add(ad.id)
      }
    }
  }
  for (const d of debts) {
    for (const [mid, p] of Object.entries(d.payments ?? {})) {
      if (!p?.paid) continue
      if (p.movementId) vivos.add(p.movementId)
      fuentesVivas.add(`${d.id}:${mid}`)
    }
  }

  let cambio = false
  const vistos = new Set<string>() // un rastro no puede aparecer dos veces
  const out: Record<string, MonthData> = {}
  for (const [id, m] of Object.entries(months)) {
    const movs = m.movements ?? []
    const limpios = movs.filter((mv) => {
      if (!mv.sourceId) return true              // anotado a mano: intocable
      if (vivos.has(mv.id)) {                    // su pago lo reclama
        vistos.add(mv.sourceId)
        return true
      }
      if (!fuentesVivas.has(mv.sourceId)) return false  // el pago ya no existe
      if (vistos.has(mv.sourceId)) return false         // copia repetida
      vistos.add(mv.sourceId)
      return true
    })
    if (limpios.length !== movs.length) { cambio = true; out[id] = { ...m, movements: limpios } }
    else out[id] = m
  }
  return cambio ? out : months
}

/**
 * Un mismo pago no puede quedar anotado dos veces.
 *
 * Se van las copias exactas (mismo nombre, monto, día, cuenta y tipo) SOLO
 * cuando el movimiento nació de un pago del mes: o lleva el rastro de la app,
 * o su nombre es el de un pago o una cuota de ese mes. Lo que anotás a mano
 * no se toca: dos cafés de 750 el mismo día son dos cafés de verdad.
 */
function dedupePaymentMovements(
  months: Record<string, MonthData>,
  debts: Debt[],
): Record<string, MonthData> {
  let cambio = false
  const out: Record<string, MonthData> = {}
  for (const [id, m] of Object.entries(months)) {
    const movs = m.movements ?? []
    if (movs.length < 2) { out[id] = m; continue }

    // nombres que la app genera al marcar un pago o una cuota de ESTE mes
    const dePago = new Set<string>()
    for (const e of m.expenses ?? []) {
      dePago.add(e.name.trim().toLowerCase())
      dePago.add(`adelanto - ${e.name.trim().toLowerCase()}`)
    }
    for (const d of debts) {
      if (d.payments?.[id]) dePago.add(`cuota ${d.name.trim().toLowerCase()}`)
    }

    const vistos = new Set<string>()
    const limpios = movs.filter((mv) => {
      const nombre = mv.name.trim().toLowerCase()
      if (!mv.sourceId && !dePago.has(nombre)) return true // anotado a mano
      const clave = [nombre, mv.amount, mv.dateISO.slice(0, 10), mv.accountId, mv.kind].join('|')
      if (vistos.has(clave)) return false
      vistos.add(clave)
      return true
    })
    if (limpios.length !== movs.length) { cambio = true; out[id] = { ...m, movements: limpios } }
    else out[id] = m
  }
  return cambio ? out : months
}

/**
 * El mismo pago fijo no puede estar dos veces en un mes.
 *
 * Pasaba al agregar un gasto recurrente con un nombre que ya tenía su pago
 * fijo: nacía suelto al lado del sembrado. Se unen SOLO cuando son idénticos
 * (mismo nombre y mismo monto) y la copia sobrante no tiene nada propio que
 * perder: ni pagos, ni adelantos, ni nota, ni lista de compras.
 */
function dedupeSeededExpenses(months: Record<string, MonthData>): Record<string, MonthData> {
  let cambio = false
  const out: Record<string, MonthData> = {}
  for (const [id, m] of Object.entries(months)) {
    const vistos = new Map<string, Expense>()
    const limpios: Expense[] = []
    for (const e of m.expenses ?? []) {
      const clave = `${e.name.trim().toLowerCase()}|${e.amount}`
      const previo = vistos.get(clave)
      const vacio = !e.paid && !(e.advances ?? []).length && !e.note && !e.shopping
      if (previo && vacio) { cambio = true; continue }
      vistos.set(clave, e)
      limpios.push(e)
    }
    out[id] = cambio && limpios.length !== (m.expenses ?? []).length ? { ...m, expenses: limpios } : m
  }
  return cambio ? out : months
}

/**
 * Repara deudas con montos corruptos (p. ej. la IA devolvió un número como
 * texto y al persistir quedó null): la cuota y el total siempre son números.
 */
function healDebts(debts: Debt[] | undefined): Debt[] {
  return (debts ?? []).map((d) => {
    const total = Number.isFinite(d.total) && d.total > 0 ? d.total : 0
    const installments = Number.isFinite(d.installments) && d.installments >= 1 ? Math.round(d.installments) : 1
    const monthlyPayment = Number.isFinite(d.monthlyPayment) && d.monthlyPayment > 0
      ? d.monthlyPayment
      : Math.max(1, Math.round(total / installments))
    if (total === d.total && installments === d.installments && monthlyPayment === d.monthlyPayment) return d
    return { ...d, total, installments, monthlyPayment }
  })
}

/**
 * Planilla sana: los estados viejos traen solo `ccssPct`; se convierten a la
 * lista de deducciones de ley y se completan tramos y pagos extraordinarios.
 */
function healPayroll(p: Partial<PayrollConfig> | undefined): PayrollConfig {
  const base = { ...DEFAULT_PAYROLL, ...p }
  if (!base.statutory) {
    base.statutory = [{
      id: 'legacy',
      name: base.statutoryName?.trim() || DEFAULT_STATUTORY_NAME,
      pct: base.ccssPct ?? 0,
      cap: 0,
    }]
  }
  if (!base.taxBrackets || base.taxBrackets.length === 0) {
    base.taxBrackets = countryPreset(base.countryId)?.taxBrackets ?? DEFAULT_PAYROLL.taxBrackets
  }
  if (!base.extraPays) base.extraPays = []
  return base
}

function patchMonth(
  s: FinanceState,
  monthId: string,
  fn: (m: MonthData) => MonthData,
): Partial<FinanceState> {
  const month = s.months[monthId]
  if (!month) return {}
  return { months: { ...s.months, [monthId]: fn(month) }, ...touch() }
}

/** Deja todos los meses al dia con los pagos fijos, sin tocar el historial */
function sembrarTodo(
  months: Record<string, MonthData>,
  recurring: RecurringTemplate[],
): Record<string, MonthData> {
  return seedAllMonths(months, recurring, currentMonthId())
}

/** Campos del gasto que si tienen sentido en su pago fijo */
const CAMPOS_PLANTILLA = [
  'name', 'amount', 'kind', 'dueDay', 'icon', 'note',
  'accountId', 'categoryId', 'budgetId', 'reminder', 'recurrence',
] as const

function parchePlantilla(patch: Partial<Expense>): Partial<RecurringTemplate> {
  const out: Record<string, unknown> = {}
  for (const k of CAMPOS_PLANTILLA) if (k in patch) out[k] = (patch as Record<string, unknown>)[k]
  return out as Partial<RecurringTemplate>
}

function patchExpense(
  s: FinanceState,
  monthId: string,
  id: string,
  fn: (e: Expense) => Expense,
): Partial<FinanceState> {
  return patchMonth(s, monthId, (m) => ({
    ...m,
    expenses: m.expenses.map((e) => (e.id === id ? fn(e) : e)),
  }))
}

// ─── Migración desde la versión 1 ────────────────────────────────────────────

interface V1Item { id: string; name: string; amount: number; paid: boolean; dueDay?: number; isRecurring: boolean }
interface V1Month {
  id: string; year: number; month: number
  income: { salary: number; additional: number; additionalLabel: string }
  sections: { type: string; label: string; items: V1Item[] }[]
}
interface V1State {
  months?: Record<string, V1Month>
  settings?: { defaultSalary?: number; notificationsEnabled?: boolean; notificationDays?: number[] }
  activeMonthId?: string
}

function migrateV1(old: V1State): Partial<FinanceState> {
  const months: Record<string, MonthData> = {}
  for (const [id, m] of Object.entries(old.months ?? {})) {
    const expenses: Expense[] = []
    for (const section of m.sections ?? []) {
      for (const it of section.items ?? []) {
        expenses.push({
          id: it.id,
          name: it.name,
          amount: it.amount,
          paid: it.paid,
          dueDay: it.dueDay,
          period: section.type === 'quincena' ? 'q1' : 'q2',
          kind: 'gasto',
          recurrence: it.isRecurring ? 'monthly' : 'once',
                  anchorMonthId: id,
          createdAt: todayISO(),
        })
      }
    }
    months[id] = {
      id, year: m.year, month: m.month,
      income: m.income ?? { salary: 0, additional: 0, additionalLabel: 'Ingresos adicionales' },
      expenses,
      celebrated: false,
    }
  }
  return {
    months,
    settings: {
      ...DEFAULT_SETTINGS,
      defaultSalary: old.settings?.defaultSalary ?? 0,
      notifications: {
        ...DEFAULT_NOTIFICATIONS,
        enabled: old.settings?.notificationsEnabled ?? false,
        daysBefore: old.settings?.notificationDays ?? [3, 1, 0],
      },
    },
    activeMonthId: old.activeMonthId ?? currentMonthId(),
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useFinanceStore = create<FinanceState & FinanceActions>()(
  persist(
    (set, get) => ({
      months: {},
      accounts: [],
      installments: [],
      recurring: [],
      debts: [],
      loans: [],
      budgets: [],
      usage: EMPTY_USAGE,
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
      activeMonthId: currentMonthId(),
      activeTab: 'home',
      subs: {},
      updatedAt: 0,

      setActiveTab: (tab) => set({ activeTab: tab }),
      setSub: (tab, sub) => set((s) => ({ subs: { ...s.subs, [tab]: sub } })),

      setActiveMonth: (monthId) => {
        get().ensureMonthExists(monthId)
        set({ activeMonthId: monthId })
      },

      /** El mes nace con sus pagos fijos ya puestos */
      ensureMonthExists: (monthId) => {
        const { months, settings, recurring } = get()
        if (months[monthId]) return
        const mes = seedMonth(makeMonth(monthId, settings), recurring)
        set((s) => ({ months: { ...s.months, [monthId]: mes }, ...touch() }))
      },

      // Borrar el mes (punto 1)
      deleteMonth: (monthId) =>
        set((s) => {
          const months = { ...s.months }
          delete months[monthId]
          const remaining = Object.keys(months).sort()
          const nowId = currentMonthId()
          const fallback = months[nowId] ? nowId : (remaining[remaining.length - 1] ?? nowId)
          const activeMonthId = s.activeMonthId === monthId ? fallback : s.activeMonthId
          return { months, activeMonthId, ...touch() }
        }),

      updateIncome: (monthId, patch) =>
        set((s) => patchMonth(s, monthId, (m) => ({ ...m, income: { ...m.income, ...patch } }))),

      /**
       * Al agregar un gasto que SE REPITE nace su pago fijo y se siembra de
       * una vez en todos los meses guardados, del actual en adelante. Ahí se
       * cumple la regla: marcado como recurrente = sale en todos los meses.
       */
      addExpense: (monthId, e) => {
        get().ensureMonthExists(monthId)
        const gasto: Expense = {
          ...e,
          id: uid(),
          anchorMonthId: e.anchorMonthId ?? monthId,
          createdAt: todayISO(),
        }
        set((s) => {
          const mes = s.months[monthId]
          if (!mes) return {}
          const clave = gasto.name.trim().toLowerCase()
          const existente = s.recurring.find((t) => t.name.trim().toLowerCase() === clave)
          const plantilla = gasto.recurrence !== 'once' && !gasto.templateId && !existente
            ? templateFromExpense(gasto, monthId)
            : null
          if (plantilla) gasto.templateId = plantilla.id
          // ya habia un pago fijo con ese nombre: este gasto ES ese, no otro.
          // Si no se engancha, el mes termina con el mismo pago dos veces.
          else if (existente && gasto.recurrence !== 'once' && !gasto.templateId) {
            gasto.templateId = existente.id
          }

          const recurring = plantilla ? [...s.recurring, plantilla] : s.recurring
          const conGasto = {
            ...s.months,
            [monthId]: { ...mes, expenses: [...mes.expenses, gasto] },
          }
          return {
            months: plantilla ? sembrarTodo(conGasto, recurring) : conGasto,
            recurring,
            ...touch(),
          }
        })
      },

      updateExpense: (monthId, id, patch, scope = 'mes') =>
        set((s) => {
          const mes = s.months[monthId]
          const actual = mes?.expenses.find((e) => e.id === id)
          if (!mes || !actual) return {}

          // (a) lo acaba de marcar como "se repite": nace su pago fijo
          const seVuelveFijo = !actual.templateId
            && patch.recurrence !== undefined && patch.recurrence !== 'once'
          const nombre = (patch.name ?? actual.name).trim().toLowerCase()
          const yaExiste = s.recurring.some((t) => t.name.trim().toLowerCase() === nombre)
          const plantilla = seVuelveFijo && !yaExiste
            ? templateFromExpense({ ...actual, ...patch } as Expense, monthId)
            : null

          // (b) apagó "se repite": deja de repetirse de aquí en adelante
          const apaga = patch.recurrence === 'once' && Boolean(actual.templateId)
          const tid = plantilla?.id ?? (apaga ? undefined : actual.templateId)

          let recurring = plantilla ? [...s.recurring, plantilla] : s.recurring
          if (apaga) recurring = recurring.filter((t) => t.id !== actual.templateId)

          let months: Record<string, MonthData> = {
            ...s.months,
            [monthId]: {
              ...mes,
              expenses: mes.expenses.map((e) =>
                (e.id === id ? { ...e, ...patch, templateId: tid } : e)),
            },
          }

          // (c) "también en los meses siguientes"
          if (scope === 'siempre' && tid) {
            recurring = recurring.map((t) => (t.id === tid ? { ...t, ...parchePlantilla(patch) } : t))
            // los campos de plata nunca se clonan a otros meses
            const parcheFuturo = { ...patch }
            delete parcheFuturo.advances
            delete parcheFuturo.movementId
            delete parcheFuturo.shopping
            months = Object.fromEntries(Object.entries(months).map(([mid, m]) => [mid,
              mid > monthId
                ? { ...m, expenses: m.expenses.map((e) =>
                    (e.templateId === tid && !e.paid ? { ...e, ...parcheFuturo } : e)) }
                : m]))
          }
          if (apaga) {
            months = Object.fromEntries(Object.entries(months).map(([mid, m]) => [mid,
              mid > monthId
                ? { ...m, expenses: m.expenses.filter((e) => e.templateId !== actual.templateId || e.paid) }
                : m]))
          }

          if (plantilla) months = sembrarTodo(months, recurring)
          return { months, recurring, ...touch() }
        }),

      /** 'mes' = quitarlo solo de aquí (deja lápida) · 'siempre' = no repetirlo más */
      deleteExpense: (monthId, id, scope = 'mes') =>
        set((s) => {
          const mes = s.months[monthId]
          const gasto = mes?.expenses.find((e) => e.id === id)
          if (!mes || !gasto) return {}
          const tid = gasto.templateId

          // La plata vuelve: si el pago (o sus adelantos) ya movio una cuenta,
          // al borrarlo se borran tambien esos movimientos. Si no, la cuenta
          // quedaria rebajada por un gasto que ya no existe.
          const suyos = new Set<string>()
          if (gasto.movementId) suyos.add(gasto.movementId)
          for (const ad of gasto.advances ?? []) if (ad.movementId) suyos.add(ad.movementId)

          let months: Record<string, MonthData> = {
            ...s.months,
            [monthId]: {
              ...mes,
              movements: (mes.movements ?? []).filter((mv) => !suyos.has(mv.id)),
              expenses: mes.expenses.filter((e) => e.id !== id),
              // lápida: en ESTE mes no se vuelve a sembrar, en los demás sí
              skipTemplates: tid && scope === 'mes'
                ? Array.from(new Set([...(mes.skipTemplates ?? []), tid]))
                : mes.skipTemplates,
            },
          }
          let recurring = s.recurring

          if (tid && scope === 'siempre') {
            recurring = s.recurring.filter((t) => t.id !== tid)
            months = Object.fromEntries(Object.entries(months).map(([mid, m]) => [mid,
              mid > monthId
                ? { ...m, expenses: m.expenses.filter((e) => e.templateId !== tid || e.paid) }
                : m]))
          }
          if (suyos.size) {
            months = Object.fromEntries(Object.entries(months).map(([mid, m]) => [mid, {
              ...m,
              movements: (m.movements ?? []).filter((mv) => !suyos.has(mv.id)),
            }]))
          }
          return { months, recurring, ...touch() }
        }),

      /**
       * ADELANTO: el recibo es de 30.000 y el día 10 abonás 15.000. Sale plata
       * de verdad (movimiento con su fecha, su cuenta y su categoría) y el pago
       * queda con 15.000 pendientes.
       */
      addExpenseAdvance: (monthId, expenseId, data) => {
        const s0 = get()
        const gasto = s0.months[monthId]?.expenses.find((e) => e.id === expenseId)
        if (!gasto || gasto.paid || data.amount <= 0) return
        // una lista de compras no admite adelantos: su monto todavía se está
        // moviendo y el adelanto podría superar lo que de verdad se compre
        if (gasto.shopping) return

        const monto = Math.min(data.amount, remainingAmount(gasto))
        if (monto <= 0) return

        const fecha = (data.dateISO || diaDeAdelanto(monthId)).slice(0, 10)
        const cuenta = data.accountId || gasto.accountId || cuentaPorDefecto(s0)
        const adelantoId = uid()
        const movementId = cuenta
          ? get().addMovementReturningId({
              name: `Adelanto - ${gasto.name}`.slice(0, 40),
              amount: monto,
              kind: 'gasto',
              categoryId: gasto.categoryId || guessCategory(gasto.name, 'gasto'),
              accountId: cuenta,
              dateISO: fecha,
              icon: gasto.icon,
              budgetId: gasto.budgetId,
              note: data.note,
              sourceId: adelantoId,
            })
          : undefined

        const adelanto: ExpenseAdvance = {
          id: adelantoId,
          amount: monto,
          dateISO: fecha,
          accountId: cuenta || undefined,
          movementId,
          note: data.note,
          createdAt: todayISO(),
        }

        set((st) => patchExpense(st, monthId, expenseId, (e) => {
          const advances = [...(e.advances ?? []), adelanto]
          const total = advances.reduce((t, a) => t + a.amount, 0)
          // si los adelantos cubren el total, el pago queda saldado sin otro
          // movimiento: esa plata ya salió con los adelantos
          return e.amount > 0 && total >= e.amount
            ? { ...e, advances, paid: true, paidAt: todayISO(), movementId: undefined }
            : { ...e, advances }
        }))
      },

      /**
       * Borrar un adelanto devuelve su plata a la cuenta. Si el pago ya estaba
       * pagado se recalcula su movimiento final, o quedaría "pagado" habiendo
       * movido menos plata de la que cuesta.
       */
      deleteExpenseAdvance: (monthId, expenseId, advanceId) => {
        const s0 = get()
        const gasto = s0.months[monthId]?.expenses.find((e) => e.id === expenseId)
        const adelanto = (gasto?.advances ?? []).find((a) => a.id === advanceId)
        if (!gasto || !adelanto) return

        // 1) se va el movimiento del adelanto: la plata vuelve a la cuenta
        if (adelanto.movementId) get().deleteMovement(adelanto.movementId)

        const quedan = (gasto.advances ?? []).filter((a) => a.id !== advanceId)
        const falta = Math.max(0, gasto.amount - quedan.reduce((t, a) => t + a.amount, 0))

        // 2) rebalanceo del movimiento final (solo si está pagado)
        let movementId = gasto.movementId
        if (gasto.paid) {
          if (movementId) {
            if (falta > 0) get().updateMovement(movementId, { amount: falta })
            else { get().deleteMovement(movementId); movementId = undefined }
          } else if (falta > 0) {
            // estaba saldado solo con adelantos: ahora hace falta el movimiento
            const cuenta = gasto.accountId || cuentaPorDefecto(s0)
            movementId = cuenta
              ? get().addMovementReturningId({
                  name: gasto.name.slice(0, 40),
                  amount: falta,
                  kind: 'gasto',
                  categoryId: gasto.categoryId || guessCategory(gasto.name, 'gasto'),
                  accountId: cuenta,
                  dateISO: (gasto.paidAt ?? todayISO()).slice(0, 10),
                  icon: gasto.icon,
                  budgetId: gasto.budgetId,
                })
              : undefined
          }
        }

        set((st) => patchExpense(st, monthId, expenseId, (e) => ({
          ...e,
          advances: (e.advances ?? []).filter((a) => a.id !== advanceId),
          movementId: e.paid ? movementId : e.movementId,
        })))
      },

      /* ─── Listas de compras ──────────────────────────────────────────── */

      createShoppingList: (monthId, data) => {
        get().ensureMonthExists(monthId)
        const id = uid()
        const day = data.dueDay
        set((st) => {
          const mes = st.months[monthId]
          if (!mes) return {}
          const gasto: Expense = {
            id,
            name: data.name.trim() || 'Lista de compras',
            amount: 0, // lo sincroniza cada producto
            paid: false,
            dueDay: day,
            period: day && day <= 15 ? 'q1' : 'q2',
            kind: 'gasto',
            // una compra no se repite sola; se revive con "Copiar de otro mes"
            recurrence: 'once',
            icon: data.icon || 'super',
            color: data.color,
            accountId: data.accountId,
            categoryId: data.categoryId || guessCategory(data.name, 'gasto'),
            anchorMonthId: monthId,
            shopping: { items: [], done: false, store: data.store },
            createdAt: todayISO(),
          }
          return {
            months: { ...st.months, [monthId]: { ...mes, expenses: [...mes.expenses, gasto] } },
            ...touch(),
          }
        })
        return id
      },

      addShoppingProduct: (monthId, expenseId, prod) =>
        set((st) => patchExpense(st, monthId, expenseId, (e) => {
          if (!e.shopping || e.shopping.done) return e // cerrada = solo lectura
          return syncShoppingAmount({
            ...e,
            shopping: {
              ...e.shopping,
              items: [...e.shopping.items, {
                ...prod, id: uid(), qty: Math.max(1, prod.qty || 1), checked: false,
              }],
            },
          })
        })),

      updateShoppingProduct: (monthId, expenseId, productId, patch) =>
        set((st) => patchExpense(st, monthId, expenseId, (e) => {
          if (!e.shopping || e.shopping.done) return e
          return syncShoppingAmount({
            ...e,
            shopping: {
              ...e.shopping,
              items: e.shopping.items.map((prod) => (prod.id === productId ? { ...prod, ...patch } : prod)),
            },
          })
        })),

      deleteShoppingProduct: (monthId, expenseId, productId) =>
        set((st) => patchExpense(st, monthId, expenseId, (e) => {
          if (!e.shopping || e.shopping.done) return e
          return syncShoppingAmount({
            ...e,
            shopping: { ...e.shopping, items: e.shopping.items.filter((prod) => prod.id !== productId) },
          })
        })),

      /** Marcar un producto NO mueve plata: solo cambia el subtotal que llevo */
      toggleShoppingProduct: (monthId, expenseId, productId) =>
        set((st) => patchExpense(st, monthId, expenseId, (e) => {
          if (!e.shopping || e.shopping.done) return e
          return syncShoppingAmount({
            ...e,
            shopping: {
              ...e.shopping,
              items: e.shopping.items.map((prod) => (prod.id === productId
                ? { ...prod, checked: !prod.checked, checkedAt: prod.checked ? undefined : todayISO() }
                : prod)),
            },
          })
        })),

      /**
       * Único punto donde una lista mueve dinero. Al cerrarla, el gasto pasa a
       * valer solo lo marcado y togglePaid crea el movimiento por ESE mismo
       * número. Al reabrirla se borra el movimiento y vuelve a valer lo planeado.
       */
      toggleShoppingDone: (monthId, expenseId) => {
        const gasto = get().months[monthId]?.expenses.find((e) => e.id === expenseId)
        if (!gasto?.shopping) return

        if (gasto.shopping.done || gasto.paid) { // reabrir
          if (gasto.paid) get().togglePaid(monthId, expenseId) // borra el movimiento
          set((st) => patchExpense(st, monthId, expenseId, (e) => (e.shopping
            ? syncShoppingAmount({ ...e, shopping: { ...e.shopping, done: false, doneAt: undefined } })
            : e)))
          return
        }

        // sin nada en el carrito no se cierra nada
        if (shoppingChecked(gasto.shopping) <= 0) return

        // 1) el gasto colapsa al subtotal marcado…
        set((st) => patchExpense(st, monthId, expenseId, (e) => (e.shopping
          ? syncShoppingAmount({ ...e, shopping: { ...e.shopping, done: true, doneAt: todayISO() } })
          : e)))
        // 2) …y togglePaid lee ese monto ya escrito para crear el movimiento
        get().togglePaid(monthId, expenseId)
      },

      /**
       * Marcar un pago como PAGADO crea su movimiento: queda en el historial y
       * sale de la cuenta con la que se pagó (si es tarjeta, sube su deuda).
       * Al desmarcarlo, ese movimiento se borra.
       */
      togglePaid: (monthId, id) => {
        const s0 = get()
        const gasto = s0.months[monthId]?.expenses.find((e) => e.id === id)
        if (!gasto) return

        if (gasto.paid) {
          // se borra SOLO el movimiento final: los adelantos no se tocan,
          // esa plata ya salió de verdad y sigue en Movimientos
          if (gasto.movementId) get().deleteMovement(gasto.movementId)
          set((s) => patchExpense(s, monthId, id, (e) => ({
            ...e, paid: false, paidAt: undefined, movementId: undefined,
          })))
          return
        }

        const monto = remainingAmount(gasto)
        const cuenta = gasto.accountId || cuentaPorDefecto(s0)
        const movementId = cuenta && monto > 0
          ? get().addMovementReturningId({
              name: gasto.name.slice(0, 40),
              amount: monto,
              kind: 'gasto',
              categoryId: gasto.categoryId || guessCategory(gasto.name, 'gasto'),
              accountId: cuenta,
              dateISO: todayLocalISO(),
              icon: gasto.icon,
              budgetId: gasto.budgetId,
              sourceId: gasto.id,
            })
          : undefined
        set((s) => patchExpense(s, monthId, id, (e) => ({
          ...e, paid: true, paidAt: todayISO(), movementId,
        })))
      },


      addDebt: (d) =>
        set((s) => ({
          debts: [...s.debts, { ...d, id: uid(), payments: {}, createdAt: todayISO() }],
          ...touch(),
        })),

      updateDebt: (id, patch) =>
        set((s) => {
          const debts = s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d))
          // La deducción de planilla vinculada sigue la cuota real (mejora 6)
          let settings = s.settings
          if (patch.monthlyPayment !== undefined) {
            const per = settings.payroll.inputPeriod ?? 'monthly'
            const amount = convertPeriod(patch.monthlyPayment, 'monthly', per)
            const deductions = settings.payroll.deductions.map((x) =>
              x.debtId === id ? { ...x, amount } : x)
            settings = { ...settings, payroll: { ...settings.payroll, deductions } }
          }
          if (patch.viaPlanilla === false) {
            settings = {
              ...settings,
              payroll: { ...settings.payroll, deductions: settings.payroll.deductions.filter((x) => x.debtId !== id) },
            }
          }
          return { debts, settings, ...touch() }
        }),

      deleteDebt: (id) =>
        set((s) => ({
          debts: s.debts.filter((d) => d.id !== id),
          // si se pagaba por planilla, su deducción también desaparece (mejora 6)
          settings: {
            ...s.settings,
            payroll: { ...s.settings.payroll, deductions: s.settings.payroll.deductions.filter((x) => x.debtId !== id) },
          },
          ...touch(),
        })),

      /** Igual que los pagos del mes: la cuota pagada deja su movimiento */
      toggleDebtPaid: (debtId, monthId) => {
        const s0 = get()
        const deuda = s0.debts.find((d) => d.id === debtId)
        if (!deuda) return
        const prev: DebtPayment = deuda.payments[monthId] ?? { paid: false, amount: deuda.monthlyPayment }

        if (prev.paid) {
          if (prev.movementId) get().deleteMovement(prev.movementId)
          set((s) => ({
            debts: s.debts.map((d) => (d.id === debtId
              ? {
                  ...d,
                  payments: {
                    ...d.payments,
                    [monthId]: { ...prev, paid: false, paidAt: undefined, movementId: undefined },
                  },
                }
              : d)),
            ...touch(),
          }))
          return
        }

        const cuenta = prev.accountId || cuentaPorDefecto(s0)
        // por planilla no lleva movimiento: el neto del salario ya viene sin esa cuota
        const movementId = !deuda.viaPlanilla && cuenta && prev.amount > 0
          ? get().addMovementReturningId({
              name: `Cuota ${deuda.name}`.slice(0, 40),
              amount: prev.amount,
              kind: 'gasto',
              categoryId: deuda.categoryId || 'deudas',
              accountId: cuenta,
              dateISO: todayLocalISO(),
              icon: deuda.icon,
              sourceId: `${debtId}:${monthId}`,
            })
          : undefined
        set((s) => ({
          debts: s.debts.map((d) => (d.id === debtId
            ? {
                ...d,
                payments: {
                  ...d.payments,
                  [monthId]: { ...prev, paid: true, paidAt: todayISO(), movementId },
                },
              }
            : d)),
          ...touch(),
        }))
      },

      /**
       * Pagar una cuota con su desglose (capital e intereses). Como cualquier
       * otro pago, deja su MOVIMIENTO: antes la plata desaparecia de la cuenta
       * sin que apareciera en ningun lado.
       */
      payDebtInstallment: (debtId, monthId, detail) => {
        const s0 = get()
        const deuda = s0.debts.find((d) => d.id === debtId)
        if (!deuda) return
        const prev: DebtPayment = deuda.payments[monthId] ?? { paid: false, amount: deuda.monthlyPayment }
        // si ya estaba pagada, su movimiento anterior se reemplaza
        if (prev.movementId) get().deleteMovement(prev.movementId)

        const monto = detail.amount ?? prev.amount
        const cuenta = detail.accountId || prev.accountId || cuentaPorDefecto(s0)
        const movementId = !deuda.viaPlanilla && cuenta && monto > 0
          ? get().addMovementReturningId({
              name: `Cuota ${deuda.name}`.slice(0, 40),
              amount: monto,
              kind: 'gasto',
              categoryId: deuda.categoryId || 'deudas',
              accountId: cuenta,
              dateISO: detail.paidAt?.slice(0, 10) || todayLocalISO(),
              icon: deuda.icon,
              sourceId: `${debtId}:${monthId}`,
            })
          : undefined

        set((s) => ({
          debts: s.debts.map((d) => {
            if (d.id !== debtId) return d
            const next: DebtPayment = {
              ...prev,
              ...detail,
              paid: true,
              paidAt: detail.paidAt ?? todayISO(),
              amount: monto,
              movementId,
            }
            return { ...d, payments: { ...d.payments, [monthId]: next } }
          }),
          ...touch(),
        }))
      },

      importRecurring: (targetMonthId, fromMonthId) =>
        set((s) => {
          const from = s.months[fromMonthId]
          const target = s.months[targetMonthId]
          if (!from || !target) return {}
          const existing = new Set(target.expenses.map((e) => e.name.toLowerCase()))
          const copies = recurringCandidates(from, targetMonthId)
            .filter((e) => !existing.has(e.name.toLowerCase()))
            .map(cloneExpenseForMonth)
          return {
            months: {
              ...s.months,
              [targetMonthId]: {
                ...target,
                carryAsked: true,
                income: { ...target.income, salary: target.income.salary || from.income.salary },
                expenses: [...target.expenses, ...copies],
              },
            },
            ...touch(),
          }
        }),

      copyExpensesFrom: (targetMonthId, fromMonthId, ids) =>
        set((s) => {
          const from = s.months[fromMonthId]
          const target = s.months[targetMonthId] ?? seedMonth(makeMonth(targetMonthId, s.settings), s.recurring)
          if (!from) return {}
          const existentes = new Set(target.expenses.map((e) => e.name.trim().toLowerCase()))
          const copias = from.expenses
            .filter((e) => ids.includes(e.id))
            .filter((e) => !existentes.has(e.name.trim().toLowerCase()))
            // se conserva el vínculo con su pago fijo: así la copia no se duplica
            .map((e) => cloneExpenseForMonth(e))
          if (!copias.length) return {}
          return {
            months: {
              ...s.months,
              [targetMonthId]: { ...target, expenses: [...target.expenses, ...copias] },
            },
            ...touch(),
          }
        }),

      markCarryAsked: (monthId) =>
        set((s) => patchMonth(s, monthId, (m) => ({ ...m, carryAsked: true }))),

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch }, ...touch() })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch }, ...touch() })),
      setTheme: (patch) =>
        set((s) => ({ settings: { ...s.settings, theme: { ...s.settings.theme, ...patch } }, ...touch() })),
      setAnimations: (patch) =>
        set((s) => ({ settings: { ...s.settings, animations: { ...s.settings.animations, ...patch } }, ...touch() })),
      setNotifications: (patch) =>
        set((s) => ({ settings: { ...s.settings, notifications: { ...s.settings.notifications, ...patch } }, ...touch() })),
      // La planilla manda: al cambiarla, el salario del mes actual y los futuros
      // se actualizan SOLOS con el neto (el ingreso ya no se edita en la vista Mes).
      // viewPeriod es solo visual: no dispara la sincronización ni escritura a la nube.
      setPayroll: (patch) =>
        set((s) => {
          const payroll = { ...s.settings.payroll, ...patch }
          const settings = { ...s.settings, payroll }
          const affectsMoney = 'gross' in patch || 'ccssPct' in patch || 'deductions' in patch || 'inputPeriod' in patch
          if (affectsMoney) {
            // con planilla manda el neto; sin planilla vuelve al salario manual
            const net = payroll.gross > 0
              ? Math.round(payrollBreakdown(payroll).monthlyNet)
              : settings.defaultSalary
            const nowId = currentMonthId()
            const months = Object.fromEntries(
              Object.entries(s.months).map(([id, m]) =>
                id >= nowId ? [id, { ...m, income: { ...m.income, salary: net } }] : [id, m],
              ),
            )
            const defaultSalary = payroll.gross > 0 ? net : settings.defaultSalary
            return { settings: { ...settings, defaultSalary }, months, ...touch() }
          }
          return { settings, ...touch() }
        }),
      setPaySchedule: (patch) =>
        set((s) => ({ settings: { ...s.settings, paySchedule: { ...s.settings.paySchedule, ...patch } }, ...touch() })),
      setSavings: (patch) =>
        set((s) => ({ settings: { ...s.settings, savings: { ...s.settings.savings, ...patch } }, ...touch() })),
      // El aporte "rápido" va al primer sobre; si no hay, crea "Mi ahorro"
      addSavingsDeposit: (amount, note, accountId) =>
        set((s) => {
          const sav = s.settings.savings
          const cuenta = accountId || cuentaPorDefecto(s)
          const movementId = cuenta && amount !== 0
            ? get().addMovementReturningId({
                name: (amount > 0 ? 'Ahorro' : 'Retiro del ahorro').slice(0, 40),
                amount: Math.abs(amount),
                kind: amount > 0 ? 'gasto' : 'ingreso',
                categoryId: 'ahorro',
                accountId: cuenta,
                dateISO: todayLocalISO(),
                icon: 'ahorro',
                note,
              })
            : undefined
          const dep = { id: uid(), amount, dateISO: todayLocalISO(), note, accountId: cuenta || undefined, movementId }
          const envelopes = sav.envelopes.length
            ? sav.envelopes.map((e, i) => (i === 0 ? { ...e, deposits: [...e.deposits, dep] } : e))
            : [{
                id: uid(),
                name: sav.goalName || 'Mi ahorro',
                goal: sav.goal,
                initial: 0,
                deposits: [dep],
                createdAt: todayISO(),
              }]
          return { settings: { ...s.settings, savings: { ...sav, envelopes } }, ...touch() }
        }),
      deleteSavingsDeposit: (id) =>
        set((s) => ({
          settings: {
            ...s.settings,
            savings: {
              ...s.settings.savings,
              deposits: s.settings.savings.deposits.filter((d) => d.id !== id),
              envelopes: s.settings.savings.envelopes.map((e) => ({
                ...e,
                deposits: e.deposits.filter((d) => d.id !== id),
              })),
            },
          },
          ...touch(),
        })),

      addEnvelope: (e) =>
        set((s) => ({
          settings: {
            ...s.settings,
            savings: {
              ...s.settings.savings,
              enabled: true,
              envelopes: [...s.settings.savings.envelopes, {
                id: uid(),
                name: e.name.trim() || 'Ahorro',
                goal: Math.max(0, e.goal),
                initial: Math.max(0, e.initial),
                deposits: [],
                createdAt: todayISO(),
              }],
            },
          },
          ...touch(),
        })),
      updateEnvelope: (id, patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            savings: {
              ...s.settings.savings,
              envelopes: s.settings.savings.envelopes.map((e) => (e.id === id ? { ...e, ...patch } : e)),
            },
          },
          ...touch(),
        })),
      deleteEnvelope: (id) =>
        set((s) => ({
          settings: {
            ...s.settings,
            savings: { ...s.settings.savings, envelopes: s.settings.savings.envelopes.filter((e) => e.id !== id) },
          },
          ...touch(),
        })),
      /**
       * Aporte (o retiro) a un sobre de ahorro. La plata se mueve DE VERDAD:
       * apartar 10 000 saca 10 000 de la cuenta elegida y deja su movimiento;
       * un retiro (monto negativo) los devuelve.
       */
      addEnvelopeDeposit: (envelopeId, amount, note, accountId) => {
        const s0 = get()
        const sobre = s0.settings.savings.envelopes.find((e) => e.id === envelopeId)
        const cuenta = accountId || cuentaPorDefecto(s0)
        const esAporte = amount > 0
        const movementId = cuenta && amount !== 0
          ? get().addMovementReturningId({
              name: (esAporte ? `Ahorro: ${sobre?.name ?? 'sobre'}` : `Retiro de ${sobre?.name ?? 'ahorro'}`).slice(0, 40),
              amount: Math.abs(amount),
              kind: esAporte ? 'gasto' : 'ingreso',
              categoryId: 'ahorro',
              accountId: cuenta,
              dateISO: todayLocalISO(),
              icon: 'ahorro',
              note,
            })
          : undefined

        set((s) => ({
          settings: {
            ...s.settings,
            savings: {
              ...s.settings.savings,
              envelopes: s.settings.savings.envelopes.map((e) => e.id === envelopeId
                ? { ...e, deposits: [...e.deposits, { id: uid(), amount, dateISO: todayLocalISO(), note, accountId: cuenta || undefined, movementId }] }
                : e),
            },
          },
          ...touch(),
        }))
      },
      deleteEnvelopeDeposit: (envelopeId, depositId) => {
        // si el aporte movió una cuenta, al borrarlo la plata vuelve
        const dep = get().settings.savings.envelopes
          .find((e) => e.id === envelopeId)?.deposits.find((d) => d.id === depositId)
        if (dep?.movementId) get().deleteMovement(dep.movementId)
        set((s) => ({
          settings: {
            ...s.settings,
            savings: {
              ...s.settings.savings,
              envelopes: s.settings.savings.envelopes.map((e) => e.id === envelopeId
                ? { ...e, deposits: e.deposits.filter((d) => d.id !== depositId) }
                : e),
            },
          },
          ...touch(),
        }))
      },

      /**
       * "Hoy tengo X": ajusta el EFECTIVO REAL a ese monto. Si ya hay cuentas,
       * corrige la principal; si no hay ninguna, crea la cuenta principal.
       */
      setFundNow: (baseAmount) =>
        set((s) => {
          const principal = s.accounts.find((a) => a.isMain && !a.archived && a.type !== 'credito')
          const fund = { ...s.settings.fund, enabled: true }
          if (principal) {
            const actual = realBalance(
              s.months, s.debts, s.settings, new Date(), s.loans, s.accounts, s.installments,
            ) ?? 0
            const delta = baseAmount - actual
            return {
              accounts: s.accounts.map((a) => (a.id === principal.id
                ? { ...a, openingBalance: round2(a.openingBalance + delta) }
                : a)),
              settings: { ...s.settings, fund },
              ...touch(),
            }
          }
          // primera vez: la cuenta principal nace con ese saldo
          const anchor = currentMonthId()
          const id = uid()
          const cuenta: Account = {
            id,
            name: 'Cuenta principal',
            type: 'corriente',
            icon: 'banco',
            openingBalance: baseAmount,
            openingISO: `${anchor}-01`,
            includeInTotal: true,
            isMain: true,
            flowSnapshot: generalFlow(s.months, s.debts, s.settings, anchor, new Date(), s.loans, s.accounts),
            createdAt: todayISO(),
          }
          // los movimientos que no tenían cuenta pasan a ser de esta
          const months = Object.fromEntries(Object.entries(s.months).map(([mid, m]) => [mid, {
            ...m,
            movements: (m.movements ?? []).map((mv) => (mv.accountId ? mv : { ...mv, accountId: id })),
          }]))
          return {
            accounts: [...s.accounts, cuenta],
            months,
            settings: {
              ...s.settings,
              fund: makeFundConfig(baseAmount, s.months, s.debts, s.settings, s.loans, s.accounts),
            },
            ...touch(),
          }
        }),
      disableFund: () =>
        set((s) => ({ settings: { ...s.settings, fund: { ...s.settings.fund, enabled: false } }, ...touch() })),

      addHormiga: (monthId, h) => {
        const s = get()
        const cuenta = s.accounts.find((a) => a.isMain && !a.archived)
          ?? s.accounts.find((a) => a.type !== 'credito' && !a.archived)
        get().addMovement({
          name: h.name,
          amount: h.amount,
          kind: 'gasto',
          categoryId: guessCategory(h.name, 'gasto'),
          accountId: cuenta?.id ?? '',
          dateISO: monthId === currentMonthId() ? todayLocalISO() : `${monthId}-15`,
          budgetId: h.budgetId,
        })
      },

      // ── Cuentas contables ────────────────────────────────────────────────
      addAccount: (a) => {
        const id = uid()
        set((s) => {
          const esPrimeraDeEfectivo = !s.accounts.some((x) => !x.archived && x.type !== 'credito')
          const cuenta: Account = {
            ...a,
            id,
            isMain: a.type === 'credito' ? false : (a.isMain ?? esPrimeraDeEfectivo),
            createdAt: todayISO(),
          }
          const accounts = cuenta.isMain
            ? [...s.accounts.map((x) => ({ ...x, isMain: false })), cuenta]
            : [...s.accounts, cuenta]
          // movimientos viejos sin cuenta (migrados de gastos hormiga): se
          // adoptan en la primera cuenta principal para que el total cuadre
          const huerfanos = cuenta.isMain
          const months = huerfanos
            ? Object.fromEntries(Object.entries(s.months).map(([mid, m]) => [mid, {
                ...m,
                movements: (m.movements ?? []).map((mv) => (
                  mv.accountId ? mv : { ...mv, accountId: id }
                )),
              }]))
            : s.months
          return { accounts, months, ...touch() }
        })
        return id
      },
      updateAccount: (id, patch) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          ...touch(),
        })),
      deleteAccount: (id) =>
        set((s) => {
          const quedan = s.accounts.filter((a) => a.id !== id)
          const candidata = quedan.find((a) => a.type !== 'credito' && !a.archived)
          const hayPrincipal = quedan.some((a) => a.isMain && a.type !== 'credito' && !a.archived)
          const accounts = hayPrincipal || !candidata
            ? quedan
            : quedan.map((a) => (a.id === candidata.id ? { ...a, isMain: true } : a))
          // los movimientos de esa cuenta pasan a la principal para no perderlos
          const destino = accounts.find((a) => a.isMain)?.id
          const months = destino
            ? Object.fromEntries(Object.entries(s.months).map(([mid, m]) => [mid, {
                ...m,
                movements: (m.movements ?? [])
                  .filter((mv) => !(mv.kind === 'transferencia' && mv.toAccountId === id))
                  .map((mv) => (mv.accountId === id ? { ...mv, accountId: destino } : mv)),
              }]))
            : s.months
          return {
            accounts,
            months,
            installments: s.installments.filter((i) => i.accountId !== id),
            ...touch(),
          }
        }),
      setMainAccount: (id) =>
        set((s) => ({
          accounts: s.accounts.map((a) => ({ ...a, isMain: a.id === id && a.type !== 'credito' })),
          ...touch(),
        })),
      setAccountBalance: (id, amount, currentBalance) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id
            ? { ...a, openingBalance: round2(a.openingBalance + (amount - currentBalance)) }
            : a)),
          ...touch(),
        })),

      // ── Movimientos del mes ──────────────────────────────────────────────
      addMovement: (mv) => { get().addMovementReturningId(mv) },
      addMovementReturningId: (mv) => {
        // Un pago solo puede tener UN movimiento. Si ya lo dejó (por un doble
        // toque, o porque se volvió a marcar sin limpiar), se reutiliza el que
        // hay en vez de anotar la misma plata otra vez.
        if (mv.sourceId) {
          const s0 = get()
          for (const m of Object.values(s0.months)) {
            const previo = (m.movements ?? []).find((x) => x.sourceId === mv.sourceId)
            if (previo) {
              get().updateMovement(previo.id, { ...mv })
              return previo.id
            }
          }
        }
        const id = uid()
        set((s) => {
          const monthId = mv.dateISO.slice(0, 7)
          const mes = s.months[monthId] ?? seedMonth(makeMonth(monthId, s.settings), s.recurring)
          const nuevo: Movement = { ...mv, id, createdAt: todayISO() }
          return {
            months: {
              ...s.months,
              [monthId]: { ...mes, movements: [...(mes.movements ?? []), nuevo] },
            },
            ...touch(),
          }
        })
        return id
      },
      updateMovement: (id, patch) =>
        set((s) => {
          let encontrado: Movement | undefined
          const months: Record<string, MonthData> = {}
          for (const [mid, m] of Object.entries(s.months)) {
            const hit = (m.movements ?? []).find((x) => x.id === id)
            if (hit) {
              encontrado = { ...hit, ...patch }
              months[mid] = { ...m, movements: (m.movements ?? []).filter((x) => x.id !== id) }
            } else {
              months[mid] = m
            }
          }
          if (!encontrado) return {}
          const destinoId = encontrado.dateISO.slice(0, 7)
          const destino = months[destinoId] ?? seedMonth(makeMonth(destinoId, s.settings), s.recurring)
          return {
            months: {
              ...months,
              [destinoId]: { ...destino, movements: [...(destino.movements ?? []), encontrado] },
            },
            ...touch(),
          }
        }),
      deleteMovement: (id) =>
        set((s) => ({
          months: Object.fromEntries(Object.entries(s.months).map(([mid, m]) => [mid, {
            ...m,
            movements: (m.movements ?? []).filter((x) => x.id !== id),
          }])),
          ...touch(),
        })),

      // ── Compras a cuotas con tarjeta ─────────────────────────────────────
      addInstallment: (i) =>
        set((s) => ({
          installments: [...s.installments, { ...i, id: uid(), payments: {}, createdAt: todayISO() }],
          ...touch(),
        })),
      updateInstallment: (id, patch) =>
        set((s) => ({
          installments: s.installments.map((i) => (i.id === id ? { ...i, ...patch } : i)),
          ...touch(),
        })),
      deleteInstallment: (id) =>
        set((s) => ({ installments: s.installments.filter((i) => i.id !== id), ...touch() })),
      toggleInstallmentPaid: (id, monthId) =>
        set((s) => ({
          installments: s.installments.map((i) => {
            if (i.id !== id) return i
            const actual = i.payments[monthId]
            const paid = !actual?.paid
            return {
              ...i,
              payments: {
                ...i.payments,
                [monthId]: {
                  paid,
                  amount: actual?.amount ?? i.monthly,
                  paidAt: paid ? todayISO() : undefined,
                },
              },
            }
          }),
          ...touch(),
        })),

      // ── Categorias de movimientos ────────────────────────────────────────
      addCategory: (c) =>
        set((s) => ({
          settings: {
            ...s.settings,
            categories: [...(s.settings.categories ?? DEFAULT_CATEGORIES), { ...c, id: uid() }],
          },
          ...touch(),
        })),
      updateCategory: (id, patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            categories: (s.settings.categories ?? DEFAULT_CATEGORIES).map((c) => (
              c.id === id ? { ...c, ...patch } : c
            )),
          },
          ...touch(),
        })),
      deleteCategory: (id) =>
        set((s) => {
          const lista = s.settings.categories ?? DEFAULT_CATEGORIES
          const cat = lista.find((c) => c.id === id)
          // las de la app solo se ocultan; las propias se borran
          const categories = cat?.builtin
            ? lista.map((c) => (c.id === id ? { ...c, hidden: true } : c))
            : lista.filter((c) => c.id !== id)
          return { settings: { ...s.settings, categories }, ...touch() }
        }),

      // ── Préstamos propios ────────────────────────────────────────────────
      /**
       * Presté plata: se registra el préstamo y se genera el MOVIMIENTO que
       * saca la plata de la cuenta (así se ve en Movimientos y en el saldo).
       */
      addLoan: (l) => {
        // si me prestaron a mí, la plata ENTRA a la cuenta; si yo presté, SALE
        const meprestaron = l.kind === 'borrowed'
        const movementId = get().addMovementReturningId({
          name: (meprestaron ? `Me prestó ${l.person}` : `Le presté a ${l.person}`).slice(0, 40),
          amount: l.amount,
          kind: meprestaron ? 'ingreso' : 'gasto',
          categoryId: meprestaron ? 'me-prestaron' : 'preste',
          accountId: l.accountId ?? cuentaPorDefecto(get()),
          dateISO: (l.dateISO || todayISO()).slice(0, 10),
          note: l.note,
        })
        set((s) => ({
          loans: [...s.loans, {
            ...l,
            id: uid(),
            payments: [],
            advances: [],
            movementId,
            createdAt: todayISO(),
          }],
          ...touch(),
        }))
      },
      updateLoan: (id, patch) =>
        set((s) => ({ loans: s.loans.map((l) => (l.id === id ? { ...l, ...patch } : l)), ...touch() })),
      deleteLoan: (id) => {
        const loan = get().loans.find((l) => l.id === id)
        if (loan) {
          const movimientos = [
            loan.movementId,
            ...(loan.advances ?? []).map((a) => a.movementId),
            ...loan.payments.map((p) => p.movementId),
          ].filter(Boolean) as string[]
          for (const mid of movimientos) get().deleteMovement(mid)
        }
        set((s) => ({ loans: s.loans.filter((l) => l.id !== id), ...touch() }))
      },
      /**
       * Abono del préstamo. Si yo presté, el abono ENTRA a mi cuenta; si me
       * prestaron, soy yo quien paga y la plata SALE.
       */
      addLoanPayment: (loanId, amount, note, dateISO, accountId) => {
        const loan = get().loans.find((l) => l.id === loanId)
        const meprestaron = loan?.kind === 'borrowed'
        const fecha = (dateISO || todayISO()).slice(0, 10)
        const cuenta = accountId ?? loan?.accountId ?? cuentaPorDefecto(get())
        const movementId = get().addMovementReturningId({
          name: (meprestaron
            ? `Abono a ${loan?.person ?? 'préstamo'}`
            : `Abono de ${loan?.person ?? 'préstamo'}`).slice(0, 40),
          amount,
          kind: meprestaron ? 'gasto' : 'ingreso',
          categoryId: meprestaron ? 'pague-prestamo' : 'me-pagaron',
          accountId: cuenta,
          dateISO: fecha,
          note,
        })
        set((s) => ({
          loans: s.loans.map((l) => l.id === loanId
            ? {
                ...l,
                payments: [...l.payments, { id: uid(), amount, dateISO: fecha, note, movementId, accountId: cuenta }],
              }
            : l),
          ...touch(),
        }))
      },
      deleteLoanPayment: (loanId, paymentId) => {
        const pago = get().loans.find((l) => l.id === loanId)?.payments.find((p) => p.id === paymentId)
        if (pago?.movementId) get().deleteMovement(pago.movementId)
        set((s) => ({
          loans: s.loans.map((l) => l.id === loanId
            ? { ...l, payments: l.payments.filter((p) => p.id !== paymentId) }
            : l),
          ...touch(),
        }))
      },

      /** Otro préstamo con la misma persona: sube el saldo y mueve la cuenta */
      addLoanAdvance: (loanId, amount, note, dateISO, accountId) => {
        const loan = get().loans.find((l) => l.id === loanId)
        const meprestaron = loan?.kind === 'borrowed'
        const fecha = (dateISO || todayISO()).slice(0, 10)
        const cuenta = accountId ?? loan?.accountId ?? cuentaPorDefecto(get())
        const movementId = get().addMovementReturningId({
          name: (meprestaron
            ? `Me prestó más ${loan?.person ?? 'alguien'}`
            : `Le presté más a ${loan?.person ?? 'alguien'}`).slice(0, 40),
          amount,
          kind: meprestaron ? 'ingreso' : 'gasto',
          categoryId: meprestaron ? 'me-prestaron' : 'preste',
          accountId: cuenta,
          dateISO: fecha,
          note,
        })
        const avance: LoanAdvance = { id: uid(), amount, dateISO: fecha, note, movementId, accountId: cuenta }
        set((s) => ({
          loans: s.loans.map((l) => l.id === loanId
            ? { ...l, advances: [...(l.advances ?? []), avance] }
            : l),
          ...touch(),
        }))
      },
      deleteLoanAdvance: (loanId, advanceId) => {
        const av = get().loans.find((l) => l.id === loanId)?.advances?.find((a) => a.id === advanceId)
        if (av?.movementId) get().deleteMovement(av.movementId)
        set((s) => ({
          loans: s.loans.map((l) => l.id === loanId
            ? { ...l, advances: (l.advances ?? []).filter((a) => a.id !== advanceId) }
            : l),
          ...touch(),
        }))
      },

      recordUsage: (tokens, hadAttachment) =>
        set((s) => {
          const now = new Date()
          const dayKey = now.toISOString().slice(0, 10)
          const monthKey = dayKey.slice(0, 7)
          const u = s.usage ?? EMPTY_USAGE
          const sameDay = u.dayKey === dayKey
          const sameMonth = u.monthKey === monthKey
          return {
            usage: {
              dayKey,
              msgs: (sameDay ? u.msgs : 0) + 1,
              tokens: (sameDay ? u.tokens : 0) + Math.max(0, tokens),
              attachments: (sameDay ? u.attachments : 0) + (hadAttachment ? 1 : 0),
              monthKey,
              monthMsgs: (sameMonth ? u.monthMsgs : 0) + 1,
              monthTokens: (sameMonth ? u.monthTokens : 0) + Math.max(0, tokens),
            },
            ...touch(),
          }
        }),

      // ── Presupuestos ─────────────────────────────────────────────────────
      addBudget: (b) =>
        set((s) => ({
          budgets: [...s.budgets, { ...b, id: uid(), entries: [], createdAt: todayISO() }],
          ...touch(),
        })),
      updateBudget: (id, patch) =>
        set((s) => ({ budgets: s.budgets.map((b) => (b.id === id ? { ...b, ...patch } : b)), ...touch() })),
      deleteBudget: (id) =>
        set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id), ...touch() })),
      addBudgetEntry: (budgetId, amount, note) =>
        set((s) => ({
          budgets: s.budgets.map((b) => b.id === budgetId
            ? { ...b, entries: [...b.entries, { id: uid(), amount, dateISO: todayLocalISO(), note }] }
            : b),
          ...touch(),
        })),
      deleteBudgetEntry: (budgetId, entryId) =>
        set((s) => ({
          budgets: s.budgets.map((b) => b.id === budgetId
            ? { ...b, entries: b.entries.filter((e) => e.id !== entryId) }
            : b),
          ...touch(),
        })),
      deleteHormiga: (monthId, id) =>
        set((s) => patchMonth(s, monthId, (m) => ({
          ...m,
          hormigas: (m.hormigas ?? []).filter((x) => x.id !== id),
          movements: (m.movements ?? []).filter((x) => x.id !== id),
        }))),
      setDefaultSalaryEverywhere: (v) =>
        set((s) => {
          const nowId = currentMonthId()
          const months = Object.fromEntries(
            Object.entries(s.months).map(([id, m]) =>
              id >= nowId ? [id, { ...m, income: { ...m.income, salary: v } }] : [id, m],
            ),
          )
          return { settings: { ...s.settings, defaultSalary: v }, months, ...touch() }
        }),
      setViewMode: (mode) =>
        set((s) => ({ settings: { ...s.settings, viewMode: mode }, ...touch() })),

      markCelebrated: (monthId, value = true) =>
        set((s) => patchMonth(s, monthId, (m) => ({ ...m, celebrated: value }))),

      hydrateFrom: (data) =>
        set((prev) => {
          // Un cliente viejo (v8) no manda `accounts`: en ese caso se conservan
          // las cuentas locales para no perderlas al sincronizar o importar.
          const accounts = data.accounts ?? prev.accounts ?? []
          const installments = data.installments ?? prev.installments ?? []
          return {
          months: seedAllMonths(
            healMonths(data.months ?? {}, accounts),
            data.recurring ?? prev.recurring ?? [],
            currentMonthId(),
          ),
          accounts,
          installments,
          recurring: data.recurring ?? prev.recurring ?? [],
          debts: healDebts(data.debts),
          loans: data.loans ?? [],
          budgets: data.budgets ?? [],
          usage: data.usage ?? EMPTY_USAGE,
          profile: { ...DEFAULT_PROFILE, ...data.profile },
          settings: {
            ...DEFAULT_SETTINGS,
            ...data.settings,
            theme: { ...DEFAULT_THEME, ...data.settings?.theme },
            animations: { ...DEFAULT_ANIMATIONS, ...data.settings?.animations },
            notifications: { ...DEFAULT_NOTIFICATIONS, ...data.settings?.notifications },
            payroll: healPayroll(data.settings?.payroll),
            paySchedule: { ...DEFAULT_PAY_SCHEDULE, ...data.settings?.paySchedule },
            savings: { ...DEFAULT_SAVINGS, ...data.settings?.savings, envelopes: data.settings?.savings?.envelopes ?? [] },
            fund: { ...DEFAULT_FUND, ...data.settings?.fund },
            categories: mergeCategories(data.settings?.categories),
            homeWidgets: data.settings?.homeWidgets ?? DEFAULT_WIDGETS,
          },
          activeMonthId: data.activeMonthId ?? currentMonthId(),
          updatedAt: data.updatedAt ?? Date.now(),
          }
        }),

      resetAll: () =>
        set({
          months: {},
          accounts: [],
          installments: [],
          recurring: [],
          debts: [],
          loans: [],
          budgets: [],
          usage: EMPTY_USAGE,
          profile: DEFAULT_PROFILE,
          settings: DEFAULT_SETTINGS,
          activeMonthId: currentMonthId(),
          activeTab: 'home',
          subs: {},
          ...touch(),
        }),
    }),
    {
      name: 'finance-app-state',
      version: 11,
      // Merge profundo de settings: cualquier estado guardado sin los campos
      // nuevos (clientes viejos, nube) recibe los defaults sin romper nada
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FinanceState>
        return {
          ...current,
          ...p,
          // los meses ya guardados se ponen al día con los pagos fijos, y de
          // paso se barren los movimientos repetidos de un mismo pago
          months: seedAllMonths(
            dedupePaymentMovements(
              pruneOrphanMovements(healMonths(p.months ?? {}, p.accounts ?? []), p.debts ?? []),
              p.debts ?? [],
            ),
            p.recurring ?? [],
            currentMonthId(),
          ),
          accounts: p.accounts ?? [],
          installments: p.installments ?? [],
          recurring: p.recurring ?? [],
          debts: healDebts(p.debts),
          loans: p.loans ?? [],
          budgets: p.budgets ?? [],
          usage: p.usage ?? EMPTY_USAGE,
          profile: { ...DEFAULT_PROFILE, ...p.profile },
          settings: {
            ...DEFAULT_SETTINGS,
            ...p.settings,
            theme: { ...DEFAULT_THEME, ...p.settings?.theme },
            animations: { ...DEFAULT_ANIMATIONS, ...p.settings?.animations },
            notifications: { ...DEFAULT_NOTIFICATIONS, ...p.settings?.notifications },
            payroll: healPayroll(p.settings?.payroll),
            paySchedule: { ...DEFAULT_PAY_SCHEDULE, ...p.settings?.paySchedule },
            savings: { ...DEFAULT_SAVINGS, ...p.settings?.savings, envelopes: p.settings?.savings?.envelopes ?? [] },
            fund: { ...DEFAULT_FUND, ...p.settings?.fund },
            categories: mergeCategories(p.settings?.categories),
          },
        }
      },
      migrate: (persisted, version) => {
        // Cadena ASCENDENTE: cada paso se aplica en orden y el `merge` de
        // arriba se encarga después de completar los campos nuevos con sus
        // valores por defecto (por eso aquí solo van los cambios de forma).
        let st = (persisted ?? {}) as FinanceState

        if (version < 2) {
          st = {
            months: {},
            accounts: [],
            installments: [],
            debts: [],
            loans: [],
            budgets: [],
            usage: EMPTY_USAGE,
            profile: DEFAULT_PROFILE,
            settings: DEFAULT_SETTINGS,
            activeMonthId: currentMonthId(),
            activeTab: 'home',
            updatedAt: Date.now(),
            ...migrateV1((persisted ?? {}) as V1State),
          } as FinanceState
        }

        if (version < 4) {
          // v2/v3 → v4: quien ya usaba la app no repite el recorrido
          st = {
            ...st,
            profile: {
              ...DEFAULT_PROFILE,
              ...st.profile,
              tourDone: (st.profile as Partial<UserProfile>)?.tourDone ?? Boolean(st.profile?.onboarded),
            },
          }
        }

        if (version < 6) {
          // v5 → v6: los aportes sueltos pasan a ser un sobre de ahorro
          const sav = { ...DEFAULT_SAVINGS, ...(st.settings as Partial<AppSettings>)?.savings }
          const envelopes = sav.envelopes?.length
            ? sav.envelopes
            : (sav.deposits?.length || sav.goal > 0
              ? [{
                  id: uid(),
                  name: sav.goalName || 'Mi ahorro',
                  goal: sav.goal ?? 0,
                  initial: 0,
                  deposits: sav.deposits ?? [],
                  createdAt: todayISO(),
                }]
              : [])
          st = { ...st, settings: { ...st.settings, savings: { ...sav, envelopes } } }
        }

        if (version < 9) {
          // v8 → v9: cuentas contables. El saldo real que el usuario ya tenía
          // se convierte en su CUENTA PRINCIPAL, con el mismo monto base y el
          // mismo mes ancla, para que el total no cambie ni un colón.
          const f = (st.settings as Partial<AppSettings>)?.fund
          const accounts: Account[] = st.accounts ?? []
          if (!accounts.length && f?.enabled && f.anchorMonthId) {
            accounts.push({
              id: uid(),
              name: 'Cuenta principal',
              type: 'corriente',
              icon: 'banco',
              openingBalance: f.baseAmount ?? 0,
              openingISO: `${f.anchorMonthId}-01`,
              includeInTotal: true,
              isMain: true,
              flowSnapshot: f.snapshot ?? 0,
              createdAt: todayISO(),
            })
          }
          st = {
            ...st,
            accounts,
            installments: st.installments ?? [],
            months: seedAllMonths(
              healMonths(st.months ?? {}, accounts),
              st.recurring ?? [],
              currentMonthId(),
            ),
            settings: {
              ...st.settings,
              categories: (st.settings as Partial<AppSettings>)?.categories?.length
                ? (st.settings as AppSettings).categories
                : DEFAULT_CATEGORIES,
            },
          }
        }

        if (version < 10) {
          // v9 → v10: se van los SUB-ÍTEMS. healMonths consolida el monto de
          // los gastos que tenían hijos y deja el desglose en la nota.
          st = {
            ...st,
            months: seedAllMonths(
              healMonths(st.months ?? {}, st.accounts ?? []),
              st.recurring ?? [],
              currentMonthId(),
            ),
          }
        }

        if (version < 11) {
          // v10 → v11: se barren los movimientos que quedaron de pagos que ya
          // no están, y el mismo pago fijo deja de poder estar dos veces en un
          // mes (uno con plantilla y otro suelto con el mismo nombre).
          st = {
            ...st,
            months: dedupeSeededExpenses(
              dedupePaymentMovements(pruneOrphanMovements(st.months ?? {}, st.debts ?? []), st.debts ?? []),
            ),
          }
        }

        return st as FinanceState & FinanceActions
      },
    },
  ),
)

/** Estado serializable para sincronizar con Firestore */
export function exportState(): PersistedShape {
  const s = useFinanceStore.getState()
  return {
    schema: 11,
    months: s.months,
    accounts: s.accounts,
    installments: s.installments,
    recurring: s.recurring,
    debts: s.debts,
    loans: s.loans,
    budgets: s.budgets,
    usage: s.usage,
    profile: s.profile,
    settings: s.settings,
    activeMonthId: s.activeMonthId,
    updatedAt: s.updatedAt,
  }
}
