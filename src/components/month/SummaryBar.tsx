import { useFinanceStore, getMonthSummary } from '../../store/useFinanceStore'

interface Props {
  monthId: string
}

const fmt = new Intl.NumberFormat('es-CR')

export function SummaryBar({ monthId }: Props) {
  const month = useFinanceStore((s) => s.months[monthId])

  if (!month) return null

  const { totalIncome, totalExpenses, savings } = getMonthSummary(month)
  const positive = savings >= 0

  return (
    <div className="mx-4 mb-4 mt-4 rounded-2xl border border-surface-border overflow-hidden">
      <div
        className={`px-4 py-2 text-center text-xs font-medium ${
          positive ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
        }`}
      >
        {positive ? '✓ Ahorro positivo este mes' : '⚠ Gastos superan ingresos'}
      </div>
      <div className="grid grid-cols-3 bg-surface-card">
        <div className="flex flex-col items-center py-3 px-2 border-r border-surface-border">
          <span className="text-[10px] text-gray-500 mb-1">Ingresos</span>
          <span className="font-mono text-sm font-semibold text-income">₡{fmt.format(totalIncome)}</span>
        </div>
        <div className="flex flex-col items-center py-3 px-2 border-r border-surface-border">
          <span className="text-[10px] text-gray-500 mb-1">Gastos</span>
          <span className="font-mono text-sm font-semibold text-expense">₡{fmt.format(totalExpenses)}</span>
        </div>
        <div className="flex flex-col items-center py-3 px-2">
          <span className="text-[10px] text-gray-500 mb-1">Ahorro</span>
          <span className={`font-mono text-sm font-bold ${positive ? 'text-income' : 'text-expense'}`}>
            ₡{fmt.format(Math.abs(savings))}
          </span>
        </div>
      </div>
    </div>
  )
}
