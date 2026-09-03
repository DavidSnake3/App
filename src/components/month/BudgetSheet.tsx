// Un presupuesto por dentro: cuánto llevás, cuánto te queda y el botón para
// gastar ahí mismo. Cada gasto sale de una cuenta de verdad y queda en el
// historial, así que el presupuesto y tu plata siempre dicen lo mismo.
import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import type { Budget, Movement } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { budgetStatus, periodEnd, periodLabel, periodStart } from '../../lib/budgets'
import { accountById, activeAccounts, allMovements, isCredit } from '../../lib/accounts'
import { dayLabel } from '../../lib/dates'
import { formatMoney, money2 } from '../../lib/format'
import { accountColor } from '../../lib/itemColors'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { BudgetForm } from './BudgetForm'

export function BudgetSheet({ budgetId, onClose }: { budgetId: string | null; onClose: () => void }) {
  const budget = useFinanceStore((s) => s.budgets.find((b) => b.id === budgetId))
  return (
    <BottomSheet
      open={Boolean(budgetId && budget)}
      onClose={onClose}
      title={budget?.name ?? 'Presupuesto'}
      subtitle={budget ? `Tu límite ${periodLabel(budget)}` : ''}
    >
      {budget && <Detalle budget={budget} onClose={onClose} />}
    </BottomSheet>
  )
}

function Detalle({ budget, onClose }: { budget: Budget; onClose: () => void }) {
  const months = useFinanceStore((s) => s.months)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const accounts = useFinanceStore((s) => s.accounts)
  const spendFromBudget = useFinanceStore((s) => s.spendFromBudget)
  const deleteMovement = useFinanceStore((s) => s.deleteMovement)
  const deleteBudget = useFinanceStore((s) => s.deleteBudget)

  const cuentas = activeAccounts(accounts).filter((a) => !isCredit(a))
  const [monto, setMonto] = useState(0)
  const [nota, setNota] = useState('')
  const [cuentaId, setCuentaId] = useState(budget.accountId ?? '')
  const [editando, setEditando] = useState(false)
  const [borrarMov, setBorrarMov] = useState<Movement | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)

  const st = budgetStatus(budget, months[monthId], new Date(), months)
  const desde = periodStart(budget)
  const hasta = periodEnd(budget)
  const pct = Math.min(100, Math.round(st.ratio * 100))
  const tono = st.level === 'over' ? 'var(--c-danger)' : st.level === 'warn' ? 'var(--c-warning)' : 'var(--c-income)'

  // lo gastado en este período, del más nuevo al más viejo
  const gastos = useMemo(
    () => allMovements(months).filter(
      (m) => m.budgetId === budget.id && m.kind === 'gasto' && m.dateISO >= desde && m.dateISO <= hasta,
    ),
    [months, budget.id, desde, hasta],
  )

  const gastar = () => {
    if (monto <= 0) return
    spendFromBudget(budget.id, { amount: monto, note: nota.trim() || undefined, accountId: cuentaId || undefined })
    setMonto(0); setNota('')
  }

  if (editando) {
    return <BudgetForm budget={budget} onDone={() => setEditando(false)} onCancel={() => setEditando(false)} />
  }

  return (
    <div className="flex flex-col gap-3.5 pb-1">
      {/* Cuánto llevás */}
      <div
        className="rounded-2xl p-4"
        style={{ background: `color-mix(in oklab, ${tono} 11%, transparent)` }}
      >
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Llevás gastado</p>
            <p className="display-money text-[27px] font-bold leading-tight mt-0.5" style={{ color: tono }}>
              {formatMoney(st.spent)}
            </p>
          </div>
          <p className="text-[12px] text-muted shrink-0 text-right">
            de <span className="num font-semibold text-ink">{formatMoney(st.limit)}</span>
            <span className="block text-[10.5px]">{periodLabel(budget)}</span>
          </p>
        </div>

        <div className="h-2.5 rounded-full bg-elevated overflow-hidden mt-2.5">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: tono }}
          />
        </div>

        <p className="text-[11.5px] mt-2 leading-snug" style={{ color: st.level === 'ok' ? 'var(--c-muted)' : tono }}>
          {st.level === 'over' ? (
            <><AlertTriangle size={11} className="inline mb-0.5" /> Te pasaste por{' '}
              <span className="num font-semibold">{formatMoney(Math.abs(st.left))}</span>.</>
          ) : st.level === 'warn' ? (
            <><AlertTriangle size={11} className="inline mb-0.5" /> Ojo, vas al{' '}
              <span className="num font-semibold">{pct}%</span>: te quedan{' '}
              <span className="num font-semibold">{formatMoney(st.left)}</span>.</>
          ) : (
            <>Te quedan <span className="num font-semibold text-ink">{formatMoney(st.left)}</span> hasta
              el {dayLabel(hasta).toLowerCase()}.</>
          )}
        </p>
      </div>

      {/* Gastar aquí mismo */}
      <div className="card p-3.5 flex flex-col gap-2.5">
        <p className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
          <Wallet size={13} style={{ color: 'var(--app-accent-soft)' }} /> Anotar un gasto
        </p>
        <div className="flex gap-2">
          <CurrencyInput value={monto} onChange={setMonto} className="flex-1" />
          <button
            onClick={gastar}
            disabled={monto <= 0}
            aria-label={`Gastar de ${budget.name}`}
            className="pressable w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-white disabled:opacity-40"
            style={{ background: 'var(--app-accent)' }}
          >
            <Plus size={18} />
          </button>
        </div>
        <input
          className="input-base"
          placeholder={`¿En qué? (opcional, si no dice "${budget.name}")`}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        {cuentas.length > 0 && (
          <div>
            <p className="text-[11.5px] text-muted mb-1.5">¿De qué cuenta sale?</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {cuentas.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setCuentaId(cuentaId === a.id ? '' : a.id)}
                  className={`pressable chip shrink-0 ${cuentaId === a.id ? 'chip-active' : ''}`}
                >
                  <span style={{ color: accountColor(a) }}>
                    <ItemIcon icon={a.icon} name={a.name} size={12} />
                  </span> {a.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lo que llevás gastado en este período */}
      {gastos.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-muted mb-1.5">
            En qué se fue <span className="font-normal">· {gastos.length} {gastos.length === 1 ? 'gasto' : 'gastos'}</span>
          </p>
          <div className="card overflow-hidden divide-y divide-[var(--c-border)]">
            {gastos.map((mv) => (
              <div key={mv.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium text-ink truncate">{mv.name}</span>
                  <span className="block text-[11px] text-muted truncate">
                    {dayLabel(mv.dateISO.slice(0, 10))}
                    {accountById(accounts, mv.accountId) && ` · ${accountById(accounts, mv.accountId)?.name}`}
                  </span>
                </span>
                <span className="display-money text-[14px] font-bold text-ink shrink-0">
                  {formatMoney(money2(mv.amount))}
                </span>
                <button
                  onClick={() => setBorrarMov(mv)}
                  aria-label={`Borrar ${mv.name}`}
                  className="pressable w-8 h-8 rounded-full bg-elevated border border-edge flex items-center justify-center shrink-0"
                  style={{ color: 'var(--c-danger)' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setEditando(true)}
          className="pressable btn-ghost flex-1 flex items-center justify-center gap-2"
        >
          <Pencil size={14} /> Editar
        </button>
        <button
          onClick={() => setConfirmDel(true)}
          className="pressable btn-ghost px-4 flex items-center justify-center"
          style={{ color: 'var(--c-danger)' }}
          aria-label={`Borrar ${budget.name}`}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <ConfirmDialog
        open={Boolean(borrarMov)}
        title="¿Borrar este gasto?"
        message={borrarMov
          ? `Se van ${formatMoney(borrarMov.amount)} de ${budget.name} y la plata vuelve a la cuenta.`
          : ''}
        confirmLabel="Borrar"
        danger
        onConfirm={() => { if (borrarMov) deleteMovement(borrarMov.id); setBorrarMov(null) }}
        onCancel={() => setBorrarMov(null)}
      />
      <ConfirmDialog
        open={confirmDel}
        title={`¿Borrar ${budget.name}?`}
        message="Se va el presupuesto. Los gastos que anotaste quedan en tus movimientos."
        confirmLabel="Borrar"
        danger
        onConfirm={() => { deleteBudget(budget.id); setConfirmDel(false); onClose() }}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  )
}

/** Marca de "presupuesto al día", para reusar en la lista */
export const BudgetOkIcon = Check
