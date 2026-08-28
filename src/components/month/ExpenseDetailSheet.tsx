import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { PayableItem } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { formatMoney } from '../../lib/format'
import { RECURRENCE_LABEL, debtPaidCount, debtRemaining } from '../../lib/finance'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DueBadge, PaidCheck } from './ItemBits'

interface Props {
  item: PayableItem | null
  monthId: string
  onClose: () => void
  onEdit: (expenseId: string) => void
}

/** Detalle de un pago: sub-hijos (punto 3), editar, eliminar */
export function ExpenseDetailSheet({ item, monthId, onClose, onEdit }: Props) {
  const month = useFinanceStore((s) => s.months[monthId])
  const debts = useFinanceStore((s) => s.debts)
  const addSubItem = useFinanceStore((s) => s.addSubItem)
  const deleteSubItem = useFinanceStore((s) => s.deleteSubItem)
  const deleteExpense = useFinanceStore((s) => s.deleteExpense)

  const [subName, setSubName] = useState('')
  const [subAmount, setSubAmount] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Releer el gasto del store para ver sub-ítems al instante
  const live = useMemo(() => {
    if (!item) return null
    if (item.source === 'expense') {
      const e = month?.expenses.find((x) => x.id === item.refId)
      return e ? { ...item, children: e.children, paid: e.paid, amount: e.children.length ? e.children.reduce((s, c) => s + c.amount, 0) : e.amount } : item
    }
    return item
  }, [item, month])

  if (!item || !live) return null

  const debt = item.source === 'debt' ? debts.find((d) => d.id === item.refId) : null

  const addSub = () => {
    if (!subName.trim() || subAmount <= 0) return
    addSubItem(monthId, item.refId, { name: subName.trim(), amount: subAmount })
    setSubName('')
    setSubAmount(0)
  }

  return (
    <BottomSheet open={!!item} onClose={onClose} title={live.name} subtitle={RECURRENCE_LABEL[live.recurrence]}>
      <div className="flex flex-col gap-4">
        <div className="card bg-elevated/60 p-4 flex items-center justify-between">
          <div>
            <p className="num text-[26px] font-bold text-ink leading-none">{formatMoney(live.amount)}</p>
            <div className="mt-2"><DueBadge item={live} monthId={monthId} /></div>
          </div>
          <PaidCheck item={live} monthId={monthId} size={52} />
        </div>

        {debt && (
          <div className="card bg-elevated/60 p-4">
            <p className="text-[13px] font-semibold text-muted mb-2">Progreso de la deuda</p>
            <div className="h-2 rounded-full bg-card overflow-hidden mb-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round((debtPaidCount(debt) / debt.installments) * 100)}%`,
                  background: 'var(--app-gradient)',
                }}
              />
            </div>
            <div className="flex justify-between text-[12.5px] text-muted">
              <span>Cuota {live.debtProgress?.current}/{live.debtProgress?.total}</span>
              <span>Restan <span className="num font-semibold text-ink">{formatMoney(debtRemaining(debt))}</span></span>
            </div>
            <p className="text-[12px] text-muted mt-2">Administra esta deuda desde la pestaña Deudas.</p>
          </div>
        )}

        {item.source === 'expense' && (
          <>
            {/* Sub-hijos (punto 3) */}
            <div>
              <p className="text-[13px] font-semibold text-muted mb-2">
                Sub-ítems {live.children.length > 0 && `· ${live.children.length}`}
              </p>
              {live.children.length > 0 && (
                <div className="card overflow-hidden divide-y divide-[var(--c-border)] mb-3">
                  {live.children.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 px-3.5 py-2.5">
                      <span className="flex-1 text-[14px] text-ink truncate">{c.name}</span>
                      <span className="num text-[13.5px] font-semibold text-ink">{formatMoney(c.amount)}</span>
                      <button
                        onClick={() => deleteSubItem(monthId, item.refId, c.id)}
                        aria-label={`Eliminar ${c.name}`}
                        className="pressable w-8 h-8 flex items-center justify-center rounded-full text-muted"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="input-base flex-1"
                  placeholder="Ej. Tomate, arroz…"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSub() }}
                />
                <CurrencyInput value={subAmount} onChange={setSubAmount} className="w-32" />
                <button
                  onClick={addSub}
                  aria-label="Agregar sub-ítem"
                  className="pressable w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-white"
                  style={{ background: 'var(--app-accent)' }}
                >
                  <Plus size={19} />
                </button>
              </div>
              {live.children.length > 0 && (
                <p className="text-[11.5px] text-muted mt-2">
                  El monto del gasto ahora es la suma de sus sub-ítems.
                </p>
              )}
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => onEdit(item.refId)}
                className="pressable btn-ghost flex-1 flex items-center justify-center gap-2"
              >
                <Pencil size={15} /> Editar
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="pressable flex-1 rounded-2xl font-semibold py-3 flex items-center justify-center gap-2"
                style={{ background: 'color-mix(in oklab, var(--c-danger) 14%, transparent)', color: 'var(--c-danger)' }}
              >
                <Trash2 size={15} /> Eliminar
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar este pago?"
        message={`"${live.name}" se eliminará de este mes. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteExpense(monthId, item.refId)
          setConfirmDelete(false)
          onClose()
        }}
      />
    </BottomSheet>
  )
}
