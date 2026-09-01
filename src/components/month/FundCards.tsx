// Tarjeta del Mes: Movimientos (antes "gastos hormiga").
// Cada movimiento lleva categoría, cuenta y fecha; el detalle completo vive en
// Dinero → Movimientos.
import { useMemo, useState } from 'react'
import { ArrowLeftRight, ChevronRight, Plus, X } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { monthMovements, movementsExpense } from '../../lib/accounts'
import { category, movementIcon } from '../../lib/categories'
import { formatMoney } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { MovementSheet } from '../money/MovementSheet'

/** Resumen de los movimientos del mes con acceso rápido para anotar */
export function MovementsCard() {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const cats = useFinanceStore((s) => s.settings.categories)
  const deleteMovement = useFinanceStore((s) => s.deleteMovement)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)
  const setSub = useFinanceStore((s) => s.setSub)

  const [sheet, setSheet] = useState(false)
  const [open, setOpen] = useState(false)

  // corte de la semana: estable durante el render (regla de pureza)
  const [weekAgo] = useState(() => new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))

  const movs = useMemo(() => monthMovements(month), [month])

  // en qué se fue más este mes
  const top = useMemo(() => {
    const acc = new Map<string, number>()
    for (const m of movs) {
      if (m.kind !== 'gasto') continue
      acc.set(m.categoryId, (acc.get(m.categoryId) ?? 0) + m.amount)
    }
    return [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [movs])

  if (!month) return null

  const totalMes = movementsExpense(month)
  const totalSemana = movs
    .filter((m) => m.kind === 'gasto' && m.dateISO >= weekAgo)
    .reduce((s, m) => s + m.amount, 0)

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--app-accent) 15%, transparent)' }}
        >
          <ArrowLeftRight size={16} style={{ color: 'var(--app-accent-soft)' }} />
        </span>
        <button onClick={() => setOpen(!open)} className="pressable flex-1 min-w-0 text-left">
          <span className="block text-[13.5px] font-semibold text-ink">Movimientos del mes</span>
          <span className="block text-[11.5px] text-muted">
            Salió <span className="num font-semibold text-ink">{formatMoney(Math.round(totalMes))}</span>
            {' · '}esta semana <span className="num font-semibold text-ink">{formatMoney(Math.round(totalSemana))}</span>
          </span>
        </button>
        <button
          onClick={() => setSheet(true)}
          aria-label="Registrar movimiento"
          className="pressable w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ background: 'var(--app-gradient)' }}
        >
          <Plus size={17} />
        </button>
      </div>

      {/* En qué se fue */}
      {top.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          {top.map(([catId, monto]) => {
            const c = category(cats, catId)
            return (
              <span key={catId} className="chip shrink-0">
                <ItemIcon icon={c.icon} size={12} /> {c.name}
                <span className="num font-semibold text-ink ml-0.5">{formatMoney(Math.round(monto))}</span>
              </span>
            )
          })}
        </div>
      )}

      {open && (
        <div className="mt-3 anim-fade flex flex-col gap-1.5">
          {movs.length === 0 ? (
            <p className="text-[12px] text-muted">
              Todavía no anotaste nada este mes. Toca + para registrar el primero.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--c-border)]">
              {movs.slice(0, 6).map((m) => (
                <div key={m.id} className="flex items-center gap-2 py-1.5">
                  <span className="text-muted shrink-0">
                    <ItemIcon icon={movementIcon(m, cats)} name={m.name} size={13} />
                  </span>
                  <span className="text-[12.5px] text-ink flex-1 truncate">{m.name}</span>
                  <span className="text-[10.5px] text-muted num">
                    {m.dateISO.slice(8, 10)}/{m.dateISO.slice(5, 7)}
                  </span>
                  <span
                    className="num text-[12.5px] font-semibold"
                    style={{ color: m.kind === 'ingreso' ? 'var(--c-income)' : 'var(--c-text)' }}
                  >
                    {m.kind === 'ingreso' ? '+' : '−'}{formatMoney(m.amount)}
                  </span>
                  <button
                    onClick={() => deleteMovement(m.id)}
                    aria-label={`Quitar ${m.name}`}
                    className="pressable w-6 h-6 rounded-full flex items-center justify-center text-muted"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => { setActiveTab('money'); setSub('money', 'movimientos') }}
            className="pressable text-[12px] font-semibold flex items-center justify-center gap-1 mt-1"
            style={{ color: 'var(--app-accent-soft)' }}
          >
            Ver todos los movimientos <ChevronRight size={13} />
          </button>
        </div>
      )}

      <MovementSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  )
}
