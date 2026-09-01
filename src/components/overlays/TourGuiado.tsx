// Recorrido guiado de bienvenida: un velo oscuro con un AGUJERO que resalta un
// elemento REAL de la pantalla y, en la mitad libre, un título corto con la
// frase que explica para qué sirve. Se avanza tocando donde sea.
//
// El agujero es un div con `box-shadow: 0 0 0 9999px` (oscurece todo lo de
// afuera) y se mueve entre paradas con una transición CSS: el navegador repinta
// una sola capa y el hilo principal queda libre, que es lo que hace que se
// sienta fluido en un celular de gama media.
//
// Va en un PORTAL al body por lo mismo que el Fab: <main> lleva siempre
// anim-page / anim-tab-* y esas animaciones terminan en `both`, así que el
// transform queda aplicado para siempre y <main> se vuelve el marco de
// referencia de cualquier position:fixed hijo. Sin el portal, el agujero
// quedaría corrido respecto al elemento que resalta.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight } from 'lucide-react'
import type { TabId } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useBackClose } from '../../hooks/useBackClose'
import { playTap } from '../../lib/sound'
import { vibrate } from '../../lib/fx'

interface Parada {
  /** valor del data-tour del elemento que se resalta */
  ancla: string
  titulo: string
  texto: string
  /** pestaña donde vive el ancla (si hay que navegar) */
  tab?: TabId
  /** submenú de esa pestaña ('' = el menú de cuadros) */
  sub?: string
  /** círculo perfecto (íconos redondos) o rectángulo con sus esquinas reales */
  forma?: 'circulo' | 'tarjeta'
  /** aire alrededor del elemento, en píxeles */
  aire?: number
}

const PASOS: Parada[] = [
  {
    ancla: 'home-widget-first', tab: 'home', sub: '', forma: 'tarjeta', aire: 8,
    titulo: 'Tu inicio, a tu gusto',
    texto: 'Mantené presionado un widget un segundo y lo movés, lo agrandás o lo quitás.',
  },
  {
    ancla: 'snake-launcher', forma: 'circulo', aire: 12,
    titulo: 'Snake anota por vos',
    texto: 'Tocalo y contale lo que gastaste, o pasale la foto del comprobante.',
  },
  {
    ancla: 'tab-money', forma: 'tarjeta', aire: 6,
    titulo: 'Aquí vive tu plata',
    texto: 'Tus cuentas, tus tarjetas, tus ahorros y lo que prestaste o te prestaron.',
  },
  {
    ancla: 'hub-cuentas', tab: 'money', sub: '', forma: 'tarjeta', aire: 8,
    titulo: 'Empezá por tus cuentas',
    texto: 'Anotá dónde tenés tu plata y la app calcula tu saldo real sola.',
  },
  {
    // el selector de mes se ve también dentro del submenú, así que entramos ya
    // a "Pagos" y la parada siguiente (el botón +) no tiene que navegar
    ancla: 'month-switcher', tab: 'month', sub: 'pagos', forma: 'tarjeta', aire: 10,
    titulo: 'Un mes a la vez',
    texto: 'Con las flechas cambiás de mes. Cada uno guarda sus pagos y su balance.',
  },
  {
    ancla: 'fab-add', forma: 'circulo', aire: 10,
    titulo: 'Agregar es un toque',
    texto: 'Este botón crea un pago nuevo: un gasto, un servicio o algo personal.',
  },
  {
    ancla: 'tab-reports', tab: 'reports', sub: '', forma: 'tarjeta', aire: 6,
    titulo: 'Mirá a dónde se va',
    texto: 'Reportes te muestra en qué gastás más, mes a mes y por categoría.',
  },
  {
    ancla: 'tab-settings', tab: 'settings', sub: '', forma: 'tarjeta', aire: 6,
    titulo: 'Todo se personaliza',
    texto: 'Colores, ingresos y avisos. Si querés repetir esto, está en Ajustes › Ayuda.',
  },
]

interface Hueco { x: number; y: number; w: number; h: number; r: number }

const cuadro = () => new Promise((r) => requestAnimationFrame(() => r(null)))
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Lleva la app a la pantalla de la parada. Nunca simulando un clic en la barra:
 * tocar la pestaña que ya está activa resetea el submenú, y eso rompería la
 * parada del botón +, que necesita estar dentro de "Pagos".
 */
function navegar(p: Parada) {
  const s = useFinanceStore.getState()
  if (!p.tab) return
  // al cambiar de pestaña no dejar un submenú abierto en la que se abandona
  if (p.tab !== s.activeTab && s.subs[s.activeTab]) s.setSub(s.activeTab, '')
  const quiere = p.sub ?? ''
  if ((s.subs[p.tab] ?? '') !== quiere) s.setSub(p.tab, quiere)
  if (p.tab !== s.activeTab) s.setActiveTab(p.tab)
}

/** El nodo puede no existir todavía: React remonta <main> al cambiar de pestaña */
function esperarNodo(sel: string, intentos = 45): Promise<HTMLElement | null> {
  return new Promise((res) => {
    let n = 0
    const buscar = () => {
      const el = document.querySelector<HTMLElement>(sel)
      if (el) { res(el); return }
      if (++n >= intentos) { res(null); return }
      requestAnimationFrame(buscar)
    }
    buscar()
  })
}

/**
 * Mientras corren las animaciones de entrada el elemento está trasladado, y los
 * widgets y los cuadros del hub entran escalonados: un temporizador fijo mide
 * corrido. Las animaciones infinitas (el flote del launcher, los brillos) nunca
 * terminan, así que se descartan.
 */
async function esperarAnimaciones(el: HTMLElement) {
  try {
    const nodos: Element[] = []
    for (let n: Element | null = el; n; n = n.parentElement) nodos.push(n)
    const pendientes = nodos
      .flatMap((n, k) => n.getAnimations({ subtree: k === 0 }))
      .filter((a) => a.playState === 'running'
        && a.effect?.getComputedTiming().iterations !== Infinity)
      .map((a) => a.finished.then(() => null, () => null))
    if (!pendientes.length) return
    await Promise.race([Promise.all(pendientes), espera(900)])
  } catch {
    await espera(420) // WebView viejo sin getAnimations
  }
}

function medir(el: HTMLElement, p: Parada): Hueco {
  const r = el.getBoundingClientRect()
  const aire = p.aire ?? 8
  if (p.forma === 'circulo') {
    const d = Math.max(r.width, r.height) + aire * 2
    return {
      x: r.left + r.width / 2 - d / 2,
      y: r.top + r.height / 2 - d / 2,
      w: d, h: d, r: d / 2,
    }
  }
  // el agujero copia las esquinas reales del elemento
  let base = 14
  try { base = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14 } catch { /* da igual */ }
  const h = r.height + aire * 2
  return {
    x: r.left - aire,
    y: r.top - aire,
    w: r.width + aire * 2,
    h,
    r: Math.min(base + aire, h / 2),
  }
}

export function TourGuiado({ onDone }: { onDone: () => void }) {
  const anims = useFinanceStore((s) => s.settings.animations)
  /** parada a la que queremos llegar */
  const [i, setI] = useState(0)
  /**
   * Parada que se está MOSTRANDO, ya medida. Mantener la anterior mientras se
   * mide la siguiente evita que el texto cambie antes que el foco.
   */
  const [vista, setVista] = useState<{ idx: number; hueco: Hueco } | null>(null)

  const idx = vista?.idx ?? 0
  const p = PASOS[idx]
  const ultimo = idx === PASOS.length - 1
  const listo = vista?.idx === i

  const cerrar = useCallback(() => {
    const s = useFinanceStore.getState()
    s.setSub('month', '') // no dejarlo metido dentro de Pagos
    s.setActiveTab('home')
    s.setProfile({ tourDone: true })
    onDone()
  }, [onDone])

  const cerrarRef = useRef(cerrar)
  useEffect(() => { cerrarRef.current = cerrar })

  const toque = () => { if (anims.sounds) playTap(); vibrate(12, anims) }

  const avanzar = () => {
    if (!listo) return // todavía se está midiendo la parada
    if (i >= PASOS.length - 1) {
      if (anims.sounds) playTap()
      vibrate([14, 40, 22], anims)
      cerrar()
      return
    }
    toque()
    setI(i + 1)
  }

  const atras = () => {
    if (i <= 0) { cerrar(); return }
    toque()
    setI(i - 1)
  }

  // el atrás del celular retrocede una parada; en la primera, cierra
  useBackClose(true, atras)

  // navegar y medir cada vez que cambia la parada
  useEffect(() => {
    let cancelado = false
    const paso = PASOS[i]
    navegar(paso)

    void (async () => {
      const el = await esperarNodo(`[data-tour="${paso.ancla}"]`)
      if (cancelado) return
      if (!el) {
        // el ancla no existe (por ejemplo, quitó ese widget del inicio):
        // la parada se salta sola en vez de trabar el recorrido
        if (i >= PASOS.length - 1) cerrarRef.current()
        else setI((v) => v + 1)
        return
      }
      await esperarAnimaciones(el)
      if (cancelado) return
      const r = el.getBoundingClientRect()
      if (r.top < 76 || r.bottom > window.innerHeight - 96) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' })
        await cuadro(); await cuadro()
      }
      if (cancelado) return
      setVista({ idx: i, hueco: medir(el, paso) })
    })()

    return () => { cancelado = true }
  }, [i])

  // seguir al elemento si gira la pantalla o la vista se mueve
  useEffect(() => {
    const actual = vista?.idx
    if (actual == null) return
    const paso = PASOS[actual]
    let raf = 0
    const remedir = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-tour="${paso.ancla}"]`)
        if (el) setVista((v) => (v && v.idx === actual ? { idx: actual, hueco: medir(el, paso) } : v))
      })
    }
    window.addEventListener('resize', remedir)
    window.addEventListener('scroll', remedir, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', remedir)
      window.removeEventListener('scroll', remedir, true)
    }
  }, [vista?.idx])

  const hueco = vista?.hueco
  // el texto va en la mitad libre: si el foco está arriba, abajo; y al revés
  const abajo = hueco ? hueco.y + hueco.h / 2 < window.innerHeight / 2 : true

  return createPortal(
    <div
      className="fixed inset-0 z-[97] tour-capa"
      style={{ touchAction: 'none' }}
      onClick={avanzar}
      role="dialog"
      aria-label={`Recorrido: ${p.titulo}`}
    >
      {/* velo de arranque, hasta que se mide la primera parada */}
      {!hueco && <div className="absolute inset-0 tour-velo-plano anim-fade" />}

      {/* el agujero: su sombra gigante es la que oscurece todo lo demás */}
      {hueco && (
        <div
          className="absolute tour-hueco"
          style={{
            left: hueco.x,
            top: hueco.y,
            width: hueco.w,
            height: hueco.h,
            borderRadius: hueco.r,
          }}
        />
      )}

      {/* el texto de la parada */}
      {hueco && (
        <div
          key={idx}
          className="absolute left-0 right-0 px-7 anim-rise"
          style={abajo
            ? { top: Math.min(hueco.y + hueco.h + 28, window.innerHeight - 210) }
            : { bottom: Math.min(window.innerHeight - hueco.y + 28, window.innerHeight - 210) }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2"
            style={{ color: 'var(--app-accent-soft)' }}
          >
            {idx === 0 ? 'Te muestro lo básico' : `Paso ${idx + 1} de ${PASOS.length}`}
          </p>
          <h2 className="text-[27px] font-bold text-white leading-tight font-display">
            {p.titulo}
          </h2>
          <p className="text-[15.5px] leading-relaxed mt-2" style={{ color: 'rgb(255 255 255 / 0.72)' }}>
            {p.texto}
          </p>

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={(e) => { e.stopPropagation(); avanzar() }}
              className="pressable rounded-2xl px-5 h-11 flex items-center gap-2 text-[14px] font-semibold text-white"
              style={{ background: 'var(--app-gradient)' }}
            >
              {ultimo ? <>Listo <Check size={16} /></> : <>Siguiente <ChevronRight size={16} /></>}
            </button>
            {!ultimo && (
              <button
                onClick={(e) => { e.stopPropagation(); cerrar() }}
                className="pressable text-[13.5px] font-medium"
                style={{ color: 'rgb(255 255 255 / 0.6)' }}
              >
                Saltar
              </button>
            )}
          </div>

          {/* puntitos de avance */}
          <div className="flex gap-1.5 mt-5">
            {PASOS.map((_, k) => (
              <span
                key={k}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: k === idx ? 22 : 7,
                  background: k === idx ? 'var(--app-accent)' : 'rgb(255 255 255 / 0.28)',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
