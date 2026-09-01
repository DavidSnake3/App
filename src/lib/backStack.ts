/**
 * Botón "atrás" del celular.
 *
 * En Android el atrás cerraba la app aunque hubiera una hoja o un formulario
 * abierto. Aquí se lleva una pila: primero se cierra lo que esté abierto,
 * después se sale del submenú, después se vuelve a Inicio y solo al final —
 * tocando atrás una segunda vez — se sale de la app.
 *
 * Funciona con el historial del WebView (sin plugins): mientras haya algo que
 * cerrar se mantiene UNA entrada "centinela"; el atrás la consume y nosotros
 * decidimos qué cerrar. Cuando ya no queda nada, no se vuelve a poner y el
 * siguiente atrás sí cierra la app.
 */
type Handler = () => void

interface Overlay { id: number; run: Handler }

const overlays: Overlay[] = []
let nav: { can: () => boolean; back: () => void } | null = null
let hint: (() => void) | null = null
let centinela = false
let seq = 0

function sync() {
  const hayAlgo = overlays.length > 0 || Boolean(nav?.can())
  if (hayAlgo && !centinela) {
    window.history.pushState({ snb: ++seq }, '')
    centinela = true
  }
}

function onPop() {
  centinela = false
  const top = overlays.pop()
  if (top) { top.run(); sync(); return }
  if (nav?.can()) { nav.back(); sync(); return }
  hint?.()
}

/** Lo arranca la app una sola vez */
export function initBackStack(opts: {
  nav: { can: () => boolean; back: () => void }
  onExitHint?: () => void
}) {
  nav = opts.nav
  hint = opts.onExitHint ?? null
  window.addEventListener('popstate', onPop)
  sync()
  return () => {
    window.removeEventListener('popstate', onPop)
    nav = null
    hint = null
  }
}

/** Vuelve a evaluar si hace falta el centinela (al cambiar de pestaña o submenú) */
export function refreshBackStack() {
  sync()
}

/** Registra algo abierto (hoja, diálogo). Devuelve su id para quitarlo. */
export function pushOverlay(run: Handler): number {
  const id = ++seq
  overlays.push({ id, run })
  sync()
  return id
}

/** Lo quita de la pila (se cerró con la X, tocando afuera o al desmontarse) */
export function popOverlay(id: number) {
  const i = overlays.findIndex((o) => o.id === id)
  if (i >= 0) overlays.splice(i, 1)
}
