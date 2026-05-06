export type ExpenseId = string
export type SectionType = 'quincena' | 'fin_de_mes'
export type TabId = 'month' | 'history' | 'projection' | 'settings'

export interface ExpenseItem {
  id: ExpenseId
  name: string
  amount: number
  paid: boolean
  dueDay?: number
  isRecurring: boolean
}

export interface ExpenseSection {
  type: SectionType
  label: string
  items: ExpenseItem[]
}

export interface MonthlyIncome {
  salary: number
  additional: number
  additionalLabel: string
}

export interface MonthData {
  id: string
  year: number
  month: number
  income: MonthlyIncome
  sections: [ExpenseSection, ExpenseSection]
}

export interface MonthSummary {
  monthId: string
  totalIncome: number
  totalExpenses: number
  savings: number
  paidExpenses: number
  pendingExpenses: number
}

export interface AppSettings {
  defaultSalary: number
  notificationsEnabled: boolean
  notificationDays: number[]
  startYear: number
  startMonth: number
}

export interface ProjectedMonth {
  monthId: string
  month: number
  label: string
  income: number
  expenses: number
  savings: number
  isActual: boolean
}

export interface AnnualProjection {
  months: ProjectedMonth[]
  totalIncome: number
  totalExpenses: number
  totalSavings: number
}
