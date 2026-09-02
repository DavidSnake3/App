import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight, ArrowRight, CalendarClock, CreditCard, HandCoins,
  Lightbulb, Receipt, Wallet,
} from 'lucide-react'
import type { WidgetId, WidgetSize } from '../../types/finance'
import type { WidgetCtx } from './widgetMeta'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useMoney } from '../../hooks/useLedger'
import { monthMovements } from '../../lib/accounts'
import { loanRemaining } from '../../lib/loans'
import { buildAnnualProjection, buildMonthFlow, buildPayables, debtIsActiveInMonth, debtIsSettled, debtRemaining, getMonthSummary } from '../../lib/finance'
import { getDailyTip } from '../../lib/ai'
import { WEEKDAY_SHORT, daysInMonth, firstWeekday, getUrgency, isCurrentMonth, monthLabel, todayDay, urgencyColor, urgencyLabel } from '../../lib/dates'
import { formatMoney, formatMoneyShort, money2 } from '../../lib/format'
import { ProgressRing } from '../ui/ProgressRing'
import { LoaderDots } from '../ui/Loader'
import { PaidCheck } from '../month/ItemBits'
import { LineChart } from '../year/LineChart'
import { AhorroWidget, ComprobanteWidget } from './payrollWidgets'
import { DonaGastosWidget, PilaresWidget } from './chartWidgets'
import { SaldoWidget } from './fundWidget'
import { CuentasWidget, TarjetasWidget } from './accountWidgets'
import { DivisasWidget } from './ratesWidget'
import { MovimientosWidget } from './movementsWidget'

export function RenderWidget({ id, size, ctx }: { id: WidgetId; size: WidgetSize; ctx: WidgetCtx }) {
  switch (id) {
    case 'estado': return <EstadoWidget size={size} ctx={ctx} />
    case 'comprobante': return <ComprobanteWidget size={size} ctx={ctx} />
    case 'ahorro': return <AhorroWidget size={size} ctx={ctx} />
    case 'resumen': return <ResumenWidget />
    case 'consejo': return <ConsejoWidget />
    case 'acciones': return <AccionesWidget ctx={ctx} />
    case 'cuentas': return <CuentasWidget size={size} ctx={ctx} />
    case 'tarjetas': return <TarjetasWidget ctx={ctx} />
    case 'pendientes': return <PendientesWidget size={size} ctx={ctx} />
    case 'proyeccion': return <ProyeccionWidget size={size} />
    case 'flujo': return <FlujoWidget size={size} />
    case 'deudas': return <DeudasWidget ctx={ctx} />
    case 'calendario': return <CalendarioWidget ctx={ctx} />
    case 'dona': return <DonaGastosWidget size={size} />
    case 'pilares': return <PilaresWidget size={size} />
    case 'saldo': return <SaldoWidget size={size} ctx={ctx} />
    case 'movimientos': return <MovimientosWidget size={size} ctx={ctx} />
    case 'divisas': return <DivisasWidget size={size} />
  }
}

// ─── Widgets ─────────────────────────────────────────────────────────────────

function useMonthData() {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const debts = useFinanceStore((s) => s.debts)
  const summary = useMemo(() => (month ? getMonthSummary(month, debts) : null), [month, debts])
  const items = useMemo(() => (month ? buildPayables(month, debts) : []), [month, debts])
  return { monthId, month, debts, summary, items }
}

function EstadoWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { monthId, summary } = useMonthData()
  if (!summary) return null
  if (size === 'sm') {
    return (
      <div className="widget p-3.5 h-full flex flex-col items-center justify-center gap-1.5">
        <ProgressRing progress={summary.progress} size={64} stroke={7}>
          <span className="num text-[13px] font-bold text-ink">{Math.round(summary.progress * 100)}%</span>
          <span className="text-[8px] text-muted">pagado</span>
        </ProgressRing>
        <p className="display-money text-[16px] font-bold anim-money" style={{ color: summary.savings >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>
          {formatMoneyShort(summary.savings)}
        </p>
        <p className="text-[10px] text-muted leading-tight text-center">
          te queda en {monthLabel(monthId, true)}
        </p>
      </div>
    )
  }
  return (
    <div className="widget p-4 flex items-center gap-4">
      <ProgressRing progress={summary.progress} size={86} stroke={9}>
        <span className="num text-[17px] font-bold text-ink leading-none">{Math.round(summary.progress * 100)}%</span>
        <span className="text-[9px] text-muted mt-0.5">pagado</span>
      </ProgressRing>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-muted">{monthLabel(monthId)}</p>
        <p className="display-money text-[23px] font-bold anim-money" style={{ color: summary.savings >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>
          {formatMoney(summary.savings)}
        </p>
        <p className="text-[11.5px] text-muted mt-1">
          {summary.countPaid} de {summary.countTotal} pagos · pendiente {formatMoney(summary.pendingAmount)}
        </p>
        <button
          onClick={() => ctx.setActiveTab('month')}
          className="pressable mt-2 text-[12.5px] font-semibold inline-flex items-center gap-1"
          style={{ color: 'var(--app-accent-soft)' }}
        >
          Ver mi mes <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

function ResumenWidget() {
  const { items, summary } = useMonthData()
  const daily = useMemo(() => {
    const today = todayDay()
    const pending = items.filter((i) => !i.paid && i.dueDay)
    return {
      dueToday: pending.filter((i) => i.dueDay === today),
      overdue: pending.filter((i) => (i.dueDay ?? 99) < today),
      upcoming: [...pending.filter((i) => (i.dueDay ?? 0) > today)].sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)).slice(0, 4),
    }
  }, [items])

  return (
    <div className="widget p-4 h-full">
      <div className="flex items-center gap-2 mb-2.5">
        <CalendarClock size={16} className="text-accent-soft" />
        <h3 className="text-[13.5px] font-semibold text-muted">Tu día en pagos</h3>
      </div>
      {daily.overdue.length === 0 && daily.dueToday.length === 0 && daily.upcoming.length === 0 ? (
        <p className="text-[13.5px] text-ink">
          Nada vence hoy. {summary?.allPaid ? '¡Mes al día, disfruta!' : 'Vas bien, respira.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {daily.overdue.length > 0 && (
            <p className="text-[13.5px] font-medium" style={{ color: 'var(--c-overdue)' }}>
              {daily.overdue.length} pago{daily.overdue.length === 1 ? '' : 's'} vencido{daily.overdue.length === 1 ? '' : 's'} · {formatMoney(daily.overdue.reduce((s, i) => s + i.amount, 0))}
            </p>
          )}
          {daily.dueToday.length > 0 && (
            <p className="text-[13.5px] font-medium" style={{ color: 'var(--c-danger)' }}>
              Hoy vence{daily.dueToday.length === 1 ? '' : 'n'}: {daily.dueToday.map((i) => i.name).join(', ')} · {formatMoney(daily.dueToday.reduce((s, i) => s + i.amount, 0))}
            </p>
          )}
          {daily.upcoming.length > 0 && (
            <p className="text-[12.5px] text-muted">
              Próximos: {daily.upcoming.map((i) => `${i.name} (d${i.dueDay})`).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ConsejoWidget() {
  const [tip, setTip] = useState<{ tip: string } | null>(null)

  // Consejo local del día (la IA ahora vive solo en el chatbot Snake)
  useEffect(() => {
    let alive = true
    getDailyTip('', false).then((t) => { if (alive) setTip(t) })
    return () => { alive = false }
  }, [])

  return (
    <div className="widget p-4 flex gap-3 h-full" style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 40%, var(--c-border))' }}>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--app-accent) 18%, transparent)' }}>
        <Lightbulb size={17} style={{ color: 'var(--c-warning)' }} />
      </span>
      <div className="flex-1">
        <p className="text-[11.5px] font-semibold text-muted">Consejo del día</p>
        <p className="text-[13.5px] text-ink leading-relaxed mt-0.5">
          {tip?.tip ?? <span className="text-muted"><LoaderDots /></span>}
        </p>
      </div>
    </div>
  )
}

function AccionesWidget({ ctx }: { ctx: WidgetCtx }) {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const debts = useFinanceStore((s) => s.debts)
  const loans = useFinanceStore((s) => s.loans)
  const money = useMoney()

  const movs = monthMovements(month).length
  const cuotas = debts.filter((d) => debtIsActiveInMonth(d, monthId) && !d.payments[monthId]?.paid).length
  const prestados = loans.filter((l) => loanRemaining(l) > 0).length

  const accesos = [
    { label: 'Movimientos', icon: <ArrowLeftRight size={18} />, color: 'var(--app-accent)', badge: movs, go: () => ctx.goto('money', 'movimientos') },
    { label: 'Deudas', icon: <Receipt size={18} />, color: 'var(--c-danger)', badge: cuotas, go: () => ctx.goto('month', 'deudas') },
    { label: 'Cuentas', icon: <Wallet size={18} />, color: 'var(--c-income)', badge: money.balances.length, go: () => ctx.goto('money', 'cuentas') },
    { label: 'Tarjeta', icon: <CreditCard size={18} />, color: '#38bdf8', badge: money.cards.length, go: () => ctx.goto('money', 'tarjetas') },
    { label: 'Le presté', icon: <HandCoins size={18} />, color: 'var(--c-warning)', badge: prestados, go: () => ctx.goto('money', 'prestamos') },
  ]

  return (
    <div className="grid grid-cols-5 gap-1.5 h-full">
      {accesos.map((a, i) => (
        <Accion key={a.label} {...a} delay={i * 45} />
      ))}
    </div>
  )
}

function Accion({ icon, label, color, badge, go, delay }: {
  icon: React.ReactNode
  label: string
  color: string
  badge?: number
  go: () => void
  delay: number
}) {
  return (
    <button
      onClick={go}
      className="pressable widget relative flex flex-col items-center justify-center gap-1.5 py-3 px-0.5 overflow-hidden anim-rise"
      style={{
        animationDelay: `${delay}ms`,
        background: `linear-gradient(160deg, color-mix(in oklab, ${color} 13%, var(--c-card)) 0%, var(--c-card) 68%)`,
        borderColor: `color-mix(in oklab, ${color} 26%, var(--c-border))`,
      }}
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{
          background: `linear-gradient(145deg, ${color}, color-mix(in oklab, ${color} 52%, #000))`,
          color: '#fff',
          boxShadow: `0 6px 16px -9px ${color}`,
        }}
      >
        {icon}
      </span>
      <span className="text-[9.5px] font-semibold leading-none text-center tracking-tight text-ink w-full truncate px-0.5">
        {label}
      </span>
      {Boolean(badge) && (
        <span
          className="num absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
          style={{ background: `color-mix(in oklab, ${color} 22%, var(--c-elevated))`, color }}
        >
          {badge! > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function PendientesWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const { monthId, items } = useMonthData()
  const pending = [...items.filter((i) => !i.paid)].sort((a, b) => (a.dueDay ?? 32) - (b.dueDay ?? 32))
  const max = size === 'sm' ? 3 : size === 'xl' ? 8 : 5

  return (
    <div className="widget overflow-hidden h-full">
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted">Pendientes</h3>
        <button onClick={() => ctx.setActiveTab('month')} className="pressable text-[11.5px] font-semibold" style={{ color: 'var(--app-accent-soft)' }}>
          Ver todos
        </button>
      </div>
      {pending.length === 0 ? (
        <p className="text-[13px] text-muted px-3.5 pb-3.5">Todo pagado por ahora. Excelente.</p>
      ) : (
        <div className="divide-y divide-[var(--c-border)]">
          {pending.slice(0, max).map((it) => {
            const u = getUrgency(monthId, it.dueDay, it.paid)
            return (
              <div key={it.id} className="flex items-center gap-2.5 px-3.5 py-2">
                <PaidCheck item={it} monthId={monthId} size={28} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium text-ink truncate">{it.name}</p>
                  <p className="text-[10.5px]" style={{ color: urgencyColor(u) }}>{urgencyLabel(u)}</p>
                </div>
                {size === 'lg' && <span className="num text-[13px] font-semibold text-ink">{formatMoney(it.amount)}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProyeccionWidget({ size }: { size: WidgetSize }) {
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const settings = useFinanceStore((s) => s.settings)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const projection = useMemo(
    () => buildAnnualProjection(months, debts, settings, monthId),
    [months, debts, settings, monthId],
  )
  return (
    <div className="widget p-3.5 h-full">
      <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted mb-2">Proyección anual</h3>
      <LineChart
        height={size === 'sm' ? 110 : size === 'xl' ? 215 : 150}
        labels={projection.months.map((m) => m.label.split(' ')[0])}
        series={[
          { name: 'Ingresos', color: 'var(--chart-income)', values: projection.months.map((m) => m.income) },
          { name: 'Ahorro', color: 'var(--chart-savings)', values: projection.months.map((m) => m.savings) },
          { name: 'Gastos', color: 'var(--chart-expense)', values: projection.months.map((m) => m.expenses) },
        ]}
      />
    </div>
  )
}

function FlujoWidget({ size }: { size: WidgetSize }) {
  const { monthId, month, debts } = useMonthData()
  const payday = useFinanceStore((s) => s.profile.payday)
  const flow = useMemo(() => (month ? buildMonthFlow(month, debts, payday) : []), [month, debts, payday])
  if (!flow.length) return null
  return (
    <div className="widget p-3.5 h-full">
      <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted mb-2">Flujo de {monthLabel(monthId, true)}</h3>
      <LineChart
        height={size === 'xl' ? 200 : 120}
        labels={flow.map((p) => String(p.day))}
        series={[{ name: 'Balance', color: 'var(--chart-savings)', values: flow.map((p) => p.balance) }]}
      />
    </div>
  )
}

function DeudasWidget({ ctx }: { ctx: WidgetCtx }) {
  const debts = useFinanceStore((s) => s.debts)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const active = debts.filter((d) => !debtIsSettled(d))
  const totalRemaining = active.reduce((s, d) => s + debtRemaining(d), 0)
  const monthlyLoad = active.filter((d) => debtIsActiveInMonth(d, monthId)).reduce((s, d) => s + d.monthlyPayment, 0)
  return (
    <button onClick={() => ctx.goto('month', 'deudas')} className="pressable widget p-3.5 h-full w-full text-left flex flex-col justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-muted">
        <CreditCard size={13} /> Deudas
      </span>
      <span>
        <span className="block num text-[17px] font-bold text-ink leading-tight">{formatMoneyShort(totalRemaining)}</span>
        <span className="block text-[10.5px] text-muted">saldo pendiente</span>
      </span>
      <span>
        <span className="block num text-[14px] font-semibold leading-tight" style={{ color: 'var(--c-warning)' }}>{formatMoneyShort(monthlyLoad)}</span>
        <span className="block text-[10.5px] text-muted">cuotas de este mes</span>
      </span>
    </button>
  )
}

function CalendarioWidget({ ctx }: { ctx: WidgetCtx }) {
  const { monthId, items } = useMonthData()
  const days = daysInMonth(monthId)
  const offset = firstWeekday(monthId)
  const today = isCurrentMonth(monthId) ? todayDay() : -1

  // Qué se paga cada día (mejora 9): monto, cuántos y si ya está pagado
  const byDay = new Map<number, { paid: boolean; t: number; amount: number; count: number }>()
  for (const it of items) {
    if (!it.dueDay) continue
    const d = Math.min(it.dueDay, days)
    const u = getUrgency(monthId, it.dueDay, it.paid)
    const prev = byDay.get(d)
    byDay.set(d, {
      paid: (prev?.paid ?? true) && it.paid,
      t: Math.max(prev?.t ?? 0, u.t),
      amount: (prev?.amount ?? 0) + it.amount,
      count: (prev?.count ?? 0) + 1,
    })
  }

  // próximo día con pagos pendientes
  const pendientes = [...byDay.entries()].filter(([, v]) => !v.paid).sort((a, b) => a[0] - b[0])
  const proximo = pendientes.find(([d]) => today < 0 || d >= today) ?? pendientes[0]
  const hoyInfo = today > 0 ? byDay.get(today) : undefined

  return (
    <button onClick={() => ctx.setActiveTab('month')} className="pressable widget p-3 h-full w-full text-left">
      <span className="flex items-center justify-between mb-1.5">
        <span className="block text-[12px] font-bold uppercase tracking-wider text-muted">{monthLabel(monthId, true)}</span>
        <span className="flex items-center gap-2 text-[8.5px] text-muted">
          <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--c-danger)' }} /> pendiente</span>
          <span className="flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--c-income)' }} /> pagado</span>
        </span>
      </span>
      <span className="grid grid-cols-7 gap-[3px]">
        {WEEKDAY_SHORT.map((d, i) => (
          <span key={`h${i}`} className="text-center text-[8px] font-semibold text-muted">{d}</span>
        ))}
        {Array.from({ length: offset }).map((_, i) => <span key={`x${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1
          const info = byDay.get(day)
          return (
            <span
              key={day}
              className="relative aspect-square rounded-[5px] flex items-center justify-center text-[8px] num"
              style={{
                background: day === today
                  ? 'var(--app-gradient)'
                  : info
                    ? info.paid
                      ? 'color-mix(in oklab, var(--c-income) 26%, transparent)'
                      : `color-mix(in oklab, var(--c-danger) ${18 + info.t * 42}%, transparent)`
                    : 'var(--c-elevated)',
                color: day === today ? '#fff' : info ? 'var(--c-text)' : 'var(--c-muted)',
                fontWeight: day === today || info ? 800 : 500,
                boxShadow: day === today
                  ? '0 4px 12px -4px color-mix(in oklab, var(--app-accent) 70%, transparent)'
                  : undefined,
              }}
            >
              {day}
              {info && (
                <i
                  className="absolute bottom-[1px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: info.paid ? 'var(--c-income)' : 'var(--c-danger)' }}
                />
              )}
            </span>
          )
        })}
      </span>
      {/* Qué toca pagar (mejora 9) */}
      <span className="block mt-2 pt-1.5 border-t border-edge/60 text-[10.5px] text-muted">
        {hoyInfo && !hoyInfo.paid ? (
          <>
            <span className="font-bold" style={{ color: 'var(--c-danger)' }}>Hoy pagas</span>
            {' '}<span className="num font-semibold text-ink">{formatMoney(money2(hoyInfo.amount))}</span>
            {hoyInfo.count > 1 && <> · {hoyInfo.count} pagos</>}
          </>
        ) : proximo ? (
          <>
            Próximo pago: <span className="num font-semibold text-ink">día {proximo[0]}</span>
            {' · '}<span className="num font-semibold" style={{ color: 'var(--c-warning)' }}>{formatMoney(Math.round(proximo[1].amount))}</span>
            {proximo[1].count > 1 && <> ({proximo[1].count})</>}
          </>
        ) : (
          <>Todo pagado este mes. Excelente.</>
        )}
      </span>
    </button>
  )
}


