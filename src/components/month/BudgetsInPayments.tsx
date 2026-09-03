// Los presupuestos dentro de "Pagos del mes". No llevan check: llevan barra.
// Un presupuesto no se paga ni se termina, así que nunca frena el mes
// completado; solo te muestra cuánto llevás y te avisa si te estás pasando.
import { useState } from 'react'
import { AlertTriangle, ChevronRight, Target } from 'lucide-react'
import type { Budget } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { budgetStatus, periodLabel } from '../../lib/budgets'
import { formatMoney, money2 } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { BudgetSheet } from './BudgetSheet'

export function BudgetsInPayments() {
  const budgets = useFinanceStore((s) => s.budgets)
  const [verId, setVerId] = useState<string | null>(null)
  const visibles = budgets.filter((b) => b.inPayments !== false)
  if (!visibles.length) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <Target size={13} style={{ color: 'var(--app-accent-soft)' }} />
        <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-muted">
          Mis presupuestos
        </h3>
        <span className="text-[11px] text-muted">· {visibles.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {visibles.map((b) => <Fila key={b.id} budget={b} onOpen={() => setVerId(b.id)} />)}
      </div>
      <BudgetSheet budgetId={verId} onClose={() => setVerId(null)} />
    </section>
  )
}

function Fila({ budget, onOpen }: { budget: Budget; onOpen: () => void }) {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const months = useFinanceStore((s) => s.months)
  const st = budgetStatus(budget, months[monthId], new Date(), months)
  const tono = st.level === 'over' ? 'var(--c-danger)' : st.level === 'warn' ? 'var(--c-warning)' : 'var(--c-income)'
  const pct = Math.min(100, Math.round(st.ratio * 100))

  return (
    <button
      onClick={onOpen}
      className="pressable tile p-3 text-left w-full"
      style={{
        background: `linear-gradient(155deg, color-mix(in oklab, ${tono} 9%, var(--c-card)) 0%, var(--c-card) 62%)`,
        borderColor: `color-mix(in oklab, ${tono} 24%, var(--c-border))`,
      }}
    >
      <div className="flex items-center gap-2.5">
        {/* en vez del check, el porcentaje */}
        <span
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0"
          style={{ background: `color-mix(in oklab, ${tono} 15%, transparent)`, color: tono }}
        >
          <ItemIcon icon={budget.icon} name={budget.name} size={14} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-[14px] font-semibold text-ink truncate">{budget.name}</span>
            {st.level !== 'ok' && <AlertTriangle size={11} style={{ color: tono }} className="shrink-0" />}
          </span>
          <span className="block text-[11px] text-muted">
            Presupuesto {periodLabel(budget)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="display-money block text-[15px] font-bold" style={{ color: tono }}>
            {formatMoney(money2(st.spent))}
          </span>
          <span className="block text-[10.5px] text-muted num">de {formatMoney(st.limit)}</span>
        </span>
        <ChevronRight size={15} className="text-muted shrink-0" />
      </div>

      <div className="h-2 rounded-full bg-elevated overflow-hidden mt-2.5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: tono }}
        />
      </div>
      <p className="text-[10.5px] mt-1" style={{ color: st.level === 'ok' ? 'var(--c-muted)' : tono }}>
        {st.level === 'over'
          ? `Te pasaste por ${formatMoney(Math.abs(money2(st.left)))}`
          : `${pct}% usado · te quedan ${formatMoney(money2(st.left))}`}
      </p>
    </button>
  )
}
