import { useState } from 'react'
import { Plus } from 'lucide-react'
import { ExpenseItem } from './ExpenseItem'
import { AddExpenseModal } from './AddExpenseModal'
import { useFinanceStore, sumSection } from '../../store/useFinanceStore'
import type { SectionType } from '../../types/finance'

interface Props {
  monthId: string
  section: SectionType
}

const fmt = new Intl.NumberFormat('es-CR')

export function ExpenseSection({ monthId, section }: Props) {
  const month = useFinanceStore((s) => s.months[monthId])
  const [addOpen, setAddOpen] = useState(false)

  if (!month) return null

  const sec = section === 'quincena' ? month.sections[0] : month.sections[1]
  const subtotal = sumSection(sec.items)
  const paidTotal = sumSection(sec.items.filter((i) => i.paid))

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-surface-card border border-surface-border overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-gray-300">{sec.label}</h3>
      </div>

      <div className="px-3 pb-2 space-y-0.5">
        {sec.items.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">Sin gastos registrados</p>
        ) : (
          sec.items.map((item) => (
            <ExpenseItem key={item.id} item={item} monthId={monthId} section={section} />
          ))
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-surface-border/30 border-t border-surface-border">
        <div className="text-xs text-gray-500">
          Pagado: <span className="text-income font-mono">₡{fmt.format(paidTotal)}</span>
        </div>
        <div className="text-sm font-semibold text-white">
          Subtotal: <span className="font-mono">₡{fmt.format(subtotal)}</span>
        </div>
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-brand-400 hover:bg-brand-900/20 transition-colors active:bg-brand-900/40"
      >
        <Plus size={16} />
        Agregar gasto
      </button>

      <AddExpenseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        monthId={monthId}
        section={section}
      />
    </div>
  )
}
