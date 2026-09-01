import { createPortal } from 'react-dom'

interface Props {
  onClick: () => void
  label: string
  children: React.ReactNode
  /** color del botón (por defecto, el degradado de la app) */
  background?: string
}

/**
 * Botón flotante de acción, siempre en la esquina inferior derecha.
 *
 * Va en un PORTAL al body: dentro de las vistas hay contenedores con
 * animaciones (transform), y eso convierte al contenedor en marco de
 * referencia del position:fixed, dejando el botón a media pantalla.
 * El envoltorio respeta el ancho máximo de la app para que quede alineado
 * con el contenido también en pantallas anchas.
 */
export function Fab({ onClick, label, children, background }: Props) {
  return createPortal(
    <div
      className="fixed inset-x-0 z-40 max-w-[520px] mx-auto pointer-events-none"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      <div className="flex justify-end px-4">
        <button
          onClick={onClick}
          aria-label={label}
          className="pressable pointer-events-auto w-14 h-14 rounded-2xl flex items-center justify-center text-white anim-pop"
          style={{
            background: background ?? 'var(--app-gradient)',
            boxShadow: '0 12px 32px color-mix(in oklab, var(--app-accent) 50%, transparent), 0 2px 8px rgb(0 0 0 / 0.35)',
          }}
        >
          {children}
        </button>
      </div>
    </div>,
    document.body,
  )
}
