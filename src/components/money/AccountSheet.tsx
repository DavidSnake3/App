import { useState } from 'react'
import { CreditCard, Info, Trash2 } from 'lucide-react'
import type { Account, AccountType } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { ACCOUNT_TYPES } from '../../lib/accounts'
import { todayISO } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'
import { IconPicker } from '../ui/IconPicker'
import { Toggle } from '../ui/Toggle'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ItemIcon } from '../../lib/icons'

interface Props {
  open: boolean
  onClose: () => void
  /** cuenta que se está editando (null = nueva) */
  editing?: Account | null
  /** tipo sugerido al abrir */
  defaultType?: AccountType
  /** saldo actual calculado (para ajustar sin romper el histórico) */
  currentBalance?: number
}

/** Crear o editar una cuenta: efectivo, banco, ahorros, inversión o tarjeta */
export function AccountSheet({ open, onClose, editing, defaultType = 'efectivo', currentBalance = 0 }: Props) {
  const esCredito = (editing?.type ?? defaultType) === 'credito'
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar cuenta' : esCredito ? 'Nueva tarjeta' : 'Nueva cuenta'}
      subtitle={esCredito
        ? 'Lo que gastes con la tarjeta se vuelve deuda con su fecha de pago'
        : 'De estas cuentas sale tu efectivo real'}
    >
      {open && (
        <AccountForm
          key={editing?.id ?? `nueva-${defaultType}`}
          editing={editing}
          defaultType={defaultType}
          currentBalance={currentBalance}
          onDone={onClose}
        />
      )}
    </BottomSheet>
  )
}

function AccountForm({ editing, defaultType, currentBalance, onDone }: {
  editing?: Account | null
  defaultType: AccountType
  currentBalance: number
  onDone: () => void
}) {
  const addAccount = useFinanceStore((s) => s.addAccount)
  const updateAccount = useFinanceStore((s) => s.updateAccount)
  const deleteAccount = useFinanceStore((s) => s.deleteAccount)
  const setAccountBalance = useFinanceStore((s) => s.setAccountBalance)

  const [type, setType] = useState<AccountType>(editing?.type ?? defaultType)
  const [name, setName] = useState(editing?.name ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? '')
  const [balance, setBalance] = useState(editing ? (editing.type === 'credito' ? 0 : currentBalance) : 0)
  const [includeInTotal, setIncludeInTotal] = useState(editing?.includeInTotal ?? true)
  const [isMain, setIsMain] = useState(Boolean(editing?.isMain))
  // tarjeta de crédito
  const [limit, setLimit] = useState(editing?.credit?.limit ?? 0)
  const [cutoffDay, setCutoffDay] = useState(editing?.credit?.cutoffDay ?? 20)
  const [dueDay, setDueDay] = useState(editing?.credit?.dueDay ?? 5)
  const [rate, setRate] = useState(editing?.credit?.rate ?? 0)
  const [ratePeriod, setRatePeriod] = useState<'annual' | 'monthly'>(editing?.credit?.ratePeriod ?? 'annual')
  const [openingDebt, setOpeningDebt] = useState(editing?.credit?.openingDebt ?? 0)
  const [confirmDel, setConfirmDel] = useState(false)

  const esCredito = type === 'credito'
  const puedeGuardar = name.trim().length > 0

  const guardar = () => {
    if (!puedeGuardar) return
    const credit = esCredito
      ? { limit, cutoffDay, dueDay, rate, ratePeriod, openingDebt }
      : undefined
    if (editing) {
      updateAccount(editing.id, {
        name: name.trim(),
        type,
        icon: icon || undefined,
        includeInTotal: esCredito ? false : includeInTotal,
        isMain: esCredito ? false : isMain,
        credit,
      })
      if (!esCredito && balance !== currentBalance) {
        setAccountBalance(editing.id, balance, currentBalance)
      }
    } else {
      addAccount({
        name: name.trim(),
        type,
        icon: icon || undefined,
        openingBalance: esCredito ? 0 : balance,
        openingISO: todayISO().slice(0, 10),
        includeInTotal: esCredito ? false : includeInTotal,
        isMain: esCredito ? false : isMain,
        credit,
      })
    }
    onDone()
  }

  return (
    <>
      <div className="flex flex-col gap-4 pb-2">
        {/* Tipo de cuenta */}
        <div>
          <label className="text-[12px] font-semibold text-muted">Tipo de cuenta</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {ACCOUNT_TYPES.map((t) => {
              const activo = t.type === type
              return (
                <button
                  key={t.type}
                  onClick={() => setType(t.type)}
                  className="pressable rounded-2xl border px-3 py-2.5 text-left transition-all duration-200"
                  style={activo
                    ? {
                        borderColor: 'var(--app-accent)',
                        background: 'color-mix(in oklab, var(--app-accent) 12%, var(--c-elevated))',
                      }
                    : { borderColor: 'var(--c-border)', background: 'var(--c-elevated)' }}
                >
                  <span className="flex items-center gap-2">
                    <span style={{ color: activo ? 'var(--app-accent-soft)' : 'var(--c-muted)' }}>
                      <ItemIcon icon={t.icon} size={15} />
                    </span>
                    <span className="text-[12.5px] font-semibold text-ink">{t.label}</span>
                  </span>
                  <span className="block text-[10.5px] text-muted mt-0.5 leading-snug">{t.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-[12px] font-semibold text-muted">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={esCredito ? 'Visa BAC, Mastercard…' : 'Efectivo, BN cuenta, Nu…'}
            className="input-base mt-1.5"
          />
        </div>

        <IconPicker value={icon} onChange={setIcon} name={name} kind={esCredito ? 'deuda' : 'gasto'} />

        {!esCredito ? (
          <>
            <div>
              <label className="text-[12px] font-semibold text-muted">
                {editing ? '¿Cuánto tienes hoy en esta cuenta?' : '¿Cuánto tienes ahora?'}
              </label>
              <CurrencyInput value={balance} onChange={setBalance} className="mt-1.5" />
              {editing && (
                <p className="text-[11px] text-muted mt-1">
                  Saldo calculado ahora: <span className="num">{formatMoney(currentBalance)}</span>.
                  Si escribes otro monto, se ajusta la cuenta sin borrar tus movimientos.
                </p>
              )}
            </div>

            <Toggle
              checked={includeInTotal}
              onChange={setIncludeInTotal}
              label="Sumar al efectivo real"
              hint="Apágalo si es plata que no quieres contar como disponible"
            />
            <Toggle
              checked={isMain}
              onChange={setIsMain}
              label="Cuenta principal"
              hint="Aquí cae tu salario y de aquí salen los pagos del mes"
            />
          </>
        ) : (
          <>
            <div
              className="rounded-xl px-3.5 py-2.5 flex items-start gap-2.5"
              style={{ background: 'color-mix(in oklab, var(--app-accent) 10%, transparent)' }}
            >
              <Info size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--app-accent-soft)' }} />
              <p className="text-[11.5px] text-ink leading-snug">
                Con la fecha de <b>corte</b> sabemos qué entra en el estado de cuenta y con la
                fecha de <b>pago</b> hasta cuándo tienes para pagarlo sin intereses.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-semibold text-muted">Día de corte</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cutoffDay}
                  onChange={(e) => setCutoffDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  className="input-base mt-1.5 num text-center"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-muted">Día de pago</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  className="input-base mt-1.5 num text-center"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-muted">Interés que te cobran</label>
              <div className="flex gap-2 mt-1.5">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={rate || ''}
                    onChange={(e) => setRate(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                    className="input-base num text-right pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-[13px]">%</span>
                </div>
                <div className="flex rounded-2xl bg-elevated border border-edge p-1 gap-1">
                  {(['annual', 'monthly'] as const).map((rp) => (
                    <button
                      key={rp}
                      onClick={() => setRatePeriod(rp)}
                      className={`pressable rounded-xl px-3 text-[12px] font-semibold ${
                        ratePeriod === rp ? 'bg-card text-ink border border-edge' : 'text-muted'
                      }`}
                    >
                      {rp === 'annual' ? 'anual' : 'mensual'}
                    </button>
                  ))}
                </div>
              </div>
              {rate > 0 && (
                <p className="text-[11px] text-muted mt-1">
                  Eso es <span className="num">{(ratePeriod === 'annual' ? rate / 12 : rate).toFixed(2)}%</span> por mes
                  sobre lo que quede sin pagar.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-semibold text-muted">Límite</label>
                <CurrencyInput value={limit} onChange={setLimit} className="mt-1.5" />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-muted">Deuda actual</label>
                <CurrencyInput value={openingDebt} onChange={setOpeningDebt} className="mt-1.5" />
              </div>
            </div>
            <p className="text-[11px] text-muted -mt-2">
              La deuda actual es lo que ya debes hoy en esa tarjeta. Los gastos que registres
              después se van sumando solos.
            </p>
          </>
        )}

        <button
          onClick={guardar}
          disabled={!puedeGuardar}
          className="pressable btn-primary w-full disabled:opacity-50"
        >
          {editing ? 'Guardar cambios' : esCredito ? 'Agregar tarjeta' : 'Agregar cuenta'}
        </button>

        {editing && (
          <button
            onClick={() => setConfirmDel(true)}
            className="pressable w-full rounded-2xl py-2.5 text-[13px] font-semibold flex items-center justify-center gap-2"
            style={{ background: 'color-mix(in oklab, var(--c-danger) 12%, transparent)', color: 'var(--c-danger)' }}
          >
            <Trash2 size={14} /> Eliminar cuenta
          </button>
        )}

        {esCredito && !editing && (
          <p className="text-[11px] text-muted text-center flex items-center justify-center gap-1.5">
            <CreditCard size={12} /> Las tarjetas no suman al efectivo: suman a tus deudas.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title={`¿Eliminar ${editing?.name ?? 'la cuenta'}?`}
        message="Los movimientos que tenía pasan a tu cuenta principal para no perder el historial."
        confirmLabel="Eliminar"
        danger
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          setConfirmDel(false)
          if (editing) deleteAccount(editing.id)
          onDone()
        }}
      />
    </>
  )
}
