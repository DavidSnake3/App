import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useBackClose } from '../../hooks/useBackClose'
import { useFinanceStore } from '../../store/useFinanceStore'
import { playSwoosh } from '../../lib/sound'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function BottomSheet({ open, onClose, title, subtitle, children }: Props) {
  // el atrás del celular cierra la hoja, no la app
  useBackClose(open, onClose)

  useEffect(() => {
    if (!open) return
    // un soplido suave al abrirse, si el usuario tiene los sonidos activos
    if (useFinanceStore.getState().settings.animations.sounds) playSwoosh()
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    // el fondo no se mueve mientras la hoja está abierta
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  // Portal al body: si la hoja vive dentro de un contenedor con transform
  // (las animaciones de página), ese contenedor se vuelve el marco de
  // referencia del position:fixed y la hoja aparece corrida hacia arriba.
  return createPortal(
    <SheetPanel onClose={onClose} title={title} subtitle={subtitle}>
      {children}
    </SheetPanel>,
    document.body,
  )
}

/** Panel interno: se desmonta al cerrar, así la animación se reinicia en cada apertura */
function SheetPanel({ onClose, title, subtitle, children }: Omit<Props, 'open'>) {
  // Al terminar la animación se quita el transform: un elemento con transform se
  // vuelve "containing block" y atraparía overlays position:fixed hijos (IconPicker)
  const [settled, setSettled] = useState(false)
  // arrastrar hacia abajo para cerrar (gesto de app nativa)
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = e.touches[0].clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (start.current == null) return
    const dy = e.touches[0].clientY - start.current
    if (dy > 0) setDrag(dy)
  }
  const onTouchEnd = () => {
    if (drag > 110) onClose()
    else setDrag(0)
    start.current = null
  }

  const animando = !settled && drag === 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-[520px] mx-auto">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
        style={{
          animation: 'fadeIn 0.2s ease both',
          opacity: drag > 0 ? Math.max(0.25, 1 - drag / 400) : undefined,
        }}
        onClick={onClose}
      />
      <div
        className="relative bg-card border-t border-edge rounded-t-3xl max-h-[92dvh] flex flex-col"
        style={{
          ...(animando ? { animation: 'slideUp 0.28s cubic-bezier(0.2, 0.8, 0.3, 1) both' } : null),
          ...(drag > 0
            ? { transform: `translateY(${drag}px)`, transition: 'none' }
            : settled ? undefined : null),
        }}
        onAnimationEnd={(e) => { if (e.target === e.currentTarget) setSettled(true) }}
      >
        {/* zona para arrastrar y cerrar */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="shrink-0 pt-2.5 pb-1 cursor-grab"
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-edge" />
        </div>
        <div className="flex items-start justify-between px-5 pt-1 pb-2 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-lg font-semibold text-ink font-display">{title}</h2>
            {subtitle && <p className="text-[13px] text-muted mt-0.5 leading-snug">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="pressable w-9 h-9 flex items-center justify-center rounded-full bg-elevated border border-edge text-muted shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-[calc(1.4rem+env(safe-area-inset-bottom))] pt-1">
          {children}
        </div>
      </div>
    </div>
  )
}
