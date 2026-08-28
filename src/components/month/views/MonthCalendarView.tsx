import { useState } from 'react'
import type { PayableItem } from '../../../types/finance'
import { WEEKDAY_SHORT, daysInMonth, firstWeekday, getUrgency, isCurrentMonth, todayDay, urgencyColor } from '../../../lib/dates'
import { formatMoneyShort } from '../../../lib/format'
import { ListView } from './ListView'

interface Props {
  items: PayableItem[]
  monthId: string
  onOpen: (item: PayableItem) => void
}

/** Vista calendario del mes (punto 10) */
export function MonthCalendarView({ items, monthId, onOpen }: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const days = daysInMonth(monthId)
  const offset = firstWeekday(monthId)
  const today = isCurrentMonth(monthId) ? todayDay() : -1

  const byDay = new Map<number, PayableItem[]>()
  for (const it of items) {
    if (!it.dueDay) continue
    const d = Math.min(it.dueDay, days)
    byDay.set(d, [...(byDay.get(d) ?? []), it])
  }
  const noDate = items.filter((i) => !i.dueDay)
  const dayItems = selectedDay ? (byDay.get(selectedDay) ?? []) : []

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-3">
        <div className="grid grid-cols-7 mb-1.5">
          {WEEKDAY_SHORT.map((d, i) => (
            <span key={i} className="text-center text-[11px] font-semibold text-muted py-1">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }).map((_, i) => <span key={`x${i}`} />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1
            const list = byDay.get(day) ?? []
            const pend = list.filter((x) => !x.paid)
            const isToday = day === today
            const selected = day === selectedDay
            const worst = pend.length
              ? pend.map((x) => getUrgency(monthId, x.dueDay, false)).sort((a, b) => b.t - a.t)[0]
              : null
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(selected ? null : day)}
                aria-label={`Día ${day}${list.length ? `, ${list.length} pagos` : ''}`}
                className="pressable relative rounded-xl flex flex-col items-center justify-start pt-1 pb-1 min-h-[52px] border transition-colors"
                style={{
                  borderColor: selected ? 'var(--app-accent)' : isToday ? 'color-mix(in oklab, var(--app-accent) 55%, transparent)' : 'transparent',
                  background: selected
                    ? 'color-mix(in oklab, var(--app-accent) 16%, transparent)'
                    : list.length ? 'var(--c-elevated)' : 'transparent',
                }}
              >
                <span
                  className={`text-[12.5px] num ${isToday ? 'font-bold' : 'font-medium'}`}
                  style={{ color: isToday ? 'var(--app-accent-soft)' : 'var(--c-text)' }}
                >
                  {day}
                </span>
                {list.length > 0 && (
                  <>
                    <span className="flex gap-0.5 mt-0.5">
                      {list.slice(0, 3).map((x) => (
                        <span
                          key={x.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: x.paid ? 'var(--c-income)' : urgencyColor(getUrgency(monthId, x.dueDay, false)) }}
                        />
                      ))}
                    </span>
                    <span className="text-[9px] num mt-0.5" style={{ color: worst ? urgencyColor(worst) : 'var(--c-income)' }}>
                      {formatMoneyShort(list.reduce((s, x) => s + x.amount, 0))}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDay !== null && (
        <div className="anim-page">
          <h4 className="text-[13px] font-semibold text-muted mb-2 px-1">
            Pagos del día {selectedDay}
          </h4>
          {dayItems.length
            ? <ListView items={dayItems} monthId={monthId} onOpen={onOpen} />
            : <p className="text-[13px] text-muted px-1">Sin pagos este día.</p>}
        </div>
      )}

      {noDate.length > 0 && selectedDay === null && (
        <div>
          <h4 className="text-[13px] font-semibold text-muted mb-2 px-1">Sin fecha asignada</h4>
          <ListView items={noDate} monthId={monthId} onOpen={onOpen} />
        </div>
      )}
    </div>
  )
}
