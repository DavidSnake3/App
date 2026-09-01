import { useMemo, useState } from 'react'
import { CalendarClock, Trash2 } from 'lucide-react'
import type { Installment } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { activeAccounts, isCredit } from '../../lib/accounts'
import { addMonthsToId, currentMonthId, monthLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'
import { IconPicker } from '../ui/IconPicker'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { MonthField } from '../ui/DatePicker'

interface Props {
  open: boolean
  onClose: () => void
  editing?: Installment | null
  defaultAccountId?: string
}

/** Compra a cuotas con tarjeta: nombre, mensualidad, cuántas cuotas y fechas */
export function InstallmentSheet({ open, onClose, editing, defaultAccountId }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar compra a cuotas' : 'Compra a cuotas'}
      subtitle="Cada cuota se suma a la deuda de la tarjeta en su mes"
    >
      {open && (
        <InstallmentForm
          key={editing?.id ?? `nueva-${defaultAccountId ?? ''}`}
          editing={editing}
          defaultAccountId={defaultAccountId}
          onDone={onClose}
        />
      )}
    </BottomSheet>
  )
}

function InstallmentForm({ editing, defaultAccountId, onDone }: {
  editing?: Installment | null
  defaultAccountId?: string
  onDone: () => void
}) {
  const accounts = useFinanceStore((s) => s.accounts)
  const addInstallment = useFinanceStore((s) => s.addInstallment)
  const updateInstallment = useFinanceStore((s) => s.updateInstallment)
  const deleteInstallment = useFinanceStore((s) => s.deleteInstallment)

  const tarjetas = useMemo(() => activeAccounts(accounts).filter(isCredit), [accounts])

  const tarjetaInicial = tarjetas.find((t) => t.id === defaultAccountId) ?? tarjetas[0]
  const [name, setName] = useState(editing?.name ?? '')
  const [accountId, setAccountId] = useState(editing?.accountId ?? tarjetaInicial?.id ?? '')
  const [total, setTotal] = useState(editing?.total ?? 0)
  const [monthly, setMonthly] = useState(editing?.monthly ?? 0)
  const [count, setCount] = useState(editing?.count ?? 6)
  const [dueDay, setDueDay] = useState(editing?.dueDay ?? tarjetaInicial?.credit?.dueDay ?? 5)
  const [startMonthId, setStartMonthId] = useState(editing?.startMonthId ?? currentMonthId())
  const [icon, setIcon] = useState(editing?.icon ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [confirmDel, setConfirmDel] = useState(false)
  const [tocoMensual, setTocoMensual] = useState(Boolean(editing))

  // si escribe el total y no ha tocado la mensualidad, se calcula sola
  const mensualSugerida = count > 0 && total > 0 ? Math.round(total / count) : 0
  const mensualFinal = tocoMensual && monthly > 0 ? monthly : (mensualSugerida || monthly)
  const puedeGuardar = name.trim().length > 0 && accountId && mensualFinal > 0 && count > 0

  const guardar = () => {
    if (!puedeGuardar) return
    const datos = {
      name: name.trim(),
      accountId,
      total: total || Math.round(mensualFinal * count),
      monthly: mensualFinal,
      count,
      dueDay,
      startMonthId,
      icon: icon || undefined,
      note: note.trim() || undefined,
    }
    if (editing) updateInstallment(editing.id, datos)
    else addInstallment(datos)
    onDone()
  }

  const finId = addMonthsToId(startMonthId, Math.max(0, count - 1))

  return (
    <>
      <div className="flex flex-col gap-4 pb-2">
        {!tarjetas.length ? (
          <p className="text-[13px] text-muted">
            Primero agrega una tarjeta de crédito en Dinero → Cuentas.
          </p>
        ) : (
          <>
            <div>
              <label className="text-[12px] font-semibold text-muted">¿Qué compraste?</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Refrigeradora, celular, llantas…"
                className="input-base mt-1.5"
              />
            </div>

            <IconPicker value={icon} onChange={setIcon} name={name} kind="gasto" />

            <div>
              <label className="text-[12px] font-semibold text-muted">Tarjeta</label>
              <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                {tarjetas.map((t) => {
                  const activo = t.id === accountId
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setAccountId(t.id); setDueDay(t.credit?.dueDay ?? dueDay) }}
                      className="pressable shrink-0 rounded-2xl border px-3 py-2 flex items-center gap-2"
                      style={activo
                        ? {
                            borderColor: 'var(--app-accent)',
                            background: 'color-mix(in oklab, var(--app-accent) 14%, var(--c-elevated))',
                          }
                        : { borderColor: 'var(--c-border)', background: 'var(--c-elevated)' }}
                    >
                      <span style={{ color: activo ? 'var(--app-accent-soft)' : 'var(--c-muted)' }}>
                        <ItemIcon icon={t.icon} name={t.name} size={15} />
                      </span>
                      <span className="text-[12.5px] font-medium" style={{ color: activo ? 'var(--c-text)' : 'var(--c-muted)' }}>
                        {t.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-semibold text-muted">Monto total</label>
                <CurrencyInput value={total} onChange={setTotal} className="mt-1.5" />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-muted">Cuántas cuotas</label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  value={count}
                  onChange={(e) => setCount(Math.min(72, Math.max(1, Number(e.target.value) || 1)))}
                  className="input-base mt-1.5 num text-center"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-muted">Mensualidad</label>
              <CurrencyInput
                value={tocoMensual ? monthly : mensualSugerida}
                onChange={(v) => { setMonthly(v); setTocoMensual(true) }}
                className="mt-1.5"
              />
              {!tocoMensual && mensualSugerida > 0 && (
                <p className="text-[11px] text-muted mt-1">
                  Calculada del total ÷ {count}. Si tu tarjeta cobra intereses, escribe la mensualidad real.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <MonthField
                  value={startMonthId}
                  onChange={setStartMonthId}
                  label="Primera cuota"
                  title="¿En qué mes empieza?"
                />
              </div>
            </div>

            {mensualFinal > 0 && (
              <div className="card p-3.5">
                <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
                  <CalendarClock size={12} /> Así queda
                </p>
                <p className="text-[13px] text-ink mt-1.5 leading-snug">
                  <span className="num font-bold">{count}</span> cuotas de{' '}
                  <span className="num font-bold">{formatMoney(mensualFinal)}</span>, el día{' '}
                  <span className="num">{dueDay}</span> de cada mes.
                </p>
                <p className="text-[11.5px] text-muted mt-1">
                  De {monthLabel(startMonthId)} a {monthLabel(finId)} · total{' '}
                  <span className="num">{formatMoney(mensualFinal * count)}</span>
                  {total > 0 && mensualFinal * count > total && (
                    <> · intereses ≈ <span className="num">{formatMoney(mensualFinal * count - total)}</span></>
                  )}
                </p>
              </div>
            )}

            <div>
              <label className="text-[12px] font-semibold text-muted">Nota (opcional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tienda, número de contrato…"
                className="input-base mt-1.5"
              />
            </div>

            <button
              onClick={guardar}
              disabled={!puedeGuardar}
              className="pressable btn-primary w-full disabled:opacity-50"
            >
              {editing ? 'Guardar cambios' : 'Agregar compra a cuotas'}
            </button>

            {editing && (
              <button
                onClick={() => setConfirmDel(true)}
                className="pressable w-full rounded-2xl py-2.5 text-[13px] font-semibold flex items-center justify-center gap-2"
                style={{ background: 'color-mix(in oklab, var(--c-danger) 12%, transparent)', color: 'var(--c-danger)' }}
              >
                <Trash2 size={14} /> Eliminar
              </button>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title={`¿Eliminar ${editing?.name ?? 'la compra'}?`}
        message="Se quitan sus cuotas de la deuda de la tarjeta."
        confirmLabel="Eliminar"
        danger
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          setConfirmDel(false)
          if (editing) deleteInstallment(editing.id)
          onDone()
        }}
      />
    </>
  )
}
