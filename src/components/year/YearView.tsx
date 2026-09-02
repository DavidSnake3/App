import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { buildAnnualProjection, buildMonthFlow, debtEndMonthId, debtIsSettled, debtRemaining, getMonthSummary } from '../../lib/finance'
import { MONTH_SHORT, currentMonthId, monthDiff, monthIdOf, monthLabel, parseMonthId } from '../../lib/dates'
import { formatMoney, formatMoneyShort } from '../../lib/format'
import { LineChart } from './LineChart'
import { FinancialReport, YearCharts } from './YearInsights'
import { MonthReportSheet } from './MonthReportSheet'

/**
 * Vista Año: calendario anual, proyecciones P/G y Gantt de deudas.
 * `embedded` = va dentro del hub de Reportes (sin contenedor de scroll propio).
 */
export function YearView({ embedded = false, showReport = true }: { embedded?: boolean; showReport?: boolean }) {
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const settings = useFinanceStore((s) => s.settings)
  const profile = useFinanceStore((s) => s.profile)
  const activeMonthId = useFinanceStore((s) => s.activeMonthId)
  const [reporteMes, setReporteMes] = useState<string | null>(null)

  const [year, setYear] = useState(() => parseMonthId(activeMonthId).year)

  const projection = useMemo(
    () => buildAnnualProjection(months, debts, settings, `${year}-01`),
    [months, debts, settings, year],
  )

  const nowId = currentMonthId()
  const currentMonth = months[activeMonthId]
  const flow = useMemo(
    () => (currentMonth ? buildMonthFlow(currentMonth, debts, profile.payday) : []),
    [currentMonth, debts, profile.payday],
  )

  const activeDebts = debts.filter((d) => !debtIsSettled(d))

  const cuerpo = (
    <>
        {/* Selector de año */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setYear((y) => y - 1)}
            aria-label="Año anterior"
            className="pressable w-10 h-10 rounded-full bg-card border border-edge flex items-center justify-center text-muted"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-display text-[20px] font-bold text-ink num">{year}</h2>
          <button
            onClick={() => setYear((y) => y + 1)}
            aria-label="Año siguiente"
            className="pressable w-10 h-10 rounded-full bg-card border border-edge flex items-center justify-center text-muted"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Calendario anual (punto 2) */}
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 12 }).map((_, i) => {
            const id = monthIdOf(year, i + 1)
            const m = months[id]
            const isNow = id === nowId
            const isActive = id === activeMonthId
            const s = m ? getMonthSummary(m, debts) : null
            return (
              <button
                key={id}
                onClick={() => setReporteMes(id)}
                className="pressable card p-2.5 text-left relative overflow-hidden"
                style={{
                  borderColor: isActive
                    ? 'color-mix(in oklab, var(--app-accent) 65%, var(--c-border))'
                    : isNow ? 'color-mix(in oklab, var(--app-accent) 35%, var(--c-border))' : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-bold" style={{ color: isNow ? 'var(--app-accent-soft)' : 'var(--c-text)' }}>
                    {MONTH_SHORT[i]}
                  </span>
                  {s && s.allPaid && (
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--c-income)' }} />
                  )}
                </div>
                {s ? (
                  <>
                    <p className="num text-[11px] font-semibold mt-1" style={{ color: s.savings >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>
                      {formatMoneyShort(s.savings)}
                    </p>
                    <div className="h-1 rounded-full bg-elevated overflow-hidden mt-1.5">
                      <div className="h-full rounded-full" style={{ width: `${Math.round(s.progress * 100)}%`, background: 'var(--app-gradient)' }} />
                    </div>
                    <p className="text-[9.5px] text-muted mt-1 num">{s.countPaid}/{s.countTotal} pagos</p>
                  </>
                ) : (
                  <p className="text-[10px] text-muted mt-1.5">Sin datos</p>
                )}
              </button>
            )
          })}
        </div>

        {/* Reporte financiero por período (mejora 16) */}
        {showReport && <FinancialReport year={year} />}

        {/* Dashboards del año: dona, barras y comparación (mejora 15) */}
        <YearCharts year={year} />

        {/* Proyección anual con líneas de P/G (punto 13) */}
        <section className="card p-4">
          <h3 className="text-[14px] font-bold text-ink font-display mb-1">Proyección anual</h3>
          <p className="text-[11.5px] text-muted mb-3">Ingresos, ahorro y gastos por mes. Los meses sin datos se proyectan.</p>
          <LineChart
            labels={projection.months.map((m) => m.label.split(' ')[0])}
            series={[
              { name: 'Ingresos', color: 'var(--chart-income)', values: projection.months.map((m) => m.income) },
              { name: 'Ahorro', color: 'var(--chart-savings)', values: projection.months.map((m) => m.savings) },
              { name: 'Gastos', color: 'var(--chart-expense)', values: projection.months.map((m) => m.expenses) },
            ]}
            projectedFrom={(() => {
              const idx = projection.months.findIndex((m) => !m.isActual)
              return idx === -1 ? undefined : Math.max(0, idx - 1)
            })()}
          />
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-edge">
            <Stat label="Ingresos" value={projection.totalIncome} color="var(--chart-income)" />
            <Stat label="Gastos" value={projection.totalExpenses} color="var(--chart-expense)" />
            <Stat label="Balance" value={projection.totalSavings} color={projection.totalSavings >= 0 ? 'var(--chart-income)' : 'var(--chart-expense)'} />
          </div>
        </section>

        {/* Flujo del mes activo (línea de pérdidas/ganancias del mes) */}
        {flow.length > 0 && (
          <section className="card p-4">
            <h3 className="text-[14px] font-bold text-ink font-display mb-1">Flujo de {monthLabel(activeMonthId)}</h3>
            <p className="text-[11.5px] text-muted mb-3">
              Balance acumulado día a día (salario el día {profile.payday}).
            </p>
            <LineChart
              height={160}
              labels={flow.map((p) => String(p.day))}
              series={[
                { name: 'Balance', color: 'var(--chart-savings)', values: flow.map((p) => p.balance) },
              ]}
            />
          </section>
        )}

        {/* Gantt anual de deudas */}
        {activeDebts.length > 0 && (
          <section className="card p-4">
            <h3 className="text-[14px] font-bold text-ink font-display mb-3">Deudas en {year}</h3>
            <div className="flex flex-col gap-2.5">
              {activeDebts.map((d) => {
                const startIdx = monthDiff(`${year}-01`, d.startMonthId) // puede ser negativo
                const endIdx = monthDiff(`${year}-01`, debtEndMonthId(d))
                const from = Math.max(0, startIdx)
                const to = Math.min(11, endIdx)
                if (to < 0 || from > 11) return null
                return (
                  <div key={d.id}>
                    <div className="flex justify-between text-[11.5px] mb-1">
                      <span className="font-medium text-ink truncate">{d.name}</span>
                      <span className="text-muted num">resta {formatMoneyShort(debtRemaining(d))}</span>
                    </div>
                    <div className="relative h-5 rounded-lg bg-elevated overflow-hidden">
                      {/* separadores de meses */}
                      {Array.from({ length: 11 }).map((_, i) => (
                        <span key={i} className="absolute top-0 bottom-0 w-px bg-card" style={{ left: `${((i + 1) / 12) * 100}%` }} />
                      ))}
                      <div
                        className="absolute top-0.5 bottom-0.5 rounded-md flex items-center px-1.5"
                        style={{
                          left: `${(from / 12) * 100}%`,
                          width: `${((to - from + 1) / 12) * 100}%`,
                          background: 'var(--app-gradient)',
                          opacity: 0.85,
                        }}
                      >
                        <span className="text-[9px] font-bold text-white num truncate">
                          {formatMoneyShort(d.monthlyPayment)}/mes
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Al tocar un mes se abre su reporte, sin sacarte de aqui */}
        <MonthReportSheet monthId={reporteMes} onClose={() => setReporteMes(null)} />
    </>
  )

  if (embedded) return cuerpo
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-28 pt-2 flex flex-col gap-4">{cuerpo}</div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-[10.5px] text-muted">{label}</p>
      <p className="num text-[14px] font-bold" style={{ color }}>{formatMoney(value)}</p>
    </div>
  )
}
