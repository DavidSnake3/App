// Presupuestos propios: "Gasolina: 30 000 por quincena" y vas gastando ahí.
// Cada gasto sale de una cuenta de verdad. Avisa cuando te acercás al límite,
// pero nunca te frena: es tu plata.
import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Target } from 'lucide-react'
import type { Budget } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { budgetStatus, budgetsNeedingAttention, periodLabel } from '../../lib/budgets'
import { formatMoney, money2 } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { BudgetForm } from './BudgetForm'
import { BudgetSheet } from './BudgetSheet'

export function BudgetsCard() {
  const budgets = useFinanceStore((s) => s.budgets)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const months = useFinanceStore((s) => s.months)

  const [open, setOpen] = useState(false)
  const [creando, setCreando] = useState(false)
  const [verId, setVerId] = useState<string | null>(null)

  const alertas = budgetsNeedingAttention(budgets, months[monthId], new Date(), months)

  return (
    <div className="card p-4">
      <button onClick={() => setOpen(!open)} className="pressable w-full flex items-center gap-2.5 text-left">
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)' }}
        >
          <Target size={15} style={{ color: 'var(--app-accent-soft)' }} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-semibold text-ink">Mis presupuestos</span>
          <span className="block text-[11.5px] text-muted">
            {budgets.length === 0
              ? 'Poné un límite y gastá desde ahí'
              : `${budgets.length} presupuesto${budgets.length === 1 ? '' : 's'}${alertas.length ? ` · ${alertas.length} necesita${alertas.length === 1 ? '' : 'n'} atención` : ' · todos al día'}`}
          </span>
        </span>
        <ChevronDown
          size={17}
          className="text-muted shrink-0 transition-transform"
          style={open ? { transform: 'rotate(180deg)' } : undefined}
        />
      </button>

      {/* Aviso corto cuando algo está cerca del límite */}
      {!open && alertas.length > 0 && (
        <div
          className="mt-2.5 rounded-xl px-3 py-2 flex items-start gap-2"
          style={{ background: `color-mix(in oklab, ${alertas[0].status.level === 'over' ? 'var(--c-danger)' : 'var(--c-warning)'} 12%, transparent)` }}
        >
          <AlertTriangle
            size={14}
            className="shrink-0 mt-0.5"
            style={{ color: alertas[0].status.level === 'over' ? 'var(--c-danger)' : 'var(--c-warning)' }}
          />
          <p className="text-[11.5px] text-ink leading-snug">
            {alertas[0].status.level === 'over' ? (
              <>Te pasaste en <span className="font-semibold">{alertas[0].budget.name}</span>:
                {' '}<span className="num">{formatMoney(money2(alertas[0].status.spent))}</span> de
                {' '}<span className="num">{formatMoney(alertas[0].status.limit)}</span></>
            ) : (
              <>Vas al <span className="num font-semibold">{Math.round(alertas[0].status.ratio * 100)}%</span> de
                {' '}<span className="font-semibold">{alertas[0].budget.name}</span>: te quedan
                {' '}<span className="num">{formatMoney(money2(alertas[0].status.left))}</span></>
            )}
          </p>
        </div>
      )}

      {open && (
        <div className="mt-3 anim-fade flex flex-col gap-2.5">
          {budgets.map((b) => (
            <BudgetRow key={b.id} budget={b} onOpen={() => setVerId(b.id)} />
          ))}

          <button
            onClick={() => setCreando(true)}
            className="pressable rounded-xl border border-dashed py-2 text-[12.5px] font-semibold flex items-center justify-center gap-1.5"
            style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 45%, var(--c-border))', color: 'var(--app-accent-soft)' }}
          >
            <Plus size={14} /> Crear un presupuesto
          </button>
        </div>
      )}

      <BottomSheet
        open={creando}
        onClose={() => setCreando(false)}
        title="Nuevo presupuesto"
        subtitle="Un límite tuyo, no un pago del mes"
      >
        {creando && <BudgetForm onDone={() => { setCreando(false); setOpen(true) }} onCancel={() => setCreando(false)} />}
      </BottomSheet>
      <BudgetSheet budgetId={verId} onClose={() => setVerId(null)} />
    </div>
  )
}

/* ─── Una línea de presupuesto ──────────────────────────────────────────── */

function BudgetRow({ budget, onOpen }: { budget: Budget; onOpen: () => void }) {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const months = useFinanceStore((s) => s.months)
  const st = budgetStatus(budget, months[monthId], new Date(), months)
  const color = st.level === 'over' ? 'var(--c-danger)' : st.level === 'warn' ? 'var(--c-warning)' : 'var(--c-income)'

  return (
    <button onClick={onOpen} className="pressable rounded-xl border border-edge p-3 w-full text-left">
      <div className="flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color }}
        >
          <ItemIcon icon={budget.icon} name={budget.name} size={13} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-ink truncate">{budget.name}</span>
          <span className="block text-[10.5px] text-muted">{periodLabel(budget)}</span>
        </span>
        <span className="num text-[12.5px] font-bold shrink-0 text-right" style={{ color }}>
          {formatMoney(money2(st.spent))}
          <span className="block text-[10.5px] text-muted font-normal">de {formatMoney(st.limit)}</span>
        </span>
        <ChevronRight size={14} className="text-muted shrink-0" />
      </div>
      <div className="h-2 rounded-full bg-elevated overflow-hidden mt-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.round(st.ratio * 100))}%`, background: color }}
        />
      </div>
      <p className="text-[10.5px] mt-1" style={{ color: st.level === 'ok' ? 'var(--c-muted)' : color }}>
        {st.level === 'over'
          ? `Te pasaste por ${formatMoney(Math.abs(money2(st.left)))}`
          : st.level === 'warn'
            ? `¡Cuidado! Te quedan ${formatMoney(money2(st.left))}`
            : `Te quedan ${formatMoney(money2(st.left))}`}
      </p>
    </button>
  )
}
