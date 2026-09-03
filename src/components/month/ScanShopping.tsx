// Comprar escaneando: pasás el código, ponés el precio y sigue. La cámara vive
// arriba y ocupa poco; abajo está lo que llevás y el total en vivo.
//
// La app recuerda cada código: la segunda vez que pasás la misma leche ya sabe
// cómo se llama y cuánto costó, así solo confirmás.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check, CameraOff, Keyboard, Minus, Plus, ScanLine, Trash2, X, Zap,
} from 'lucide-react'
import type { Expense } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { lineTotal, shoppingPlanned } from '../../lib/shopping'
import { abrirCamara, cerrarCamara, codigoValido, crearLector, scannerDisponible } from '../../lib/scanner'
import { formatMoney, money2 } from '../../lib/format'
import { useBackClose } from '../../hooks/useBackClose'
import { playPop, playTick } from '../../lib/sound'
import { vibrate } from '../../lib/fx'
import { CurrencyInput } from '../ui/CurrencyInput'

type Estado = 'pidiendo' | 'leyendo' | 'sin-permiso' | 'sin-camara'

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

  const [estado, setEstado] = useState<Estado>('pidiendo')
  const [captura, setCaptura] = useState<{ code: string; name: string; price: number; conocido: boolean } | null>(null)
  const [qty, setQty] = useState(1)
  const [manual, setManual] = useState(false)

  const lista = expense.shopping
  const total = lista ? shoppingPlanned(lista) : 0
  const items = lista?.items ?? []

  /** Un código leído: si ya lo conocemos, viene con nombre y precio */
  const capturar = useCallback((code: string) => {
    const ahora = Date.now()
    // el mismo código repetido en menos de 2 s es la misma lectura
    if (ultimo.current.code === code && ahora - ultimo.current.t < 2000) return
    ultimo.current = { code, t: ahora }
    if (!codigoValido(code)) return

    const previo = findProduct(code)
    setCaptura({
      code,
      name: previo?.name ?? '',
      price: previo?.price ?? 0,
      conocido: Boolean(previo),
    })
    setQty(1)
    if (anims.sounds) playPop()
    vibrate(14, anims)
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
        if (v && v.readyState >= 2) {
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
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col max-w-[520px] mx-auto" style={{ background: 'var(--c-bg)' }}>
      {/* ── Cámara: arriba y compacta ─────────────────────────────────── */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ height: '34vh', minHeight: 200, background: '#000', paddingTop: 'env(safe-area-inset-top)' }}
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
                Podés agregar los productos a mano con el botón de abajo.
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
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 shrink-0">
          <ScanLine size={15} style={{ color: 'var(--app-accent-soft)' }} />
          <p className="text-[13px] font-semibold text-ink flex-1 truncate">{expense.name}</p>
          <span className="text-[11.5px] text-muted num shrink-0">
            {items.length} {items.length === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3">
          {items.length === 0 ? (
            <div className="text-center py-8 px-6">
              <span
                className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: 'color-mix(in oklab, var(--app-accent) 14%, transparent)', color: 'var(--app-accent-soft)' }}
              >
                <ScanLine size={24} />
              </span>
              <p className="text-[14px] font-semibold text-ink mt-3">Pasá el primer código</p>
              <p className="text-[12.5px] text-muted mt-1 leading-snug">
                Apuntá la cámara al código de barras del producto. Te pregunto el precio y listo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {[...items].reverse().map((p) => (
                <div key={p.id} className="card-soft px-3 py-2.5 flex items-center gap-2.5">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink leading-snug break-words">
                      {p.name}
                    </span>
                    <span className="block text-[11px] text-muted num mt-0.5">
                      {formatMoney(money2(p.price))}{p.qty > 1 && ` × ${p.qty}`}
                    </span>
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
                  <span className="display-money text-[14px] font-bold text-ink shrink-0 w-[74px] text-right">
                    {formatMoney(lineTotal(p))}
                  </span>
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
            onClick={() => { setCaptura({ code: '', name: '', price: 0, conocido: false }); setQty(1); setManual(true) }}
            className="pressable btn-ghost flex-1 flex items-center justify-center gap-2 !py-2.5"
          >
            <Keyboard size={15} /> A mano
          </button>
          <button onClick={onClose} className="pressable btn-primary flex-1 !py-2.5">
            Listo
          </button>
        </div>
      </div>

      {/* ── Producto leído: nombre, precio y cantidad ─────────────────── */}
      {captura && (
        <div className="absolute inset-0 z-10 flex items-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] anim-fade" onClick={() => { setCaptura(null); setManual(false) }} />
          <div
            className="relative w-full rounded-t-3xl p-4 pt-3 anim-sheet"
            style={{ background: 'var(--c-card)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            <span className="block w-10 h-1 rounded-full bg-edge mx-auto mb-3" />

            {captura.conocido && (
              <p
                className="text-[11.5px] font-semibold flex items-center gap-1.5 mb-2"
                style={{ color: 'var(--c-income)' }}
              >
                <Zap size={12} /> Ya lo conocía: revisá el precio y listo
              </p>
            )}
            {!manual && captura.code && (
              <p className="text-[10.5px] text-muted num mb-2">Código {captura.code}</p>
            )}

            <input
              className="input-base mb-2"
              placeholder="¿Qué producto es?"
              value={captura.name}
              onChange={(e) => setCaptura({ ...captura, name: e.target.value })}
              autoFocus={!captura.conocido}
            />

            <div className="flex gap-2 items-center">
              <CurrencyInput
                value={captura.price}
                onChange={(v) => setCaptura({ ...captura, price: v })}
                className="flex-1"
                autoFocus={captura.conocido}
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
              <button
                onClick={() => { setCaptura(null); setManual(false); if (anims.sounds) playTick() }}
                className="pressable btn-ghost px-5"
              >
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
