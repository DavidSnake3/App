import { useEffect, useState } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { SN_GRADIENT, SN_HEAD, SN_N, SN_S } from '../../lib/logo'

/**
 * Animación de arranque premium: el logo se dibuja a sí mismo, la flecha
 * aparece con rebote, brillo de fondo y salida suave hacia la app.
 */
export function SplashIntro({ onDone }: { onDone: () => void }) {
  const transitions = useFinanceStore((s) => s.settings.animations.transitions)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let reduced = false
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { /* nada */ }
    if (reduced || !transitions) { onDone(); return }
    const t1 = setTimeout(() => setLeaving(true), 2250)
    const t2 = setTimeout(onDone, 2700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone, transitions])

  const skip = () => { setLeaving(true); setTimeout(onDone, 380) }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden max-w-[520px] mx-auto"
      style={{ background: '#0b0d14', animation: leaving ? 'splashOut 0.45s ease forwards' : undefined }}
      onClick={skip}
      role="presentation"
    >
      {/* brillo de fondo */}
      <div
        className="absolute w-[560px] h-[560px] rounded-full"
        style={{
          background: `radial-gradient(circle, ${SN_GRADIENT[0]}33 0%, ${SN_GRADIENT[1]}22 38%, transparent 70%)`,
          animation: 'glowPulse 2.4s ease-in-out infinite',
        }}
      />

      {/* logo que se dibuja */}
      <div className="relative" style={{ animation: 'splashFloat 2.6s ease-in-out infinite' }}>
        <svg width="256" height="147" viewBox="0 0 400 230" aria-label="SNBusiness">
          <defs>
            <linearGradient id="splash-g" x1="50" y1="120" x2="392" y2="110" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={SN_GRADIENT[0]} />
              <stop offset="100%" stopColor={SN_GRADIENT[1]} />
            </linearGradient>
          </defs>
          <path d={SN_S} pathLength={1} className="splash-draw-s" fill="none" stroke="url(#splash-g)" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />
          <path d={SN_N} pathLength={1} className="splash-draw-n" fill="none" stroke="url(#splash-g)" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />
          <path d={SN_HEAD} className="splash-draw-head" fill="url(#splash-g)" />
        </svg>
        {/* destello que barre el logo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-0 bottom-0 w-16"
            style={{
              background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent)',
              animation: 'splashShine 0.7s ease-in-out 1.7s both',
            }}
          />
        </div>
      </div>

      {/* wordmark */}
      <p
        className="font-display font-bold text-[26px] mt-7 relative"
        style={{ color: '#e8eaf2', animation: 'splashWord 0.6s cubic-bezier(0.2,0.8,0.3,1) 1.45s both' }}
      >
        SNBusiness
      </p>
      <p
        className="text-[12.5px] relative"
        style={{ color: '#98a0b3', animation: 'splashWord 0.6s ease 1.7s both' }}
      >
        Tus finanzas, en orden
      </p>
    </div>
  )
}
