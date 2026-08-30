// Widget Saldo real: lo que tienes en el banco, en vivo (nueva funcionalidad)
import { useMemo } from 'react'
import { ArrowRight, Landmark } from 'lucide-react'
import type { WidgetSize } from '../../types/finance'
import type { WidgetCtx } from './widgetMeta'
import { useFinanceStore } from '../../store/useFinanceStore'
import { carryOver, hormigasTotal, realBalance } from '../../lib/fund'
import { currentMonthId } from '../../lib/dates'
import { formatMoney } from '../../lib/format'

export function SaldoWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const settings = useFinanceStore((s) => s.settings)

  const saldo = useMemo(() => realBalance(months, debts, settings), [months, debts, settings])
  const arrastre = useMemo(() => carryOver(months, debts, settings), [months, debts, settings])
  const mesActual = months[currentMonthId()]
  const hormigas = mesActual ? hormigasTotal(mesActual) : 0

  if (saldo == null) {
    return (
      <button onClick={() => ctx.setActiveTab('month')} className="pressable card p-4 h-full w-full text-left flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--c-income) 16%, transparent)', color: 'var(--c-income)' }}>
          <Landmark size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-semibold text-ink">Activa tu saldo real</span>
          <span className="block text-[12px] text-muted mt-0.5">En Mes: escribe cuánto tienes hoy y la app lo lleva en vivo</span>
        </span>
        <ArrowRight size={15} className="text-muted shrink-0" />
      </button>
    )
  }

  return (
    <button onClick={() => ctx.setActiveTab('month')} className="pressable card p-4 h-full w-full text-left relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--c-income), var(--app-accent))' }} />
      <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
        <Landmark size={12} /> Saldo real (tu banco)
      </p>
      <p className="num text-[24px] font-bold leading-tight mt-1" style={{ color: saldo >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>
        {formatMoney(Math.round(saldo))}
      </p>
      {size !== 'sm' && (
        <p className="text-[11px] text-muted mt-1.5">
          Hormigas del mes: <span className="num font-semibold" style={{ color: hormigas > 0 ? 'var(--c-warning)' : 'var(--c-muted)' }}>{formatMoney(Math.round(hormigas))}</span>
          {arrastre !== 0 && (
            <> · Sobrante arrastrado: <span className="num font-semibold text-ink">{formatMoney(Math.round(arrastre))}</span></>
          )}
        </p>
      )}
    </button>
  )
}
