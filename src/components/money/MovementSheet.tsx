import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Banknote, Check, CreditCard, Repeat, Trash2 } from 'lucide-react'
import type { Movement, MovementKind } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { categoryList, guessCategory } from '../../lib/categories'
import { accountById, activeAccounts, isCredit } from '../../lib/accounts'
import { todayISO } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface Props {
  open: boolean
  onClose: () => void
  editing?: Movement | null
  /** tipo con el que abre */
  defaultKind?: MovementKind
  /** cuenta de origen preseleccionada (ej. la tarjeta al retirar efectivo) */
  defaultAccountId?: string
  /** cuenta de destino preseleccionada (ej. la tarjeta que se va a pagar) */
  defaultToAccountId?: string
  defaultAmount?: number
  defaultName?: string
}

const KINDS: { id: MovementKind; label: string; icon: React.ReactNode }[] = [
  { id: 'gasto', label: 'Gasto', icon: <ArrowUpRight size={14} /> },
  { id: 'ingreso', label: 'Ingreso', icon: <ArrowDownLeft size={14} /> },
  { id: 'transferencia', label: 'Traslado', icon: <Repeat size={14} /> },
]

/** Registrar un movimiento: monto, categoría con ícono, cuenta y fecha */
export function MovementSheet(props: Props) {
  const { open, onClose, editing } = props
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar movimiento' : props.defaultKind === 'transferencia' ? 'Mover plata entre cuentas' : 'Nuevo movimiento'}
      subtitle={props.defaultKind === 'transferencia'
        ? 'Pagar la tarjeta, pasar a ahorros o retirar efectivo'
        : 'Anota lo que entra y lo que sale, con su categoría y su cuenta'}
    >
      {open && (
        <MovementForm
          key={editing?.id ?? `nuevo-${props.defaultKind ?? 'gasto'}-${props.defaultToAccountId ?? ''}-${props.defaultAccountId ?? ''}`}
          {...props}
          onDone={onClose}
        />
      )}
    </BottomSheet>
  )
}

function MovementForm({
  editing, defaultKind = 'gasto', defaultAccountId, defaultToAccountId,
  defaultAmount, defaultName, onDone,
}: Props & { onDone: () => void }) {
  const accounts = useFinanceStore((s) => s.accounts)
  const cats = useFinanceStore((s) => s.settings.categories)
  const budgets = useFinanceStore((s) => s.budgets)
  const addMovement = useFinanceStore((s) => s.addMovement)
  const updateMovement = useFinanceStore((s) => s.updateMovement)
  const deleteMovement = useFinanceStore((s) => s.deleteMovement)

  const activas = useMemo(() => activeAccounts(accounts), [accounts])
  const principal = activas.find((a) => a.isMain) ?? activas.find((a) => !isCredit(a))

  const [kind, setKind] = useState<MovementKind>(editing?.kind ?? defaultKind)
  const [name, setName] = useState(editing?.name ?? defaultName ?? '')
  const [amount, setAmount] = useState(editing?.amount ?? defaultAmount ?? 0)
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ?? (defaultKind === 'transferencia' ? 'transferencia' : 'otros'),
  )
  const [accountId, setAccountId] = useState(
    editing?.accountId ?? defaultAccountId ?? principal?.id ?? activas[0]?.id ?? '',
  )
  const [toAccountId, setToAccountId] = useState(editing?.toAccountId ?? defaultToAccountId ?? '')
  const [dateISO, setDateISO] = useState(editing?.dateISO ?? todayISO().slice(0, 10))
  const [budgetId, setBudgetId] = useState(editing?.budgetId ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [catManual, setCatManual] = useState(Boolean(editing))
  const [confirmDel, setConfirmDel] = useState(false)

  const esTransfer = kind === 'transferencia'
  const lista = categoryList(cats, esTransfer ? undefined : (kind as 'gasto' | 'ingreso'))
  const cuentaOrigen = accountById(accounts, accountId)
  const cuentaDestino = accountById(accounts, toAccountId)
  const origenEsTarjeta = Boolean(cuentaOrigen && isCredit(cuentaOrigen))
  const destinoEsTarjeta = Boolean(cuentaDestino && isCredit(cuentaDestino))
  const pagaTarjeta = esTransfer && destinoEsTarjeta
  const adelantoEfectivo = esTransfer && origenEsTarjeta && Boolean(cuentaDestino) && !destinoEsTarjeta
  const conTarjeta = !esTransfer && origenEsTarjeta

  const puedeGuardar = amount > 0 && Boolean(accountId)
    && (!esTransfer || (Boolean(toAccountId) && toAccountId !== accountId))

  const nombreCambio = (v: string) => {
    setName(v)
    if (!catManual && !esTransfer && v.trim().length > 2) {
      setCategoryId(guessCategory(v, kind === 'ingreso' ? 'ingreso' : 'gasto'))
    }
  }

  const guardar = () => {
    if (!puedeGuardar) return
    const nombrePorDefecto = esTransfer
      ? (pagaTarjeta ? 'Pago de tarjeta' : adelantoEfectivo ? 'Retiro de efectivo' : 'Traslado entre cuentas')
      : kind === 'ingreso' ? 'Ingreso' : 'Gasto'
    const datos = {
      name: name.trim() || nombrePorDefecto,
      amount,
      kind,
      categoryId: esTransfer ? (pagaTarjeta ? 'pago-tarjeta' : categoryId || 'transferencia') : categoryId,
      accountId,
      toAccountId: esTransfer ? toAccountId : undefined,
      dateISO,
      budgetId: budgetId || undefined,
      note: note.trim() || undefined,
    }
    if (editing) updateMovement(editing.id, datos)
    else addMovement(datos)
    onDone()
  }

  return (
    <>
      <div className="flex flex-col gap-4 pb-2">
        {/* Tipo */}
        <div className="flex rounded-2xl bg-elevated border border-edge p-1 gap-1">
          {KINDS.map((k) => {
            const activo = k.id === kind
            return (
              <button
                key={k.id}
                onClick={() => {
                  setKind(k.id)
                  if (k.id === 'transferencia') setCategoryId('transferencia')
                  else if (!catManual) setCategoryId(guessCategory(name, k.id === 'ingreso' ? 'ingreso' : 'gasto'))
                }}
                className={`pressable flex-1 min-h-10 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  activo ? 'bg-card text-ink border border-edge' : 'text-muted'
                }`}
              >
                {k.icon} {k.label}
              </button>
            )
          })}
        </div>

        {/* Monto */}
        <div>
          <label className="text-[12px] font-semibold text-muted">¿De cuánto?</label>
          <CurrencyInput value={amount} onChange={setAmount} className="mt-1.5" autoFocus />
        </div>

        <div>
          <label className="text-[12px] font-semibold text-muted">
            {esTransfer ? 'Concepto' : '¿En qué / de dónde?'}
          </label>
          <input
            value={name}
            onChange={(e) => nombreCambio(e.target.value)}
            placeholder={esTransfer
              ? 'Pago de la Visa, retiro de efectivo…'
              : kind === 'ingreso' ? 'Venta, bono, propina…' : 'Café, súper, gasolina…'}
            className="input-base mt-1.5"
          />
        </div>

        {/* Categoría con ícono */}
        {!esTransfer && (
          <div>
            <label className="text-[12px] font-semibold text-muted">Categoría</label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {lista.map((c) => {
                const activo = c.id === categoryId
                return (
                  <button
                    key={c.id}
                    onClick={() => { setCategoryId(c.id); setCatManual(true) }}
                    className="pressable rounded-2xl border px-1 py-2 flex flex-col items-center gap-1 transition-all duration-200"
                    style={activo
                      ? {
                          borderColor: 'var(--app-accent)',
                          background: 'color-mix(in oklab, var(--app-accent) 14%, var(--c-elevated))',
                        }
                      : { borderColor: 'var(--c-border)', background: 'var(--c-elevated)' }}
                  >
                    <span style={{ color: activo ? 'var(--app-accent-soft)' : 'var(--c-muted)' }}>
                      <ItemIcon icon={c.icon} size={17} />
                    </span>
                    <span
                      className="text-[9.5px] leading-tight text-center"
                      style={{ color: activo ? 'var(--c-text)' : 'var(--c-muted)' }}
                    >
                      {c.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Cuentas */}
        <div>
          <label className="text-[12px] font-semibold text-muted">
            {esTransfer ? 'Sale de' : kind === 'ingreso' ? 'Entra a' : 'Pagué con'}
          </label>
          <AccountRow
            accounts={activas.filter((a) => (kind === 'ingreso' ? !isCredit(a) : true))}
            value={accountId}
            onChange={setAccountId}
          />
        </div>

        {esTransfer && (
          <div>
            <label className="text-[12px] font-semibold text-muted">Entra a</label>
            <AccountRow
              accounts={activas.filter((a) => a.id !== accountId)}
              value={toAccountId}
              onChange={setToAccountId}
            />
          </div>
        )}

        {conTarjeta && (
          <Aviso tone="warning" icon={<CreditCard size={14} />}>
            Esto <b>no baja tu efectivo</b>: se suma a la deuda de {cuentaOrigen?.name} y se paga
            en su fecha de pago.
          </Aviso>
        )}
        {pagaTarjeta && (
          <Aviso tone="income" icon={<Check size={14} />}>
            Estás abonando {formatMoney(amount)} a {cuentaDestino?.name}: baja tu efectivo y baja la deuda.
          </Aviso>
        )}
        {adelantoEfectivo && (
          <Aviso tone="warning" icon={<Banknote size={14} />}>
            Retiro de efectivo con tarjeta: <b>sube la deuda</b> de {cuentaOrigen?.name} y
            entra a {cuentaDestino?.name}. Ojo: casi siempre cobran intereses desde el primer día.
          </Aviso>
        )}
        {esTransfer && !pagaTarjeta && !adelantoEfectivo && cuentaDestino && (
          <Aviso tone="accent" icon={<Repeat size={14} />}>
            Pasas {formatMoney(amount)} de {cuentaOrigen?.name} a {cuentaDestino.name}.
            Tu efectivo total no cambia, solo cambia de cuenta.
          </Aviso>
        )}

        {/* Fecha */}
        <div>
          <label className="text-[12px] font-semibold text-muted">¿Cuándo fue?</label>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value || todayISO().slice(0, 10))}
            className="input-base mt-1.5 num"
          />
        </div>

        {/* Presupuesto */}
        {!esTransfer && kind === 'gasto' && budgets.length > 0 && (
          <div>
            <label className="text-[12px] font-semibold text-muted">¿Va a un presupuesto?</label>
            <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setBudgetId('')}
                className={`chip shrink-0 ${budgetId === '' ? 'chip-active' : ''}`}
              >
                Ninguno
              </button>
              {budgets.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBudgetId(b.id)}
                  className={`chip shrink-0 ${budgetId === b.id ? 'chip-active' : ''}`}
                >
                  <ItemIcon icon={b.icon} name={b.name} size={12} /> {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-[12px] font-semibold text-muted">Nota (opcional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Detalle, lugar, comprobante…"
            className="input-base mt-1.5"
          />
        </div>

        <button
          onClick={guardar}
          disabled={!puedeGuardar}
          className="pressable btn-primary w-full disabled:opacity-50"
        >
          {editing ? 'Guardar cambios' : esTransfer ? 'Registrar el traslado' : 'Registrar movimiento'}
        </button>

        {editing && (
          <button
            onClick={() => setConfirmDel(true)}
            className="pressable w-full rounded-2xl py-2.5 text-[13px] font-semibold flex items-center justify-center gap-2"
            style={{ background: 'color-mix(in oklab, var(--c-danger) 12%, transparent)', color: 'var(--c-danger)' }}
          >
            <Trash2 size={14} /> Eliminar movimiento
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="¿Eliminar este movimiento?"
        message="Se quita de tus cuentas y de los reportes."
        confirmLabel="Eliminar"
        danger
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          setConfirmDel(false)
          if (editing) deleteMovement(editing.id)
          onDone()
        }}
      />
    </>
  )
}

/** Aviso corto de lo que va a pasar con la plata */
function Aviso({ tone, icon, children }: {
  tone: 'warning' | 'income' | 'accent'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const color = tone === 'warning'
    ? 'var(--c-warning)'
    : tone === 'income' ? 'var(--c-income)' : 'var(--app-accent)'
  return (
    <div
      className="rounded-xl px-3.5 py-2.5 flex items-start gap-2.5"
      style={{ background: `color-mix(in oklab, ${color} 12%, transparent)` }}
    >
      <span className="shrink-0 mt-0.5" style={{ color }}>{icon}</span>
      <p className="text-[11.5px] text-ink leading-snug">{children}</p>
    </div>
  )
}

/** Fila de cuentas seleccionables */
function AccountRow({ accounts, value, onChange }: {
  accounts: { id: string; name: string; icon?: string; type: string }[]
  value: string
  onChange: (id: string) => void
}) {
  if (!accounts.length) {
    return <p className="text-[12px] text-muted mt-1.5">Primero crea una cuenta en Dinero → Cuentas.</p>
  }
  return (
    <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
      {accounts.map((a) => {
        const activo = a.id === value
        return (
          <button
            key={a.id}
            onClick={() => onChange(a.id)}
            className="pressable shrink-0 rounded-2xl border px-3 py-2 flex items-center gap-2 transition-all duration-200"
            style={activo
              ? {
                  borderColor: 'var(--app-accent)',
                  background: 'color-mix(in oklab, var(--app-accent) 14%, var(--c-elevated))',
                }
              : { borderColor: 'var(--c-border)', background: 'var(--c-elevated)' }}
          >
            <span style={{ color: activo ? 'var(--app-accent-soft)' : 'var(--c-muted)' }}>
              <ItemIcon icon={a.icon} name={a.name} size={15} />
            </span>
            <span className="text-[12.5px] font-medium" style={{ color: activo ? 'var(--c-text)' : 'var(--c-muted)' }}>
              {a.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
