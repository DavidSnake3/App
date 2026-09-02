// Presupuestos propios (mejora 4): "Comida de la U: 30 000 al mes" y vas
// anotando lo que gastás. Avisa cuando te acercás o te pasás del límite.
import { useState } from 'react'
import { AlertTriangle, ChevronDown, Plus, Target, Trash2, X } from 'lucide-react'
import type { Budget } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { budgetStatus, budgetsNeedingAttention } from '../../lib/budgets'
import { formatMoney, money2 } from '../../lib/format'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Segmented } from '../ui/Segmented'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export function BudgetsCard() {
  const budgets = useFinanceStore((s) => s.budgets)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const addBudget = useFinanceStore((s) => s.addBudget)

  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [period, setPeriod] = useState<'monthly' | 'weekly'>('monthly')

  const alertas = budgetsNeedingAttention(budgets, month)
  const crear = () => {
    if (!name.trim() || amount <= 0) return
    addBudget({ name: name.trim(), amount: money2(amount), period })
    setName(''); setAmount(0); setAdding(false); setOpen(true)
  }

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
              ? 'Poné un límite por categoría y controlá lo que gastás'
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
                {' '}<span className="num">{formatMoney(Math.round(alertas[0].status.spent))}</span> de
                {' '}<span className="num">{formatMoney(alertas[0].status.limit)}</span></>
            ) : (
              <>Vas al <span className="num font-semibold">{Math.round(alertas[0].status.ratio * 100)}%</span> de
                {' '}<span className="font-semibold">{alertas[0].budget.name}</span>: te quedan
                {' '}<span className="num">{formatMoney(Math.round(alertas[0].status.left))}</span></>
            )}
          </p>
        </div>
      )}

      {open && (
        <div className="mt-3 anim-fade flex flex-col gap-2.5">
          {budgets.map((b) => <BudgetRow key={b.id} budget={b} />)}

          {adding ? (
            <div className="rounded-xl border border-edge p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-semibold text-ink">Nuevo presupuesto</p>
                <button onClick={() => setAdding(false)} aria-label="Cancelar" className="pressable text-muted">
                  <X size={14} />
                </button>
              </div>
              <input
                className="input-base"
                placeholder="Ej. Comida de la U, Gasolina, Salidas"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <CurrencyInput value={amount} onChange={setAmount} className="flex-1" />
                <div className="w-40 shrink-0">
                  <Segmented
                    value={period}
                    onChange={setPeriod}
                    options={[
                      { value: 'monthly', label: 'Mes' },
                      { value: 'weekly', label: 'Semana' },
                    ]}
                  />
                </div>
              </div>
              <button onClick={crear} className="pressable btn-primary w-full !py-2 text-[13px]">
                Crear presupuesto
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="pressable rounded-xl border border-dashed py-2 text-[12.5px] font-semibold flex items-center justify-center gap-1.5"
              style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 45%, var(--c-border))', color: 'var(--app-accent-soft)' }}
            >
              <Plus size={14} /> Crear un presupuesto
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Una línea de presupuesto ──────────────────────────────────────────── */

function BudgetRow({ budget }: { budget: Budget }) {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const deleteBudgetEntry = useFinanceStore((s) => s.deleteBudgetEntry)
  const updateBudget = useFinanceStore((s) => s.updateBudget)
  const deleteBudget = useFinanceStore((s) => s.deleteBudget)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const st = budgetStatus(budget, month)
  const color = st.level === 'over' ? 'var(--c-danger)' : st.level === 'warn' ? 'var(--c-warning)' : 'var(--c-income)'

  return (
    <div className="rounded-xl border border-edge p-3">
      <button onClick={() => setOpen(!open)} className="pressable w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-ink truncate">
            {budget.name}
            <span className="text-[10.5px] text-muted font-normal"> · {budget.period === 'weekly' ? 'semanal' : 'mensual'}</span>
          </span>
          <span className="num text-[12.5px] font-bold shrink-0" style={{ color }}>
            {formatMoney(money2(st.spent))}
            <span className="text-[10.5px] text-muted font-normal"> / {formatMoney(st.limit)}</span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-elevated overflow-hidden mt-1.5">
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

      {open && (
        <div className="mt-2.5 anim-fade flex flex-col gap-2">

          {st.entries.length > 0 && (
            <div className="flex flex-col divide-y divide-[var(--c-border)]">
              {st.entries.slice(0, 6).map((e) => (
                <div key={e.id} className="flex items-center gap-2 py-1.5">
                  <span className="text-[12px] text-ink flex-1 truncate">{e.note || 'Gasto'}</span>
                  <span className="text-[10px] text-muted num">{e.dateISO.slice(8, 10)}/{e.dateISO.slice(5, 7)}</span>
                  <span className="num text-[12px] font-semibold" style={{ color: 'var(--c-danger)' }}>
                    −{formatMoney(e.amount)}
                  </span>
                  <button
                    onClick={() => deleteBudgetEntry(budget.id, e.id)}
                    aria-label="Eliminar movimiento"
                    className="pressable w-5 h-5 rounded-full flex items-center justify-center text-muted"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {editing ? (
            <div className="flex flex-col gap-2 pt-1">
              <input
                className="input-base !py-2 !text-[13px]"
                value={budget.name}
                onChange={(e) => updateBudget(budget.id, { name: e.target.value })}
              />
              <div className="flex gap-2">
                <CurrencyInput
                  value={budget.amount}
                  onChange={(v) => updateBudget(budget.id, { amount: v })}
                  className="flex-1 [&_input]:!py-2 [&_input]:!text-[13px]"
                />
                <div className="w-36 shrink-0">
                  <Segmented
                    value={budget.period}
                    onChange={(p) => updateBudget(budget.id, { period: p })}
                    options={[
                      { value: 'monthly', label: 'Mes' },
                      { value: 'weekly', label: 'Semana' },
                    ]}
                  />
                </div>
              </div>
              <button
                onClick={() => setConfirmDel(true)}
                className="pressable text-[12px] font-semibold flex items-center justify-center gap-1.5 py-1"
                style={{ color: 'var(--c-danger)' }}
              >
                <Trash2 size={13} /> Eliminar presupuesto
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="pressable text-[11.5px] text-muted self-start underline decoration-dotted"
            >
              Editar límite o nombre
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDel}
        title={`¿Eliminar "${budget.name}"?`}
        message="Se borra el presupuesto y sus movimientos anotados."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => { deleteBudget(budget.id); setConfirmDel(false) }}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  )
}
