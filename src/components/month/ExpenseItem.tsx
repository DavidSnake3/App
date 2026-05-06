import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import type { ExpenseItem as IExpenseItem, SectionType } from '../../types/finance'

interface Props {
  item: IExpenseItem
  monthId: string
  section: SectionType
}

const fmt = new Intl.NumberFormat('es-CR')

export function ExpenseItem({ item, monthId, section }: Props) {
  const togglePaid = useFinanceStore((s) => s.togglePaid)
  const deleteExpense = useFinanceStore((s) => s.deleteExpense)
  const updateExpense = useFinanceStore((s) => s.updateExpense)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(item.name)
  const [showDelete, setShowDelete] = useState(false)

  function commitName() {
    setEditingName(false)
    if (nameVal.trim()) updateExpense(monthId, section, item.id, { name: nameVal.trim() })
    else setNameVal(item.name)
  }

  return (
    <div
      className={`flex items-center gap-3 py-2.5 px-1 rounded-xl transition-colors ${
        item.paid ? 'opacity-50' : ''
      }`}
      onTouchStart={() => {
        const t = setTimeout(() => setShowDelete(true), 500)
        const cancel = () => clearTimeout(t)
        document.addEventListener('touchend', cancel, { once: true })
        document.addEventListener('touchmove', cancel, { once: true })
      }}
    >
      <button
        onClick={() => togglePaid(monthId, section, item.id)}
        className={`w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${
          item.paid
            ? 'bg-income border-income'
            : 'border-surface-border bg-transparent'
        }`}
      >
        {item.paid && (
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path d="M1 5L4.5 8.5L11 1" stroke="#0f0e1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        {editingName ? (
          <input
            autoFocus
            type="text"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && commitName()}
            className="w-full bg-transparent text-sm text-white outline-none border-b border-brand-500"
          />
        ) : (
          <span
            className={`text-sm truncate block ${item.paid ? 'line-through text-gray-500' : 'text-white'}`}
            onDoubleClick={() => setEditingName(true)}
          >
            {item.name}
          </span>
        )}
      </div>

      <span className="font-mono text-sm text-gray-300 flex-shrink-0">
        ₡{fmt.format(item.amount)}
      </span>

      {showDelete ? (
        <button
          onClick={() => {
            deleteExpense(monthId, section, item.id)
            setShowDelete(false)
          }}
          onBlur={() => setShowDelete(false)}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-expense/20 text-expense active:scale-90 transition-transform"
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  )
}
