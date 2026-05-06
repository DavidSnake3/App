import type { ProjectedMonth } from '../../types/finance'

interface Props {
  months: ProjectedMonth[]
}

export function ProjectionChart({ months }: Props) {
  if (months.length === 0) return null

  const maxVal = Math.max(...months.map((m) => Math.max(m.income, m.expenses, Math.abs(m.savings))), 1)
  const chartH = 120
  const barW = 8
  const groupW = 30
  const gap = 4
  const totalW = months.length * (groupW + gap)
  const labelH = 28

  function barHeight(val: number): number {
    return Math.max(2, (Math.abs(val) / maxVal) * chartH)
  }

  return (
    <div className="rounded-2xl bg-surface-card border border-surface-border p-3 overflow-x-auto">
      <div className="flex gap-4 text-[10px] text-gray-500 mb-3 justify-center">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-income inline-block" />Ingresos</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-expense inline-block" />Gastos</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-400 inline-block" />Ahorro</span>
      </div>
      <svg
        width={totalW}
        height={chartH + labelH}
        viewBox={`0 0 ${totalW} ${chartH + labelH}`}
        style={{ minWidth: '100%', display: 'block' }}
      >
        {months.map((m, i) => {
          const x = i * (groupW + gap)
          const incH = barHeight(m.income)
          const expH = barHeight(m.expenses)
          const savH = barHeight(m.savings)
          const opacity = m.isActual ? 1 : 0.4

          return (
            <g key={m.monthId} opacity={opacity}>
              <rect x={x} y={chartH - incH} width={barW} height={incH} rx="2" fill="#34d399" />
              <rect x={x + barW + 1} y={chartH - expH} width={barW} height={expH} rx="2" fill="#f87171" />
              <rect
                x={x + barW * 2 + 2}
                y={m.savings >= 0 ? chartH - savH : chartH}
                width={barW}
                height={savH}
                rx="2"
                fill={m.savings >= 0 ? '#818cf8' : '#f87171'}
              />
              <text
                x={x + groupW / 2}
                y={chartH + 16}
                textAnchor="middle"
                fontSize="8"
                fill={m.isActual ? '#9ca3af' : '#4b5563'}
              >
                {m.label.slice(0, 3)}
              </text>
            </g>
          )
        })}
        <line x1={0} y1={chartH} x2={totalW} y2={chartH} stroke="#2e2b4a" strokeWidth={1} />
      </svg>
    </div>
  )
}
