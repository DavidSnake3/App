import type { PayableItem } from '../../../types/finance'
import { daysInMonth, getUrgency, isCurrentMonth, todayDay, urgencyColor } from '../../../lib/dates'
import { formatMoneyShort } from '../../../lib/format'
import { PaidCheck } from '../ItemBits'

interface Props {
  items: PayableItem[]
  monthId: string
  onOpen: (item: PayableItem) => void
}

/** Vista Gantt del mes: barras hasta la fecha de vencimiento (punto 10) */
export function GanttView({ items, monthId, onOpen }: Props) {
  const days = daysInMonth(monthId)
  const today = isCurrentMonth(monthId) ? todayDay() : -1
  const withDate = items.filter((i) => i.dueDay)
  const noDate = items.filter((i) => !i.dueDay)

  return (
    <div className="card p-3 overflow-x-auto">
      <div className="min-w-[480px]">
        {/* regla de días */}
        <div className="flex items-center mb-2">
          <span className="w-[128px] shrink-0" />
          <div className="relative flex-1 h-5">
            {[1, 5, 10, 15, 20, 25, days].map((d) => (
              <span
                key={d}
                className="absolute text-[10px] num text-muted -translate-x-1/2"
                style={{ left: `${((d - 0.5) / days) * 100}%` }}
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          {/* línea de hoy */}
          {today > 0 && (
            <span
              className="absolute top-0 bottom-0 w-px z-10"
              style={{ left: `calc(128px + (100% - 128px) * ${(today - 0.5) / days})`, background: 'var(--app-accent)' }}
            />
          )}

          {withDate.map((it) => {
            const u = getUrgency(monthId, it.dueDay, it.paid)
            const color = it.paid ? 'var(--c-income)' : urgencyColor(u)
            const end = Math.min(it.dueDay ?? days, days)
            return (
              <div key={it.id} className="flex items-center gap-2 py-1.5 border-b border-edge/40 last:border-0">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpen(it)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onOpen(it) }}
                  className="pressable w-[128px] shrink-0 flex items-center gap-2 min-w-0"
                >
                  <PaidCheck item={it} monthId={monthId} size={24} />
                  <span className={`text-[12px] font-medium text-ink truncate ${it.paid ? 'line-through opacity-60' : ''}`}>
                    {it.name}
                  </span>
                </div>
                <div className="relative flex-1 h-6 rounded-lg bg-elevated/70 overflow-hidden">
                  <div
                    className="absolute top-1 bottom-1 left-0 rounded-md flex items-center justify-end pr-1.5"
                    style={{
                      width: `${(end / days) * 100}%`,
                      background: `linear-gradient(90deg, color-mix(in oklab, ${color} 18%, transparent), ${color})`,
                      opacity: it.paid ? 0.45 : 0.9,
                    }}
                  >
                    <span className="text-[9.5px] num font-bold" style={{ color: 'rgb(255 255 255 / 0.95)' }}>
                      {formatMoneyShort(it.amount)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {noDate.length > 0 && (
          <p className="text-[11.5px] text-muted mt-2 px-1">
            {noDate.length} pago{noDate.length === 1 ? '' : 's'} sin fecha no se muestran en el Gantt.
          </p>
        )}
      </div>
    </div>
  )
}
