import { useState } from 'react'
import { Wallet, Plus } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { CurrencyInput } from '../ui/CurrencyInput'

interface Props {
  monthId: string
}

export function IncomeCard({ monthId }: Props) {
  const month = useFinanceStore((s) => s.months[monthId])
  const updateSalary = useFinanceStore((s) => s.updateSalary)
  const updateAdditional = useFinanceStore((s) => s.updateAdditional)
  const [showExtra, setShowExtra] = useState(month?.income.additional > 0)

  if (!month) return null
  const { salary, additional, additionalLabel } = month.income

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-br from-brand-900 to-surface-card border border-brand-600/40 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Wallet size={18} className="text-brand-400" />
        <span className="text-sm font-semibold text-brand-300">Ingresos</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 w-24 flex-shrink-0">Salario</span>
          <CurrencyInput
            value={salary}
            onChange={(v) => updateSalary(monthId, v)}
            className="flex-1"
          />
        </div>

        {showExtra ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={additionalLabel}
                onChange={(e) => updateAdditional(monthId, additional, e.target.value)}
                className="text-sm text-gray-400 w-24 flex-shrink-0 bg-transparent border-none outline-none truncate"
                placeholder="Extra"
              />
              <CurrencyInput
                value={additional}
                onChange={(v) => updateAdditional(monthId, v)}
                className="flex-1"
              />
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowExtra(true)}
            className="flex items-center gap-1 text-xs text-brand-400/70 hover:text-brand-400 transition-colors"
          >
            <Plus size={14} />
            Agregar ingreso extra
          </button>
        )}
      </div>
    </div>
  )
}
