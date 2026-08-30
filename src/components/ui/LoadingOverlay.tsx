import { useEffect, useState } from 'react'
import { useLoading } from '../../store/useLoading'
import { Loader } from './Loader'

/**
 * Cargando global (mejora 4): fondo oscuro que bloquea la interacción
 * con la marca SN animada al centro. Se controla con useLoading/withLoading.
 * Si recibe varios mensajes, los va rotando mientras carga.
 */
export function LoadingOverlay() {
  const visible = useLoading((s) => s.visible)
  const labels = useLoading((s) => s.labels)
  if (!visible) return null
  return <OverlayInner key={labels.join('|')} labels={labels} />
}

function OverlayInner({ labels }: { labels: string[] }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (labels.length < 2) return
    const t = setInterval(() => setI((x) => x + 1), 2600)
    return () => clearInterval(t)
  }, [labels.length])

  const label = labels[i % Math.max(1, labels.length)] ?? 'Cargando…'

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
