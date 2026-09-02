// Selector de categoría: cada una con su ícono y su color. Es el mismo que se
// usa al anotar un movimiento y al crear un gasto o servicio, para que los
// reportes por categoría cuadren venga de donde venga el registro.
//
// Muestra las más usadas en una cuadrícula corta y, como hay muchas, "Ver
// todas" abre una hoja con buscador (igual que el selector de íconos). La hoja
// va en un PORTAL: dentro de una hoja hay contenedores con transform que
// atraparían un position:fixed.
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, Search, Tag, X } from 'lucide-react'
import type { Category } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useBackClose } from '../../hooks/useBackClose'
import { categoryColor, categoryList } from '../../lib/categories'
import { ItemIcon } from '../../lib/icons'

interface Props {
  value: string
  onChange: (id: string) => void
  /** para qué sirve: filtra las categorías que se muestran */
  kind?: 'gasto' | 'ingreso'
  label?: string
  /** cuántas se ven en la cuadrícula corta (0 = todas, sin hoja) */
  preview?: number
  hint?: string
}

export function CategoryPicker({
  value, onChange, kind = 'gasto', label = 'Categoría', preview = 8, hint,
}: Props) {
  const cats = useFinanceStore((s) => s.settings.categories)
  const lista = categoryList(cats, kind)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  useBackClose(open, () => setOpen(false))

  // la elegida siempre se ve, aunque esté fuera del recorte
  const visibles = preview <= 0
    ? lista
    : (() => {
        const corte = lista.slice(0, preview)
        const elegida = lista.find((c) => c.id === value)
        return elegida && !corte.some((c) => c.id === elegida.id)
          ? [elegida, ...corte.slice(0, preview - 1)]
          : corte
      })()

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return lista
    return lista.filter((c) => c.name.toLowerCase().includes(t))
  }, [lista, q])

  const elegir = (id: string) => {
    onChange(id)
    setOpen(false)
    setQ('')
  }

  const tile = (c: Category, i: number, grande = false) => {
    const activo = c.id === value
    const color = categoryColor(c.id, cats)
    return (
      <button
        key={c.id}
        onClick={() => (grande ? elegir(c.id) : onChange(c.id))}
        className={`pressable rounded-2xl border px-1 flex flex-col items-center gap-1 transition-all duration-200 ${grande ? 'py-2.5 anim-rise' : 'py-2'}`}
        style={{
          animationDelay: grande ? `${Math.min(i * 18, 260)}ms` : undefined,
          borderColor: activo ? color : 'var(--c-border)',
          background: activo
            ? `color-mix(in oklab, ${color} 14%, var(--c-elevated))`
            : 'var(--c-elevated)',
          boxShadow: activo ? `0 6px 16px -12px ${color}` : undefined,
        }}
      >
        <span
          className={`${grande ? 'w-9 h-9' : 'w-7 h-7'} rounded-xl flex items-center justify-center relative`}
          style={activo
            ? {
                background: `linear-gradient(145deg, ${color}, color-mix(in oklab, ${color} 55%, #000))`,
                color: '#fff',
              }
            : { color }}
        >
          <ItemIcon icon={c.icon} size={grande ? 17 : 15} />
          {activo && grande && (
            <span
              className="absolute -right-1 -top-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: color, color: '#fff' }}
            >
              <Check size={10} strokeWidth={3} />
            </span>
          )}
        </span>
        <span
          className={`${grande ? 'text-[10.5px]' : 'text-[9.5px]'} leading-tight text-center w-full truncate px-0.5`}
          style={{ color: activo ? 'var(--c-text)' : 'var(--c-muted)' }}
        >
          {c.name}
        </span>
      </button>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-semibold text-muted flex items-center gap-1.5">
          <Tag size={12} /> {label}
        </label>
        {preview > 0 && lista.length > visibles.length && (
          <button
            onClick={() => setOpen(true)}
            className="pressable text-[11px] font-semibold flex items-center gap-0.5"
            style={{ color: 'var(--app-accent-soft)' }}
          >
            Ver todas ({lista.length}) <ChevronRight size={11} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 mt-2">
        {visibles.map((c, i) => tile(c, i))}
      </div>

      {hint && <p className="text-[11px] text-muted mt-1.5 leading-snug">{hint}</p>}

      {/* Hoja con todas las categorías y buscador */}
      {open && createPortal((
        <div className="fixed inset-0 z-[70] flex flex-col justify-end max-w-[520px] mx-auto">
          <div className="absolute inset-0 bg-black/65 anim-fade" onClick={() => setOpen(false)} />
          <div
            className="relative bg-card border-t border-edge rounded-t-3xl max-h-[84dvh] flex flex-col"
            style={{ animation: 'slideUp 0.28s cubic-bezier(0.2, 0.8, 0.3, 1) both' }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div>
                <h3 className="text-[17px] font-semibold text-ink font-display">Elegí la categoría</h3>
                <p className="text-[12px] text-muted">{lista.length} disponibles · con su ícono y su color</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="pressable w-9 h-9 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 rounded-2xl border border-edge bg-elevated px-3.5 h-11">
                <Search size={15} className="text-muted shrink-0" />
                <input
                  className="flex-1 bg-transparent outline-none text-[14px] text-ink placeholder:text-muted"
                  placeholder="Buscar: súper, gasolina, mascota…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoFocus
                />
                {q && (
                  <button onClick={() => setQ('')} aria-label="Limpiar" className="pressable text-muted">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 pb-6">
              {filtradas.length === 0 ? (
                <p className="text-[13px] text-muted text-center py-8">
                  Nada con «{q}». Podés crear la categoría en Ajustes › Categorías.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {filtradas.map((c, i) => tile(c, i, true))}
                </div>
              )}
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  )
}
