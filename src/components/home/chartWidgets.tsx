import { useMemo } from 'react'
import type { WidgetSize } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { getMonthSummary } from '../../lib/finance'
import { addMonthsToId, currentMonthId, monthLabel } from '../../lib/dates'
import { formatMoney, formatMoneyShort } from '../../lib/format'

/* Colores fijos por tipo de pago (consistentes en toda la app) */
const KIND_COLORS = {
  servicios: 'var(--app-accent)',
  gastos: 'var(--c-warning)',
  personales: '#ec4899',
  deudas: 'var(--c-danger)',
} as const

const KIND_LABELS = {
  servicios: 'Servicios',
  gastos: 'Gastos',
  personales: 'Personales',
  deudas: 'Deudas',
} as const

type Kind = keyof typeof KIND_COLORS

/* ─── Dona: ¿en qué se va tu dinero este mes? ──────────────────────────────── */

export function DonaGastosWidget({ size }: { size: WidgetSize }) {
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const monthId = useFinanceStore((s) => s.activeMonthId)

  const s = useMemo(() => {
    const m = months[monthId]
    return m ? getMonthSummary(m, debts) : null
  }, [months, debts, monthId])

  const parts = useMemo(() => {
    if (!s) return []
    return (Object.keys(KIND_COLORS) as Kind[])
      .map((k) => ({ k, label: KIND_LABELS[k], color: KIND_COLORS[k], value: s[k] }))
      .filter((p) => p.value > 0)
  }, [s])

  const total = s?.totalExpenses ?? 0

  if (!s || total <= 0) {
    return (
      <div className="widget p-4 h-full flex flex-col items-center justify-center text-center">
        <p className="text-[13px] font-semibold text-ink">¿En qué se va tu dinero?</p>
        <p className="text-[12px] text-muted mt-1">Agrega pagos este mes y aquí verás la dona por tipo.</p>
      </div>
    )
  }

  // Segmentos de la dona con strokeDasharray sobre la circunferencia
  const R = 40
  const C = 2 * Math.PI * R
  let acc = 0
  const segs = parts.map((p) => {
    const frac = p.value / total
    const seg = { ...p, frac, offset: acc }
    acc += frac
    return seg
  })

  const libre = s.totalIncome - total
  const compact = size === 'sm'

  return (
    <div className="widget p-4 h-full flex flex-col">
      <p className="text-[11.5px] font-semibold text-muted">¿En qué se va tu dinero? · {monthLabel(monthId, true)}</p>
      <div className={`flex items-center gap-4 mt-2 flex-1 ${compact ? 'flex-col !gap-2' : ''}`}>
        <div className="relative shrink-0" style={{ width: compact ? 92 : 118, height: compact ? 92 : 118 }}>
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <defs>
              {segs.map((p, i) => (
                <linearGradient key={`hg-${p.k}`} id={`home-dona-${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={p.color} stopOpacity="1" />
                  <stop offset="100%" stopColor={p.color} stopOpacity="0.6" />
                </linearGradient>
              ))}
              <filter id="homeDonaGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--c-border)" strokeWidth="13" opacity="0.5" />
            <g filter="url(#homeDonaGlow)">
              {segs.map((p, i) => (
                <circle
                  key={p.k}
                  className="anim-ring"
                  cx="50" cy="50" r={R} fill="none"
                  stroke={`url(#home-dona-${i})`} strokeWidth="13" strokeLinecap="butt"
                  strokeDasharray={`${Math.max(0.5, p.frac * C - 1.5)} ${C}`}
                  strokeDashoffset={-p.offset * C}
                  style={{ animationDelay: `${i * 70}ms` }}
                />
              ))}
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="display-money text-[14px] font-bold text-ink">{formatMoneyShort(total)}</span>
            <span className="text-[9.5px] text-muted mt-0.5">total</span>
          </div>
        </div>
        <div className="flex-1 w-full flex flex-col gap-1.5 min-w-0">
          {segs.map((p) => (
            <div key={p.k} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: p.color, boxShadow: `0 0 8px 0 ${p.color}` }}
              />
              <span className="text-[12px] text-ink flex-1 truncate">{p.label}</span>
              <span className="num text-[12px] font-semibold text-ink shrink-0">{formatMoneyShort(p.value)}</span>
              <span className="num text-[10.5px] text-muted w-9 text-right shrink-0">{Math.round(p.frac * 100)}%</span>
            </div>
          ))}
          {!compact && s.totalIncome > 0 && (
            <div className="flex items-center gap-2 pt-1 mt-0.5 border-t border-dashed" style={{ borderColor: 'var(--c-border)' }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--c-income)' }} />
              <span className="text-[12px] text-ink flex-1">Te queda libre</span>
              <span className="num text-[12px] font-bold shrink-0" style={{ color: libre >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>
                {formatMoney(Math.round(libre))}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Pilares: ingresos vs gastos de los últimos 6 meses ───────────────────── */

export function PilaresWidget({ size }: { size: WidgetSize }) {
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const monthId = useFinanceStore((s) => s.activeMonthId)

  const data = useMemo(() => {
    const n = size === 'sm' ? 4 : 6
    const out: { id: string; label: string; income: number; expenses: number }[] = []
    for (let i = n - 1; i >= 0; i--) {
      const id = addMonthsToId(monthId, -i)
      const m = months[id]
      if (!m) continue
      const s = getMonthSummary(m, debts)
      out.push({ id, label: monthLabel(id, true).slice(0, 3), income: s.totalIncome, expenses: s.totalExpenses })
    }
    return out
  }, [months, debts, monthId, size])

  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]))

  if (data.length < 2) {
    return (
      <div className="widget p-4 h-full flex flex-col items-center justify-center text-center">
        <p className="text-[13px] font-semibold text-ink">Ingresos vs gastos</p>
        <p className="text-[12px] text-muted mt-1">Cuando tengas 2+ meses con datos verás aquí la comparación en pilares.</p>
      </div>
    )
  }

  const H = 96 // alto útil de los pilares en px

  return (
    <div className="widget p-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] font-semibold text-muted">Ingresos vs gastos</p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <span className="w-2 h-2 rounded-[3px]" style={{ background: 'var(--c-income)' }} /> Ingresos
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted">
            <span className="w-2 h-2 rounded-[3px]" style={{ background: 'var(--c-danger)' }} /> Gastos
          </span>
        </div>
      </div>
      <div className="flex-1 flex items-end gap-2 mt-3" style={{ minHeight: H + 34 }}>
        {data.map((d, i) => {
          const ok = d.income >= d.expenses
          const esActual = d.id === currentMonthId()
          return (
            <div key={d.id} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="num text-[9.5px] font-semibold leading-none" style={{ color: ok ? 'var(--c-income)' : 'var(--c-danger)' }}>
                {ok ? '+' : '−'}{formatMoneyShort(Math.abs(d.income - d.expenses))}
              </span>
              <div className="flex items-end gap-[3px]" style={{ height: H }}>
                <div
                  className="w-[13px] rounded-t-md anim-grow"
                  style={{
                    height: Math.max(3, (d.income / max) * H),
                    background: 'linear-gradient(180deg, var(--c-income), color-mix(in oklab, var(--c-income) 30%, transparent))',
                    animationDelay: `${i * 60}ms`,
                    boxShadow: esActual ? '0 0 12px -2px var(--c-income)' : undefined,
                  }}
                  title={`Ingresos: ${formatMoney(d.income)}`}
                />
                <div
                  className="w-[13px] rounded-t-md anim-grow"
                  style={{
                    height: Math.max(3, (d.expenses / max) * H),
                    background: 'linear-gradient(180deg, var(--c-danger), color-mix(in oklab, var(--c-danger) 30%, transparent))',
                    animationDelay: `${i * 60 + 30}ms`,
                    boxShadow: esActual ? '0 0 12px -2px var(--c-danger)' : undefined,
                  }}
                  title={`Gastos: ${formatMoney(d.expenses)}`}
                />
              </div>
              <span className={`text-[10px] capitalize ${d.id === monthId ? 'font-bold text-ink' : 'text-muted'}`}>{d.label}</span>
            </div>
          )
        })}
      </div>
      <p className="text-[10.5px] text-muted mt-1.5">El número de arriba es tu balance del mes (lo que te sobró o faltó).</p>
    </div>
  )
}
