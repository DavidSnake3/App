/**
 * Botón "atrás" del celular.
 *
 * El atrás cierra primero lo que esté abierto (hojas, diálogos, detalles),
 * después sale del submenú, después vuelve a Inicio y solo al final —tocándolo
 * una segunda vez— se sale de la app.
 *
 * Hay DOS caminos porque el atrás no es lo mismo en el celular que en el navegador:
 *
 * - En el APK (Android) el atrás físico o gestual es un evento del sistema que
 *   se le entrega a la Activity: nunca pasa por el WebView y por eso NO dispara
 *   `popstate`. Se escucha con el evento `backButton` del plugin App. Ojo: al
 *   existir ese listener, Capacitor deja de cerrar la app por su cuenta, así que
 *   el último atrás lo tenemos que ejecutar nosotros con `App.exitApp()`.
 *
 * - En el navegador y la PWA se usa el historial: mientras haya algo que cerrar
 *   se mantiene UNA entrada "centinela" que el atrás consume.
 */
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

type Handler = () => void

interface Overlay { id: number; run: Handler }

const overlays: Overlay[] = []
let nav: { can: () => boolean; back: () => void } | null = null
let hint: (() => void) | null = null
let centinela = false
let seq = 0

const nativo = Capacitor.isNativePlatform()

/** Qué hacer con un atrás. Devuelve false cuando ya no queda nada que cerrar. */
function handleBack(): boolean {
  const top = overlays.pop()
  if (top) { top.run(); return true }
  if (nav?.can()) { nav.back(); return true }
  return false
}

function sync() {
  if (nativo) return // en el APK el historial del WebView no se usa
  const hayAlgo = overlays.length > 0 || Boolean(nav?.can())
  if (hayAlgo && !centinela) {
    window.history.pushState({ snb: ++seq }, '')
    centinela = true
  }
}

function onPop() {
  centinela = false
  if (handleBack()) { sync(); return }
  hint?.()
}

/** Lo arranca la app una sola vez */
export function initBackStack(opts: {
  nav: { can: () => boolean; back: () => void }
  onExitHint?: () => void
}) {
  nav = opts.nav
  hint = opts.onExitHint ?? null

  if (nativo) {
    let salir = false
    let t: ReturnType<typeof setTimeout> | null = null
    let handle: PluginListenerHandle | null = null
    let vivo = true

    void App.addListener('backButton', () => {
      if (handleBack()) {
        salir = false
        if (t) clearTimeout(t)
        return
      }
      // no queda nada abierto y ya estamos en Inicio: segunda vez, se sale
      if (salir) { void App.exitApp(); return }
      salir = true
      hint?.()
      t = setTimeout(() => { salir = false }, 2200)
    }).then((h) => { if (vivo) handle = h; else void h.remove() })

    return () => {
      vivo = false
      void handle?.remove()
      if (t) clearTimeout(t)
      nav = null
      hint = null
    }
  }

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

/** Registra algo abierto (hoja, diálogo, detalle). Devuelve su id para quitarlo. */
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
