import { useMemo, useState } from 'react'
import { CalendarX2, Pencil, Repeat2, Trash2 } from 'lucide-react'
import type { PayableItem } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { formatMoney } from '../../lib/format'
import { RECURRENCE_LABEL, debtPaidCount, debtRemaining } from '../../lib/finance'
import { BottomSheet } from '../ui/BottomSheet'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { DueBadge, PaidCheck } from './ItemBits'
import { AdvancesBlock } from './AdvancesBlock'
import { ShoppingChecklist } from './ShoppingChecklist'

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
  const deleteExpense = useFinanceStore((s) => s.deleteExpense)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [comoQuitar, setComoQuitar] = useState(false)

  // Releer el gasto del store para ver sub-ítems al instante
  const live = useMemo(() => {
    if (!item) return null
    if (item.source === 'expense') {
      const e = month?.expenses.find((x) => x.id === item.refId)
      return e ? { ...item, templateId: e.templateId, paid: e.paid, amount: e.amount } : item
    }
    return item
  }, [item, month])

  if (!item || !live) return null

  const gastoVivo = item.source === 'expense'
    ? month?.expenses.find((x) => x.id === item.refId)
    : undefined

  const debt = item.source === 'debt' ? debts.find((d) => d.id === item.refId) : null

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

        {/* Es un pago fijo: sale en todos los meses de aquí en adelante */}
        {live.templateId && (
          <div
            className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5"
            style={{ background: 'color-mix(in oklab, var(--app-accent) 10%, transparent)' }}
          >
            <Repeat2 size={15} className="shrink-0" style={{ color: 'var(--app-accent-soft)' }} />
            <p className="text-[11.5px] text-ink leading-snug">
              Pago fijo: sale <span className="font-semibold">todos los meses</span> de aquí en
              adelante sin que tengas que ponerlo.
            </p>
          </div>
        )}

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

        {item.source === 'expense' && gastoVivo && (
          <>
            {/* Una lista de compras trae su checklist; el resto, sus adelantos */}
            {gastoVivo.shopping
              ? <ShoppingChecklist monthId={monthId} expense={gastoVivo} onDeleted={onClose} />
              : <AdvancesBlock monthId={monthId} expense={gastoVivo} />}

            <div className="flex gap-2.5">
              <button
                onClick={() => onEdit(item.refId)}
                className="pressable btn-ghost flex-1 flex items-center justify-center gap-2"
              >
                <Pencil size={15} /> Editar
              </button>
              <button
                onClick={() => (live.templateId ? setComoQuitar(true) : setConfirmDelete(true))}
                className="pressable flex-1 rounded-2xl font-semibold py-3 flex items-center justify-center gap-2"
                style={{ background: 'color-mix(in oklab, var(--c-danger) 14%, transparent)', color: 'var(--c-danger)' }}
              >
                <Trash2 size={15} /> Eliminar
              </button>
            </div>
          </>
        )}
      </div>

      {/* Un pago fijo se puede quitar de este mes o dejar de repetirse */}
      <BottomSheet
        open={comoQuitar}
        onClose={() => setComoQuitar(false)}
        title="¿Cómo lo quitamos?"
        subtitle={`"${live.name}" es un pago fijo`}
      >
        <div className="flex flex-col gap-2.5 pb-2">
          <button
            onClick={() => {
              deleteExpense(monthId, item.refId, 'mes')
              setComoQuitar(false)
              onClose()
            }}
            className="pressable tile p-3.5 flex items-center gap-3 text-left"
          >
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)', color: 'var(--app-accent-soft)' }}
            >
              <CalendarX2 size={17} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-semibold text-ink">Quitarlo solo de este mes</span>
              <span className="block text-[11.5px] text-muted leading-snug">
                Los demás meses lo siguen teniendo.
              </span>
            </span>
          </button>

          <button
            onClick={() => {
              deleteExpense(monthId, item.refId, 'siempre')
              setComoQuitar(false)
              onClose()
            }}
            className="pressable tile p-3.5 flex items-center gap-3 text-left"
            style={{ borderColor: 'color-mix(in oklab, var(--c-danger) 35%, var(--c-border))' }}
          >
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in oklab, var(--c-danger) 14%, transparent)', color: 'var(--c-danger)' }}
            >
              <Trash2 size={17} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-semibold" style={{ color: 'var(--c-danger)' }}>
                Dejar de repetirlo
              </span>
              <span className="block text-[11.5px] text-muted leading-snug">
                Se quita de este mes y de los siguientes. Lo ya pagado no se toca.
              </span>
            </span>
          </button>

          <button onClick={() => setComoQuitar(false)} className="pressable btn-ghost w-full mt-1">
            Cancelar
          </button>
        </div>
      </BottomSheet>

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
