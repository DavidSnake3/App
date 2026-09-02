// Widget de inicio: los últimos movimientos del mes, con lo que entró y salió.
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Plus } from 'lucide-react'
import type { WidgetSize } from '../../types/finance'
import type { WidgetCtx } from './widgetMeta'
import { useFinanceStore } from '../../store/useFinanceStore'
import { monthMovements, movementsExpense, movementsIncome } from '../../lib/accounts'
import { categoryColor, movementIcon } from '../../lib/categories'
import { formatMoney } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { formatDate } from '../../lib/format'

export function MovimientosWidget({ size, ctx }: { size: WidgetSize; ctx: WidgetCtx }) {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const cats = useFinanceStore((s) => s.settings.categories)

  const movs = monthMovements(month)

  if (!movs.length) {
    return (
      <button
        onClick={() => ctx.goto('money', 'movimientos')}
        className="pressable widget p-4 h-full w-full text-left flex items-center gap-3"
      >
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)', color: 'var(--app-accent-soft)' }}
        >
          <Plus size={18} />
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-semibold text-ink">Anotá tu primer movimiento</span>
          <span className="block text-[12px] text-muted mt-0.5">
            Cada gasto y cada entrada, con su categoría y su cuenta
          </span>
        </span>
        <ArrowRight size={15} className="text-muted shrink-0" />
      </button>
    )
  }

  const entro = movementsIncome(month)
  const salio = movementsExpense(month)
  const max = size === 'sm' ? 2 : size === 'xl' ? 7 : 4

  return (
    <button
      onClick={() => ctx.goto('money', 'movimientos')}
      className="pressable widget p-4 h-full w-full text-left relative overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
          <ArrowLeftRight size={12} /> Movimientos del mes
        </p>
        <span className="text-[10.5px] text-muted num">{movs.length}</span>
      </div>

      {/* Lo que entró y lo que salió */}
      <div className="flex items-center gap-3 mt-1.5">
        <span className="flex items-center gap-1">
          <ArrowDownLeft size={13} style={{ color: 'var(--c-income)' }} />
          <span className="display-money text-[17px] font-bold" style={{ color: 'var(--c-income)' }}>
            {formatMoney(entro)}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <ArrowUpRight size={13} style={{ color: 'var(--c-danger)' }} />
          <span className="display-money text-[17px] font-bold" style={{ color: 'var(--c-danger)' }}>
            {formatMoney(salio)}
          </span>
        </span>
      </div>

      {size !== 'sm' && (
        <div className="flex flex-col gap-1.5 mt-2.5 pt-2.5 border-t border-edge/60">
          {movs.slice(0, max).map((m) => {
            const esIngreso = m.kind === 'ingreso'
            const color = categoryColor(m.categoryId, cats)
            return (
              <div key={m.id} className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
                >
                  <ItemIcon icon={movementIcon(m, cats)} name={m.name} size={11} />
                </span>
                <span className="text-[12px] text-ink flex-1 truncate">{m.name}</span>
                <span className="text-[10px] text-muted num shrink-0">{formatDate(m.dateISO).slice(0, 5)}</span>
                <span
                  className="num text-[12px] font-semibold shrink-0"
                  style={{ color: esIngreso ? 'var(--c-income)' : 'var(--c-text)' }}
                >
                  {esIngreso ? '+' : '−'}{formatMoney(m.amount)}
                </span>
              </div>
            )
          })}
          {movs.length > max && (
            <p className="text-[11px] text-muted">+{movs.length - max} más</p>
          )}
        </div>
      )}
    </button>
  )
}
