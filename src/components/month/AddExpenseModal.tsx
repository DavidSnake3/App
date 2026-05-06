import { useState } from 'react'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'
import { useFinanceStore } from '../../store/useFinanceStore'
import type { SectionType } from '../../types/finance'

interface Props {
  open: boolean
  onClose: () => void
  monthId: string
  section: SectionType
}

export function AddExpenseModal({ open, onClose, monthId, section }: Props) {
  const addExpense = useFinanceStore((s) => s.addExpense)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [dueDay, setDueDay] = useState<number | undefined>()
  const [recurring, setRecurring] = useState(true)

  function handleSubmit() {
    if (!name.trim() || amount <= 0) return
    addExpense(monthId, section, {
      name: name.trim(),
      amount,
      paid: false,
      dueDay,
      isRecurring: recurring,
    })
    setName('')
    setAmount(0)
    setDueDay(undefined)
    setRecurring(true)
    onClose()
  }

  const title = section === 'quincena' ? 'Agregar gasto quincenal' : 'Agregar gasto fin de mes'

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Descripción</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Ej: Electricidad"
            className="w-full px-4 py-3 rounded-xl bg-surface-border/40 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Monto</label>
          <CurrencyInput value={amount} onChange={setAmount} placeholder="0" />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Día de vencimiento (opcional)</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={dueDay ?? ''}
            onChange={(e) => {
              const v = parseInt(e.target.value)
              setDueDay(isNaN(v) ? undefined : Math.min(31, Math.max(1, v)))
            }}
            placeholder="1 – 31"
            className="w-full px-4 py-3 rounded-xl bg-surface-border/40 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setRecurring(!recurring)}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              recurring ? 'bg-brand-500' : 'bg-surface-border'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                recurring ? 'translate-x-5.5' : 'translate-x-0.5'
              }`}
            />
          </div>
          <span className="text-sm text-gray-300">Repetir cada mes</span>
        </label>

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || amount <= 0}
          className="w-full py-3.5 rounded-2xl bg-brand-500 text-white font-semibold text-sm disabled:opacity-40 active:scale-98 transition-all"
        >
          Agregar gasto
        </button>
      </div>
    </BottomSheet>
  )
}
