// Crear o editar una lista de compras: título, dónde se compra, con qué cuenta
// se pagará y su color. Los productos se manejan dentro de la lista.
import { useState } from 'react'
import { Save, ShoppingCart, Target } from 'lucide-react'
import type { Expense } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { activeAccounts, isCredit } from '../../lib/accounts'
import { accountColor } from '../../lib/itemColors'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { ColorPicker } from '../ui/ColorPicker'
import { Toggle } from '../ui/Toggle'
import { periodLabel } from '../../lib/budgets'
import { formatMoney } from '../../lib/format'

interface Props {
  open: boolean
  monthId: string
  /** si viene, la hoja edita esa lista en vez de crear una nueva */
  editing?: Expense | null
  onClose: () => void
  onCreated: (expenseId: string) => void
}

export function NewShoppingListSheet({ open, monthId, editing, onClose, onCreated }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar lista' : 'Nueva lista de compras'}
      subtitle={editing ? 'Cambiá el nombre, la tienda o la cuenta' : 'Armala antes de ir, y marcá en el súper'}
    >
      {open && (
        <Form
          key={editing?.id ?? monthId}
          monthId={monthId}
          editing={editing ?? null}
          onCreated={onCreated}
          onClose={onClose}
        />
      )}
    </BottomSheet>
  )
}

function Form({ monthId, editing, onCreated, onClose }: {
  monthId: string
  editing: Expense | null
  onCreated: (id: string) => void
  onClose: () => void
}) {
  const accounts = useFinanceStore((s) => s.accounts)
  const budgets = useFinanceStore((s) => s.budgets)
  const createShoppingList = useFinanceStore((s) => s.createShoppingList)
  const updateExpense = useFinanceStore((s) => s.updateExpense)
  const cuentas = activeAccounts(accounts)

  const [name, setName] = useState(editing?.name ?? '')
  const [store, setStore] = useState(editing?.shopping?.store ?? '')
  const [dueDay, setDueDay] = useState<number | ''>(editing?.dueDay ?? '')
  const [accountId, setAccountId] = useState(editing?.accountId ?? '')
  const [color, setColor] = useState(editing?.color ?? '')
  const [mode, setMode] = useState<'plan' | 'live'>(editing?.shopping?.mode ?? 'plan')
  const [budgetId, setBudgetId] = useState(editing?.budgetId ?? '')
  const [countInBalance, setCountInBalance] = useState(editing?.countInBalance ?? true)
  const [error, setError] = useState('')

  const cuentaElegida = cuentas.find((a) => a.id === accountId)
  const presupuesto = budgets.find((b) => b.id === budgetId)
  // enlazada a un presupuesto, la lista hereda su decisión: no pueden decir
  // cosas distintas sobre la misma plata
  const cuentaEnBalance = presupuesto ? presupuesto.countInBalance !== false : countInBalance
  const cerrada = Boolean(editing?.shopping?.done)

  const guardar = () => {
    if (!name.trim()) { setError('Ponle un nombre a la lista.'); return }
    const day = dueDay === '' ? undefined : Math.max(1, Math.min(31, Number(dueDay)))

    if (editing) {
      updateExpense(monthId, editing.id, {
        name: name.trim(),
        dueDay: day,
        period: day && day <= 15 ? 'q1' : 'q2',
        accountId: accountId || undefined,
        color: color || undefined,
        budgetId: budgetId || undefined,
        countInBalance: cuentaEnBalance,
        shopping: editing.shopping
          ? { ...editing.shopping, store: store.trim() || undefined, mode }
          : editing.shopping,
      })
      onClose()
      return
    }

    const id = createShoppingList(monthId, {
      name: name.trim(),
      store: store.trim() || undefined,
      dueDay: day,
      accountId: accountId || undefined,
      color: color || undefined,
      icon: 'super',
      mode,
      budgetId: budgetId || undefined,
      countInBalance: cuentaEnBalance,
    })
    onCreated(id)
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* ¿Ya existe la lista o la vas armando en el súper? */}
      <div>
        <label className="text-[12px] font-semibold text-muted">¿Cómo la vas a usar?</label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <ModoBoton
            activo={mode === 'plan'}
            onClick={() => setMode('plan')}
            titulo="Ya la tengo"
            desc="La armo antes y voy marcando lo que echo al carrito"
          />
          <ModoBoton
            activo={mode === 'live'}
            onClick={() => setMode('live')}
            titulo="La armo comprando"
            desc="Escaneo cada producto en el súper. Sin marcas"
          />
        </div>
      </div>

      <div>
        <label className="text-[12px] font-semibold text-muted">¿Cómo se llama?</label>
        <input
          className="input-base mt-1.5"
          placeholder="Ej. Diario de la quincena"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!editing}
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
          <label className="text-[12px] font-semibold text-muted">
            {cerrada ? 'Cuenta con la que se pagó' : '¿Con qué cuenta la vas a pagar?'}
          </label>
          <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => !cerrada && setAccountId('')}
              disabled={cerrada}
              className={`pressable chip shrink-0 ${accountId === '' ? 'chip-active' : ''} disabled:opacity-60`}
            >
              La principal
            </button>
            {cuentas.map((a) => (
              <button
                key={a.id}
                onClick={() => !cerrada && setAccountId(a.id)}
                disabled={cerrada}
                className={`pressable chip shrink-0 ${accountId === a.id ? 'chip-active' : ''} disabled:opacity-60`}
              >
                <span style={{ color: accountColor(a) }}>
                  <ItemIcon icon={a.icon} name={a.name} size={12} />
                </span> {a.name}
              </button>
            ))}
          </div>
          {cerrada ? (
            <p className="text-[11px] text-muted mt-1.5 leading-snug">
              La compra ya se cerró y la plata ya salió: para cambiar la cuenta, reabrila primero.
            </p>
          ) : cuentaElegida && isCredit(cuentaElegida) ? (
            <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: 'var(--c-warning)' }}>
              Al finalizar la compra se suma a la deuda de {cuentaElegida.name}, no baja tu efectivo.
            </p>
          ) : null}
        </div>
      )}

      {/* Enlazarla a un presupuesto: así la compra descuenta de ese límite */}
      {budgets.length > 0 && (
        <div>
          <label className="text-[12px] font-semibold text-muted">
            ¿Sale de algún presupuesto? (opcional)
          </label>
          <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setBudgetId('')}
              className={`pressable chip shrink-0 ${budgetId === '' ? 'chip-active' : ''}`}
            >
              Ninguno
            </button>
            {budgets.map((b) => (
              <button
                key={b.id}
                onClick={() => setBudgetId(b.id)}
                className={`pressable chip shrink-0 ${budgetId === b.id ? 'chip-active' : ''}`}
              >
                <Target size={11} /> {b.name}
              </button>
            ))}
          </div>
          {presupuesto && (
            <p className="text-[11px] text-muted mt-1.5 leading-snug">
              Vas a ver cuánto llevás del límite de{' '}
              <span className="num font-semibold text-ink">{formatMoney(presupuesto.amount)}</span>
              {' '}{periodLabel(presupuesto)} mientras comprás.
            </p>
          )}
        </div>
      )}

      {/* ¿Se resta del balance del mes? */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-ink">Contar en el balance del mes</p>
          <p className="text-[11px] text-muted leading-snug">
            {presupuesto
              ? `Lo decide "${presupuesto.name}": ${cuentaEnBalance ? 'sí cuenta' : 'no cuenta'}.`
              : cuentaEnBalance
                ? 'La compra se resta del balance mensual.'
                : 'La plata sale de la cuenta igual, pero no baja el balance.'}
          </p>
        </div>
        <Toggle
          checked={cuentaEnBalance}
          onChange={presupuesto ? () => { /* lo manda el presupuesto */ } : setCountInBalance}
        />
      </div>

      <ColorPicker
        value={color}
        onChange={setColor}
        label="Color de la lista"
        fallback="var(--app-accent)"
      />

      {error && <p className="text-[13px] anim-shake" style={{ color: 'var(--c-danger)' }}>{error}</p>}

      <button
        onClick={guardar}
        className="pressable btn-primary w-full flex items-center justify-center gap-2"
      >
        {editing ? <><Save size={16} /> Guardar cambios</> : <><ShoppingCart size={16} /> Crear la lista</>}
      </button>

      {!editing && (
        <p className="text-[11px] text-muted text-center leading-snug">
          Aparece también en Pagos del mes. No mueve plata hasta que finalices la compra.
        </p>
      )}
    </div>
  )
}

/** Uno de los dos modos de lista, como tarjeta grande */
function ModoBoton({ activo, onClick, titulo, desc }: {
  activo: boolean
  onClick: () => void
  titulo: string
  desc: string
}) {
  return (
    <button
      onClick={onClick}
      className="pressable rounded-2xl p-3 text-left border transition-colors"
      style={activo
        ? {
            background: 'color-mix(in oklab, var(--app-accent) 14%, transparent)',
            borderColor: 'color-mix(in oklab, var(--app-accent) 55%, var(--c-border))',
          }
        : { background: 'var(--c-elevated)', borderColor: 'var(--c-border)' }}
    >
      <span
        className="block text-[13px] font-semibold"
        style={{ color: activo ? 'var(--app-accent-soft)' : 'var(--c-text)' }}
      >
        {titulo}
      </span>
      <span className="block text-[10.5px] text-muted leading-snug mt-0.5">{desc}</span>
    </button>
  )
}
