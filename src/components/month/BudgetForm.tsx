// Crear o editar un presupuesto: cuánto, cada cuánto se reinicia, de qué
// cuenta sale y si querés verlo en Pagos del mes.
import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { Budget, BudgetPeriod } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { activeAccounts, isCredit } from '../../lib/accounts'
import { formatMoney, money2 } from '../../lib/format'
import { accountColor } from '../../lib/itemColors'
import { ItemIcon } from '../../lib/icons'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Toggle } from '../ui/Toggle'
import { CategoryPicker } from '../ui/CategoryPicker'

const PERIODOS: { value: BudgetPeriod; label: string; hint: string }[] = [
  { value: 'weekly', label: 'Semana', hint: 'se reinicia cada lunes' },
  { value: 'biweekly', label: 'Quincena', hint: 'del 1 al 15 y del 16 al final' },
  { value: 'monthly', label: 'Mes', hint: 'se reinicia el día 1' },
  { value: 'days', label: 'Días', hint: 'vos elegís cada cuántos' },
]

export function BudgetForm({ budget, onDone, onCancel }: {
  budget?: Budget
  onDone: () => void
  onCancel: () => void
}) {
  const accounts = useFinanceStore((s) => s.accounts)
  const addBudget = useFinanceStore((s) => s.addBudget)
  const updateBudget = useFinanceStore((s) => s.updateBudget)
  const cuentas = activeAccounts(accounts).filter((a) => !isCredit(a))

  const [name, setName] = useState(budget?.name ?? '')
  const [amount, setAmount] = useState(budget?.amount ?? 0)
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? 'monthly')
  const [everyDays, setEveryDays] = useState(budget?.everyDays ?? 15)
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? '')
  const [accountId, setAccountId] = useState(budget?.accountId ?? '')
  const [inPayments, setInPayments] = useState(budget?.inPayments ?? true)

  const guardar = () => {
    if (!name.trim() || amount <= 0) return
    const datos = {
      name: name.trim(),
      amount: money2(amount),
      period,
      everyDays: period === 'days' ? Math.max(1, Math.round(everyDays)) : undefined,
      startISO: period === 'days' ? (budget?.startISO ?? new Date().toISOString().slice(0, 10)) : undefined,
      categoryId: categoryId || undefined,
      accountId: accountId || undefined,
      inPayments,
    }
    if (budget) updateBudget(budget.id, datos)
    else addBudget(datos)
    onDone()
  }

  return (
    <div className="flex flex-col gap-3 pb-1">
      <input
        className="input-base"
        placeholder="Ej. Gasolina, Comida de la U, Salidas"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus={!budget}
      />

      <div>
        <p className="text-[11.5px] text-muted mb-1.5">¿Cuánto podés gastar?</p>
        <CurrencyInput value={amount} onChange={setAmount} />
      </div>

      {/* Cada cuánto se reinicia */}
      <div>
        <p className="text-[11.5px] text-muted mb-1.5 flex items-center gap-1.5">
          <CalendarDays size={12} /> ¿Cada cuánto se reinicia?
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className="pressable rounded-xl py-2 text-[12px] font-semibold border transition-colors"
              style={period === p.value
                ? { background: 'var(--app-accent)', color: '#fff', borderColor: 'var(--app-accent)' }
                : { background: 'var(--c-elevated)', color: 'var(--c-muted)', borderColor: 'var(--c-border)' }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted mt-1.5">
          {PERIODOS.find((p) => p.value === period)?.hint}
        </p>
      </div>

      {period === 'days' && (
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-ink">Cada</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            className="input-base w-20 text-center"
            value={everyDays}
            onChange={(e) => setEveryDays(Number(e.target.value) || 1)}
          />
          <span className="text-[12.5px] text-ink">días</span>
        </div>
      )}

      {amount > 0 && (
        <div
          className="rounded-xl px-3 py-2 text-[11.5px] leading-snug"
          style={{ background: 'color-mix(in oklab, var(--app-accent) 10%, transparent)' }}
        >
          Podés gastar <span className="num font-semibold text-ink">{formatMoney(money2(amount))}</span>
          {period === 'weekly' && ' por semana'}
          {period === 'biweekly' && ' por quincena'}
          {period === 'monthly' && ' por mes'}
          {period === 'days' && ` cada ${Math.max(1, Math.round(everyDays))} días`}
          . Cuando el período se reinicia, el contador vuelve a cero.
        </div>
      )}

      <CategoryPicker value={categoryId} onChange={setCategoryId} kind="gasto" label="Categoría (opcional)" />

      {cuentas.length > 0 && (
        <div>
          <p className="text-[11.5px] text-muted mb-1.5">¿De qué cuenta sale?</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {cuentas.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccountId(accountId === a.id ? '' : a.id)}
                className={`pressable chip shrink-0 ${accountId === a.id ? 'chip-active' : ''}`}
              >
                <span style={{ color: accountColor(a) }}>
                  <ItemIcon icon={a.icon} name={a.name} size={12} />
                </span> {a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 py-1">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-ink">Verlo en Pagos del mes</p>
          <p className="text-[11px] text-muted leading-snug">
            Sale con su barra de avance. No es un pago: no se marca ni frena el mes completado.
          </p>
        </div>
        <Toggle checked={inPayments} onChange={setInPayments} />
      </div>

      <div className="flex gap-2 mt-1">
        <button onClick={onCancel} className="pressable btn-ghost flex-1">Cancelar</button>
        <button
          onClick={guardar}
          disabled={!name.trim() || amount <= 0}
          className="pressable btn-primary flex-1 disabled:opacity-40"
        >
          {budget ? 'Guardar' : 'Crear presupuesto'}
        </button>
      </div>
    </div>
  )
}
