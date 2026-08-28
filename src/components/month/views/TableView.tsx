import type { PayableItem } from '../../../types/finance'
import { formatMoney } from '../../../lib/format'
import { getUrgency, urgencyColor } from '../../../lib/dates'
import { RECURRENCE_LABEL } from '../../../lib/finance'
import { PaidCheck } from '../ItemBits'

interface Props {
  items: PayableItem[]
  monthId: string
  onOpen: (item: PayableItem) => void
}

/** Vista tipo tabla de Excel (punto 10) */
export function TableView({ items, monthId, onOpen }: Props) {
  const total = items.reduce((s, i) => s + i.amount, 0)
  const paid = items.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0)

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-[13px] border-collapse min-w-[440px]">
        <thead>
          <tr className="text-left text-muted border-b border-edge">
            <th className="px-3 py-2.5 font-semibold w-11">✓</th>
            <th className="px-2 py-2.5 font-semibold">Nombre</th>
            <th className="px-2 py-2.5 font-semibold text-right">Monto</th>
            <th className="px-2 py-2.5 font-semibold text-center">Vence</th>
            <th className="px-2 py-2.5 font-semibold">Tipo</th>
            <th className="px-3 py-2.5 font-semibold">Frecuencia</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const u = getUrgency(monthId, it.dueDay, it.paid)
            return (
              <tr
                key={it.id}
                onClick={() => onOpen(it)}
                className="pressable border-b border-edge/60 cursor-pointer"
                style={{ background: idx % 2 ? 'color-mix(in oklab, var(--c-elevated) 55%, transparent)' : 'transparent' }}
              >
                <td className="px-2.5 py-2"><PaidCheck item={it} monthId={monthId} size={26} /></td>
                <td className={`px-2 py-2 font-medium text-ink ${it.paid ? 'line-through opacity-60' : ''}`}>
                  {it.name}
                  {it.children.length > 0 && <span className="text-muted"> ({it.children.length})</span>}
                </td>
                <td className="px-2 py-2 text-right num font-semibold text-ink">{formatMoney(it.amount)}</td>
                <td className="px-2 py-2 text-center font-semibold num" style={{ color: urgencyColor(u) }}>
                  {it.dueDay ?? '—'}
                </td>
                <td className="px-2 py-2 text-muted capitalize">{it.kind}</td>
                <td className="px-3 py-2 text-muted">{it.kind === 'deuda' ? `Cuota ${it.debtProgress?.current}/${it.debtProgress?.total}` : RECURRENCE_LABEL[it.recurrence]}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold text-ink">
            <td className="px-3 py-2.5" colSpan={2}>Total</td>
            <td className="px-2 py-2.5 text-right num">{formatMoney(total)}</td>
            <td colSpan={3} className="px-2 py-2.5 text-right text-[12px] text-muted">
              Pagado: <span className="num" style={{ color: 'var(--c-income)' }}>{formatMoney(paid)}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
