import { useEffect, useState } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { SN_GRADIENT, SN_HEAD, SN_N, SN_S } from '../../lib/logo'

// El splash debe reproducirse UNA sola vez por arranque de la app,
// aunque React cambie de pantalla (login → onboarding → inicio).
let playedThisBoot = false

/** Animación de arranque: el logo se dibuja a sí mismo y da paso a la app. */
export function SplashIntro({ onDone }: { onDone: () => void }) {
  const transitions = useFinanceStore((s) => s.settings.animations.transitions)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (playedThisBoot) { onDone(); return }
    playedThisBoot = true
    let reduced = false
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { /* nada */ }
    if (reduced || !transitions) { onDone(); return }
    const t1 = setTimeout(() => setLeaving(true), 2050)
    const t2 = setTimeout(onDone, 2500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

      {/* logo que se dibuja (solo la animación, sin textos ni destellos) */}
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
      </div>
    </div>
  )
}
