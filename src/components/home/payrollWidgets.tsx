// Widgets de Comprobante salarial (mejoras 8 y 9) y Ahorro (mejora 15)
import { useMemo } from 'react'
import { ArrowRight, FileText, PiggyBank } from 'lucide-react'
import type { WidgetSize } from '../../types/finance'
import type { WidgetCtx } from './widgetMeta'
import { useFinanceStore } from '../../store/useFinanceStore'
import { PERIOD_LABEL, formatPayday, inView, nextPaydays, payrollBreakdown } from '../../lib/payroll'
import { currentMonthId } from '../../lib/dates'
import { formatMoney, formatMoneyExact } from '../../lib/format'
import { ProgressRing } from '../ui/ProgressRing'

export function ComprobanteWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const payroll = useFinanceStore((s) => s.settings.payroll)
  const schedule = useFinanceStore((s) => s.settings.paySchedule)
  const setPayroll = useFinanceStore((s) => s.setPayroll)
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
          <span className="block text-[14px] font-semibold text-ink">Configura tu comprobante</span>
          <span className="block text-[12px] text-muted mt-0.5">Semanal, quincenal o mensual, en Ajustes → Ingresos</span>
        </span>
        <ArrowRight size={15} className="text-muted shrink-0" />
      </button>
    )
  }

  const rows: { label: string; value: number; neg?: boolean }[] = [
    { label: 'Salario bruto', value: inView(bd, bd.gross, p) },
    { label: `CCSS (${payroll.ccssPct}%)`, value: inView(bd, bd.ccss, p), neg: true },
    ...bd.deductions.map((d) => ({ label: d.name, value: inView(bd, d.amount, p), neg: true })),
  ]

  return (
    <div className="card p-4 h-full relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--app-gradient)' }} />
      <div className="flex items-center justify-between mb-2.5 gap-2">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <FileText size={13} /> Comprobante
        </h3>
        <div className="flex gap-1">
          {(['weekly', 'biweekly', 'monthly'] as const).map((per) => (
            <button
              key={per}
              onClick={() => setPayroll({ viewPeriod: per })}
              className={`pressable text-[10px] font-semibold rounded-full px-2 py-1 border ${p === per ? 'chip-active' : ''}`}
              style={{ borderColor: p === per ? undefined : 'var(--c-border)', color: p === per ? undefined : 'var(--c-muted)' }}
            >
              {PERIOD_LABEL[per]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
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
            <span className="text-muted truncate pr-2">{a.name} (adelanto: es tu pago)</span>
            <span className="num font-semibold shrink-0" style={{ color: 'var(--c-income)' }}>
              {formatMoneyExact(inView(bd, a.amount, p))}
            </span>
          </div>
        ))}
        <div className="border-t border-dashed my-1.5" style={{ borderColor: 'var(--c-border)' }} />
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-ink">LÍQUIDO {PERIOD_LABEL[p].toUpperCase()}</span>
          <span className="num text-[17px] font-bold" style={{ color: 'var(--c-income)' }}>
            {formatMoneyExact(inView(bd, bd.net, p))}
          </span>
        </div>
        {schedule.frequency === 'biweekly' && bd.monthlyNet > 0 && (
          <p className="text-[11px] text-muted mt-0.5">
            Te llega: <span className="num font-semibold text-ink">{formatMoney(Math.round(bd.monthlyNet / 2))}</span> (1ª q)
            {' + '}<span className="num font-semibold text-ink">{formatMoney(Math.round(bd.monthlyNet) - Math.round(bd.monthlyNet / 2))}</span> (2ª q)
          </p>
        )}
      </div>

      {size !== 'sm' && next.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-edge/60 flex flex-col gap-1">
          {next.slice(0, size === 'xl' ? 2 : 1).map((pd, i) => (
            <p key={i} className="text-[11.5px] text-muted">
              {i === 0 ? 'Próximo pago: ' : 'Luego: '}
              <span className="font-semibold text-ink capitalize">{formatPayday(pd.date)}</span>
              {' · '}<span className="num font-semibold" style={{ color: 'var(--c-income)' }}>{formatMoney(Math.round(pd.amount))}</span>
              {pd.label && <span> ({pd.label})</span>}
              {pd.adjusted && <span style={{ color: 'var(--c-warning)' }}> · movido por fin de semana</span>}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export function AhorroWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const savings = useFinanceStore((s) => s.settings.savings)
  const payroll = useFinanceStore((s) => s.settings.payroll)
  const defaultSalary = useFinanceStore((s) => s.settings.defaultSalary)
  const addSavingsDeposit = useFinanceStore((s) => s.addSavingsDeposit)

  const base = payrollBreakdown(payroll).monthlyNet || defaultSalary
  const planMensual = savings.mode === 'percent'
    ? Math.round(Math.max(0, base) * savings.value / 100)
    : savings.value

  // ahorro REAL: la suma de tus aportes (se registran con el botón Aportar)
  const acumulado = useMemo(() => savings.deposits.reduce((s, d) => s + d.amount, 0), [savings.deposits])
  const nowId = currentMonthId()
  const aportadoEsteMes = useMemo(
    () => savings.deposits.filter((d) => d.dateISO.slice(0, 7) === nowId).reduce((s, d) => s + d.amount, 0),
    [savings.deposits, nowId],
  )

  if (!savings.enabled) {
    return (
      <button onClick={() => ctx.setActiveTab('settings')} className="pressable card p-4 h-full w-full text-left flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--c-income) 16%, transparent)', color: 'var(--c-income)' }}>
          <PiggyBank size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-semibold text-ink">Activa tu plan de ahorro</span>
          <span className="block text-[12px] text-muted mt-0.5">Define % o monto fijo en Ajustes → Ingresos</span>
        </span>
        <ArrowRight size={15} className="text-muted shrink-0" />
      </button>
    )
  }

  const progreso = savings.goal > 0 ? Math.min(1, acumulado / savings.goal) : 0

  return (
    <div className="card p-4 h-full relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--c-income), var(--app-accent))' }} />
      <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5 mb-2.5">
        <PiggyBank size={13} /> Ahorro{savings.goalName ? ` · ${savings.goalName}` : ''}
      </h3>
      <div className="flex items-center gap-4">
        {savings.goal > 0 && (
          <ProgressRing progress={progreso} size={size === 'sm' ? 56 : 72} stroke={7} color="var(--c-income)">
            <span className="num text-[12px] font-bold text-ink">{Math.round(progreso * 100)}%</span>
          </ProgressRing>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted">Plan mensual ({savings.mode === 'percent' ? `${savings.value}% del neto` : 'monto fijo'})</p>
          <p className="num text-[18px] font-bold leading-tight" style={{ color: 'var(--c-income)' }}>{formatMoney(planMensual)}</p>
          <p className="text-[11px] text-muted mt-1.5">Ahorrado real (tus aportes)</p>
          <p className="num text-[14px] font-bold text-ink leading-tight">{formatMoney(Math.round(acumulado))}</p>
          {savings.goal > 0 && size !== 'sm' && (
            <p className="text-[11px] text-muted mt-1">
              Meta: <span className="num font-semibold text-ink">{formatMoney(savings.goal)}</span>
              {planMensual > 0 && progreso < 1 && (
                <> · ~<span className="num font-semibold text-ink">{Math.ceil(Math.max(0, savings.goal - acumulado) / planMensual)}</span> meses para llegar</>
              )}
            </p>
          )}
        </div>
      </div>
      {planMensual > 0 && (
        aportadoEsteMes >= planMensual ? (
          <p className="text-[11.5px] font-semibold mt-2.5 flex items-center gap-1" style={{ color: 'var(--c-income)' }}>
            ✓ Este mes ya apartaste {formatMoney(Math.round(aportadoEsteMes))}
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
