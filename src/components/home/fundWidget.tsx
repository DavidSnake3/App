// Widget Saldo real: lo que tienes en el banco, en vivo (nueva funcionalidad)
import { useMemo } from 'react'
import { ArrowRight, Landmark } from 'lucide-react'
import type { WidgetSize } from '../../types/finance'
import type { WidgetCtx } from './widgetMeta'
import { useFinanceStore } from '../../store/useFinanceStore'
import { carryOver, realBalance } from '../../lib/fund'
import { movementsExpense } from '../../lib/accounts'
import { currentMonthId } from '../../lib/dates'
import { formatMoney } from '../../lib/format'

export function SaldoWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const settings = useFinanceStore((s) => s.settings)
  const accounts = useFinanceStore((s) => s.accounts)
  const installments = useFinanceStore((s) => s.installments)
  const loans = useFinanceStore((s) => s.loans)

  const saldo = useMemo(
    () => realBalance(months, debts, settings, new Date(), loans, accounts, installments),
    [months, debts, settings, loans, accounts, installments],
  )
  const arrastre = useMemo(
    () => carryOver(months, debts, settings, loans, accounts),
    [months, debts, settings, loans, accounts],
  )
  const mesActual = months[currentMonthId()]
  const movimientos = mesActual ? movementsExpense(mesActual) : 0

  if (saldo == null) {
    return (
      <button onClick={() => ctx.goto('money', 'cuentas')} className="pressable card p-4 h-full w-full text-left flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--c-income) 16%, transparent)', color: 'var(--c-income)' }}>
          <Landmark size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-semibold text-ink">Activa tu efectivo real</span>
          <span className="block text-[12px] text-muted mt-0.5">Crea tus cuentas en Dinero y la app lleva el total en vivo</span>
        </span>
        <ArrowRight size={15} className="text-muted shrink-0" />
      </button>
    )
  }

  return (
    <button onClick={() => ctx.goto('money', 'cuentas')} className="pressable card p-4 h-full w-full text-left relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--c-income), var(--app-accent))' }} />
      <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
        <Landmark size={12} /> Efectivo real
      </p>
      <p className="num text-[24px] font-bold leading-tight mt-1" style={{ color: saldo >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>
        {formatMoney(Math.round(saldo))}
      </p>
      {size !== 'sm' && (
        <p className="text-[11px] text-muted mt-1.5">
          Movimientos del mes: <span className="num font-semibold" style={{ color: movimientos > 0 ? 'var(--c-warning)' : 'var(--c-muted)' }}>{formatMoney(Math.round(movimientos))}</span>
          {arrastre !== 0 && (
            <> · Sobrante arrastrado: <span className="num font-semibold text-ink">{formatMoney(Math.round(arrastre))}</span></>
          )}
        </p>
      )}
    </button>
  )
}
