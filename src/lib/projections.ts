import { addMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { MonthData, AnnualProjection, ProjectedMonth, AppSettings } from '../types/finance'

function sumExpenses(month: MonthData): number {
  return month.sections.flatMap((s) => s.items).reduce((s, i) => s + i.amount, 0)
}

export function buildAnnualProjection(
  months: Record<string, MonthData>,
  settings: AppSettings
): AnnualProjection {
  const { startYear, startMonth, defaultSalary } = settings
  const result: ProjectedMonth[] = []

  const actuals = Object.values(months)
  const avgExpenses =
    actuals.length > 0
      ? actuals.reduce((s, m) => s + sumExpenses(m), 0) / actuals.length
      : 0

  for (let i = 0; i < 12; i++) {
    const date = addMonths(new Date(startYear, startMonth - 1), i)
    const monthId = format(date, 'yyyy-MM')
    const actual = months[monthId]
    const label = format(date, 'MMM yyyy', { locale: es })

    if (actual) {
      const income = actual.income.salary + actual.income.additional
      const expenses = sumExpenses(actual)
      result.push({
        monthId,
        month: date.getMonth() + 1,
        label,
        income,
        expenses,
        savings: income - expenses,
        isActual: true,
      })
    } else {
      result.push({
        monthId,
        month: date.getMonth() + 1,
        label,
        income: defaultSalary,
        expenses: avgExpenses,
        savings: defaultSalary - avgExpenses,
        isActual: false,
      })
    }
  }

  return {
    months: result,
    totalIncome: result.reduce((s, m) => s + m.income, 0),
    totalExpenses: result.reduce((s, m) => s + m.expenses, 0),
    totalSavings: result.reduce((s, m) => s + m.savings, 0),
  }
}

export function formatCRC(amount: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCRCShort(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `₡${(amount / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(amount) >= 1_000) {
    return `₡${Math.round(amount / 1_000)}K`
  }
  return `₡${amount}`
}
