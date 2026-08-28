import { useMemo, useRef, useState } from 'react'
import { formatMoney, formatMoneyShort } from '../../lib/format'

export interface ChartSeries {
  name: string
  color: string // var(--chart-…)
  values: number[]
  dashed?: boolean
}

interface Props {
  labels: string[]
  series: ChartSeries[]
  height?: number
  /** índice a partir del cual los datos son proyección (línea punteada) */
  projectedFrom?: number
}

const W = 360
const PAD = { top: 14, right: 12, bottom: 22, left: 44 }

/**
 * Gráfica de líneas SVG: 2px, un solo eje, leyenda, tooltip táctil.
 * Colores validados para daltonismo (skill dataviz).
 */
export function LineChart({ labels, series, height = 190, projectedFrom }: Props) {
  const H = height
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const { minV, maxV } = useMemo(() => {
    const all = series.flatMap((s) => s.values)
    const min = Math.min(0, ...all)
    let max = Math.max(0, ...all)
    if (min === max) { max = min + 1 }
    const pad = (max - min) * 0.08
    return { minV: min - (min < 0 ? pad : 0), maxV: max + pad }
  }, [series])

  const n = labels.length
  const x = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - minV) / (maxV - minV)) * (H - PAD.top - PAD.bottom)

  const path = (values: number[], from = 0, to = n - 1) =>
    values.slice(from, to + 1).map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i + from).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const gridVals = useMemo(() => {
    const steps = 4
    return Array.from({ length: steps + 1 }, (_, i) => minV + ((maxV - minV) / steps) * i)
  }, [minV, maxV])

  const handleMove = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((clientX - rect.left) / rect.width) * W
    const idx = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, idx)))
  }

  const split = projectedFrom ?? n

  return (
    <div>
      {/* leyenda (siempre presente con ≥2 series) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 px-1">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="w-3 h-[3px] rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        {projectedFrom !== undefined && projectedFrom < n && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
            <span className="w-3 border-t-2 border-dashed" style={{ borderColor: 'var(--c-muted)' }} />
            Proyección
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Gráfica: ${series.map((s) => s.name).join(', ')}`}
        onPointerMove={(e) => handleMove(e.clientX)}
        onPointerDown={(e) => handleMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {/* rejilla */}
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
              stroke="var(--c-border)" strokeWidth={v === 0 && minV < 0 ? 1.4 : 0.6} />
            <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize={8.5} fill="var(--c-muted)" className="num">
              {formatMoneyShort(v)}
            </text>
          </g>
        ))}

        {/* etiquetas x (cada 2 para no saturar) */}
        {labels.map((l, i) => (
          i % 2 === 0 && (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={8.5} fill="var(--c-muted)">
              {l}
            </text>
          )
        ))}

        {/* línea de hover */}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom}
            stroke="var(--c-muted)" strokeWidth={0.8} strokeDasharray="3 3" />
        )}

        {/* series: sólida hasta split, punteada después */}
        {series.map((s) => (
          <g key={s.name}>
            <path d={path(s.values, 0, Math.min(split, n - 1))} fill="none"
              stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {split < n - 1 && (
              <path d={path(s.values, split, n - 1)} fill="none"
                stroke={s.color} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" opacity={0.8} />
            )}
            {hover !== null && (
              <circle cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4}
                fill={s.color} stroke="var(--c-card)" strokeWidth={2} />
            )}
          </g>
        ))}
      </svg>

      {/* tooltip */}
      {hover !== null && (
        <div className="card bg-elevated/95 px-3 py-2 mt-1 anim-fade">
          <p className="text-[11.5px] font-bold text-ink mb-1">{labels[hover]}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {series.map((s) => (
              <span key={s.name} className="text-[11.5px] text-muted inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                {s.name}: <span className="num font-semibold text-ink">{formatMoney(s.values[hover] ?? 0)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
