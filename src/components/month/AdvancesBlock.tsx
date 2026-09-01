// Adelantos de un pago: abonos parciales antes de pagarlo del todo.
// Ej. el recibo es de 30.000 y vence el 15, pero el 10 adelantás 15.000.
import { useState } from 'react'
import { ArrowDownToLine, Trash2 } from 'lucide-react'
import type { Expense } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { advancedAmount, remainingAmount } from '../../lib/finance'
import { activeAccounts, isCredit } from '../../lib/accounts'
import { accountColor } from '../../lib/itemColors'
import { ItemIcon } from '../../lib/icons'
import { formatMoney } from '../../lib/format'
import { todayLocalISO } from '../../lib/dates'
import { CurrencyInput } from '../ui/CurrencyInput'
import { DateField } from '../ui/DatePicker'

export function AdvancesBlock({ monthId, expense }: { monthId: string; expense: Expense }) {
  const accounts = useFinanceStore((s) => s.accounts)
  const addAdvance = useFinanceStore((s) => s.addExpenseAdvance)
  const deleteAdvance = useFinanceStore((s) => s.deleteExpenseAdvance)
  const cuentas = activeAccounts(accounts)

  const [abrir, setAbrir] = useState(false)
  const [amount, setAmount] = useState(0)
  const [dateISO, setDateISO] = useState(todayLocalISO())
  const [accountId, setAccountId] = useState(expense.accountId ?? '')

  const adelantos = expense.advances ?? []
  const yaAdelantado = advancedAmount(expense)
  const falta = remainingAmount(expense)
  const cuentaElegida = cuentas.find((a) => a.id === accountId)

  const registrar = () => {
    if (amount <= 0) return
    addAdvance(monthId, expense.id, {
      amount: Math.min(amount, falta),
      dateISO,
      accountId: accountId || undefined,
    })
    setAmount(0)
    setAbrir(false)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[13px] font-semibold text-muted">
          Adelantos {adelantos.length > 0 && `· ${adelantos.length}`}
        </p>
        {yaAdelantado > 0 && (
          <p className="text-[11.5px] text-muted">
            abonado <span className="num font-semibold" style={{ color: 'var(--c-income)' }}>
              {formatMoney(yaAdelantado)}
            </span>
            {' · falta '}
            <span className="num font-semibold" style={{ color: 'var(--c-warning)' }}>
              {formatMoney(falta)}
            </span>
          </p>
        )}
      </div>

      {adelantos.length > 0 && (
        <div className="card overflow-hidden divide-y divide-[var(--c-border)] mb-3">
          {adelantos.map((a) => {
            const cuenta = accounts.find((x) => x.id === a.accountId)
            return (
              <div key={a.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: 'color-mix(in oklab, var(--c-income) 16%, transparent)',
                    color: 'var(--c-income)',
                  }}
                >
                  <ArrowDownToLine size={13} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium text-ink truncate">
                    {a.note || 'Adelanto'}
                  </span>
                  <span className="block text-[10.5px] text-muted num">
                    {a.dateISO.slice(8, 10)}/{a.dateISO.slice(5, 7)}
                    {cuenta ? ` · ${cuenta.name}` : ''}
                  </span>
                </span>
                <span className="num text-[13.5px] font-semibold shrink-0" style={{ color: 'var(--c-income)' }}>
                  {formatMoney(a.amount)}
                </span>
                <button
                  onClick={() => deleteAdvance(monthId, expense.id, a.id)}
                  aria-label="Eliminar adelanto"
                  className="pressable w-8 h-8 flex items-center justify-center rounded-full text-muted shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {expense.paid ? (
        adelantos.length === 0 && (
          <p className="text-[11.5px] text-muted leading-snug">
            Este pago ya está saldado. Si querés registrar un abono parcial, desmarcalo primero.
          </p>
        )
      ) : abrir ? (
        <div className="card bg-elevated/60 p-3.5 flex flex-col gap-3 anim-fade">
          <div>
            <label className="text-[12px] font-semibold text-muted">¿Cuánto vas a adelantar?</label>
            <CurrencyInput value={amount} onChange={setAmount} className="mt-1.5" autoFocus />
            <p className="text-[11px] text-muted mt-1">
              Falta <span className="num font-semibold">{formatMoney(falta)}</span> de{' '}
              <span className="num">{formatMoney(expense.amount)}</span>
            </p>
          </div>

          <DateField value={dateISO} onChange={setDateISO} label="¿Qué día lo abonás?" maxToday />

          {cuentas.length > 0 && (
            <div>
              <label className="text-[12px] font-semibold text-muted">¿De qué cuenta sale?</label>
              <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setAccountId('')}
                  className={`pressable chip shrink-0 ${accountId === '' ? 'chip-active' : ''}`}
                >
                  La principal
                </button>
                {cuentas.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAccountId(a.id)}
                    className={`pressable chip shrink-0 ${accountId === a.id ? 'chip-active' : ''}`}
                  >
                    <span style={{ color: accountColor(a) }}>
                      <ItemIcon icon={a.icon} name={a.name} size={12} />
                    </span> {a.name}
                  </button>
                ))}
              </div>
              {cuentaElegida && isCredit(cuentaElegida) && (
                <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: 'var(--c-warning)' }}>
                  Se suma a la deuda de {cuentaElegida.name}, no baja tu efectivo.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setAbrir(false)} className="pressable btn-ghost flex-1">
              Cancelar
            </button>
            <button
              onClick={registrar}
              disabled={amount <= 0}
              className="pressable btn-primary flex-1 disabled:opacity-50"
            >
              Registrar
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => { setAmount(0); setAbrir(true) }}
            className="pressable rounded-2xl border-2 border-dashed w-full flex items-center justify-center gap-2 py-3 text-[13px] font-semibold"
            style={{
              borderColor: 'color-mix(in oklab, var(--c-income) 45%, var(--c-border))',
              color: 'var(--c-income)',
            }}
          >
            <ArrowDownToLine size={15} /> Adelantar parte de este pago
          </button>
          <p className="text-[11px] text-muted mt-1.5 leading-snug">
            Sale de tu cuenta al momento y queda en Movimientos. Al marcarlo pagado solo se
            cobra lo que falta.
          </p>
        </>
      )}
    </div>
  )
}
