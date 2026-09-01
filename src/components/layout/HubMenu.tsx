import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { playTap } from '../../lib/sound'

export type Tone = 'accent' | 'income' | 'danger' | 'warning'

const TONE_COLOR: Record<Tone, string> = {
  accent: 'var(--app-accent)',
  income: 'var(--c-income)',
  danger: 'var(--c-danger)',
  warning: 'var(--c-warning)',
}

const TONE_TEXT: Record<Tone, string> = {
  accent: 'var(--app-accent-soft)',
  income: 'var(--c-income)',
  danger: 'var(--c-danger)',
  warning: 'var(--c-warning)',
}

export interface HubItem<T extends string> {
  id: T
  title: string
  desc: string
  icon: React.ReactNode
  /** dato en vivo (ej. "₡148 500", "3 pendientes") */
  stat?: string
  tone?: Tone
  /** contador pequeño en la esquina del ícono */
  badge?: number
}

interface Props<T extends string> {
  items: HubItem<T>[]
  onPick: (id: T) => void
  /** contenido opcional arriba de los cuadros */
  children?: React.ReactNode
}

/**
 * Menú de una sección en CUADROS (como Ajustes): ícono grande, nombre, una
 * línea de ayuda y el dato en vivo que importa. Es el primer nivel de cada
 * pestaña; al tocar un cuadro se entra a la sección.
 */
export function HubMenu<T extends string>({ items, onPick, children }: Props<T>) {
  const sounds = useFinanceStore((s) => s.settings.animations.sounds)

  return (
    <>
      {children}
      <div className="grid grid-cols-2 gap-3">
        {items.map((it, i) => {
          const tone = it.tone ?? 'accent'
          return (
            <button
              key={it.id}
          data-tour={`hub-${it.id}`}
              onClick={() => { if (sounds) playTap(); onPick(it.id) }}
              className="pressable tile px-3.5 py-3.5 flex flex-col text-left min-h-[132px] anim-rise"
              style={{
                animationDelay: `${i * 45}ms`,
                background: `linear-gradient(155deg, color-mix(in oklab, ${TONE_COLOR[tone]} 10%, var(--c-card)) 0%, var(--c-card) 62%)`,
                borderColor: `color-mix(in oklab, ${TONE_COLOR[tone]} 18%, var(--c-border))`,
              }}
            >
              {/* halo del tono y línea de luz superior */}
              <span
                className="absolute -right-6 -top-8 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-25"
                style={{ background: TONE_COLOR[tone] }}
              />
              <span
                className="absolute inset-x-6 top-0 h-px pointer-events-none"
                style={{ background: `linear-gradient(90deg, transparent, color-mix(in oklab, ${TONE_COLOR[tone]} 80%, #fff), transparent)` }}
              />
              <span className="flex items-start justify-between w-full">
                <span
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 relative"
                  style={{
                    background: `linear-gradient(145deg, color-mix(in oklab, ${TONE_COLOR[tone]} 26%, transparent), color-mix(in oklab, ${TONE_COLOR[tone]} 10%, transparent))`,
                    color: TONE_TEXT[tone],
                    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${TONE_COLOR[tone]} 34%, transparent), 0 6px 16px -10px ${TONE_COLOR[tone]}`,
                  }}
                >
                  {it.icon}
                  {Boolean(it.badge) && (
                    <span
                      className="num absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9.5px] font-bold flex items-center justify-center text-white"
                      style={{
                        background: TONE_COLOR[tone],
                        boxShadow: `0 0 10px 1px color-mix(in oklab, ${TONE_COLOR[tone]} 60%, transparent)`,
                      }}
                    >
                      {it.badge}
                    </span>
                  )}
                </span>
                <ChevronRight size={14} className="text-muted mt-1 shrink-0" />
              </span>

              <span className="block text-[13.5px] font-bold text-ink mt-2.5 leading-tight">
                {it.title}
              </span>
              <span className="block text-[10.5px] text-muted leading-snug mt-0.5 flex-1">
                {it.desc}
              </span>
              {it.stat && (
                <span className="block mt-2 pt-2 w-full" style={{ borderTop: '1px solid var(--c-border)' }}>
                  <span
                    className="display-money block text-[14px] font-bold truncate"
                    style={{ color: TONE_TEXT[tone] }}
                  >
                    {it.stat}
                  </span>
                </span>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}

/** Encabezado de una sección: flecha para volver al menú de cuadros */
export function HubHeader({ title, subtitle, onBack, right }: {
  title: string
  subtitle?: string
  onBack: () => void
  right?: React.ReactNode
}) {
  return (
    <header className="flex items-center gap-3">
      <button
        onClick={onBack}
        aria-label="Volver al menú"
        className="pressable w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: 'var(--c-card)',
          border: '1px solid color-mix(in oklab, var(--app-accent) 25%, var(--c-border))',
          color: 'var(--app-accent-soft)',
        }}
      >
        <ArrowLeft size={17} />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[19px] font-bold text-ink leading-tight truncate">{title}</h2>
        {subtitle && <p className="text-[11.5px] text-muted leading-snug">{subtitle}</p>}
      </div>
      {right}
    </header>
  )
}

/** Título de la pestaña, arriba del menú de cuadros */
export function HubTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header>
      <h2 className="font-display text-[22px] font-bold text-ink">{title}</h2>
      {subtitle && <p className="text-[12.5px] text-muted mt-0.5">{subtitle}</p>}
    </header>
  )
}
