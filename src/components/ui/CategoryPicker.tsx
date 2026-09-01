// Selector de categoría: cada una con su ícono y su color. Es el mismo que se
// usa al anotar un movimiento y al crear un gasto o servicio, para que los
// reportes por categoría cuadren venga de donde venga el registro.
import { useState } from 'react'
import { ChevronDown, Tag } from 'lucide-react'
import type { Category } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { categoryColor, categoryList } from '../../lib/categories'
import { ItemIcon } from '../../lib/icons'

interface Props {
  value: string
  onChange: (id: string) => void
  /** para qué sirve: filtra las categorías que se muestran */
  kind?: 'gasto' | 'ingreso'
  label?: string
  /** cuántas se ven antes de "ver todas" (0 = todas) */
  preview?: number
  hint?: string
}

export function CategoryPicker({
  value, onChange, kind = 'gasto', label = 'Categoría', preview = 8, hint,
}: Props) {
  const cats = useFinanceStore((s) => s.settings.categories)
  const lista = categoryList(cats, kind)
  const [todas, setTodas] = useState(false)

  // la elegida siempre se ve, aunque esté fuera del recorte
  const visibles = todas || preview <= 0
    ? lista
    : (() => {
        const corte = lista.slice(0, preview)
        const elegida = lista.find((c) => c.id === value)
        return elegida && !corte.some((c) => c.id === elegida.id)
          ? [elegida, ...corte.slice(0, preview - 1)]
          : corte
      })()

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-semibold text-muted flex items-center gap-1.5">
          <Tag size={12} /> {label}
        </label>
        {lista.length > visibles.length || todas ? (
          <button
            onClick={() => setTodas((v) => !v)}
            className="pressable text-[11px] font-semibold flex items-center gap-0.5"
            style={{ color: 'var(--app-accent-soft)' }}
          >
            {todas ? 'Ver menos' : `Ver todas (${lista.length})`}
            <ChevronDown size={11} style={{ transform: todas ? 'rotate(180deg)' : undefined }} />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-2 mt-2">
        {visibles.map((c: Category) => {
          const activo = c.id === value
          const color = categoryColor(c.id, cats)
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              className="pressable rounded-2xl border px-1 py-2 flex flex-col items-center gap-1 transition-all duration-200"
              style={activo
                ? {
                    borderColor: color,
                    background: `color-mix(in oklab, ${color} 14%, var(--c-elevated))`,
                    boxShadow: `0 6px 16px -12px ${color}`,
                  }
                : { borderColor: 'var(--c-border)', background: 'var(--c-elevated)' }}
            >
              <span
                className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={activo
                  ? {
                      background: `linear-gradient(145deg, ${color}, color-mix(in oklab, ${color} 55%, #000))`,
                      color: '#fff',
                    }
                  : { color: 'var(--c-muted)' }}
              >
                <ItemIcon icon={c.icon} size={15} />
              </span>
              <span
                className="text-[9.5px] leading-tight text-center w-full truncate px-0.5"
                style={{ color: activo ? 'var(--c-text)' : 'var(--c-muted)' }}
              >
                {c.name}
              </span>
            </button>
          )
        })}
      </div>

      {hint && <p className="text-[11px] text-muted mt-1.5 leading-snug">{hint}</p>}
    </div>
  )
}
