import { useRef } from 'react'
import { Check } from 'lucide-react'
import type { PayableItem } from '../../types/finance'
import { getUrgency, urgencyColor, urgencyLabel } from '../../lib/dates'
import { useFinanceStore } from '../../store/useFinanceStore'
import { payBurst } from '../../lib/fx'

/**
 * Botón de check: marca pagado con confeti y sonido.
 *
 * El anillo se llena a medias cuando el pago tiene adelantos o cuando es una
 * lista de compras y ya llevás cosas en el carrito.
 */
export function PaidCheck({ item, monthId, size = 40, onShoppingTap }: {
  item: PayableItem
  monthId: string
  size?: number
  /** en una lista sin cerrar, el check abre la lista en vez de pagar */
  onShoppingTap?: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const togglePaid = useFinanceStore((s) => s.togglePaid)
  const toggleDebtPaid = useFinanceStore((s) => s.toggleDebtPaid)
  const toggleShoppingDone = useFinanceStore((s) => s.toggleShoppingDone)
  const prefs = useFinanceStore((s) => s.settings.animations)

  // anillo a medias: lo que llevo en el carrito, o lo ya adelantado
  const pct = item.paid
    ? 1
    : item.shopping && !item.shopping.done
      ? (item.shopping.total > 0 ? Math.min(1, item.shopping.checkedTotal / item.shopping.total) : 0)
      : (item.amount > 0 ? Math.min(1, item.advanced / item.amount) : 0)

  const handle = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Una lista nunca pasa por togglePaid directo: el movimiento tiene que
    // salir por lo MARCADO, no por lo planeado.
    if (item.shopping) {
      if (!item.shopping.done && onShoppingTap) { onShoppingTap(); return }
      if (!item.paid) payBurst(ref.current, prefs)
      toggleShoppingDone(monthId, item.refId)
      return
    }
    if (!item.paid) payBurst(ref.current, prefs)
    if (item.source === 'expense') togglePaid(monthId, item.refId)
    else toggleDebtPaid(item.refId, monthId)
  }

  return (
    <button
      ref={ref}
      onClick={handle}
      aria-label={item.paid
        ? `Desmarcar ${item.name}`
        : pct > 0
          ? `Marcar ${item.name} como pagado · ${Math.round(pct * 100)}% cubierto`
          : `Marcar ${item.name} como pagado`}
      className="pressable rounded-full flex items-center justify-center border-2 transition-all duration-200 shrink-0"
      style={{
        width: size,
        height: size,
        borderColor: item.paid || pct > 0 ? 'var(--c-income)' : 'var(--c-border)',
        background: item.paid
          ? 'var(--c-income)'
          : pct > 0
            ? `conic-gradient(color-mix(in oklab, var(--c-income) 55%, transparent) ${pct * 360}deg, transparent 0deg)`
            : 'transparent',
        color: item.paid ? '#08281c' : 'var(--c-muted)',
      }}
    >
      <Check size={size * 0.45} strokeWidth={3} style={{ opacity: item.paid ? 1 : 0.35 }} />
    </button>
  )
}

/** Badge de vencimiento que se pone rojo al acercarse la fecha (punto 11) */
export function DueBadge({ item, monthId }: { item: PayableItem; monthId: string }) {
  const u = getUrgency(monthId, item.dueDay, item.paid)
  const color = urgencyColor(u)
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] font-medium rounded-full px-2 py-0.5"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        ...(u.level === 'urgent' || u.level === 'overdue'
          ? { animation: 'pulseSoft 1.6s ease-in-out infinite' }
          : {}),
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {urgencyLabel(u)}
    </span>
  )
}

export function KindTag({ kind }: { kind: PayableItem['kind'] }) {
  const map = {
    servicio: { label: 'Servicio', color: 'var(--app-accent-soft)' },
    deuda: { label: 'Deuda', color: 'var(--c-warning)' },
    gasto: { label: 'Gasto', color: 'var(--c-muted)' },
    personal: { label: 'Personal', color: 'var(--c-income)' },
  } as const
  const { label, color } = map[kind]
  return (
    <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color }}>
      {label}
    </span>
  )
}
