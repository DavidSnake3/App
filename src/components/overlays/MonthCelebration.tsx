// La celebración de "mes completado": una pantalla completa, premium, que se
// elige en Ajustes entre cinco estilos. Va en un PORTAL (las vistas tienen
// transform y atraparían un position:fixed) y se cierra sola o al tocar.
//
// Estilos:
//  · estallido  — tarjeta que entra con rebote, anillo que se dibuja, cañonazo de confeti
//  · trofeo     — el trofeo cae, rebota y le pasa un brillo; lluvia de monedas doradas
//  · aurora     — ondas de color de fondo, sobrio y elegante, casi sin confeti
//  · fuegos     — fuegos artificiales por toda la pantalla
//  · racha      — el anillo se llena hasta 100 % con el contador subiendo; celebra la racha
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'
import { Check, ChevronRight, Flame, Sparkles, Trophy } from 'lucide-react'
import type { AnimationPrefs, CelebrationStyle } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useBackClose } from '../../hooks/useBackClose'
import { getMonthSummary } from '../../lib/finance'
import { addMonthsToId, monthLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { playSuccess } from '../../lib/sound'
import { vibrate } from '../../lib/fx'

interface Props {
  open: boolean
  monthId: string
  onClose: () => void
  /** fuerza un estilo (para probarlo desde Ajustes); si no, el de las preferencias */
  style?: CelebrationStyle
  /** en la vista previa no se marca nada ni se calcula la racha real */
  preview?: boolean
}

function reduced(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function accent(): string {
  try { return getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim() || '#7c5cff' } catch { return '#7c5cff' }
}

/** Confeti según el estilo: cada uno tiene su propia "firma" */
function disparar(style: CelebrationStyle, prefs: AnimationPrefs) {
  if (reduced() || !prefs.celebration) return
  const colors = [accent(), '#2dd4a0', '#ffd166', '#ff7ab8', '#ffffff']
  const nivel = prefs.celebrationLevel ?? 'normal'
  const k = nivel === 'suave' ? 0.5 : nivel === 'fiesta' ? 1.6 : 1

  if (style === 'estallido' || style === 'racha') {
    void confetti({ particleCount: Math.round(120 * k), spread: 95, startVelocity: 52, origin: { x: 0.5, y: 0.55 }, colors, disableForReducedMotion: true })
    setTimeout(() => {
      void confetti({ particleCount: Math.round(40 * k), angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true })
      void confetti({ particleCount: Math.round(40 * k), angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true })
    }, 250)
  }
  if (style === 'trofeo') {
    const oro = ['#ffd166', '#ffb703', '#f59e0b', '#fff3c4']
    const fin = Date.now() + 1800 * k
    const lluvia = () => {
      void confetti({ particleCount: 3, spread: 70, startVelocity: 18, gravity: 0.9, scalar: 0.9, shapes: ['circle'], origin: { x: Math.random(), y: -0.05 }, colors: oro, disableForReducedMotion: true })
      if (Date.now() < fin) setTimeout(lluvia, 60)
    }
    setTimeout(lluvia, 500)
  }
  if (style === 'fuegos') {
    const n = Math.round(6 * k)
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        void confetti({
          particleCount: 70, spread: 360, startVelocity: 28, ticks: 90, gravity: 0.55, scalar: 0.95, decay: 0.92,
          origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.45 },
          colors: [colors[i % colors.length], '#ffffff'], disableForReducedMotion: true,
        })
      }, 200 + i * 380)
    }
  }
  if (style === 'aurora' && nivel === 'fiesta') {
    void confetti({ particleCount: 40, spread: 120, startVelocity: 22, gravity: 0.6, scalar: 0.8, origin: { x: 0.5, y: 0.35 }, colors, disableForReducedMotion: true })
  }
}

/**
 * El anillo del estilo "racha": se llena de 0 a 100 % con el número subiendo.
 * Se monta solo mientras la pantalla está abierta, así arranca en 0 cada vez.
 */
function AnilloRacha() {
  const [pct, setPct] = useState(() => (reduced() ? 100 : 0))
  useEffect(() => {
    if (reduced()) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1400)
      const eased = 1 - Math.pow(1 - p, 3)
      setPct(Math.round(eased * 100))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const C = 2 * Math.PI * 52
  return (
    <span className="cel-racha-icono">
      <svg viewBox="0 0 120 120" width="112" height="112" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke="color-mix(in oklab, var(--app-accent) 22%, transparent)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r="52" fill="none" stroke="url(#celGrad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * C} ${C}`}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 80ms linear' }}
        />
        <defs>
          <linearGradient id="celGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--app-accent)" />
            <stop offset="1" stopColor="var(--c-income)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display-money text-[30px] font-bold text-white leading-none">{pct}%</span>
        <span className="text-[10px] uppercase tracking-widest text-white/60 mt-1">pagado</span>
      </span>
    </span>
  )
}

export function MonthCelebration({ open, monthId, onClose, style, preview }: Props) {
  const prefs = useFinanceStore((s) => s.settings.animations)
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const estilo: CelebrationStyle = style ?? prefs.celebrationStyle ?? 'estallido'

  // qué se logró este mes y cuántos meses seguidos van
  const datos = useMemo(() => {
    const m = months[monthId]
    const resumen = m ? getMonthSummary(m, debts) : null
    let racha = 1
    let cursor = addMonthsToId(monthId, -1)
    while (months[cursor]) {
      const r = getMonthSummary(months[cursor], debts)
      if (!r.allPaid || r.countTotal === 0) break
      racha++
      cursor = addMonthsToId(cursor, -1)
    }
    return {
      pagado: resumen?.paidAmount ?? 0,
      pagos: resumen?.countTotal ?? 0,
      racha: preview ? 3 : racha,
    }
  }, [months, monthId, debts, preview])

  useBackClose(open, onClose)

  // sonido, vibración, confeti y cierre automático
  const disparado = useRef(false)
  useEffect(() => {
    if (!open) { disparado.current = false; return }
    if (disparado.current) return
    disparado.current = true
    if (prefs.sounds) playSuccess()
    vibrate([60, 40, 60, 40, 120], prefs)
    disparar(estilo, prefs)
    const t = setTimeout(onClose, estilo === 'fuegos' ? 6200 : 5200)
    return () => clearTimeout(t)
  }, [open, estilo, prefs, onClose])

  if (!open) return null

  const titulo = '¡Mes completado!'
  const sub = `Pagaste todo lo de ${monthLabel(monthId)}`

  return createPortal(
    <div
      className={`fixed inset-0 z-[96] flex items-center justify-center p-6 max-w-[520px] mx-auto cel-capa cel-${estilo}`}
      onClick={onClose}
      role="dialog"
      aria-label={titulo}
    >
      {/* fondo */}
      <div className="absolute inset-0 cel-fondo" />
      {estilo === 'aurora' && (
        <>
          <span className="cel-onda cel-onda-1" />
          <span className="cel-onda cel-onda-2" />
          <span className="cel-onda cel-onda-3" />
        </>
      )}
      {(estilo === 'estallido' || estilo === 'racha') && <span className="cel-halo" />}

      {/* tarjeta */}
      <div
        className="relative w-full rounded-[28px] p-6 pt-8 text-center cel-tarjeta"
        onClick={(e) => e.stopPropagation()}
      >
        {/* la pieza visual de cada estilo */}
        <div className="mx-auto mb-4 flex items-center justify-center" style={{ height: 112 }}>
          {estilo === 'estallido' && (
            <span className="cel-check">
              <svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
                <circle cx="48" cy="48" r="42" fill="none" stroke="color-mix(in oklab, var(--c-income) 30%, transparent)" strokeWidth="6" />
                <circle className="cel-check-ring" cx="48" cy="48" r="42" fill="none" stroke="var(--c-income)" strokeWidth="6" strokeLinecap="round" />
                <path className="cel-check-mark" d="M30 49 L43 62 L67 36" fill="none" stroke="var(--c-income)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          {estilo === 'trofeo' && (
            <span className="cel-trofeo-icono">
              <span className="cel-trofeo-luz" />
              <Trophy size={64} strokeWidth={1.6} style={{ color: '#ffd166' }} />
              <span className="cel-brillo" />
            </span>
          )}
          {estilo === 'aurora' && (
            <span className="cel-aurora-icono">
              <Sparkles size={44} strokeWidth={1.6} className="text-white" />
            </span>
          )}
          {estilo === 'fuegos' && (
            <span className="cel-fuegos-icono">
              <Check size={54} strokeWidth={3} className="text-white" />
            </span>
          )}
          {estilo === 'racha' && <AnilloRacha />}
        </div>

        <p className="text-[11px] font-bold uppercase tracking-[0.16em] cel-kicker">
          {estilo === 'racha' && datos.racha > 1
            ? <><Flame size={11} className="inline -mt-0.5 mr-1" />{datos.racha} meses seguidos</>
            : 'Lo lograste'}
        </p>
        <h2 className="font-display text-[26px] font-bold text-white leading-tight mt-1.5 cel-titulo">
          {titulo}
        </h2>
        <p className="text-[14px] leading-relaxed mt-2 cel-sub">
          {sub}.
          {datos.pagos > 0 && (
            <>
              <br />
              <span className="num font-semibold text-white">{datos.pagos} {datos.pagos === 1 ? 'pago' : 'pagos'}</span>
              {' '}por <span className="num font-semibold text-white">{formatMoney(datos.pagado)}</span>
            </>
          )}
        </p>

        {estilo !== 'racha' && datos.racha > 1 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold cel-pill">
            <Flame size={12} /> {datos.racha} meses seguidos al día
          </p>
        )}

        <button
          onClick={onClose}
          className="pressable mt-6 w-full h-12 rounded-2xl text-[15px] font-semibold text-white flex items-center justify-center gap-2 cel-boton"
        >
          Seguir así <ChevronRight size={17} />
        </button>
      </div>
    </div>,
    document.body,
  )
}
