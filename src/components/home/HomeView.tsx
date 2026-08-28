import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, CalendarClock, CreditCard, FileSpreadsheet, HandCoins,
  Lightbulb, Plus, Sparkles, Wallet,
} from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { buildPayables, getMonthSummary } from '../../lib/finance'
import { financeSnapshot } from '../../lib/plans'
import { getDailyTip } from '../../lib/ai'
import { getUrgency, greeting, longToday, monthLabel, urgencyColor, urgencyLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { ProgressRing } from '../ui/ProgressRing'
import { PaidCheck } from '../month/ItemBits'
import { PlansSheet } from '../debts/PlansSheet'
import { buildWorkbook, downloadWorkbook } from '../../lib/excel'

/** Menú de inicio (puntos 5, 16, 18) */
export function HomeView() {
  const profile = useFinanceStore((s) => s.profile)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const aiEnabled = useFinanceStore((s) => s.settings.aiEnabled)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)

  const [tip, setTip] = useState<{ tip: string; fromAI: boolean } | null>(null)
  const [plansOpen, setPlansOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const summary = useMemo(() => (month ? getMonthSummary(month, debts) : null), [month, debts])
  const items = useMemo(() => (month ? buildPayables(month, debts) : []), [month, debts])

  // Resumen diario (punto 18)
  const daily = useMemo(() => {
    const today = new Date().getDate()
    const pending = items.filter((i) => !i.paid && i.dueDay)
    return {
      dueToday: pending.filter((i) => i.dueDay === today),
      overdue: pending.filter((i) => (i.dueDay ?? 99) < today),
      upcoming: [...pending.filter((i) => (i.dueDay ?? 0) > today)].sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)).slice(0, 4),
    }
  }, [items])

  // Consejo del día (punto 16)
  useEffect(() => {
    const ctx = month ? financeSnapshot(month, debts, profile) : 'Sin datos todavía.'
    let alive = true
    getDailyTip(ctx, aiEnabled).then((t) => { if (alive) setTip(t) })
    return () => { alive = false }
  }, [month, debts, profile, aiEnabled])

  const exportExcel = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await buildWorkbook(months, debts, profile, monthId)
      await downloadWorkbook(blob, `SNBusiness-${monthId}.xlsx`)
    } catch { /* silencioso */ }
    setExporting(false)
  }

  if (!summary) return null

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-28 pt-2 flex flex-col gap-4">

        {/* Saludo */}
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-muted capitalize">{longToday()}</p>
            <h1 className="font-display text-[24px] font-bold text-ink leading-tight">
              {greeting()}{profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
            </h1>
          </div>
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-display font-bold text-[16px] shrink-0"
            style={{ background: 'var(--app-gradient)' }}
            aria-hidden="true"
          >
            {(profile.name || 'S').charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Estado del mes con anillo de progreso */}
        <div className="card p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--app-gradient)' }} />
          <ProgressRing progress={summary.progress} size={86} stroke={9}>
            <span className="num text-[17px] font-bold text-ink leading-none">{Math.round(summary.progress * 100)}%</span>
            <span className="text-[9px] text-muted mt-0.5">pagado</span>
          </ProgressRing>
          <div className="flex-1">
            <p className="text-[12px] text-muted">{monthLabel(monthId)}</p>
            <p className="num text-[21px] font-bold leading-tight" style={{ color: summary.savings >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>
              {formatMoney(summary.savings)}
            </p>
            <p className="text-[11.5px] text-muted mt-1">
              {summary.countPaid} de {summary.countTotal} pagos · pendiente {formatMoney(summary.pendingAmount)}
            </p>
            <button
              onClick={() => setActiveTab('month')}
              className="pressable mt-2 text-[12.5px] font-semibold inline-flex items-center gap-1"
              style={{ color: 'var(--app-accent-soft)' }}
            >
              Ver mi mes <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Resumen diario (punto 18) */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <CalendarClock size={16} className="text-accent-soft" />
            <h3 className="text-[13.5px] font-semibold text-muted">Tu día en pagos</h3>
          </div>
          {daily.overdue.length === 0 && daily.dueToday.length === 0 && daily.upcoming.length === 0 ? (
            <p className="text-[13.5px] text-ink">
              Nada vence hoy. {summary.allPaid ? '¡Mes al día, disfruta!' : 'Vas bien, respira.'}
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

        {/* Consejo del día (punto 16) */}
        <div
          className="card p-4 flex gap-3"
          style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 40%, var(--c-border))' }}
        >
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--app-accent) 18%, transparent)' }}>
            <Lightbulb size={17} style={{ color: 'var(--c-warning)' }} />
          </span>
          <div className="flex-1">
            <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
              Consejo del día {tip?.fromAI && <Sparkles size={11} style={{ color: 'var(--app-accent-soft)' }} />}
            </p>
            <p className="text-[13.5px] text-ink leading-relaxed mt-0.5">
              {tip?.tip ?? 'Cargando consejo…'}
            </p>
          </div>
        </div>

        {/* Acciones rápidas (punto 5) */}
        <div className="grid grid-cols-4 gap-2.5">
          <QuickAction icon={<Plus size={19} />} label="Gasto" onClick={() => setActiveTab('month')} primary />
          <QuickAction icon={<CreditCard size={18} />} label="Deudas" onClick={() => setActiveTab('debts')} />
          <QuickAction icon={<HandCoins size={18} />} label="Planes" onClick={() => setPlansOpen(true)} />
          <QuickAction
            icon={<FileSpreadsheet size={18} className={exporting ? 'animate-pulse' : ''} />}
            label={exporting ? '…' : 'Excel'}
            onClick={exportExcel}
          />
        </div>

        {/* Próximos pagos */}
        {items.filter((i) => !i.paid).length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-muted">Pagos pendientes</h3>
              <button onClick={() => setActiveTab('month')} className="pressable text-[12px] font-semibold" style={{ color: 'var(--app-accent-soft)' }}>
                Ver todos
              </button>
            </div>
            <div className="card overflow-hidden divide-y divide-[var(--c-border)]">
              {[...items.filter((i) => !i.paid)]
                .sort((a, b) => (a.dueDay ?? 32) - (b.dueDay ?? 32))
                .slice(0, 5)
                .map((it) => {
                  const u = getUrgency(monthId, it.dueDay, it.paid)
                  return (
                    <div key={it.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <PaidCheck item={it} monthId={monthId} size={30} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-ink truncate">{it.name}</p>
                        <p className="text-[11px]" style={{ color: urgencyColor(u) }}>{urgencyLabel(u)}</p>
                      </div>
                      <span className="num text-[14px] font-semibold text-ink">{formatMoney(it.amount)}</span>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {summary.countTotal === 0 && (
          <button onClick={() => setActiveTab('month')} className="pressable card p-6 text-center">
            <Wallet size={26} className="mx-auto mb-2" style={{ color: 'var(--app-accent-soft)' }} />
            <p className="text-[15px] font-semibold text-ink">Empieza tu mes</p>
            <p className="text-[13px] text-muted mt-1">Agrega tu salario, servicios y gastos</p>
          </button>
        )}
      </div>

      <PlansSheet open={plansOpen} onClose={() => setPlansOpen(false)} />
    </div>
  )
}

function QuickAction({ icon, label, onClick, primary }: {
  icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="pressable card flex flex-col items-center gap-1.5 py-3.5"
      style={primary ? { background: 'var(--app-gradient)', border: 'none' } : undefined}
    >
      <span style={{ color: primary ? '#fff' : 'var(--app-accent-soft)' }}>{icon}</span>
      <span className="text-[11.5px] font-semibold" style={{ color: primary ? '#fff' : 'var(--c-text)' }}>{label}</span>
    </button>
  )
}
