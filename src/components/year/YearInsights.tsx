// Dashboards del año (mejora 15) y Reporte financiero por período (mejora 16).
// El reporte sigue el formato estándar de un ESTADO DE FLUJO DE EFECTIVO
// PERSONAL + BALANCE PERSONAL (activos − pasivos = patrimonio neto), que es
// la plantilla que usan bancos y asesores para finanzas personales.
import { useMemo, useState } from 'react'
import { ChartColumnBig, ChartPie, FileText, Landmark, Share2, TrendingUp } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { debtRemaining, getMonthSummary } from '../../lib/finance'
import { hormigasTotal, depositsInMonth, kindTotals, realBalance, savingsTotal } from '../../lib/fund'
import { movementsExpense } from '../../lib/accounts'
import { MONTH_SHORT, addMonthsToId, currentMonthId, monthIdOf, monthLabel } from '../../lib/dates'
import { formatMoney, formatMoneyShort } from '../../lib/format'
import { buildStatementBlob } from '../../lib/shareCard'
import { downloadWorkbook } from '../../lib/excel'
import { withLoading } from '../../store/useLoading'

const KIND_COLORS: Record<string, string> = {
  servicio: 'var(--app-accent)',
  gasto: 'var(--c-warning)',
  personal: '#ec4899',
  deuda: 'var(--c-danger)',
}

/* ─── Dashboards del año ───────────────────────────────────────────────────── */

export function YearCharts({ year }: { year: number }) {
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const settings = useFinanceStore((s) => s.settings)

  const data = useMemo(() => {
    const ids = Array.from({ length: 12 }, (_, i) => monthIdOf(year, i + 1))
    const rows = ids.map((id, i) => {
      const m = months[id]
      if (!m) return { id, label: MONTH_SHORT[i], income: 0, expenses: 0, has: false }
      const s = getMonthSummary(m, debts)
      const movs = movementsExpense(m) + hormigasTotal(m)
      return { id, label: MONTH_SHORT[i], income: s.totalIncome, expenses: s.totalExpenses + movs, has: true }
    })
    // dona: distribución del año por tipo
    const acc: Record<string, number> = { servicio: 0, gasto: 0, personal: 0, deuda: 0 }
    let movimientos = 0
    for (const id of ids) {
      const m = months[id]
      if (!m) continue
      for (const k of kindTotals(m, debts)) acc[k.kind] += k.total
      movimientos += movementsExpense(m) + hormigasTotal(m)
    }
    const parts = [
      { key: 'servicio', label: 'Servicios', value: acc.servicio },
      { key: 'gasto', label: 'Gastos', value: acc.gasto },
      { key: 'personal', label: 'Personales', value: acc.personal },
      { key: 'deuda', label: 'Deudas', value: acc.deuda },
      { key: 'movimiento', label: 'Movimientos', value: movimientos },
    ].filter((p) => p.value > 0)
    const totalGasto = parts.reduce((s, p) => s + p.value, 0)
    // offsets de la dona ya calculados (sin mutar nada durante el render)
    let run = 0
    const segments = parts.map((p) => {
      const frac = totalGasto > 0 ? p.value / totalGasto : 0
      const seg = { ...p, frac, offset: run }
      run += frac
      return seg
    })
    return { rows, parts, segments, totalGasto, conDatos: rows.filter((r) => r.has).length }
  }, [months, debts, year])

  const saldo = realBalance(months, debts, settings)
  const ahorro = savingsTotal(settings)
  const maxBar = Math.max(1, ...data.rows.flatMap((r) => [r.income, r.expenses]))

  if (data.conDatos === 0) return null

  const R = 40
  const C = 2 * Math.PI * R

  return (
    <>
      {/* Dona anual */}
      {data.totalGasto > 0 && (
        <section className="card p-4">
          <h3 className="text-[14px] font-bold text-ink font-display mb-1 flex items-center gap-2">
            <ChartPie size={15} style={{ color: 'var(--app-accent-soft)' }} /> ¿En qué se fue tu año?
          </h3>
          <p className="text-[11.5px] text-muted mb-3">Total gastado en {year}: <span className="num font-semibold text-ink">{formatMoney(Math.round(data.totalGasto))}</span></p>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: 118, height: 118 }}>
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <defs>
                  {data.segments.map((p, i) => {
                    const col = KIND_COLORS[p.key] ?? 'var(--c-muted)'
                    return (
                      <linearGradient key={`ag-${p.key}`} id={`anual-${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={col} stopOpacity="1" />
                        <stop offset="100%" stopColor={col} stopOpacity="0.6" />
                      </linearGradient>
                    )
                  })}
                  <filter id="anualGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.6" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--c-border)" strokeWidth="13" opacity="0.5" />
                <g filter="url(#anualGlow)">
                  {data.segments.map((p, i) => (
                    <circle
                      key={p.key}
                      className="anim-ring"
                      cx="50" cy="50" r={R} fill="none"
                      stroke={`url(#anual-${i})`}
                      strokeWidth="13"
                      strokeDasharray={`${Math.max(0.5, p.frac * C - 1.5)} ${C}`}
                      strokeDashoffset={-p.offset * C}
                      style={{ animationDelay: `${i * 70}ms` }}
                    />
                  ))}
                </g>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="display-money text-[14px] font-bold text-ink">{formatMoneyShort(data.totalGasto)}</span>
                <span className="text-[9.5px] text-muted mt-0.5">{year}</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              {data.parts.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      background: KIND_COLORS[p.key] ?? 'var(--c-muted)',
                      boxShadow: `0 0 8px 0 ${KIND_COLORS[p.key] ?? 'transparent'}`,
                    }}
                  />
                  <span className="text-[12px] text-ink flex-1 truncate">{p.label}</span>
                  <span className="num text-[12px] font-semibold text-ink shrink-0">{formatMoneyShort(p.value)}</span>
                  <span className="num text-[10.5px] text-muted w-9 text-right shrink-0">
                    {Math.round((p.value / data.totalGasto) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Barras del año */}
      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-ink font-display flex items-center gap-2">
            <ChartColumnBig size={15} style={{ color: 'var(--app-accent-soft)' }} /> Mes a mes
          </h3>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <span className="w-2 h-2 rounded-[3px]" style={{ background: 'var(--c-income)' }} /> Entra
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <span className="w-2 h-2 rounded-[3px]" style={{ background: 'var(--c-danger)' }} /> Sale
            </span>
          </div>
        </div>
        <div className="flex items-end gap-1" style={{ height: 118 }}>
          {data.rows.map((r, i) => {
            const esActual = r.id === currentMonthId()
            return (
              <div key={r.id} className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-0">
                <div className="flex items-end gap-[3px]" style={{ height: 92 }}>
                  <div
                    className="w-[8px] rounded-t-md anim-grow"
                    style={{
                      height: Math.max(2, (r.income / maxBar) * 92),
                      background: 'linear-gradient(180deg, var(--c-income), color-mix(in oklab, var(--c-income) 30%, transparent))',
                      opacity: r.has ? 1 : 0.25,
                      animationDelay: `${i * 40}ms`,
                      boxShadow: esActual && r.has ? '0 0 12px -2px var(--c-income)' : undefined,
                    }}
                    title={`${r.label}: entra ${formatMoney(r.income)}`}
                  />
                  <div
                    className="w-[8px] rounded-t-md anim-grow"
                    style={{
                      height: Math.max(2, (r.expenses / maxBar) * 92),
                      background: 'linear-gradient(180deg, var(--c-danger), color-mix(in oklab, var(--c-danger) 30%, transparent))',
                      opacity: r.has ? 1 : 0.25,
                      animationDelay: `${i * 40 + 20}ms`,
                      boxShadow: esActual && r.has ? '0 0 12px -2px var(--c-danger)' : undefined,
                    }}
                    title={`${r.label}: sale ${formatMoney(r.expenses)}`}
                  />
                </div>
                <span
                  className="text-[8.5px] truncate"
                  style={{
                    color: esActual ? 'var(--c-text)' : 'var(--c-muted)',
                    fontWeight: esActual ? 700 : 400,
                  }}
                >
                  {r.label}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Comparación con el saldo real (si está activo) */}
      {saldo != null && (
        <section className="card p-4">
          <h3 className="text-[14px] font-bold text-ink font-display mb-1 flex items-center gap-2">
            <Landmark size={15} style={{ color: 'var(--c-income)' }} /> Tu dinero real vs tus ahorros
          </h3>
          <p className="text-[11.5px] text-muted mb-3">Lo que tienes disponible hoy, lo guardado y lo que aún debes.</p>
          {(() => {
            const deuda = debts.reduce((s, d) => s + debtRemaining(d), 0)
            const max = Math.max(1, saldo, ahorro, deuda)
            const bars = [
              { label: 'En el banco', value: saldo, color: 'var(--c-income)' },
              { label: 'Ahorrado', value: ahorro, color: 'var(--app-accent)' },
              { label: 'Deuda pendiente', value: deuda, color: 'var(--c-danger)' },
            ]
            const patrimonio = saldo + ahorro - deuda
            return (
              <div className="flex flex-col gap-2.5">
                {bars.map((b) => (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-[11.5px] mb-1">
                      <span className="text-muted">{b.label}</span>
                      <span className="num font-semibold text-ink">{formatMoney(Math.round(b.value))}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 bar-shine"
                        style={{
                          width: `${Math.max(2, (Math.max(0, b.value) / max) * 100)}%`,
                          background: `linear-gradient(90deg, color-mix(in oklab, ${b.color} 70%, #000), ${b.color})`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 mt-0.5 border-t border-edge">
                  <span className="text-[12.5px] font-bold text-ink">Patrimonio neto</span>
                  <span
                    className="display-money text-[17px] font-bold"
                    style={{ color: patrimonio >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}
                  >
                    {formatMoney(Math.round(patrimonio))}
                  </span>
                </div>
              </div>
            )
          })()}
        </section>
      )}
    </>
  )
}

/* ─── Reporte financiero por período ───────────────────────────────────────── */

type RangeId = 'mes' | 'trimestre' | 'anio' | 'todo' | 'custom'

export function FinancialReport({ year }: { year: number }) {
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const settings = useFinanceStore((s) => s.settings)
  const profile = useFinanceStore((s) => s.profile)

  const nowId = currentMonthId()
  const [range, setRange] = useState<RangeId>('anio')
  const [from, setFrom] = useState(`${year}-01`)
  const [to, setTo] = useState(`${year}-12`)

  const period = useMemo(() => {
    if (range === 'mes') return { from: nowId, to: nowId }
    if (range === 'trimestre') return { from: addMonthsToId(nowId, -2), to: nowId }
    if (range === 'anio') return { from: `${year}-01`, to: `${year}-12` }
    if (range === 'todo') {
      const ids = Object.keys(months).sort()
      return { from: ids[0] ?? nowId, to: ids[ids.length - 1] ?? nowId }
    }
    return { from, to }
  }, [range, from, to, year, nowId, months])

  const report = useMemo(() => {
    const ids = Object.keys(months).filter((id) => id >= period.from && id <= period.to).sort()
    const acc = {
      salario: 0, adicional: 0,
      servicio: 0, gasto: 0, personal: 0, deuda: 0, movimiento: 0, ahorro: 0,
      pagado: 0, pendiente: 0, meses: ids.length,
    }
    for (const id of ids) {
      const m = months[id]
      const s = getMonthSummary(m, debts)
      acc.salario += m.income.salary
      acc.adicional += m.income.additional
      acc.pagado += s.paidAmount
      acc.pendiente += s.pendingAmount
      acc.movimiento += movementsExpense(m) + hormigasTotal(m)
      acc.ahorro += depositsInMonth(settings, id)
      for (const k of kindTotals(m, debts)) acc[k.kind] += k.total
    }
    const ingresos = acc.salario + acc.adicional
    const egresos = acc.servicio + acc.gasto + acc.personal + acc.deuda + acc.movimiento
    const flujo = ingresos - egresos - acc.ahorro
    // Balance personal (patrimonio) al cierre
    const banco = realBalance(months, debts, settings) ?? 0
    const ahorrado = savingsTotal(settings)
    const pasivos = debts.reduce((s, d) => s + debtRemaining(d), 0)
    return {
      ids, ...acc, ingresos, egresos, flujo,
      tasaAhorro: ingresos > 0 ? Math.round(((acc.ahorro + Math.max(0, flujo)) / ingresos) * 100) : 0,
      cargaDeuda: ingresos > 0 ? Math.round((acc.deuda / ingresos) * 100) : 0,
      promedioMes: acc.meses > 0 ? egresos / acc.meses : 0,
      activos: banco + ahorrado,
      banco, ahorrado, pasivos,
      patrimonio: banco + ahorrado - pasivos,
    }
  }, [months, debts, settings, period])

  const exportar = () => {
    const nombre = [profile.name, profile.lastName].filter(Boolean).join(' ')
    void withLoading('Generando tu reporte…', async () => {
      const blob = await buildStatementBlob({
        title: 'Reporte financiero',
        subtitle: `${monthLabel(period.from)} — ${monthLabel(period.to)}`,
        owner: nombre,
        sections: [
          {
            title: 'INGRESOS',
            rows: [
              ['Salario neto', report.salario],
              ['Ingresos adicionales', report.adicional],
            ],
            total: ['Total de ingresos', report.ingresos],
          },
          {
            title: 'EGRESOS',
            rows: [
              ['Servicios', -report.servicio],
              ['Gastos', -report.gasto],
              ['Personales', -report.personal],
              ['Cuotas de deuda', -report.deuda],
              ['Movimientos del mes', -report.movimiento],
              ['Apartado al ahorro', -report.ahorro],
            ],
            total: ['Total de egresos', -(report.egresos + report.ahorro)],
          },
          {
            title: 'FLUJO NETO DEL PERÍODO',
            rows: [
              ['Tasa de ahorro', report.tasaAhorro],
              ['Carga de deuda sobre ingresos', report.cargaDeuda],
            ],
            percentRows: true,
            total: ['Flujo neto', report.flujo],
          },
          {
            title: 'BALANCE PERSONAL AL CIERRE',
            rows: [
              ['Dinero en el banco', report.banco],
              ['Ahorros', report.ahorrado],
              ['Deudas pendientes', -report.pasivos],
            ],
            total: ['Patrimonio neto', report.patrimonio],
          },
        ],
      })
      await downloadWorkbook(blob, `Reporte-${period.from}_${period.to}.png`)
    }).catch(() => {})
  }

  const monthOptions = useMemo(() => {
    const out: string[] = []
    for (let y = year - 2; y <= year + 1; y++) {
      for (let m = 1; m <= 12; m++) out.push(monthIdOf(y, m))
    }
    return out
  }, [year])

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[14px] font-bold text-ink font-display flex items-center gap-2">
            <FileText size={15} style={{ color: 'var(--app-accent-soft)' }} /> Reporte financiero
          </h3>
          <p className="text-[11px] text-muted mt-0.5">
            Flujo de efectivo personal + balance de patrimonio
          </p>
        </div>
        <button
          onClick={exportar}
          className="pressable btn-ghost !py-1.5 !px-2.5 text-[11.5px] flex items-center gap-1.5 shrink-0"
        >
          <Share2 size={13} /> Exportar
        </button>
      </div>

      {/* Período */}
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-elevated/70 border border-edge/60 p-1">
        {([['mes', 'Mes'], ['trimestre', '3 meses'], ['anio', 'Año'], ['custom', 'Elegir']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setRange(id)}
            className="pressable text-[11px] font-semibold rounded-lg py-1.5"
            style={range === id ? { background: 'var(--app-accent)', color: '#fff' } : { color: 'var(--c-muted)' }}
          >
            {label}
          </button>
        ))}
      </div>
      {range === 'custom' && (
        <div className="grid grid-cols-2 gap-3 mt-3 anim-fade">
          <div>
            <label className="text-[11.5px] text-muted block mb-1">Desde</label>
            <select className="input-base !py-2 !text-[13px]" value={from} onChange={(e) => setFrom(e.target.value)}>
              {monthOptions.map((id) => <option key={id} value={id}>{monthLabel(id, true)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11.5px] text-muted block mb-1">Hasta</label>
            <select className="input-base !py-2 !text-[13px]" value={to} onChange={(e) => setTo(e.target.value)}>
              {monthOptions.map((id) => <option key={id} value={id}>{monthLabel(id, true)}</option>)}
            </select>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted mt-3">
        {monthLabel(period.from)} — {monthLabel(period.to)} ·{' '}
        <span className="num font-semibold text-ink">{report.meses}</span> mes{report.meses === 1 ? '' : 'es'} con datos
      </p>

      {report.meses === 0 ? (
        <p className="text-[12.5px] text-muted mt-3">No hay datos en ese período.</p>
      ) : (
        <div className="flex flex-col gap-3 mt-3">
          <ReportBlock
            title="Ingresos"
            color="var(--c-income)"
            rows={[['Salario neto', report.salario], ['Ingresos adicionales', report.adicional]]}
            total={['Total de ingresos', report.ingresos]}
          />
          <ReportBlock
            title="Egresos"
            color="var(--c-danger)"
            rows={[
              ['Servicios', report.servicio],
              ['Gastos', report.gasto],
              ['Personales', report.personal],
              ['Cuotas de deuda', report.deuda],
              ['Movimientos del mes', report.movimiento],
              ['Apartado al ahorro', report.ahorro],
            ]}
            total={['Total de egresos', report.egresos + report.ahorro]}
            negative
          />

          {/* Resultado e indicadores */}
          <div
            className="rounded-xl p-3.5"
            style={{ background: `color-mix(in oklab, ${report.flujo >= 0 ? 'var(--c-income)' : 'var(--c-danger)'} 12%, transparent)` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-ink">Flujo neto del período</span>
              <span
                className="num text-[19px] font-bold"
                style={{ color: report.flujo >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}
              >
                {formatMoney(Math.round(report.flujo))}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-dashed" style={{ borderColor: 'var(--c-border)' }}>
              <Indicator label="Tasa de ahorro" value={`${report.tasaAhorro}%`} good={report.tasaAhorro >= 10} />
              <Indicator label="Carga de deuda" value={`${report.cargaDeuda}%`} good={report.cargaDeuda <= 35} />
              <Indicator label="Gasto/mes" value={formatMoneyShort(report.promedioMes)} />
            </div>
          </div>

          {/* Patrimonio */}
          <ReportBlock
            title="Balance personal al cierre"
            color="var(--app-accent-soft)"
            rows={[
              ['Dinero en el banco', report.banco],
              ['Ahorros', report.ahorrado],
              ['Deudas pendientes', report.pasivos],
            ]}
            total={['Patrimonio neto', report.patrimonio]}
          />

          <p className="text-[10px] text-muted leading-relaxed">
            Formato estándar de finanzas personales: estado de flujo de efectivo (ingresos −
            egresos del período) y balance personal (activos − pasivos = patrimonio neto).
            Referencia sana: tasa de ahorro 10–20% y carga de deuda por debajo del 35% de tus ingresos.
          </p>
        </div>
      )}
    </section>
  )
}

function ReportBlock({ title, color, rows, total, negative }: {
  title: string
  color: string
  rows: [string, number][]
  total: [string, number]
  negative?: boolean
}) {
  return (
    <div className="card p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color }}>{title}</p>
      {rows.filter(([, v]) => v !== 0).map(([label, v]) => (
        <div key={label} className="flex items-center justify-between py-0.5">
          <span className="text-[12.5px] text-muted">{label}</span>
          <span className="num text-[12.5px] font-semibold" style={{ color: negative ? 'var(--c-danger)' : 'var(--c-text)' }}>
            {negative ? '−' : ''}{formatMoney(Math.round(Math.abs(v)))}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t" style={{ borderColor: 'var(--c-border)' }}>
        <span className="text-[12.5px] font-bold text-ink">{total[0]}</span>
        <span className="num text-[15px] font-bold" style={{ color }}>
          {formatMoney(Math.round(total[1]))}
        </span>
      </div>
    </div>
  )
}

function Indicator({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[9.5px] text-muted">{label}</p>
      <p
        className="num text-[13.5px] font-bold mt-0.5 flex items-center justify-center gap-1"
        style={{ color: good === undefined ? 'var(--c-text)' : good ? 'var(--c-income)' : 'var(--c-warning)' }}
      >
        {good === true && <TrendingUp size={11} />}{value}
      </p>
    </div>
  )
}
