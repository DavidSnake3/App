import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Account, AnimationPrefs, AppSettings, Budget, Category, Debt, DebtPayment, Expense,
  FundConfig, Installment, Loan, MonthData, Movement, NotificationPrefs, PayrollConfig,
  PaySchedule, SavingsConfig, SavingsEnvelope, SubItem, TabId, ThemeSettings, UsageState,
  UserProfile, ViewMode, WidgetConf,
} from '../types/finance'
import { currentMonthId, todayISO } from '../lib/dates'
import { DEFAULT_CATEGORIES, guessCategory } from '../lib/categories'
import { cloneExpenseForMonth, makeMonth, recurringCandidates, uid } from '../lib/finance'
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
  updateExpense(monthId: string, id: string, patch: Partial<Expense>): void
  deleteExpense(monthId: string, id: string): void
  togglePaid(monthId: string, id: string): void
  addSubItem(monthId: string, expenseId: string, item: Omit<SubItem, 'id'>): void
  updateSubItem(monthId: string, expenseId: string, subId: string, patch: Partial<SubItem>): void
  deleteSubItem(monthId: string, expenseId: string, subId: string): void

  addDebt(d: Omit<Debt, 'id' | 'createdAt' | 'payments'>): void
  updateDebt(id: string, patch: Partial<Debt>): void
  deleteDebt(id: string): void
  toggleDebtPaid(debtId: string, monthId: string): void
  /** registra un abono con desglose capital/interés (estilo recibo) */
  payDebtInstallment(debtId: string, monthId: string, detail: Partial<DebtPayment>): void

  /** copia los recurrentes del mes anterior al mes destino (mejora 12) */
  importRecurring(targetMonthId: string, fromMonthId: string): void
  markCarryAsked(monthId: string): void

  setProfile(patch: Partial<UserProfile>): void
  setSettings(patch: Partial<AppSettings>): void
  setTheme(patch: Partial<ThemeSettings>): void
  setAnimations(patch: Partial<AnimationPrefs>): void
  setNotifications(patch: Partial<NotificationPrefs>): void
  setPayroll(patch: Partial<PayrollConfig>): void
  setPaySchedule(patch: Partial<PaySchedule>): void
  setSavings(patch: Partial<SavingsConfig>): void
  /** aporta (o retira, con monto negativo) al sobre principal */
  addSavingsDeposit(amount: number, note?: string): void
  deleteSavingsDeposit(id: string): void

  /** sobres de ahorro: varios ahorros a la vez (mejora 5) */
  addEnvelope(e: { name: string; goal: number; initial: number }): void
  updateEnvelope(id: string, patch: Partial<Omit<SavingsEnvelope, 'id' | 'deposits'>>): void
  deleteEnvelope(id: string): void
  /** aporte (+) o retiro (−) a un sobre concreto */
  addEnvelopeDeposit(envelopeId: string, amount: number, note?: string): void
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
  addLoanPayment(loanId: string, amount: number, note?: string): void
  deleteLoanPayment(loanId: string, paymentId: string): void

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

  markCelebrated(monthId: string): void
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

/**
 * Meses sanos: los gastos hormiga viejos se convierten en MOVIMIENTOS con su
 * categoria adivinada, para que nadie pierda lo que ya habia anotado.
 */
function healMonths(
  months: Record<string, MonthData>,
  accounts: Account[] = [],
): Record<string, MonthData> {
  const cuenta = accounts.find((a) => a.isMain && !a.archived)
    ?? accounts.find((a) => a.type !== 'credito' && !a.archived)
  let cambio = false
  const out: Record<string, MonthData> = {}
  for (const [id, m] of Object.entries(months)) {
    const viejas = m.hormigas ?? []
    if (!viejas.length) { out[id] = m; continue }
    const yaMigradas = new Set((m.movements ?? []).map((x) => x.id))
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
    if (!nuevos.length) { out[id] = m; continue }
    cambio = true
    out[id] = { ...m, hormigas: [], movements: [...(m.movements ?? []), ...nuevos] }
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
          children: [],
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

      // Mes nuevo SIEMPRE vacío: copiar recurrentes solo si el usuario acepta (mejora 12)
      ensureMonthExists: (monthId) => {
        const { months, settings } = get()
        if (months[monthId]) return
        set((s) => ({
          months: { ...s.months, [monthId]: makeMonth(monthId, settings) },
          ...touch(),
        }))
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

      addExpense: (monthId, e) =>
        set((s) => patchMonth(s, monthId, (m) => ({
          ...m,
          expenses: [...m.expenses, { ...e, id: uid(), anchorMonthId: e.anchorMonthId ?? monthId, createdAt: todayISO() }],
        }))),

      updateExpense: (monthId, id, patch) =>
        set((s) => patchExpense(s, monthId, id, (e) => ({ ...e, ...patch }))),

      deleteExpense: (monthId, id) =>
        set((s) => patchMonth(s, monthId, (m) => ({
          ...m,
          expenses: m.expenses.filter((e) => e.id !== id),
        }))),

      togglePaid: (monthId, id) =>
        set((s) => patchExpense(s, monthId, id, (e) => ({
          ...e,
          paid: !e.paid,
          paidAt: !e.paid ? todayISO() : undefined,
        }))),

      addSubItem: (monthId, expenseId, item) =>
        set((s) => patchExpense(s, monthId, expenseId, (e) => ({
          ...e,
          children: [...e.children, { ...item, id: uid() }],
        }))),

      updateSubItem: (monthId, expenseId, subId, patch) =>
        set((s) => patchExpense(s, monthId, expenseId, (e) => ({
          ...e,
          children: e.children.map((c) => (c.id === subId ? { ...c, ...patch } : c)),
        }))),

      deleteSubItem: (monthId, expenseId, subId) =>
        set((s) => patchExpense(s, monthId, expenseId, (e) => ({
          ...e,
          children: e.children.filter((c) => c.id !== subId),
        }))),

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

      toggleDebtPaid: (debtId, monthId) =>
        set((s) => ({
          debts: s.debts.map((d) => {
            if (d.id !== debtId) return d
            const prev: DebtPayment = d.payments[monthId] ?? { paid: false, amount: d.monthlyPayment }
            const next: DebtPayment = {
              ...prev,
              paid: !prev.paid,
              paidAt: !prev.paid ? todayISO() : undefined,
            }
            return { ...d, payments: { ...d.payments, [monthId]: next } }
          }),
          ...touch(),
        })),

      payDebtInstallment: (debtId, monthId, detail) =>
        set((s) => ({
          debts: s.debts.map((d) => {
            if (d.id !== debtId) return d
            const prev: DebtPayment = d.payments[monthId] ?? { paid: false, amount: d.monthlyPayment }
            const next: DebtPayment = {
              ...prev,
              ...detail,
              paid: true,
              paidAt: detail.paidAt ?? todayISO(),
              amount: detail.amount ?? prev.amount,
            }
            return { ...d, payments: { ...d.payments, [monthId]: next } }
          }),
          ...touch(),
        })),

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
      addSavingsDeposit: (amount, note) =>
        set((s) => {
          const sav = s.settings.savings
          const dep = { id: uid(), amount, dateISO: todayISO().slice(0, 10), note }
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
      addEnvelopeDeposit: (envelopeId, amount, note) =>
        set((s) => ({
          settings: {
            ...s.settings,
            savings: {
              ...s.settings.savings,
              envelopes: s.settings.savings.envelopes.map((e) => e.id === envelopeId
                ? { ...e, deposits: [...e.deposits, { id: uid(), amount, dateISO: todayISO().slice(0, 10), note }] }
                : e),
            },
          },
          ...touch(),
        })),
      deleteEnvelopeDeposit: (envelopeId, depositId) =>
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
        })),

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
          dateISO: monthId === currentMonthId() ? todayISO().slice(0, 10) : `${monthId}-15`,
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
      addMovement: (mv) =>
        set((s) => {
          const monthId = mv.dateISO.slice(0, 7)
          const mes = s.months[monthId] ?? makeMonth(monthId, s.settings)
          const nuevo: Movement = { ...mv, id: uid(), createdAt: todayISO() }
          return {
            months: {
              ...s.months,
              [monthId]: { ...mes, movements: [...(mes.movements ?? []), nuevo] },
            },
            ...touch(),
          }
        }),
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
          const destino = months[destinoId] ?? makeMonth(destinoId, s.settings)
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
      addLoan: (l) =>
        set((s) => ({
          loans: [...s.loans, { ...l, id: uid(), payments: [], createdAt: todayISO() }],
          ...touch(),
        })),
      updateLoan: (id, patch) =>
        set((s) => ({ loans: s.loans.map((l) => (l.id === id ? { ...l, ...patch } : l)), ...touch() })),
      deleteLoan: (id) =>
        set((s) => ({ loans: s.loans.filter((l) => l.id !== id), ...touch() })),
      addLoanPayment: (loanId, amount, note) =>
        set((s) => ({
          loans: s.loans.map((l) => l.id === loanId
            ? { ...l, payments: [...l.payments, { id: uid(), amount, dateISO: todayISO().slice(0, 10), note }] }
            : l),
          ...touch(),
        })),
      deleteLoanPayment: (loanId, paymentId) =>
        set((s) => ({
          loans: s.loans.map((l) => l.id === loanId
            ? { ...l, payments: l.payments.filter((p) => p.id !== paymentId) }
            : l),
          ...touch(),
        })),

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
            ? { ...b, entries: [...b.entries, { id: uid(), amount, dateISO: todayISO().slice(0, 10), note }] }
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

      markCelebrated: (monthId) =>
        set((s) => patchMonth(s, monthId, (m) => ({ ...m, celebrated: true }))),

      hydrateFrom: (data) =>
        set((prev) => {
          // Un cliente viejo (v8) no manda `accounts`: en ese caso se conservan
          // las cuentas locales para no perderlas al sincronizar o importar.
          const accounts = data.accounts ?? prev.accounts ?? []
          const installments = data.installments ?? prev.installments ?? []
          return {
          months: healMonths(data.months ?? {}, accounts),
          accounts,
          installments,
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
            categories: data.settings?.categories?.length ? data.settings.categories : DEFAULT_CATEGORIES,
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
      version: 9,
      // Merge profundo de settings: cualquier estado guardado sin los campos
      // nuevos (clientes viejos, nube) recibe los defaults sin romper nada
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FinanceState>
        return {
          ...current,
          ...p,
          months: healMonths(p.months ?? {}, p.accounts ?? []),
          accounts: p.accounts ?? [],
          installments: p.installments ?? [],
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
            categories: p.settings?.categories?.length ? p.settings.categories : DEFAULT_CATEGORIES,
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
            months: healMonths(st.months ?? {}, accounts),
            settings: {
              ...st.settings,
              categories: (st.settings as Partial<AppSettings>)?.categories?.length
                ? (st.settings as AppSettings).categories
                : DEFAULT_CATEGORIES,
            },
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
    schema: 9,
    months: s.months,
    accounts: s.accounts,
    installments: s.installments,
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
