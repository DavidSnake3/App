// Selector de color de la app: una paleta cuidada, con degradado y anillo en
// el elegido. Se usa en categorías, cuentas y pagos.
import { Check, Palette } from 'lucide-react'
import { APP_COLORS } from '../../lib/palette'


interface Props {
  /** color elegido ('' = automático) */
  value?: string
  onChange: (color: string) => void
  label?: string
  /** color que se usaría si no elige ninguno */
  fallback?: string
  /** permite volver al color automático */
  allowAuto?: boolean
  /** texto de ayuda bajo el selector */
  hint?: string
}

export function ColorPicker({
  value, onChange, label = 'Color', fallback, allowAuto = true, hint,
}: Props) {
  const actual = value || ''
  return (
    <div>
      <label className="text-[12px] font-semibold text-muted flex items-center gap-1.5">
        <Palette size={12} /> {label}
      </label>

      <div className="flex flex-wrap gap-2 mt-2">
        {allowAuto && (
          <button
            onClick={() => onChange('')}
            aria-label="Color automático"
            className="pressable w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-200"
            style={{
              background: fallback
                ? `linear-gradient(145deg, ${fallback}, color-mix(in oklab, ${fallback} 45%, transparent))`
                : 'var(--c-elevated)',
              borderColor: !actual
                ? 'var(--app-accent)'
                : 'var(--c-border)',
              boxShadow: !actual
                ? '0 0 0 2px color-mix(in oklab, var(--app-accent) 35%, transparent)'
                : undefined,
              opacity: 0.85,
            }}
          >
            <span className="text-[9px] font-bold text-white drop-shadow">AUTO</span>
          </button>
        )}

        {APP_COLORS.map((c) => {
          const activo = actual.toLowerCase() === c.toLowerCase()
          return (
            <button
              key={c}
              onClick={() => onChange(c)}
              aria-label={`Color ${c}`}
              className="pressable w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 anim-rise"
              style={{
                background: `linear-gradient(145deg, ${c}, color-mix(in oklab, ${c} 55%, #000))`,
                boxShadow: activo
                  ? `0 0 0 2px var(--c-card), 0 0 0 4px ${c}, 0 6px 16px -6px ${c}`
                  : `0 4px 12px -8px ${c}`,
                transform: activo ? 'scale(1.06)' : undefined,
              }}
            >
              {activo && <Check size={15} className="text-white drop-shadow" />}
            </button>
          )
        })}
      </div>

      {hint && <p className="text-[11px] text-muted mt-1.5 leading-snug">{hint}</p>}
    </div>
  )
}
