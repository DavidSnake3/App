import { ChevronRight, Layers, RefreshCw } from 'lucide-react'
import type { PayableItem } from '../../../types/finance'
import { formatMoney } from '../../../lib/format'
import { getUrgency, urgencyColor } from '../../../lib/dates'
import { RECURRENCE_LABEL } from '../../../lib/finance'
import { DueBadge, KindTag, PaidCheck } from '../ItemBits'

interface Props {
  items: PayableItem[]
  monthId: string
  onOpen: (item: PayableItem) => void
}

/** Vista de tarjetas personalizadas con progresión del mes (puntos 10 y 15) */
export function CardsView({ items, monthId, onOpen }: Props) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it, i) => {
        const u = getUrgency(monthId, it.dueDay, it.paid)
        const edge = urgencyColor(u)
        return (
          <div
            key={it.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(it)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(it) } }}
            className="pressable card p-4 text-left w-full relative overflow-hidden"
            style={{
              animation: `fadeSlideIn 0.3s ease both`,
              animationDelay: `${Math.min(i * 35, 280)}ms`,
              opacity: it.paid ? 0.72 : 1,
            }}
          >
            {/* barra lateral de urgencia (punto 11) */}
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: edge }} />

            <div className="flex items-center gap-3.5">
              <PaidCheck item={it} monthId={monthId} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <KindTag kind={it.kind} />
                  {it.recurrence !== 'once' && it.kind !== 'deuda' && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-muted">
                      <RefreshCw size={10} /> {RECURRENCE_LABEL[it.recurrence]}
                    </span>
                  )}
                </div>
                <p className={`text-[15.5px] font-semibold text-ink truncate mt-0.5 ${it.paid ? 'line-through decoration-2 decoration-[var(--c-income)]/60' : ''}`}>
                  {it.name}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <DueBadge item={it} monthId={monthId} />
                  {it.children.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
                      <Layers size={11} /> {it.children.length} sub-ítems
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="num text-[17px] font-bold text-ink">{formatMoney(it.amount)}</p>
                <ChevronRight size={15} className="ml-auto mt-1 text-muted" />
              </div>
            </div>

            {/* progreso de deuda: cuota n/m (punto 15) */}
            {it.debtProgress && (
              <div className="mt-3 pl-[54px]">
                <div className="flex justify-between text-[11px] text-muted mb-1">
                  <span>Cuota {it.debtProgress.current} de {it.debtProgress.total}</span>
                  <span>Restan {formatMoney(it.debtProgress.remaining)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(((it.debtProgress.current - (it.paid ? 0 : 1)) / it.debtProgress.total) * 100)}%`,
                      background: 'var(--app-gradient)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
