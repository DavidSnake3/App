// Camino a cero deudas: cuánto debes hoy, cómo baja mes a mes y cuándo
// quedas libre (nueva funcionalidad 5)
import { useMemo } from 'react'
import { PartyPopper } from 'lucide-react'
import type { Debt } from '../../types/finance'
import { debtEndMonthId, debtIsSettled, debtRemaining } from '../../lib/finance'
import { addMonthsToId, currentMonthId, monthDiff, monthLabel } from '../../lib/dates'
import { formatMoney, formatMoneyShort } from '../../lib/format'

/** Saldo TOTAL planificado que quedará después de pagar la cuota del mes m */
function plannedRemaining(debts: Debt[], monthId: string): number {
  return debts.reduce((sum, d) => {
    const elapsed = Math.max(0, Math.min(d.installments, monthDiff(d.startMonthId, monthId) + 1))
    return sum + Math.max(0, d.total - d.monthlyPayment * elapsed)
  }, 0)
}

export function DebtTrend({ debts }: { debts: Debt[] }) {
  const nowId = currentMonthId()
  const active = debts.filter((d) => !debtIsSettled(d))

  const data = useMemo(() => {
    if (!active.length) return null
    const end = active.map(debtEndMonthId).sort().pop()!
    const start = addMonthsToId(nowId, -2)
    const span = monthDiff(start, end) + 1
    if (span < 2) return null
    // máx. ~12 barras: si el plan es largo, muestrear cada n meses
    const step = Math.max(1, Math.ceil(span / 12))
    const points: { id: string; value: number }[] = []
    for (let i = 0; i < span; i += step) {
      const id = addMonthsToId(start, i)
      points.push({ id, value: plannedRemaining(active, id) })
    }
    if (points[points.length - 1]?.id !== end) points.push({ id: end, value: 0 })
    const hoy = active.reduce((s, d) => s + debtRemaining(d), 0)
    const inicial = active.reduce((s, d) => s + d.total, 0)
    return { points, end, hoy, inicial, mesesLibre: monthDiff(nowId, end) }
  }, [active, nowId])

  if (!data) return null
  const max = Math.max(1, ...data.points.map((p) => p.value), data.hoy)
  const pagadoPct = data.inicial > 0 ? Math.round((1 - data.hoy / data.inicial) * 100) : 0

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11.5px] font-semibold text-muted">Tu camino a cero deudas</p>
          <p className="num text-[22px] font-bold text-ink leading-tight mt-0.5">{formatMoney(Math.round(data.hoy))}</p>
          <p className="text-[11px] text-muted">debes hoy · ya pagaste el <span className="num font-semibold" style={{ color: 'var(--c-income)' }}>{pagadoPct}%</span></p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-muted inline-flex items-center gap-1">
            <PartyPopper size={11} style={{ color: 'var(--c-income)' }} /> Libre de deudas
          </p>
          <p className="text-[12.5px] font-bold text-ink capitalize">{monthLabel(data.end, true)}</p>
          {data.mesesLibre > 0 && <p className="text-[10.5px] text-muted">en {data.mesesLibre} mes{data.mesesLibre === 1 ? '' : 'es'}</p>}
        </div>
      </div>

      <div className="flex items-end gap-1 mt-3" style={{ height: 64 }}>
        {data.points.map((p) => {
          const isNow = p.id === nowId
          return (
            <div key={p.id} className="flex-1 flex flex-col items-center justify-end h-full" title={`${monthLabel(p.id, true)}: ${formatMoney(Math.round(p.value))}`}>
              <div
                className="w-full rounded-t"
                style={{
                  height: Math.max(2, (p.value / max) * 52),
                  background: isNow ? 'var(--app-gradient)' : 'color-mix(in oklab, var(--c-danger) 55%, transparent)',
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9.5px] text-muted capitalize">{monthLabel(data.points[0].id, true)}</span>
        <span className="text-[9.5px] font-semibold capitalize" style={{ color: 'var(--c-income)' }}>
          {monthLabel(data.end, true)} · {formatMoneyShort(0)}
        </span>
      </div>
    </div>
  )
}
