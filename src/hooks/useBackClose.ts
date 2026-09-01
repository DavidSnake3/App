import { useEffect, useRef } from 'react'
import { popOverlay, pushOverlay } from '../lib/backStack'

/**
 * Mientras esto esté abierto, el atrás del celular lo cierra en vez de salirse
 * de la app. Se usa en hojas, diálogos y cualquier cosa que tape la pantalla.
 */
export function useBackClose(open: boolean, onClose: () => void) {
  const cerrar = useRef(onClose)
  useEffect(() => { cerrar.current = onClose })

  useEffect(() => {
    if (!open) return
    const id = pushOverlay(() => cerrar.current())
    return () => popOverlay(id)
  }, [open])
}
