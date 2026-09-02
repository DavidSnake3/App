// El reporte de UN mes: se abre al tocar su tarjeta en el calendario anual.
// Muestra lo que entró, lo que de verdad salió y en qué se fue, sin sacar al
// usuario de Reportes.
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { buildPayables, getMonthSummary } from '../../lib/finance'
import { monthSpend } from '../../lib/fund'
import { movementsIncome } from '../../lib/accounts'
import { monthLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { BottomSheet } from '../ui/BottomSheet'

const TIPOS: { key: 'servicio' | 'gasto' | 'personal' | 'deuda' | 'movimientos'; label: string; color: string }[] = [
  { key: 'servicio', label: 'Servicios', color: 'var(--c-danger)' },
  { key: 'gasto', label: 'Gastos', color: 'var(--c-warning)' },
  { key: 'personal', label: 'Personales', color: '#ec4899' },
  { key: 'deuda', label: 'Deudas', color: 'var(--app-accent)' },
  { key: 'movimientos', label: 'Movimientos', color: '#94a3b8' },
]

export function MonthReportSheet({ monthId, onClose }: { monthId: string | null; onClose: () => void }) {
  const months = useFinanceStore((s) => s.months)
  const month = monthId ? months[monthId] : undefined

  return (
    <BottomSheet
      open={Boolean(monthId)}
      onClose={onClose}
      title={monthId ? monthLabel(monthId) : 'Mes'}
      subtitle="Lo que entró, lo que salió y en qué se fue"
    >
      {month && monthId && <Contenido monthId={monthId} />}
    </BottomSheet>
  )
}

function Contenido({ monthId }: { monthId: string }) {
  const month = useFinanceStore((s) => s.months[monthId])
  const debts = useFinanceStore((s) => s.debts)
  if (!month) return null

  const resumen = getMonthSummary(month, debts)
  const gasto = monthSpend(month, debts)
  const entro = resumen.totalIncome + movementsIncome(month)
  const balance = entro - gasto.total
  const items = buildPayables(month, debts)
  const pendiente = items.filter((i) => !i.paid).reduce((s, i) => s + i.remaining, 0)
  const maximo = Math.max(1, ...TIPOS.map((t) => gasto[t.key]))

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* Entró y salió */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="card-soft p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <ArrowDownLeft size={12} style={{ color: 'var(--c-income)' }} /> Entró
          </p>
          <p className="display-money text-[19px] font-bold mt-1" style={{ color: 'var(--c-income)' }}>
            {formatMoney(entro)}
          </p>
        </div>
        <div className="card-soft p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <ArrowUpRight size={12} style={{ color: 'var(--c-danger)' }} /> Salió
          </p>
          <p className="display-money text-[19px] font-bold mt-1" style={{ color: 'var(--c-danger)' }}>
            {formatMoney(gasto.total)}
          </p>
        </div>
      </div>

      <div
        className="rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2"
        style={{ background: `color-mix(in oklab, ${balance >= 0 ? 'var(--c-income)' : 'var(--c-danger)'} 12%, transparent)` }}
      >
        <span className="text-[12.5px] text-ink">{balance >= 0 ? 'Te quedó' : 'Te faltó'}</span>
        <span className="num text-[16px] font-bold" style={{ color: balance >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>
          {formatMoney(Math.abs(balance))}
        </span>
      </div>

      {/* En qué se fue: solo lo pagado de verdad */}
      {gasto.total > 0 ? (
        <div>
          <p className="text-[12px] font-semibold text-muted mb-2">En qué se fue</p>
          <div className="flex flex-col gap-2">
            {TIPOS.filter((t) => gasto[t.key] > 0).map((t) => (
              <div key={t.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] text-ink flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-[3px]" style={{ background: t.color }} />
                    {t.label}
                  </span>
                  <span className="num text-[12.5px] font-semibold text-ink">
                    {formatMoney(gasto[t.key])}
                    <span className="text-[10.5px] text-muted font-normal">
                      {' '}{Math.round((gasto[t.key] / gasto.total) * 100)}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-elevated overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((gasto[t.key] / maximo) * 100)}%`, background: t.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[12.5px] text-muted text-center py-2">
          Todavía no salió plata en {monthLabel(monthId)}.
        </p>
      )}

      {/* Cómo va el mes */}
      <div className="card overflow-hidden divide-y divide-[var(--c-border)]">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <CheckCircle2 size={15} style={{ color: 'var(--c-income)' }} />
          <span className="text-[12.5px] text-ink flex-1">Pagos hechos</span>
          <span className="num text-[13px] font-semibold text-ink">
            {resumen.countPaid} de {resumen.countTotal}
          </span>
        </div>
        {pendiente > 0 && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
            <Clock size={15} style={{ color: 'var(--c-warning)' }} />
            <span className="text-[12.5px] text-ink flex-1">Falta por pagar</span>
            <span className="num text-[13px] font-semibold" style={{ color: 'var(--c-warning)' }}>
              {formatMoney(pendiente)}
            </span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted leading-snug">
        Aquí solo se cuenta lo que ya pagaste o adelantaste. Lo pendiente aparece aparte.
      </p>
    </div>
  )
}
