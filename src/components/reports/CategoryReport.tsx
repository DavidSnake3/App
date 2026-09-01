// Dashboard de movimientos por tipo: mensual, anual o rango a la medida.
import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CalendarRange, PieChart } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { accountTotals, categoryTotals, monthlySeries } from '../../lib/accounts'
import { category, categoryColor } from '../../lib/categories'
import { addMonthsToId, currentMonthId, daysInMonth, monthLabel, MONTH_SHORT } from '../../lib/dates'
import { formatMoney, formatMoneyShort } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { Segmented } from '../ui/Segmented'
import { DateField, MonthField } from '../ui/DatePicker'

type Rango = 'mes' | 'ano' | 'custom'

export function CategoryReport() {
  const months = useFinanceStore((s) => s.months)
  const accounts = useFinanceStore((s) => s.accounts)
  const cats = useFinanceStore((s) => s.settings.categories)
  const activeMonthId = useFinanceStore((s) => s.activeMonthId)

  const setActiveMonth = useFinanceStore((s) => s.setActiveMonth)
  const [rango, setRango] = useState<Rango>('mes')
  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto')
  const [desde, setDesde] = useState(`${addMonthsToId(currentMonthId(), -2)}-01`)
  const [hasta, setHasta] = useState(`${currentMonthId()}-${String(daysInMonth(currentMonthId())).padStart(2, '0')}`)

  const { fromISO, toISO, etiqueta } = useMemo(() => {
    if (rango === 'mes') {
      const mid = activeMonthId
      return {
        fromISO: `${mid}-01`,
        toISO: `${mid}-${String(daysInMonth(mid)).padStart(2, '0')}`,
        etiqueta: monthLabel(mid),
      }
    }
    if (rango === 'ano') {
      const year = activeMonthId.slice(0, 4)
      return { fromISO: `${year}-01-01`, toISO: `${year}-12-31`, etiqueta: `Año ${year}` }
    }
    return { fromISO: desde, toISO: hasta, etiqueta: 'A tu medida' }
  }, [rango, activeMonthId, desde, hasta])

  const porCategoria = useMemo(
    () => categoryTotals(months, fromISO, toISO, tipo),
    [months, fromISO, toISO, tipo],
  )
  const porCuenta = useMemo(
    () => accountTotals(months, accounts, fromISO, toISO, tipo),
    [months, accounts, fromISO, toISO, tipo],
  )
  const serie = useMemo(
    () => monthlySeries(months, fromISO.slice(0, 7), toISO.slice(0, 7)),
    [months, fromISO, toISO],
  )

  const total = porCategoria.reduce((s, c) => s + c.total, 0)

  // segmentos de la dona (precalculados: nada de mutar durante el render)
  const segmentos = useMemo(() => {
    const C = 2 * Math.PI * 54
    const top = porCategoria.slice(0, 8)
    // offsets acumulados calculados de una vez (sin mutar nada del render)
    const previos = top.map((_, i) =>
      top.slice(0, i).reduce((acc, x) => acc + (total > 0 ? x.total / total : 0) * C, 0))
    return top.map((c, i) => {
      const frac = total > 0 ? c.total / total : 0
      const dash = frac * C
      return { ...c, color: categoryColor(c.categoryId), dash, gap: C - dash, offset: -previos[i], frac }
    })
  }, [porCategoria, total])

  const maxSerie = Math.max(1, ...serie.map((x) => Math.max(x.gasto, x.ingreso)))

  return (
    <>
      <Segmented
        value={rango}
        onChange={setRango}
        options={[
          { value: 'mes', label: 'Mensual' },
          { value: 'ano', label: 'Anual' },
          { value: 'custom', label: 'A tu medida' },
        ]}
      />

      {/* Mes elegible cuando el rango es mensual */}
      {rango === 'mes' && (
        <div className="anim-fade">
          <MonthField value={activeMonthId} onChange={setActiveMonth} compact title="¿Qué mes quieres ver?" />
        </div>
      )}

      {rango === 'ano' && (
        <div className="card p-3.5 anim-fade">
          <MonthField
            value={activeMonthId}
            onChange={setActiveMonth}
            label="Año"
            title="Elige un mes de ese año"
          />
          <p className="text-[11px] text-muted mt-1.5">
            Se muestran los 12 meses del año del mes elegido.
          </p>
        </div>
      )}

      {rango === 'custom' && (
        <div className="card p-3.5 flex flex-col gap-3 anim-fade">
          <DateField value={desde} onChange={setDesde} label="Desde" />
          <DateField value={hasta} onChange={setHasta} label="Hasta" />
        </div>
      )}

      <div className="flex rounded-2xl bg-elevated border border-edge p-1 gap-1">
        {([
          { id: 'gasto' as const, label: 'Salidas', icon: <ArrowUpRight size={13} /> },
          { id: 'ingreso' as const, label: 'Entradas', icon: <ArrowDownLeft size={13} /> },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTipo(t.id)}
            className={`pressable flex-1 min-h-9 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1.5 ${
              tipo === t.id ? 'bg-card text-ink border border-edge' : 'text-muted'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Total del período */}
      <div className="card-glow p-4 anim-pop">
        <span className="glow-dot" />
        <span
          className="orb -right-6 -top-12 w-28 h-28"
          style={{
            background: tipo === 'gasto' ? 'var(--app-gradient)' : 'var(--c-income)',
            opacity: 0.28,
          }}
        />
        <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
          <CalendarRange size={12} /> {etiqueta.toUpperCase()}
        </p>
        <p className="display-money text-[32px] font-bold text-ink mt-1.5 anim-money">{formatMoney(total)}</p>
        <p className="text-[11.5px] text-muted mt-1">
          {porCategoria.reduce((s, c) => s + c.count, 0)} movimientos en{' '}
          {porCategoria.length} {porCategoria.length === 1 ? 'categoría' : 'categorías'}
        </p>
      </div>

      {total === 0 ? (
        <div className="card p-7 text-center anim-pop">
          <p className="text-[14.5px] font-semibold text-ink">Sin movimientos en este período</p>
          <p className="text-[12.5px] text-muted mt-1.5 leading-snug">
            Registra tus gastos en Dinero → Movimientos y aquí verás en qué se va tu plata,
            por categoría y por cuenta.
          </p>
        </div>
      ) : (
        <>
          {/* Dona por categoría */}
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-muted flex items-center gap-1.5">
              <PieChart size={12} /> Por categoría
            </p>
            <div className="flex items-center gap-4 mt-3">
              <svg viewBox="0 0 140 140" className="w-[136px] h-[136px] shrink-0 -rotate-90">
                <defs>
                  {segmentos.map((s, i) => (
                    <linearGradient key={`g-${s.categoryId}`} id={`seg-${i}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity="1" />
                      <stop offset="100%" stopColor={s.color} stopOpacity="0.62" />
                    </linearGradient>
                  ))}
                  <filter id="donaGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3.4" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle cx="70" cy="70" r="54" fill="none" stroke="var(--c-elevated)" strokeWidth="17" />
                <g filter="url(#donaGlow)">
                  {segmentos.map((s, i) => (
                    <circle
                      key={s.categoryId}
                      className="anim-ring"
                      cx="70"
                      cy="70"
                      r="54"
                      fill="none"
                      stroke={`url(#seg-${i})`}
                      strokeWidth={17}
                      strokeDasharray={`${s.dash} ${s.gap}`}
                      strokeDashoffset={s.offset}
                      strokeLinecap="butt"
                      style={{ animationDelay: `${i * 70}ms` }}
                    />
                  ))}
                </g>
                <text
                  x="70"
                  y="66"
                  textAnchor="middle"
                  className="display-money"
                  transform="rotate(90 70 70)"
                  style={{ fill: 'var(--c-text)', fontSize: 16, fontWeight: 700 }}
                >
                  {formatMoneyShort(total)}
                </text>
                <text
                  x="70"
                  y="80"
                  textAnchor="middle"
                  transform="rotate(90 70 70)"
                  style={{ fill: 'var(--c-muted)', fontSize: 8.5 }}
                >
                  total
                </text>
              </svg>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                {segmentos.slice(0, 5).map((s) => {
                  const c = category(cats, s.categoryId)
                  return (
                    <div key={s.categoryId} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: s.color, boxShadow: `0 0 8px 0 ${s.color}` }}
                      />
                      <span className="text-[11.5px] text-ink truncate flex-1">{c.name}</span>
                      <span className="num text-[11px] text-muted shrink-0">{Math.round(s.frac * 100)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Lista completa por categoría */}
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-muted">Detalle</p>
            <div className="flex flex-col gap-2.5 mt-3">
              {porCategoria.map((c) => {
                const cat = category(cats, c.categoryId)
                const frac = total > 0 ? c.total / total : 0
                return (
                  <div key={c.categoryId}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'var(--c-elevated)', color: categoryColor(c.categoryId) }}
                      >
                        <ItemIcon icon={cat.icon} size={14} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-medium text-ink truncate">{cat.name}</span>
                        <span className="block text-[10.5px] text-muted">
                          {c.count} {c.count === 1 ? 'movimiento' : 'movimientos'}
                        </span>
                      </span>
                      <span className="num text-[13.5px] font-bold text-ink shrink-0">
                        {formatMoney(c.total)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-elevated overflow-hidden mt-1.5">
                      <div
                        className="h-full rounded-full transition-all duration-700 bar-shine"
                        style={{
                          width: `${Math.max(2, Math.round(frac * 100))}%`,
                          background: `linear-gradient(90deg, color-mix(in oklab, ${categoryColor(c.categoryId)} 70%, #000), ${categoryColor(c.categoryId)})`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Por cuenta */}
          {porCuenta.length > 0 && (
            <div className="card p-4">
              <p className="text-[12px] font-semibold text-muted">Por cuenta</p>
              <div className="flex flex-col gap-2 mt-3">
                {porCuenta.map((a) => (
                  <div key={a.accountId} className="flex items-center gap-2">
                    <span className="text-[12.5px] text-ink flex-1 truncate">{a.name}</span>
                    <span className="num text-[11px] text-muted">{a.count}</span>
                    <span className="num text-[13px] font-semibold text-ink">{formatMoney(a.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barras por mes */}
          {serie.length > 1 && (
            <div className="card p-4">
              <p className="text-[12px] font-semibold text-muted">Mes a mes</p>
              <div className="flex items-stretch gap-1.5 mt-4 h-36">
                {serie.map((x, i) => {
                  const valor = tipo === 'gasto' ? x.gasto : x.ingreso
                  const h = Math.round((valor / maxSerie) * 100)
                  const mes = Number(x.monthId.slice(5, 7))
                  const esActual = x.monthId === currentMonthId()
                  const color = tipo === 'gasto' ? 'var(--app-accent)' : 'var(--c-income)'
                  return (
                    <div key={x.monthId} className="flex-1 h-full flex flex-col items-center gap-1 min-w-0">
                      <span className="num text-[9px] text-muted truncate w-full text-center h-3 leading-3">
                        {valor > 0 ? formatMoneyShort(valor) : ''}
                      </span>
                      {/* el área de la barra necesita altura propia para que el % funcione */}
                      <span className="flex-1 w-full flex items-end">
                        <span
                          className="w-full rounded-t-lg anim-grow block"
                          style={{
                            height: `${Math.max(2, h)}%`,
                            minHeight: 3,
                            animationDelay: `${i * 55}ms`,
                            background: `linear-gradient(180deg, ${color}, color-mix(in oklab, ${color} 35%, transparent))`,
                            boxShadow: esActual ? `0 0 14px -2px ${color}` : undefined,
                            outline: esActual ? `1px solid color-mix(in oklab, ${color} 55%, transparent)` : undefined,
                          }}
                        />
                      </span>
                      <span
                        className="text-[9.5px] h-3.5 leading-[14px]"
                        style={{
                          color: esActual ? 'var(--c-text)' : 'var(--c-muted)',
                          fontWeight: esActual ? 700 : 400,
                        }}
                      >
                        {MONTH_SHORT[mes - 1]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
