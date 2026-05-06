import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronRight } from 'lucide-react'
import { useFinanceStore, getMonthSummary } from '../../store/useFinanceStore'

interface Props {
  monthId: string
  onSelect: (monthId: string) => void
}

const fmt = new Intl.NumberFormat('es-CR')

export function MonthCard({ monthId, onSelect }: Props) {
  const month = useFinanceStore((s) => s.months[monthId])
  if (!month) return null

  const { totalIncome, totalExpenses, savings } = getMonthSummary(month)
  const positive = savings >= 0
  const label = format(new Date(month.year, month.month - 1), 'MMMM yyyy', { locale: es })
    .replace(/^\w/, (c) => c.toUpperCase())
  const pct = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0

  return (
    <button
      onClick={() => onSelect(monthId)}
      className="w-full mx-auto block rounded-2xl bg-surface-card border border-surface-border p-4 text-left active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white capitalize">{label}</span>
        <ChevronRight size={16} className="text-gray-600" />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-gray-500 mb-1">Ingresos</div>
          <div className="font-mono text-xs text-income">₡{fmt.format(totalIncome)}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-1">Gastos</div>
          <div className="font-mono text-xs text-expense">₡{fmt.format(totalExpenses)}</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-1">Ahorro</div>
          <div className={`font-mono text-xs font-bold ${positive ? 'text-income' : 'text-expense'}`}>
            {positive ? '+' : '-'}₡{fmt.format(Math.abs(savings))}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-gray-600 mb-1">
          <span>Gasto vs ingreso</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-surface-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct > 100 ? 'bg-expense' : 'bg-income'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    </button>
  )
}
