import type { PayableItem } from '../../../types/finance'
import { formatMoney } from '../../../lib/format'
import { getUrgency, urgencyColor, urgencyLabel } from '../../../lib/dates'
import { PaidCheck } from '../ItemBits'
import { ItemIcon } from '../../../lib/icons'
import { itemColor } from '../../../lib/itemColors'

interface Props {
  items: PayableItem[]
  monthId: string
  onOpen: (item: PayableItem) => void
}

/** Vista de lista compacta (punto 10) */
export function ListView({ items, monthId, onOpen }: Props) {
  return (
    <div className="card overflow-hidden divide-y divide-[var(--c-border)]">
      {items.map((it) => {
        const u = getUrgency(monthId, it.dueDay, it.paid)
        const tinte = itemColor(it)
        return (
          <div
            key={it.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(it)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(it) } }}
            className="pressable w-full flex items-center gap-3 px-3.5 py-3 text-left bg-transparent"
            style={{ opacity: it.paid ? 0.65 : 1 }}
          >
            <PaidCheck item={it} monthId={monthId} size={32} />
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(145deg, ${tinte}, color-mix(in oklab, ${tinte} 55%, #000))`,
                color: '#fff',
                boxShadow: `0 4px 12px -8px ${tinte}`,
              }}
            >
              <ItemIcon icon={it.icon} name={it.name} kind={it.kind} size={13} />
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-[14.5px] font-medium text-ink truncate ${it.paid ? 'line-through' : ''}`}>
                {it.name}
              </p>
              <p className="text-[11.5px]" style={{ color: urgencyColor(u) }}>
                {urgencyLabel(u)}
              </p>
            </div>
            <span className="num text-[15px] font-semibold text-ink shrink-0">
              {formatMoney(it.amount)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
