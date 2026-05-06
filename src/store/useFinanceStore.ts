import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MonthData, AppSettings, SectionType, ExpenseItem, TabId } from '../types/finance'
import { addMonths, format } from 'date-fns'

let _idCounter = 0
function uid(): string {
  return `${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultSalary: 600000,
  notificationsEnabled: false,
  notificationDays: [0, 1, 3],
  startYear: 2026,
  startMonth: 5,
}

const MAY_2026: MonthData = {
  id: '2026-05',
  year: 2026,
  month: 5,
  income: { salary: 600000, additional: 210000, additionalLabel: 'Ingresos adicionales' },
  sections: [
    {
      type: 'quincena',
      label: 'Gastos quincenas',
      items: [
        { id: uid(), name: 'Dentista',   amount: 15000,  paid: false, isRecurring: false },
        { id: uid(), name: 'Comida',     amount: 100000, paid: false, isRecurring: true  },
        { id: uid(), name: 'Lavadora',   amount: 77000,  paid: false, isRecurring: false, dueDay: 15 },
        { id: uid(), name: 'Celular',    amount: 20000,  paid: false, isRecurring: true,  dueDay: 15 },
        { id: uid(), name: 'Abono agua', amount: 20000,  paid: false, isRecurring: true  },
        { id: uid(), name: 'Pases',      amount: 30000,  paid: false, isRecurring: true  },
      ],
    },
    {
      type: 'fin_de_mes',
      label: 'Gastos fin de mes',
      items: [
        { id: uid(), name: 'Internet', amount: 22000, paid: false, isRecurring: true, dueDay: 28 },
        { id: uid(), name: 'Luz',      amount: 20000, paid: false, isRecurring: true, dueDay: 28 },
        { id: uid(), name: 'Agua',     amount: 8000,  paid: false, isRecurring: true, dueDay: 28 },
        { id: uid(), name: 'Mesa',     amount: 22000, paid: false, isRecurring: true, dueDay: 30 },
        { id: uid(), name: 'Pases',    amount: 30000, paid: false, isRecurring: true  },
      ],
    },
  ],
}

function makeEmptyMonth(monthId: string, fromMonth?: MonthData, settings?: AppSettings): MonthData {
  const [year, month] = monthId.split('-').map(Number)
  const salary = settings?.defaultSalary ?? 600000

  if (fromMonth) {
    return {
      id: monthId,
      year,
      month,
      income: { salary, additional: 0, additionalLabel: 'Ingresos adicionales' },
      sections: [
        {
          type: 'quincena',
          label: 'Gastos quincenas',
          items: fromMonth.sections[0].items
            .filter((i) => i.isRecurring)
            .map((i) => ({ ...i, id: uid(), paid: false })),
        },
        {
          type: 'fin_de_mes',
          label: 'Gastos fin de mes',
          items: fromMonth.sections[1].items
            .filter((i) => i.isRecurring)
            .map((i) => ({ ...i, id: uid(), paid: false })),
        },
      ],
    }
  }

  return {
    id: monthId,
    year,
    month,
    income: { salary, additional: 0, additionalLabel: 'Ingresos adicionales' },
    sections: [
      { type: 'quincena',   label: 'Gastos quincenas',   items: [] },
      { type: 'fin_de_mes', label: 'Gastos fin de mes',  items: [] },
    ],
  }
}

function getPrevMonthId(monthId: string): string {
  const [year, month] = monthId.split('-').map(Number)
  const prev = addMonths(new Date(year, month - 1), -1)
  return format(prev, 'yyyy-MM')
}

interface FinanceState {
  months: Record<string, MonthData>
  settings: AppSettings
  activeMonthId: string
  activeTab: TabId
}

interface FinanceActions {
  setActiveMonth(monthId: string): void
  setActiveTab(tab: TabId): void
  ensureMonthExists(monthId: string): void
  updateSalary(monthId: string, salary: number): void
  updateAdditional(monthId: string, amount: number, label?: string): void
  addExpense(monthId: string, section: SectionType, item: Omit<ExpenseItem, 'id'>): void
  updateExpense(monthId: string, section: SectionType, id: string, patch: Partial<ExpenseItem>): void
  deleteExpense(monthId: string, section: SectionType, id: string): void
  togglePaid(monthId: string, section: SectionType, id: string): void
  updateSettings(patch: Partial<AppSettings>): void
}

export const useFinanceStore = create<FinanceState & FinanceActions>()(
  persist(
    (set, get) => ({
      months: { '2026-05': MAY_2026 },
      settings: DEFAULT_SETTINGS,
      activeMonthId: '2026-05',
      activeTab: 'month',

      setActiveTab: (tab) => set({ activeTab: tab }),

      setActiveMonth: (monthId) => {
        get().ensureMonthExists(monthId)
        set({ activeMonthId: monthId })
      },

      ensureMonthExists: (monthId) => {
        const { months, settings } = get()
        if (months[monthId]) return
        const prevId = getPrevMonthId(monthId)
        const prev = months[prevId]
        set((s) => ({
          months: { ...s.months, [monthId]: makeEmptyMonth(monthId, prev, settings) },
        }))
      },

      updateSalary: (monthId, salary) =>
        set((s) => ({
          months: {
            ...s.months,
            [monthId]: {
              ...s.months[monthId],
              income: { ...s.months[monthId].income, salary },
            },
          },
        })),

      updateAdditional: (monthId, amount, label) =>
        set((s) => ({
          months: {
            ...s.months,
            [monthId]: {
              ...s.months[monthId],
              income: {
                ...s.months[monthId].income,
                additional: amount,
                additionalLabel: label ?? s.months[monthId].income.additionalLabel,
              },
            },
          },
        })),

      addExpense: (monthId, section, item) =>
        set((s) => {
          const month = s.months[monthId]
          const idx = section === 'quincena' ? 0 : 1
          const sections = [...month.sections] as MonthData['sections']
          sections[idx] = {
            ...sections[idx],
            items: [...sections[idx].items, { ...item, id: uid() }],
          }
          return { months: { ...s.months, [monthId]: { ...month, sections } } }
        }),

      updateExpense: (monthId, section, id, patch) =>
        set((s) => {
          const month = s.months[monthId]
          const idx = section === 'quincena' ? 0 : 1
          const sections = [...month.sections] as MonthData['sections']
          sections[idx] = {
            ...sections[idx],
            items: sections[idx].items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
          }
          return { months: { ...s.months, [monthId]: { ...month, sections } } }
        }),

      deleteExpense: (monthId, section, id) =>
        set((s) => {
          const month = s.months[monthId]
          const idx = section === 'quincena' ? 0 : 1
          const sections = [...month.sections] as MonthData['sections']
          sections[idx] = {
            ...sections[idx],
            items: sections[idx].items.filter((i) => i.id !== id),
          }
          return { months: { ...s.months, [monthId]: { ...month, sections } } }
        }),

      togglePaid: (monthId, section, id) => {
        const { months } = get()
        const month = months[monthId]
        const idx = section === 'quincena' ? 0 : 1
        const item = month.sections[idx].items.find((i) => i.id === id)
        if (!item) return
        get().updateExpense(monthId, section, id, { paid: !item.paid })
      },

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'finance-app-state',
      version: 1,
    }
  )
)

export function sumSection(items: ExpenseItem[]): number {
  return items.reduce((s, i) => s + i.amount, 0)
}

export function getMonthSummary(month: MonthData) {
  const totalIncome = month.income.salary + month.income.additional
  const allItems = month.sections.flatMap((s) => s.items)
  const totalExpenses = allItems.reduce((s, i) => s + i.amount, 0)
  const paidExpenses = allItems.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0)
  const pendingExpenses = totalExpenses - paidExpenses
  return { totalIncome, totalExpenses, savings: totalIncome - totalExpenses, paidExpenses, pendingExpenses }
}
