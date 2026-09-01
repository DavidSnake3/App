// Crear una lista de compras: título, dónde se compra y con qué cuenta se pagará.
import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { activeAccounts, isCredit } from '../../lib/accounts'
import { accountColor } from '../../lib/itemColors'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { ColorPicker } from '../ui/ColorPicker'

interface Props {
  open: boolean
  monthId: string
  onClose: () => void
  onCreated: (expenseId: string) => void
}

export function NewShoppingListSheet({ open, monthId, onClose, onCreated }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Nueva lista de compras"
      subtitle="Armala antes de ir, y marcá en el súper"
    >
      {open && <Form key={monthId} monthId={monthId} onCreated={onCreated} />}
    </BottomSheet>
  )
}

function Form({ monthId, onCreated }: { monthId: string; onCreated: (id: string) => void }) {
  const accounts = useFinanceStore((s) => s.accounts)
  const createShoppingList = useFinanceStore((s) => s.createShoppingList)
  const cuentas = activeAccounts(accounts)

  const [name, setName] = useState('')
  const [store, setStore] = useState('')
  const [dueDay, setDueDay] = useState<number | ''>('')
  const [accountId, setAccountId] = useState('')
  const [color, setColor] = useState('')
  const [error, setError] = useState('')

  const cuentaElegida = cuentas.find((a) => a.id === accountId)

  const crear = () => {
    if (!name.trim()) { setError('Ponle un nombre a la lista.') ; return }
    const id = createShoppingList(monthId, {
      name: name.trim(),
      store: store.trim() || undefined,
      dueDay: dueDay === '' ? undefined : Math.max(1, Math.min(31, Number(dueDay))),
      accountId: accountId || undefined,
      color: color || undefined,
      icon: 'super',
    })
    onCreated(id)
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div>
        <label className="text-[12px] font-semibold text-muted">¿Cómo se llama?</label>
        <input
          className="input-base mt-1.5"
          placeholder="Ej. Diario de la quincena"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="text-[12px] font-semibold text-muted">¿Dónde vas a comprar? (opcional)</label>
        <input
          className="input-base mt-1.5"
          placeholder="Automercado, Palí, la pulpería…"
          value={store}
          onChange={(e) => setStore(e.target.value)}
        />
      </div>

      <div>
        <label className="text-[12px] font-semibold text-muted">¿Qué día la vas a hacer? (opcional)</label>
        <input
          type="number"
          min={1}
          max={31}
          inputMode="numeric"
          className="input-base num mt-1.5"
          placeholder="Día del mes"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </div>

      {cuentas.length > 0 && (
        <div>
          <label className="text-[12px] font-semibold text-muted">¿Con qué cuenta la vas a pagar?</label>
          <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setAccountId('')}
              className={`pressable chip shrink-0 ${accountId === '' ? 'chip-active' : ''}`}
            >
              La principal
            </button>
            {cuentas.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                className={`pressable chip shrink-0 ${accountId === a.id ? 'chip-active' : ''}`}
              >
                <span style={{ color: accountColor(a) }}>
                  <ItemIcon icon={a.icon} name={a.name} size={12} />
                </span> {a.name}
              </button>
            ))}
          </div>
          {cuentaElegida && isCredit(cuentaElegida) && (
            <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: 'var(--c-warning)' }}>
              Al finalizar la compra se suma a la deuda de {cuentaElegida.name}, no baja tu efectivo.
            </p>
          )}
        </div>
      )}

      <ColorPicker
        value={color}
        onChange={setColor}
        label="Color de la lista"
        fallback="var(--app-accent)"
      />

      {error && <p className="text-[13px] anim-shake" style={{ color: 'var(--c-danger)' }}>{error}</p>}

      <button
        onClick={crear}
        className="pressable btn-primary w-full flex items-center justify-center gap-2"
      >
        <ShoppingCart size={16} /> Crear la lista
      </button>

      <p className="text-[11px] text-muted text-center leading-snug">
        Aparece también en Pagos del mes. No mueve plata hasta que finalices la compra.
      </p>
    </div>
  )
}
