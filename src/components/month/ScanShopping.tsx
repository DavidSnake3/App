// Comprar escaneando: pasás el código, la app busca el nombre, ponés el precio
// y sigue. La cámara vive arriba y ocupa poco; abajo, lo que llevás.
//
// El nombre sale solo: primero de lo que ya escaneaste antes, y si no, de una
// base abierta de productos. Solo hay que confirmar el precio.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check, CameraOff, Keyboard, Loader2, Minus, Plus, ScanLine, Trash2, X, XCircle, Zap,
} from 'lucide-react'
import type { Expense } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { lineTotal, shoppingCart } from '../../lib/shopping'
import {
  abrirCamara, buscarNombre, cerrarCamara, codigoValido, crearLector, scannerDisponible,
} from '../../lib/scanner'
import { formatMoney, money2 } from '../../lib/format'
import { useBackClose } from '../../hooks/useBackClose'
import { playPop, playTick } from '../../lib/sound'
import { vibrate } from '../../lib/fx'
import { CurrencyInput } from '../ui/CurrencyInput'

type Estado = 'pidiendo' | 'leyendo' | 'sin-permiso' | 'sin-camara'

interface Captura {
  code: string
  name: string
  price: number
  /** de dónde salió el nombre: lo que ya compraste, o la base de productos */
  fuente: 'tuyo' | 'catalogo' | 'nuevo'
  buscando: boolean
}

export function ScanShopping({ monthId, expense, open, onClose }: {
  monthId: string
  expense: Expense
  open: boolean
  onClose: () => void
}) {
  useBackClose(open, onClose)
  if (!open) return null
  return createPortal(<Pantalla monthId={monthId} expense={expense} onClose={onClose} />, document.body)
}

function Pantalla({ monthId, expense, onClose }: {
  monthId: string
  expense: Expense
  onClose: () => void
}) {
  const addProduct = useFinanceStore((s) => s.addShoppingProduct)
  const updateProduct = useFinanceStore((s) => s.updateShoppingProduct)
  const deleteProduct = useFinanceStore((s) => s.deleteShoppingProduct)
  const rememberProduct = useFinanceStore((s) => s.rememberProduct)
  const findProduct = useFinanceStore((s) => s.findProduct)
  const anims = useFinanceStore((s) => s.settings.animations)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const vivo = useRef(true)
  const ultimo = useRef<{ code: string; t: number }>({ code: '', t: 0 })
  const busqueda = useRef<AbortController | null>(null)
  // con el formulario abierto la lectura se pausa: escribiendo el nombre no se
  // puede colar el código del producto que quedó enfrente de la cámara
  const pausado = useRef(false)

  const [estado, setEstado] = useState<Estado>('pidiendo')
  const [captura, setCaptura] = useState<Captura | null>(null)
  const [qty, setQty] = useState(1)
  const [manual, setManual] = useState(false)

  const lista = expense.shopping
  const total = lista ? shoppingCart(lista) : 0
  const items = lista?.items ?? []

  /** Un código leído: se busca el nombre y solo queda poner el precio */
  const capturar = useCallback((code: string) => {
    if (pausado.current) return
    const ahora = Date.now()
    // el mismo código repetido en menos de 2 s es la misma lectura
    if (ultimo.current.code === code && ahora - ultimo.current.t < 2000) return
    ultimo.current = { code, t: ahora }
    if (!codigoValido(code)) return

    const previo = findProduct(code)
    if (anims.sounds) playPop()
    vibrate(14, anims)

    pausado.current = true
    if (previo) {
      setCaptura({ code, name: previo.name, price: previo.price, fuente: 'tuyo', buscando: false })
      setQty(1)
      return
    }

    // no lo conocemos: lo buscamos mientras el usuario ya puede escribir
    setCaptura({ code, name: '', price: 0, fuente: 'nuevo', buscando: true })
    setQty(1)
    busqueda.current?.abort()
    const ctrl = new AbortController()
    busqueda.current = ctrl
    const corte = setTimeout(() => ctrl.abort(), 6000)
    void buscarNombre(code, ctrl.signal).then((nombre) => {
      clearTimeout(corte)
      if (!vivo.current) return
      setCaptura((c) => {
        if (!c || c.code !== code) return c
        // si el usuario ya empezó a escribir, no se le pisa
        if (c.name.trim()) return { ...c, buscando: false }
        return nombre
          ? { ...c, name: nombre, fuente: 'catalogo', buscando: false }
          : { ...c, buscando: false }
      })
    })
  }, [findProduct, anims])

  // Cámara + lectura continua
  useEffect(() => {
    vivo.current = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const arrancar = async () => {
      if (!scannerDisponible()) { setEstado('sin-camara'); return }
      let lector: Awaited<ReturnType<typeof crearLector>> = null
      try {
        streamRef.current = await abrirCamara()
        lector = await crearLector()
      } catch {
        if (vivo.current) setEstado('sin-permiso')
        return
      }
      if (!vivo.current || !lector) { cerrarCamara(streamRef.current); return }
      const video = videoRef.current
      if (video) {
        video.srcObject = streamRef.current
        try { await video.play() } catch { /* el navegador ya lo reproduce */ }
      }
      setEstado('leyendo')

      const mirar = async () => {
        if (!vivo.current) return
        const v = videoRef.current
        // hay fotograma cuando el video ya trae medidas: algunos aparatos
        // tardan en subir readyState aunque la imagen ya esté llegando
        const listo = Boolean(v) && (v!.readyState >= 2 || v!.videoWidth > 0)
        if (v && listo && !pausado.current) {
          try {
            const hits = await lector.detect(v)
            const code = hits[0]?.rawValue?.trim()
            if (code) capturar(code)
          } catch { /* un fotograma malo no rompe la lectura */ }
        }
        timer = setTimeout(() => void mirar(), 220)
      }
      void mirar()
    }

    void arrancar()
    return () => {
      vivo.current = false
      if (timer) clearTimeout(timer)
      busqueda.current?.abort()
      cerrarCamara(streamRef.current)
      streamRef.current = null
    }
  }, [capturar])

  const guardar = () => {
    if (!captura || !captura.name.trim() || captura.price <= 0) return
    addProduct(monthId, expense.id, {
      name: captura.name.trim(),
      price: money2(captura.price),
      qty: Math.max(1, qty),
      barcode: captura.code || undefined,
    })
    if (captura.code) {
      rememberProduct({ barcode: captura.code, name: captura.name.trim(), price: money2(captura.price) })
    }
    if (anims.sounds) playPop()
    vibrate(18, anims)
    setCaptura(null)
    setManual(false)
    ultimo.current = { code: '', t: 0 }
    // un respiro antes de volver a leer, o el mismo producto entra dos veces
    setTimeout(() => { pausado.current = false }, 700)
  }

  const cerrarCaptura = () => {
    busqueda.current?.abort()
    setCaptura(null)
    setManual(false)
    if (anims.sounds) playTick()
    ultimo.current = { code: '', t: 0 }
    setTimeout(() => { pausado.current = false }, 700)
  }

  return (
    <div
      className="fixed inset-0 flex flex-col max-w-[520px] mx-auto"
      style={{ zIndex: 120, background: 'var(--c-bg-base)' }}
    >
      {/* ── Cámara: arriba y compacta ─────────────────────────────────── */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ height: '36vh', minHeight: 210, background: '#000', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: estado === 'leyendo' ? 1 : 0.25 }}
        />

        {/* marco de puntería con su línea que barre */}
        {estado === 'leyendo' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-[74%] aspect-[5/3]">
              <Esquina className="top-0 left-0 border-t-2 border-l-2 rounded-tl-xl" />
              <Esquina className="top-0 right-0 border-t-2 border-r-2 rounded-tr-xl" />
              <Esquina className="bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl" />
              <Esquina className="bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl" />
              <span className="scan-beam" />
            </div>
          </div>
        )}

        {estado !== 'leyendo' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center gap-2">
            <CameraOff size={26} className="text-white/70" />
            <p className="text-[13px] font-semibold text-white">
              {estado === 'pidiendo' ? 'Encendiendo la cámara…'
                : estado === 'sin-permiso' ? 'Necesito permiso para la cámara'
                  : 'Este teléfono no puede leer códigos'}
            </p>
            {estado !== 'pidiendo' && (
              <p className="text-[11.5px] text-white/70 leading-snug">
                Podés agregarlos a mano con el botón de abajo.
              </p>
            )}
          </div>
        )}

        {/* cerrar */}
        <button
          onClick={onClose}
          aria-label="Cerrar el lector"
          className="pressable absolute right-3 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ top: 'calc(env(safe-area-inset-top) + 10px)', background: 'rgba(0,0,0,.55)', color: '#fff' }}
        >
          <X size={17} />
        </button>

        {/* total en vivo, siempre a la vista */}
        <div
          className="absolute left-3 rounded-xl px-3 py-1.5 backdrop-blur-sm"
          style={{ top: 'calc(env(safe-area-inset-top) + 10px)', background: 'rgba(0,0,0,.55)' }}
        >
          <p className="text-[9.5px] font-semibold uppercase tracking-wider text-white/70">Llevás</p>
          <p className="display-money text-[17px] font-bold text-white leading-none">{formatMoney(total)}</p>
        </div>
      </div>

      {/* ── Abajo: lo que llevás ──────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {items.length === 0 ? (
          <div className="text-center py-10 px-6">
            <span
              className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
              style={{ background: 'color-mix(in oklab, var(--app-accent) 14%, transparent)', color: 'var(--app-accent-soft)' }}
            >
              <ScanLine size={24} />
            </span>
            <p className="text-[12.5px] text-muted mt-3 leading-snug">
              Apuntá al código de barras del producto.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[...items].reverse().map((p) => (
              <div key={p.id} className="card-soft px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <p className="flex-1 min-w-0 text-[13.5px] font-semibold text-ink leading-snug break-words">
                    {p.name}
                  </p>
                  <span className="display-money text-[14.5px] font-bold text-ink shrink-0">
                    {formatMoney(lineTotal(p))}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="num text-[11.5px] text-muted flex-1 min-w-0 truncate">
                    {formatMoney(money2(p.price))} c/u
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => (p.qty > 1
                        ? updateProduct(monthId, expense.id, p.id, { qty: p.qty - 1 })
                        : deleteProduct(monthId, expense.id, p.id))}
                      aria-label={p.qty > 1 ? `Quitar uno de ${p.name}` : `Borrar ${p.name}`}
                      className="pressable w-7 h-7 rounded-lg bg-elevated border border-edge flex items-center justify-center text-muted"
                    >
                      {p.qty > 1 ? <Minus size={12} /> : <Trash2 size={11} />}
                    </button>
                    <span className="num text-[13px] font-bold text-ink w-6 text-center">{p.qty}</span>
                    <button
                      onClick={() => updateProduct(monthId, expense.id, p.id, { qty: p.qty + 1 })}
                      aria-label={`Agregar uno de ${p.name}`}
                      className="pressable w-7 h-7 rounded-lg bg-elevated border border-edge flex items-center justify-center text-muted"
                    >
                      <Plus size={12} />
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* barra de abajo */}
      <div
        className="shrink-0 border-t border-edge px-4 pt-3 flex items-center gap-2.5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', background: 'var(--c-card)' }}
      >
        <button
          onClick={() => {
            pausado.current = true
            setCaptura({ code: '', name: '', price: 0, fuente: 'nuevo', buscando: false })
            setQty(1)
            setManual(true)
          }}
          className="pressable btn-ghost flex-1 flex items-center justify-center gap-2 !py-2.5"
        >
          <Keyboard size={15} /> A mano
        </button>
        <button onClick={onClose} className="pressable btn-primary flex-1 !py-2.5">
          Listo
        </button>
      </div>

      {/* ── Producto leído: nombre, precio y cantidad ─────────────────── */}
      {captura && (
        <div className="absolute inset-0 flex items-end" style={{ zIndex: 10 }} role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] anim-fade" onClick={cerrarCaptura} />
          <div
            className="relative w-full rounded-t-3xl p-4 pt-3 anim-sheet"
            style={{ background: 'var(--c-card)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            <span className="block w-10 h-1 rounded-full bg-edge mx-auto mb-3" />

            {/* de dónde salió el nombre */}
            {!manual && (
              <p className="text-[11px] flex items-center gap-1.5 mb-2 min-h-[16px]">
                {captura.buscando ? (
                  <span className="text-muted flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Buscando el producto…
                  </span>
                ) : captura.fuente === 'tuyo' ? (
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--c-income)' }}>
                    <Zap size={12} /> Ya lo habías comprado
                  </span>
                ) : captura.fuente === 'catalogo' ? (
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--app-accent-soft)' }}>
                    <Check size={12} /> Lo encontré
                  </span>
                ) : (
                  <span className="num text-muted">Código {captura.code}</span>
                )}
              </p>
            )}

            {/* Nombre, con su botón para borrarlo entero */}
            <div className="relative mb-2">
              <input
                className="input-base pr-10"
                placeholder={captura.buscando ? 'Buscando…' : '¿Qué producto es?'}
                value={captura.name}
                onChange={(e) => setCaptura({ ...captura, name: e.target.value })}
                autoFocus={manual || (!captura.buscando && !captura.name)}
              />
              {captura.name && (
                <button
                  onClick={() => setCaptura({ ...captura, name: '' })}
                  aria-label="Borrar el nombre"
                  className="pressable absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
                >
                  <XCircle size={17} />
                </button>
              )}
            </div>

            <div className="flex gap-2 items-center">
              <CurrencyInput
                value={captura.price}
                onChange={(v) => setCaptura({ ...captura, price: v })}
                className="flex-1"
                autoFocus={Boolean(captura.name) && !manual}
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Menos cantidad"
                  className="pressable w-10 h-12 rounded-xl bg-elevated border border-edge flex items-center justify-center text-muted"
                >
                  <Minus size={15} />
                </button>
                <span className="num text-[17px] font-bold text-ink w-7 text-center">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(99, q + 1))}
                  aria-label="Más cantidad"
                  className="pressable w-10 h-12 rounded-xl bg-elevated border border-edge flex items-center justify-center text-muted"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            {captura.price > 0 && qty > 1 && (
              <p className="text-[11.5px] text-muted num mt-2 text-right">
                {qty} × {formatMoney(money2(captura.price))} = {' '}
                <span className="font-bold text-ink">{formatMoney(money2(captura.price * qty))}</span>
              </p>
            )}

            <div className="flex gap-2 mt-3">
              <button onClick={cerrarCaptura} className="pressable btn-ghost px-5">
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={!captura.name.trim() || captura.price <= 0}
                className="pressable btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Check size={16} /> Al carrito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Esquina({ className }: { className: string }) {
  return (
    <span
      className={`absolute w-7 h-7 ${className}`}
      style={{ borderColor: 'var(--app-accent-soft)' }}
    />
  )
}
