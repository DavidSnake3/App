import { useFinanceStore } from '../../store/useFinanceStore'
import { buildAnnualProjection, formatCRC } from '../../lib/projections'
import { ProjectionChart } from './ProjectionChart'

export function ProjectionView() {
  const months = useFinanceStore((s) => s.months)
  const settings = useFinanceStore((s) => s.settings)
  const projection = buildAnnualProjection(months, settings)

  const { totalIncome, totalExpenses, totalSavings } = projection
  const positive = totalSavings >= 0

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pt-4 pb-6">
        <p className="text-xs text-gray-500 mb-4 text-center">
          Mayo {settings.startYear} – Abril {settings.startYear + 1} · Meses sin datos son proyectados
        </p>

        <div className="grid grid-cols-1 gap-3 mb-6">
          <StatCard label="Total ingresos anuales" value={totalIncome} color="text-income" />
          <StatCard label="Total gastos anuales" value={totalExpenses} color="text-expense" />
          <StatCard
            label="Ahorro anual estimado"
            value={totalSavings}
            color={positive ? 'text-income' : 'text-expense'}
            highlight
          />
        </div>

        <ProjectionChart months={projection.months} />

        <div className="mt-4 space-y-2">
          {projection.months.map((m) => (
            <div key={m.monthId} className="flex items-center gap-3 py-2 border-b border-surface-border/40">
              <span className={`text-xs w-16 capitalize flex-shrink-0 ${m.isActual ? 'text-gray-300' : 'text-gray-600'}`}>
                {m.label}
              </span>
              {!m.isActual && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-border text-gray-500">est.</span>
              )}
              <div className="flex-1 grid grid-cols-3 text-right gap-2">
                <span className="font-mono text-[11px] text-income">{formatCRC(m.income)}</span>
                <span className="font-mono text-[11px] text-expense">{formatCRC(m.expenses)}</span>
                <span className={`font-mono text-[11px] font-semibold ${m.savings >= 0 ? 'text-income' : 'text-expense'}`}>
                  {m.savings >= 0 ? '+' : ''}{formatCRC(m.savings)}
                </span>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 py-2 mt-1">
            <span className="text-xs text-white font-semibold w-16">Total</span>
            <div className="flex-1 grid grid-cols-3 text-right gap-2">
              <span className="font-mono text-xs text-income font-bold">{formatCRC(totalIncome)}</span>
              <span className="font-mono text-xs text-expense font-bold">{formatCRC(totalExpenses)}</span>
              <span className={`font-mono text-xs font-bold ${positive ? 'text-income' : 'text-expense'}`}>
                {positive ? '+' : ''}{formatCRC(totalSavings)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  highlight,
}: {
  label: string
  value: number
  color: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-4 flex items-center justify-between ${
        highlight ? 'bg-brand-900/60 border border-brand-600/40' : 'bg-surface-card border border-surface-border'
      }`}
    >
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`font-mono font-bold text-base ${color}`}>{formatCRC(Math.abs(value))}</span>
    </div>
  )
}
