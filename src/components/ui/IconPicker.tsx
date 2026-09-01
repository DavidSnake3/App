import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../../hooks/useBackClose'
import { ChevronRight, X } from 'lucide-react'
import { ICON_IDS, ITEM_ICONS, ItemIcon } from '../../lib/icons'

interface Props {
  value: string
  onChange: (id: string) => void
  /** para adivinar el ícono por defecto que se muestra */
  name?: string
  kind?: 'gasto' | 'servicio' | 'personal' | 'deuda'
  /** ícono que manda cuando el usuario no eligió uno (el de su categoría) */
  fallback?: string
}

/** Selector de íconos en menú-cuadrícula (mejora 6): sin deslizar tedioso */
export function IconPicker({ value, onChange, name, kind, fallback }: Props) {
  const [open, setOpen] = useState(false)
  useBackClose(open, () => setOpen(false))
  const current = value && ITEM_ICONS[value] ? ITEM_ICONS[value] : null
  const auto = !current && fallback && ITEM_ICONS[fallback] ? ITEM_ICONS[fallback] : null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pressable w-full flex items-center gap-3 rounded-2xl border border-edge bg-elevated px-3.5 py-2.5 text-left"
      >
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)', color: 'var(--app-accent-soft)' }}
        >
          <ItemIcon icon={value || fallback} name={name} kind={kind} size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-medium text-ink">
            {current ? current.label : auto ? `Automático · ${auto.label}` : 'Ícono automático'}
          </span>
          <span className="block text-[11.5px] text-muted">
            {current
              ? 'Toca para cambiarlo'
              : auto
                ? 'El de la categoría · toca para elegir otro'
                : 'Se adivina por el nombre · toca para elegir'}
          </span>
        </span>
        <ChevronRight size={15} className="text-muted shrink-0" />
      </button>

      {open && createPortal((
        <div className="fixed inset-0 z-[70] flex flex-col justify-end max-w-[520px] mx-auto">
          <div className="absolute inset-0 bg-black/65 anim-fade" onClick={() => setOpen(false)} />
          <div
            className="relative bg-card border-t border-edge rounded-t-3xl max-h-[80dvh] flex flex-col"
            style={{ animation: 'slideUp 0.28s cubic-bezier(0.2, 0.8, 0.3, 1) both' }}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-edge" />
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <h3 className="text-[16px] font-semibold text-ink font-display">Elige un ícono</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="pressable w-9 h-9 flex items-center justify-center rounded-full bg-elevated border border-edge text-muted"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto px-4 pb-[calc(1.2rem+env(safe-area-inset-bottom))]">
              <button
                onClick={() => { onChange(''); setOpen(false) }}
                className={`pressable chip mb-3 ${!value ? 'chip-active' : ''}`}
              >
                Automático (según el nombre)
              </button>
              <div className="grid grid-cols-4 gap-2">
                {ICON_IDS.map((id) => {
                  const { Icon, label } = ITEM_ICONS[id]
                  const active = value === id
                  return (
                    <button
                      key={id}
                      onClick={() => { onChange(id); setOpen(false) }}
                      className="pressable rounded-xl border flex flex-col items-center gap-1 py-2.5 px-1"
                      style={{
                        borderColor: active ? 'var(--app-accent)' : 'var(--c-border)',
                        background: active ? 'color-mix(in oklab, var(--app-accent) 16%, transparent)' : 'var(--c-elevated)',
                      }}
                    >
                      <Icon size={19} style={{ color: active ? 'var(--app-accent-soft)' : 'var(--c-muted)' }} />
                      <span className="text-[9.5px] font-medium text-muted leading-tight text-center truncate w-full">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  )
}
