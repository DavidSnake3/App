import { createPortal } from 'react-dom'
import { useBackClose } from '../../hooks/useBackClose'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', danger, onConfirm, onCancel,
}: Props) {
  // el atrás del celular cancela el diálogo en vez de salirse de la app
  useBackClose(open, onCancel)

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 max-w-[520px] mx-auto">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px] anim-fade" onClick={onCancel} />
      <div className="relative card p-5 w-full anim-pop">
        <h3 className="text-[17px] font-semibold text-ink font-display">{title}</h3>
        <p className="text-sm text-muted mt-2 leading-relaxed">{message}</p>
        <div className="flex gap-2.5 mt-5">
          <button onClick={onCancel} className="pressable btn-ghost flex-1">Cancelar</button>
          <button
            onClick={onConfirm}
            className="pressable flex-1 rounded-2xl font-semibold text-white py-3"
            style={{ background: danger ? 'var(--c-danger)' : 'var(--app-accent)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
