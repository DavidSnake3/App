import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function BottomSheet({ open, onClose, title, subtitle, children }: Props) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <SheetPanel onClose={onClose} title={title} subtitle={subtitle}>
      {children}
    </SheetPanel>
  )
}

/** Panel interno: se desmonta al cerrar, así la animación se reinicia en cada apertura */
function SheetPanel({ onClose, title, subtitle, children }: Omit<Props, 'open'>) {
  // Al terminar la animación se quita el transform: un elemento con transform se
  // vuelve "containing block" y atraparía overlays position:fixed hijos (IconPicker)
  const [settled, setSettled] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-[520px] mx-auto">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
        style={{ animation: 'fadeIn 0.2s ease both' }}
        onClick={onClose}
      />
      <div
        className="relative bg-card border-t border-edge rounded-t-3xl max-h-[92dvh] flex flex-col"
        style={settled ? undefined : { animation: 'slideUp 0.28s cubic-bezier(0.2, 0.8, 0.3, 1) both' }}
        onAnimationEnd={(e) => { if (e.target === e.currentTarget) setSettled(true) }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-edge" />
        <div className="flex items-start justify-between px-5 pt-3 pb-2">
          <div>
            <h2 className="text-lg font-semibold text-ink font-display">{title}</h2>
            {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="pressable w-9 h-9 flex items-center justify-center rounded-full bg-elevated border border-edge text-muted"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[calc(1.4rem+env(safe-area-inset-bottom))] pt-1">
          {children}
        </div>
      </div>
    </div>
  )
}
