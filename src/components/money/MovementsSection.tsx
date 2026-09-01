import { useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Repeat, Search,
} from 'lucide-react'
import type { Movement } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { accountById, monthMovements, movementsExpense, movementsIncome } from '../../lib/accounts'
import { category, categoryColor, movementIcon } from '../../lib/categories'
import { addMonthsToId, isCurrentMonth, monthLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { MovementSheet } from './MovementSheet'

/** Movimientos del mes: lo que entró y salió, por categoría y cuenta */
export function MovementsSection() {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const accounts = useFinanceStore((s) => s.accounts)
  const cats = useFinanceStore((s) => s.settings.categories)
  const setActiveMonth = useFinanceStore((s) => s.setActiveMonth)

  const [filtro, setFiltro] = useState<'todos' | 'gasto' | 'ingreso'>('todos')
  const [busca, setBusca] = useState('')
  const [sheet, setSheet] = useState<{ open: boolean; editing: Movement | null }>({ open: false, editing: null })

  const lista = useMemo(() => {
    const base = monthMovements(month)
    const q = busca.trim().toLowerCase()
    return base
      .filter((m) => (filtro === 'todos' ? true : m.kind === filtro))
      .filter((m) => (!q ? true : m.name.toLowerCase().includes(q)
        || category(cats, m.categoryId).name.toLowerCase().includes(q)))
  }, [month, filtro, busca, cats])

  const gastos = movementsExpense(month)
  const ingresos = movementsIncome(month)

  // agrupar por día para que se lea como un estado de cuenta
  const porDia = useMemo(() => {
    const mapa = new Map<string, Movement[]>()
    for (const m of lista) {
      const arr = mapa.get(m.dateISO) ?? []
      arr.push(m)
      mapa.set(m.dateISO, arr)
    }
    return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [lista])

  return (
    <>
      {/* Mes + botón de registrar (esquina superior derecha) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveMonth(addMonthsToId(monthId, -1))}
          aria-label="Mes anterior"
          className="pressable w-9 h-9 rounded-full bg-card border border-edge flex items-center justify-center text-muted shrink-0"
        >
          <ChevronLeft size={17} />
        </button>
        <div className="text-center flex-1 min-w-0">
          <p className="text-[14px] font-bold text-ink truncate">{monthLabel(monthId)}</p>
          {isCurrentMonth(monthId) && (
            <p className="text-[10.5px] font-semibold" style={{ color: 'var(--app-accent-soft)' }}>Mes actual</p>
          )}
        </div>
        <button
          onClick={() => setActiveMonth(addMonthsToId(monthId, 1))}
          aria-label="Mes siguiente"
          className="pressable w-9 h-9 rounded-full bg-card border border-edge flex items-center justify-center text-muted shrink-0"
        >
          <ChevronRight size={17} />
        </button>
        <button
          onClick={() => setSheet({ open: true, editing: null })}
          aria-label="Registrar movimiento"
          className="pressable w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0"
          style={{ background: 'var(--app-gradient)' }}
        >
          <Plus size={19} />
        </button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 gap-2.5">
        <div
          className="tile p-3.5 anim-rise"
          style={{ background: 'linear-gradient(155deg, color-mix(in oklab, var(--c-danger) 9%, var(--c-card)) 0%, var(--c-card) 60%)' }}
        >
          <p className="text-[10.5px] text-muted flex items-center gap-1">
            <ArrowUpRight size={11} style={{ color: 'var(--c-danger)' }} /> SALIÓ
          </p>
          <p className="display-money text-[20px] font-bold text-ink mt-1">{formatMoney(gastos)}</p>
        </div>
        <div
          className="tile p-3.5 anim-rise"
          style={{
            animationDelay: '60ms',
            background: 'linear-gradient(155deg, color-mix(in oklab, var(--c-income) 9%, var(--c-card)) 0%, var(--c-card) 60%)',
          }}
        >
          <p className="text-[10.5px] text-muted flex items-center gap-1">
            <ArrowDownLeft size={11} style={{ color: 'var(--c-income)' }} /> ENTRÓ
          </p>
          <p className="display-money text-[20px] font-bold text-ink mt-1">{formatMoney(ingresos)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar…"
            className="input-base pl-9 py-2 text-[13px]"
          />
        </div>
        {(['todos', 'gasto', 'ingreso'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`chip shrink-0 ${filtro === f ? 'chip-active' : ''}`}
          >
            {f === 'todos' ? 'Todo' : f === 'gasto' ? 'Salidas' : 'Entradas'}
          </button>
        ))}
      </div>

      {/* Lista */}
      {porDia.length === 0 ? (
        <div className="card p-7 text-center anim-pop">
          <p className="text-[14.5px] font-semibold text-ink">
            {busca || filtro !== 'todos' ? 'Nada con ese filtro' : 'Sin movimientos este mes'}
          </p>
          <p className="text-[12.5px] text-muted mt-1.5 leading-snug">
            Anota el café, el súper, la gasolina… Así sabés exactamente en qué se va tu plata.
          </p>
          <button
            onClick={() => setSheet({ open: true, editing: null })}
            className="pressable btn-primary w-full mt-4"
          >
            Registrar el primero
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {porDia.map(([dia, movs]) => (
            <section key={dia}>
              <div className="flex items-center justify-between mb-2 px-0.5">
                <span className="chip-day">{diaLabel(dia)}</span>
                <p className="num text-[11px] text-muted">
                  {formatMoney(movs.reduce((s, m) => s + (m.kind === 'ingreso' ? m.amount : -m.amount), 0))}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {movs.map((m) => {
                  const cat = category(cats, m.categoryId)
                  const cuenta = accountById(accounts, m.accountId)
                  const destino = accountById(accounts, m.toAccountId)
                  const color = m.kind === 'ingreso'
                    ? 'var(--c-income)'
                    : m.kind === 'transferencia'
                      ? 'var(--app-accent-soft)'
                      : 'var(--c-text)'
                  const catColor = categoryColor(m.categoryId, cats)
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSheet({ open: true, editing: m })}
                      className="pressable tile px-3.5 py-3 flex items-center gap-3 text-left"
                      style={{ background: 'var(--c-card)' }}
                    >
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: `linear-gradient(145deg, color-mix(in oklab, ${catColor} 26%, transparent), color-mix(in oklab, ${catColor} 8%, transparent))`,
                          color: catColor,
                          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${catColor} 26%, transparent)`,
                        }}
                      >
                        {m.kind === 'transferencia'
                          ? <Repeat size={16} />
                          : <ItemIcon icon={movementIcon(m, cats)} name={m.name} size={16} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13.5px] font-semibold text-ink truncate">{m.name}</span>
                        <span className="block text-[11px] text-muted truncate">
                          {m.kind === 'transferencia'
                            ? `${cuenta?.name ?? '—'} → ${destino?.name ?? '—'}`
                            : `${cat.name}${cuenta ? ` · ${cuenta.name}` : ''}`}
                        </span>
                      </span>
                      <span className="display-money text-[15px] font-bold shrink-0" style={{ color }}>
                        {m.kind === 'ingreso' ? '+' : m.kind === 'gasto' ? '−' : ''}{formatMoney(m.amount)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <MovementSheet
        open={sheet.open}
        onClose={() => setSheet({ open: false, editing: null })}
        editing={sheet.editing}
      />
    </>
  )
}

/** "Hoy", "Ayer" o la fecha corta */
function diaLabel(iso: string): string {
  const hoy = new Date()
  const h = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  if (iso === h) return 'Hoy'
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1)
  const a = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`
  if (iso === a) return 'Ayer'
  const [, mes, dia] = iso.split('-')
  const nombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${Number(dia)} de ${nombres[Number(mes) - 1] ?? ''}`
}
