// Widgets de inicio para el dinero: cuentas (efectivo real) y tarjetas.
import { AlertTriangle, ArrowRight, CreditCard, Plus, Wallet } from 'lucide-react'
import type { WidgetSize } from '../../types/finance'
import type { WidgetCtx } from './widgetMeta'
import { useMoney } from '../../hooks/useLedger'
import { formatMoney, money2 } from '../../lib/format'
import { AccountFace } from '../ui/AccountFace'

/** Efectivo real repartido por cuenta */
export function CuentasWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const money = useMoney()

  if (!money.balances.length) {
    return (
      <button
        onClick={() => ctx.goto('money', 'cuentas')}
        className="pressable widget p-4 h-full w-full text-left flex items-center gap-3"
      >
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)', color: 'var(--app-accent-soft)' }}
        >
          <Plus size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-semibold text-ink">Crea tus cuentas</span>
          <span className="block text-[12px] text-muted mt-0.5">
            Efectivo, banco, ahorros y tarjetas: así sabés cuánto tenés de verdad
          </span>
        </span>
        <ArrowRight size={15} className="text-muted shrink-0" />
      </button>
    )
  }

  const max = size === 'sm' ? 2 : size === 'xl' ? 6 : 3

  return (
    <button
      onClick={() => ctx.goto('money', 'cuentas')}
      className="pressable widget p-4 h-full w-full text-left relative overflow-hidden"
    >
      <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
        <Wallet size={12} /> Efectivo real
      </p>
      <p
        className="display-money text-[25px] font-bold mt-1.5 anim-money"
        style={{ color: money.cash >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}
      >
        {formatMoney(money2(money.cash))}
      </p>

      {size !== 'sm' && (
        <div className="flex flex-col gap-1.5 mt-2.5 pt-2.5 border-t border-edge/60">
          {money.balances.slice(0, max).map(({ account, balance }) => (
            <div key={account.id} className="flex items-center gap-2">
              <AccountFace account={account} size={22} />
              <span className="text-[12px] text-ink flex-1 truncate">{account.name}</span>
              <span className="num text-[12px] font-semibold text-ink shrink-0">
                {formatMoney(money2(balance))}
              </span>
            </div>
          ))}
          {money.balances.length > max && (
            <p className="text-[11px] text-muted">+{money.balances.length - max} más</p>
          )}
        </div>
      )}

      {money.cardDebt > 0 && size !== 'sm' && (
        <p className="text-[11px] text-muted mt-2">
          Deuda de tarjetas:{' '}
          <span className="num font-semibold" style={{ color: 'var(--c-danger)' }}>
            {formatMoney(Math.round(money.cardDebt))}
          </span>
        </p>
      )}
    </button>
  )
}

/** Tarjetas: deuda, próxima fecha de pago y avisos de interés */
export function TarjetasWidget({ ctx }: { ctx: WidgetCtx }) {
  const money = useMoney()

  if (!money.cards.length) {
    return (
      <button
        onClick={() => ctx.goto('money', 'tarjetas')}
        className="pressable widget p-4 h-full w-full text-left flex items-center gap-3"
      >
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--c-danger) 14%, transparent)', color: 'var(--c-danger)' }}
        >
          <CreditCard size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-semibold text-ink">Agrega tu tarjeta</span>
          <span className="block text-[12px] text-muted mt-0.5">
            Con su corte y fecha de pago te avisamos antes de que te cobren intereses
          </span>
        </span>
        <ArrowRight size={15} className="text-muted shrink-0" />
      </button>
    )
  }

  const urgente = money.cards.find((c) => c.statement.overdue)
    ?? money.cards.find((c) => c.statement.pending > 0 && c.statement.daysToDue <= 5)

  return (
    <button
      onClick={() => ctx.goto('money', 'tarjetas')}
      className="pressable widget p-4 h-full w-full text-left relative overflow-hidden"
      style={urgente
        ? { borderColor: 'color-mix(in oklab, var(--c-danger) 50%, var(--c-border))' }
        : undefined}
    >
      <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
        <CreditCard size={12} /> Tarjetas de crédito
      </p>
      <p className="display-money text-[25px] font-bold mt-1.5 anim-money" style={{ color: 'var(--c-danger)' }}>
        {formatMoney(Math.round(money.cardDebt))}
      </p>

      <div className="flex flex-col gap-1.5 mt-2.5 pt-2.5 border-t border-edge/60">
        {money.cards.map(({ account, statement }) => (
          <div key={account.id} className="flex items-center gap-2">
            <span className="text-[12px] text-ink flex-1 truncate">{account.name}</span>
            <span
              className="text-[10.5px] shrink-0"
              style={{ color: statement.overdue ? 'var(--c-danger)' : 'var(--c-muted)' }}
            >
              {statement.pending <= 0
                ? 'al día'
                : statement.overdue
                  ? `vencida hace ${Math.abs(statement.daysToDue)}d`
                  : `paga en ${statement.daysToDue}d`}
            </span>
            <span className="num text-[12px] font-semibold text-ink shrink-0">
              {formatMoney(money2(statement.debt))}
            </span>
          </div>
        ))}
      </div>

      {money.cardInterest > 0 && (
        <p
          className="text-[11px] mt-2 flex items-center gap-1.5"
          style={{ color: 'var(--c-danger)' }}
        >
          <AlertTriangle size={11} /> Intereses acumulados:{' '}
          <span className="num font-semibold">{formatMoney(Math.round(money.cardInterest))}</span>
        </p>
      )}
    </button>
  )
}
