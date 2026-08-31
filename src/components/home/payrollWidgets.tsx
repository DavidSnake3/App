// Widgets de Comprobante salarial (mejoras 8 y 9) y Ahorro (mejora 15)
import { useMemo } from 'react'
import { ArrowRight, FileText, PiggyBank } from 'lucide-react'
import type { WidgetSize } from '../../types/finance'
import type { WidgetCtx } from './widgetMeta'
import { useFinanceStore } from '../../store/useFinanceStore'
import { PERIOD_LABEL, formatPayday, hasPayrollDeductions, inView, nextPaydays, payrollBreakdown } from '../../lib/payroll'
import { currentMonthId } from '../../lib/dates'
import { depositsInMonth, savingsTotal } from '../../lib/fund'
import { formatMoney, formatMoneyExact } from '../../lib/format'
import { ProgressRing } from '../ui/ProgressRing'

export function ComprobanteWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const payroll = useFinanceStore((s) => s.settings.payroll)
  const schedule = useFinanceStore((s) => s.settings.paySchedule)
  const workerType = useFinanceStore((s) => s.profile.workerType)
  const setPayroll = useFinanceStore((s) => s.setPayroll)
  const salaried = hasPayrollDeductions(workerType)
  const bd = payrollBreakdown(payroll)
  const p = payroll.viewPeriod
  const next = nextPaydays(schedule, bd, 2)

  if (payroll.gross <= 0) {
    return (
      <button onClick={() => ctx.setActiveTab('settings')} className="pressable card p-4 h-full w-full text-left flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)', color: 'var(--app-accent-soft)' }}>
          <FileText size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-semibold text-ink">
            {salaried ? 'Configura tu comprobante' : 'Configura tu ingreso'}
          </span>
          <span className="block text-[12px] text-muted mt-0.5">Diario, semanal, quincenal o mensual, en Ajustes → Ingresos</span>
        </span>
        <ArrowRight size={15} className="text-muted shrink-0" />
      </button>
    )
  }

  const rows: { label: string; value: number; neg?: boolean }[] = [
    { label: salaried ? 'Salario bruto' : 'Ingreso', value: inView(bd, bd.gross, p) },
    ...bd.statutoryRows
      .filter((r) => r.amount > 0)
      .map((r) => ({ label: `${r.name} (${r.pct}%)`, value: inView(bd, r.amount, p), neg: true })),
    ...(bd.tax > 0 ? [{ label: 'Impuesto sobre la renta', value: inView(bd, bd.tax, p), neg: true }] : []),
    ...bd.deductions.map((d) => ({ label: d.name, value: inView(bd, d.amount, p), neg: true })),
  ]

  return (
    <div className="card p-4 h-full relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--app-gradient)' }} />
      <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
        <FileText size={13} /> {salaried ? 'Comprobante salarial' : 'Mis ingresos'}
      </h3>

      {/* Vista del período: segmentado a lo ancho para que nunca se corte */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-elevated/70 border border-edge/60 p-1 mt-2.5">
        {(['weekly', 'biweekly', 'monthly'] as const).map((per) => (
          <button
            key={per}
            onClick={() => setPayroll({ viewPeriod: per })}
            className="pressable text-[11px] font-semibold rounded-lg py-1.5 transition-colors"
            style={p === per
              ? { background: 'var(--app-accent)', color: '#fff' }
              : { color: 'var(--c-muted)' }}
          >
            {PERIOD_LABEL[per]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 mt-3">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between text-[12.5px]">
            <span className="text-muted truncate pr-2">{r.label}</span>
            <span className="num font-semibold shrink-0" style={{ color: r.neg ? 'var(--c-danger)' : 'var(--c-text)' }}>
              {r.neg ? '−' : ''}{formatMoneyExact(r.value)}
            </span>
          </div>
        ))}
        {bd.advances.map((a, i) => (
          <div key={`a${i}`} className="flex items-center justify-between text-[12.5px]">
            <span className="text-muted truncate pr-2">{a.name}</span>
            <span className="num font-semibold shrink-0" style={{ color: 'var(--c-income)' }}>
              {formatMoneyExact(inView(bd, a.amount, p))}
            </span>
          </div>
        ))}
      </div>

      {/* Líquido destacado */}
      <div className="rounded-xl px-3 py-2.5 mt-2.5" style={{ background: 'color-mix(in oklab, var(--c-income) 10%, transparent)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-bold text-ink uppercase tracking-wide">Líquido {PERIOD_LABEL[p]}</span>
          <span className="num text-[19px] font-bold" style={{ color: 'var(--c-income)' }}>
            {formatMoneyExact(inView(bd, bd.net, p))}
          </span>
        </div>
      </div>

      {size !== 'sm' && next.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1">
          {next.slice(0, size === 'xl' ? 2 : 1).map((pd, i) => (
            <p key={i} className="text-[11.5px] text-muted flex items-center justify-between gap-2">
              <span className="capitalize truncate">{i === 0 ? 'Próximo pago · ' : 'Luego · '}{formatPayday(pd.date)}</span>
              <span className="num font-semibold shrink-0" style={{ color: 'var(--c-income)' }}>{formatMoney(Math.round(pd.amount))}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export function AhorroWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const settings = useFinanceStore((st) => st.settings)
  const addSavingsDeposit = useFinanceStore((st) => st.addSavingsDeposit)

  const savings = settings.savings
  const envelopes = useMemo(() => savings.envelopes ?? [], [savings.envelopes])
  const base = payrollBreakdown(settings.payroll).monthlyNet || settings.defaultSalary
  const planMensual = savings.mode === 'percent'
    ? Math.round(Math.max(0, base) * savings.value / 100)
    : savings.value

  // ahorro real de TODOS los sobres (lo que ya tenías + aportes − retiros)
  const acumulado = useMemo(() => savingsTotal(settings), [settings])
  const metaTotal = useMemo(() => envelopes.reduce((t, e) => t + Math.max(0, e.goal), 0), [envelopes])
  const nowId = currentMonthId()
  const aportadoEsteMes = useMemo(() => depositsInMonth(settings, nowId), [settings, nowId])

  if (!savings.enabled && envelopes.length === 0) {
    return (
      <button onClick={() => ctx.setActiveTab('settings')} className="pressable card p-4 h-full w-full text-left flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--c-income) 16%, transparent)', color: 'var(--c-income)' }}>
          <PiggyBank size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-semibold text-ink">Crea tu primer sobre de ahorro</span>
          <span className="block text-[12px] text-muted mt-0.5">En Ajustes → Ahorros: metas, aportes y retiros</span>
        </span>
        <ArrowRight size={15} className="text-muted shrink-0" />
      </button>
    )
  }

  const progreso = metaTotal > 0 ? Math.min(1, acumulado / metaTotal) : 0

  return (
    <div className="card p-4 h-full relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--c-income), var(--app-accent))' }} />
      <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-2.5">
        <PiggyBank size={13} /> Ahorros
      </h3>
      <div className="flex items-center gap-4">
        {metaTotal > 0 && (
          <ProgressRing progress={progreso} size={size === 'sm' ? 56 : 72} stroke={7} color="var(--c-income)">
            <span className="num text-[12px] font-bold text-ink">{Math.round(progreso * 100)}%</span>
          </ProgressRing>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted">Ahorro total</p>
          <p className="num text-[19px] font-bold leading-tight" style={{ color: 'var(--c-income)' }}>
            {formatMoney(Math.round(acumulado))}
          </p>
          {envelopes.length > 0 && size !== 'sm' && (
            <p className="text-[11px] text-muted mt-1 truncate">
              {envelopes.slice(0, 3).map((e) => e.name).join(' · ')}
              {envelopes.length > 3 && ` +${envelopes.length - 3}`}
            </p>
          )}
          {metaTotal > 0 && size !== 'sm' && (
            <p className="text-[11px] text-muted mt-0.5">
              Meta: <span className="num font-semibold text-ink">{formatMoney(metaTotal)}</span>
              {planMensual > 0 && progreso < 1 && (
                <> · ~<span className="num font-semibold text-ink">{Math.ceil(Math.max(0, metaTotal - acumulado) / planMensual)}</span> meses</>
              )}
            </p>
          )}
        </div>
      </div>
      {planMensual > 0 && (
        aportadoEsteMes >= planMensual ? (
          <p className="text-[11.5px] font-semibold mt-2.5 flex items-center gap-1" style={{ color: 'var(--c-income)' }}>
            Este mes ya apartaste {formatMoney(Math.round(aportadoEsteMes))}
          </p>
        ) : (
          <button
            onClick={() => addSavingsDeposit(planMensual - Math.max(0, aportadoEsteMes), 'Aporte del mes')}
            className="pressable mt-2.5 w-full rounded-xl py-2 text-[12.5px] font-semibold text-white"
            style={{ background: 'linear-gradient(90deg, var(--c-income), var(--app-accent))' }}
          >
            Apartar {formatMoney(planMensual - Math.max(0, aportadoEsteMes))} de este mes
          </button>
        )
      )}
    </div>
  )
}
