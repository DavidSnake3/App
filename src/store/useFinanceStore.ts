import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AnimationPrefs, AppSettings, Debt, DebtPayment, Expense, MonthData,
  NotificationPrefs, PayrollConfig, PaySchedule, SavingsConfig, SubItem,
  TabId, ThemeSettings, UserProfile, ViewMode, WidgetConf,
} from '../types/finance'
import { currentMonthId, todayISO } from '../lib/dates'
import { cloneExpenseForMonth, makeMonth, recurringCandidates, uid } from '../lib/finance'
import { DEFAULT_CCSS_PCT, payrollBreakdown } from '../lib/payroll'

// ─── Valores por defecto ─────────────────────────────────────────────────────

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  email: '',
  phone: '',
  photoUrl: '',
  currency: 'CRC',
  payday: 1,
  payFrequency: 'monthly',
  planMode: 'monthly',
  onboarded: false,
  tourDone: false,
}

/** Widgets del inicio por defecto (el usuario los personaliza a su gusto) */
export const DEFAULT_WIDGETS: WidgetConf[] = [
  { id: 'estado', size: 'lg' },
  { id: 'resumen', size: 'lg' },
  { id: 'consejo', size: 'lg' },
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

export const DEFAULT_PAYROLL: PayrollConfig = {
  inputPeriod: 'monthly',
  gross: 0,
  ccssPct: DEFAULT_CCSS_PCT,
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
}

// ─── Estado ──────────────────────────────────────────────────────────────────

interface FinanceState {
  months: Record<string, MonthData>
  debts: Debt[]
  profile: UserProfile
  settings: AppSettings
  activeMonthId: string
  activeTab: TabId
  updatedAt: number
}

interface FinanceActions {
  setActiveTab(tab: TabId): void
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
  /** salario neto manual (sin planilla): actualiza default + mes actual y futuros */
  setDefaultSalaryEverywhere(v: number): void
  setViewMode(mode: ViewMode): void

  markCelebrated(monthId: string): void
  /** Reemplaza todo el estado (sincronización con la nube) */
  hydrateFrom(data: PersistedShape): void
  resetAll(): void
}

export interface PersistedShape {
  months: Record<string, MonthData>
  debts: Debt[]
  profile: UserProfile
  settings: AppSettings
  activeMonthId: string
  updatedAt: number
}

function touch() {
  return { updatedAt: Date.now() }
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
      debts: [],
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
      activeMonthId: currentMonthId(),
      activeTab: 'home',
      updatedAt: 0,

      setActiveTab: (tab) => set({ activeTab: tab }),

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
        set((s) => ({
          debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
          ...touch(),
        })),

      deleteDebt: (id) =>
        set((s) => ({ debts: s.debts.filter((d) => d.id !== id), ...touch() })),

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
          if (affectsMoney && payroll.gross > 0) {
            const net = Math.round(payrollBreakdown(payroll).monthlyNet)
            const nowId = currentMonthId()
            const months = Object.fromEntries(
              Object.entries(s.months).map(([id, m]) =>
                id >= nowId ? [id, { ...m, income: { ...m.income, salary: net } }] : [id, m],
              ),
            )
            return { settings: { ...settings, defaultSalary: net }, months, ...touch() }
          }
          return { settings, ...touch() }
        }),
      setPaySchedule: (patch) =>
        set((s) => ({ settings: { ...s.settings, paySchedule: { ...s.settings.paySchedule, ...patch } }, ...touch() })),
      setSavings: (patch) =>
        set((s) => ({ settings: { ...s.settings, savings: { ...s.settings.savings, ...patch } }, ...touch() })),
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
        set({
          months: data.months ?? {},
          debts: data.debts ?? [],
          profile: { ...DEFAULT_PROFILE, ...data.profile },
          settings: {
            ...DEFAULT_SETTINGS,
            ...data.settings,
            theme: { ...DEFAULT_THEME, ...data.settings?.theme },
            animations: { ...DEFAULT_ANIMATIONS, ...data.settings?.animations },
            notifications: { ...DEFAULT_NOTIFICATIONS, ...data.settings?.notifications },
            payroll: { ...DEFAULT_PAYROLL, ...data.settings?.payroll },
            paySchedule: { ...DEFAULT_PAY_SCHEDULE, ...data.settings?.paySchedule },
            savings: { ...DEFAULT_SAVINGS, ...data.settings?.savings },
            homeWidgets: data.settings?.homeWidgets ?? DEFAULT_WIDGETS,
          },
          activeMonthId: data.activeMonthId ?? currentMonthId(),
          updatedAt: data.updatedAt ?? Date.now(),
        }),

      resetAll: () =>
        set({
          months: {},
          debts: [],
          profile: DEFAULT_PROFILE,
          settings: DEFAULT_SETTINGS,
          activeMonthId: currentMonthId(),
          activeTab: 'home',
          ...touch(),
        }),
    }),
    {
      name: 'finance-app-state',
      version: 4,
      migrate: (persisted, version) => {
        if (version < 2) {
          const migrated = migrateV1((persisted ?? {}) as V1State)
          return {
            months: {},
            debts: [],
            profile: DEFAULT_PROFILE,
            settings: DEFAULT_SETTINGS,
            activeMonthId: currentMonthId(),
            activeTab: 'home',
            updatedAt: Date.now(),
            ...migrated,
          } as FinanceState & FinanceActions
        }
        if (version < 4) {
          // v2/v3 → v4: nuevos campos (planilla por período, tour, sonidos, widgets)
          const s = persisted as FinanceState
          return {
            ...s,
            profile: {
              ...DEFAULT_PROFILE,
              ...s.profile,
              // quien ya usaba la app no necesita el recorrido de bienvenida
              tourDone: (s.profile as Partial<UserProfile>)?.tourDone ?? Boolean(s.profile?.onboarded),
            },
            settings: {
              ...DEFAULT_SETTINGS,
              ...s.settings,
              animations: { ...DEFAULT_ANIMATIONS, ...s.settings?.animations },
              payroll: { ...DEFAULT_PAYROLL, ...(s.settings as Partial<AppSettings>)?.payroll },
              paySchedule: { ...DEFAULT_PAY_SCHEDULE, ...(s.settings as Partial<AppSettings>)?.paySchedule },
              savings: { ...DEFAULT_SAVINGS, ...(s.settings as Partial<AppSettings>)?.savings },
              homeWidgets: s.settings?.homeWidgets ?? DEFAULT_WIDGETS,
            },
          } as FinanceState & FinanceActions
        }
        return persisted as FinanceState & FinanceActions
      },
    },
  ),
)

/** Estado serializable para sincronizar con Firestore */
export function exportState(): PersistedShape {
  const s = useFinanceStore.getState()
  return {
    months: s.months,
    debts: s.debts,
    profile: s.profile,
    settings: s.settings,
    activeMonthId: s.activeMonthId,
    updatedAt: s.updatedAt,
  }
}
