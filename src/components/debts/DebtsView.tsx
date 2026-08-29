import { useMemo, useState } from 'react'
import { CalendarClock, HandCoins, Lightbulb, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import type { Debt } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import {
  debtEndMonthId, debtIsActiveInMonth, debtIsSettled, debtPaidCount, debtRemaining,
} from '../../lib/finance'
import { financeSnapshot } from '../../lib/plans'
import { getPaymentAdvice } from '../../lib/ai'
import { formatMoney } from '../../lib/format'
import { monthLabel } from '../../lib/dates'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { AddDebtSheet } from './AddDebtSheet'
import { DebtDetailSheet } from './DebtDetailSheet'
import { PlansSheet } from './PlansSheet'
import { PaidCheck } from '../month/ItemBits'
import { buildPayables } from '../../lib/finance'

export function DebtsView() {
  const debts = useFinanceStore((s) => s.debts)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const profile = useFinanceStore((s) => s.profile)
  const aiEnabled = useFinanceStore((s) => s.settings.aiEnabled)
  const deleteDebt = useFinanceStore((s) => s.deleteDebt)

  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Debt | null>(null)
  const [plansOpen, setPlansOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Debt | null>(null)
  const [advice, setAdvice] = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)

  const active = debts.filter((d) => !debtIsSettled(d))
  const settled = debts.filter((d) => debtIsSettled(d))
  const totalRemaining = active.reduce((s, d) => s + debtRemaining(d), 0)
  const monthlyLoad = active
    .filter((d) => debtIsActiveInMonth(d, monthId))
    .reduce((s, d) => s + d.monthlyPayment, 0)

  const monthItems = useMemo(() => (month ? buildPayables(month, debts) : []), [month, debts])

  const askAdvice = async () => {
    if (!month) return
    setAdviceLoading(true)
    try {
      setAdvice(await getPaymentAdvice(financeSnapshot(month, debts, profile)))
    } catch {
      setAdvice('No se pudo obtener la recomendación. Revisa tu conexión o tu clave de IA en Ajustes.')
    } finally {
      setAdviceLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-32 pt-2 flex flex-col gap-4">
        <header>
          <h2 className="font-display text-[22px] font-bold text-ink">Deudas</h2>
          <p className="text-[13px] text-muted mt-0.5">Controla tus cuotas y sal de deudas con estrategia</p>
        </header>

        {/* Resumen de deudas */}
        <div className="card p-4 grid grid-cols-2 gap-4 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--app-gradient)' }} />
          <div>
            <p className="text-[11.5px] text-muted">Saldo total pendiente</p>
            <p className="num text-[22px] font-bold text-ink leading-tight">{formatMoney(totalRemaining)}</p>
          </div>
          <div>
            <p className="text-[11.5px] text-muted">Cuotas de este mes</p>
            <p className="num text-[22px] font-bold leading-tight" style={{ color: 'var(--c-warning)' }}>
              {formatMoney(monthlyLoad)}
            </p>
          </div>
        </div>

        {/* Recomendación de pagos (punto 6) */}
        <div className="flex gap-2.5">
          <button
            onClick={() => setPlansOpen(true)}
            className="pressable btn-primary flex-1 flex items-center justify-center gap-2 !py-3"
          >
            <HandCoins size={17} /> Planes de pago
          </button>
          {aiEnabled && (
            <button
              onClick={askAdvice}
              disabled={adviceLoading}
              className="pressable btn-ghost flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Sparkles size={16} className={adviceLoading ? 'animate-pulse' : ''} style={{ color: 'var(--app-accent-soft)' }} />
              {adviceLoading ? 'Analizando…' : 'Consejo IA'}
            </button>
          )}
        </div>

        {advice && (
          <div className="card p-3.5 anim-pop flex gap-2.5" style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 40%, var(--c-border))' }}>
            <Lightbulb size={17} className="shrink-0 mt-0.5" style={{ color: 'var(--c-warning)' }} />
            <p className="text-[13px] text-ink leading-relaxed">{advice}</p>
          </div>
        )}

        {/* Deudas activas */}
        {active.length === 0 && settled.length === 0 && (
          <div className="card p-8 text-center anim-pop">
            <p className="text-[15px] font-semibold text-ink">Sin deudas registradas</p>
            <p className="text-[13px] text-muted mt-1.5">
              Agrega una deuda con su fecha de finalización o número de cuotas y la veremos mes a mes.
            </p>
          </div>
        )}

        {active.map((d) => {
          const paidN = debtPaidCount(d)
          const progress = paidN / d.installments
          const item = monthItems.find((i) => i.source === 'debt' && i.refId === d.id)
          return (
            <div key={d.id} className="card p-4 anim-page">
              <div className="flex items-start gap-3">
                {item ? (
                  <PaidCheck item={item} monthId={monthId} size={42} />
                ) : (
                  <span className="w-[42px] h-[42px] rounded-full border-2 border-dashed border-edge flex items-center justify-center shrink-0">
                    <CalendarClock size={16} className="text-muted" />
                  </span>
                )}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailId(d.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setDetailId(d.id) }}
                  className="pressable flex-1 min-w-0"
                >
                  <p className="text-[15.5px] font-semibold text-ink truncate flex items-center gap-1.5">
                    {d.name}
                    {d.viaPlanilla && (
                      <span className="chip !py-0 !px-1.5 !text-[9.5px]" style={{ color: 'var(--app-accent-soft)' }}>Planilla</span>
                    )}
                  </p>
                  <p className="text-[12px] text-muted mt-0.5">
                    {item
                      ? <>Cuota de este mes: <span className="num font-semibold text-ink">{formatMoney(d.monthlyPayment)}</span> · vence el {d.dueDay}</>
                      : d.viaPlanilla
                        ? <>Se deduce de tu salario · toca para ver el estado de cuenta</>
                        : <>Inicia en {monthLabel(d.startMonthId)}</>}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => { setEditing(d); setAddOpen(true) }}
                    aria-label={`Editar ${d.name}`}
                    className="pressable w-9 h-9 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setToDelete(d)}
                    aria-label={`Eliminar ${d.name}`}
                    className="pressable w-9 h-9 rounded-full bg-elevated border border-edge flex items-center justify-center"
                    style={{ color: 'var(--c-danger)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-3.5">
                <div className="flex justify-between text-[11.5px] text-muted mb-1.5">
                  <span>Cuota {Math.min(paidN + 1, d.installments)} de {d.installments} · termina {monthLabel(debtEndMonthId(d), true)}</span>
                  <span className="num">{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(2, Math.round(progress * 100))}%`, background: 'var(--app-gradient)' }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[12px]">
                  <span className="text-muted">Pagado: <span className="num font-semibold" style={{ color: 'var(--c-income)' }}>{formatMoney(d.total - debtRemaining(d))}</span></span>
                  <span className="text-muted">Resta: <span className="num font-semibold text-ink">{formatMoney(debtRemaining(d))}</span></span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Deudas saldadas */}
        {settled.length > 0 && (
          <section>
            <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-muted mb-2 px-1">Liquidadas</h3>
            {settled.map((d) => (
              <div key={d.id} className="card p-3.5 mb-2 flex items-center gap-3 opacity-70">
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--c-income) 18%, transparent)' }}>
                  <HandCoins size={16} style={{ color: 'var(--c-income)' }} />
                </span>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-ink line-through">{d.name}</p>
                  <p className="text-[11.5px] text-muted">{formatMoney(d.total)} · completada</p>
                </div>
                <button
                  onClick={() => setToDelete(d)}
                  aria-label={`Eliminar ${d.name}`}
                  className="pressable w-9 h-9 rounded-full flex items-center justify-center text-muted"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setEditing(null); setAddOpen(true) }}
        aria-label="Agregar deuda"
        className="pressable absolute bottom-20 right-4 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl z-30"
        style={{ background: 'var(--app-gradient)', boxShadow: '0 10px 30px color-mix(in oklab, var(--app-accent) 45%, transparent)' }}
      >
        <Plus size={26} />
      </button>

      <AddDebtSheet open={addOpen} onClose={() => { setAddOpen(false); setEditing(null) }} editing={editing} />
      <DebtDetailSheet
        debt={debts.find((d) => d.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
        onEdit={(d) => { setDetailId(null); setEditing(d); setAddOpen(true) }}
      />
      <PlansSheet open={plansOpen} onClose={() => setPlansOpen(false)} />
      <ConfirmDialog
        open={!!toDelete}
        title={`¿Eliminar "${toDelete?.name}"?`}
        message="Se eliminará la deuda y su historial de cuotas pagadas."
        confirmLabel="Eliminar"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) deleteDebt(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
