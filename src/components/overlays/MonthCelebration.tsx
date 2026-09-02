// La celebración de "mes completado": pantalla completa con el anillo que se
// llena hasta el 100 % mientras el número sube, cañonazo de confeti y el
// resumen de lo que se pagó. Va en un PORTAL (las vistas tienen transform y
// atraparían un position:fixed) y se cierra sola o al tocar.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import confetti from 'canvas-confetti'
import { ChevronRight } from 'lucide-react'
import type { AnimationPrefs } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useBackClose } from '../../hooks/useBackClose'
import { getMonthSummary } from '../../lib/finance'
import { monthLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { playSuccess } from '../../lib/sound'
import { vibrate } from '../../lib/fx'

interface Props {
  open: boolean
  monthId: string
  onClose: () => void
}

function reduced(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function accent(): string {
  try { return getComputedStyle(document.documentElement).getPropertyValue('--app-accent').trim() || '#7c5cff' } catch { return '#7c5cff' }
}

/** Cañonazo central y dos chorros laterales, justo cuando el anillo llega al 100 % */
function disparar(prefs: AnimationPrefs) {
  if (reduced() || !prefs.celebration) return
  const colors = [accent(), '#2dd4a0', '#ffd166', '#ff7ab8', '#ffffff']
  setTimeout(() => {
    void confetti({ particleCount: 120, spread: 95, startVelocity: 52, origin: { x: 0.5, y: 0.55 }, colors, disableForReducedMotion: true })
  }, 1300)
  setTimeout(() => {
    void confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true })
    void confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true })
  }, 1550)
}

/** El anillo se llena de 0 a 100 % con el número subiendo. Se monta al abrir, así arranca en 0. */
function AnilloCompleto() {
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
    <span className="cel-anillo">
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

export function MonthCelebration({ open, monthId, onClose }: Props) {
  const prefs = useFinanceStore((s) => s.settings.animations)
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)

  // qué se logró este mes
  const datos = useMemo(() => {
    const m = months[monthId]
    const resumen = m ? getMonthSummary(m, debts) : null
    return { pagado: resumen?.paidAmount ?? 0, pagos: resumen?.countTotal ?? 0 }
  }, [months, monthId, debts])

  useBackClose(open, onClose)

  // sonido, vibración, confeti y cierre automático
  const disparado = useRef(false)
  useEffect(() => {
    if (!open) { disparado.current = false; return }
    if (disparado.current) return
    disparado.current = true
    if (prefs.sounds) playSuccess()
    vibrate([60, 40, 60, 40, 120], prefs)
    disparar(prefs)
    const t = setTimeout(onClose, 5200)
    return () => clearTimeout(t)
  }, [open, prefs, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center p-6 max-w-[520px] mx-auto cel-capa"
      onClick={onClose}
      role="dialog"
      aria-label="Mes completado"
    >
      <div className="absolute inset-0 cel-fondo" />
      <span className="cel-halo" />

      <div
        className="relative w-full rounded-[28px] p-6 pt-8 text-center cel-tarjeta"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex items-center justify-center" style={{ height: 112 }}>
          <AnilloCompleto />
        </div>

        <p className="text-[11px] font-bold uppercase tracking-[0.16em] cel-kicker">Lo lograste</p>
        <h2 className="font-display text-[26px] font-bold text-white leading-tight mt-1.5 cel-titulo">
          ¡Mes completado!
        </h2>
        <p className="text-[14px] leading-relaxed mt-2 cel-sub">
          Pagaste todo lo de {monthLabel(monthId)}.
          {datos.pagos > 0 && (
            <>
              <br />
              <span className="num font-semibold text-white">{datos.pagos} {datos.pagos === 1 ? 'pago' : 'pagos'}</span>
              {' '}por <span className="num font-semibold text-white">{formatMoney(datos.pagado)}</span>
            </>
          )}
        </p>

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
