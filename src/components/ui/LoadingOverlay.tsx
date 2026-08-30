import { useLoading } from '../../store/useLoading'
import { Loader } from './Loader'

/**
 * Cargando global (mejora 4): fondo oscuro que bloquea la interacción
 * con la marca SN animada al centro. Se controla con useLoading/withLoading.
 */
export function LoadingOverlay() {
  const visible = useLoading((s) => s.visible)
  const label = useLoading((s) => s.label)
  if (!visible) return null
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center max-w-[520px] mx-auto anim-fade"
      style={{ background: 'rgb(5 7 12 / 0.82)', backdropFilter: 'blur(3px)' }}
      role="alert"
      aria-busy="true"
      aria-label={label}
    >
      <Loader size={78} label={label} />
    </div>
  )
}
