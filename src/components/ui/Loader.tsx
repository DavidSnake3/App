import { SN_GRADIENT, SN_HEAD, SN_N, SN_S } from '../../lib/logo'

/**
 * Cargando llamativo de la marca (mejora 1): el logo SN se dibuja en bucle
 * con un anillo orbital de puntos en gradiente.
 */
export function Loader({ size = 72, label }: { size?: number; label?: string }) {
  const w = size
  const h = Math.round(size * 0.575)
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-2" role="status" aria-label={label ?? 'Cargando'}>
      <div className="relative flex items-center justify-center" style={{ width: w * 1.7, height: w * 1.7 }}>
        {/* anillo orbital */}
        <svg
          className="absolute inset-0"
          viewBox="0 0 100 100"
          style={{ animation: 'loaderSpin 1.6s linear infinite' }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="loader-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={SN_GRADIENT[0]} />
              <stop offset="100%" stopColor={SN_GRADIENT[1]} />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--c-border)" strokeWidth="3" opacity="0.5" />
          <circle
            cx="50" cy="50" r="44" fill="none"
            stroke="url(#loader-ring)" strokeWidth="4" strokeLinecap="round"
            strokeDasharray="80 196"
          />
          <circle cx="50" cy="6" r="4.5" fill={SN_GRADIENT[1]} />
        </svg>

        {/* logo dibujándose en bucle */}
        <svg width={w} height={h} viewBox="0 0 400 230" aria-hidden="true">
          <defs>
            <linearGradient id="loader-g" x1="50" y1="120" x2="392" y2="110" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={SN_GRADIENT[0]} />
              <stop offset="100%" stopColor={SN_GRADIENT[1]} />
            </linearGradient>
          </defs>
          <path d={SN_S} pathLength={1} className="loader-draw" fill="none" stroke="url(#loader-g)" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />
          <path d={SN_N} pathLength={1} className="loader-draw" style={{ animationDelay: '0.15s' }} fill="none" stroke="url(#loader-g)" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />
          <path d={SN_HEAD} fill="url(#loader-g)" style={{ animation: 'loaderHead 2.2s ease-in-out infinite' }} />
        </svg>
      </div>
      {label && <p className="text-[12.5px] text-muted" style={{ animation: 'pulseSoft 1.4s ease-in-out infinite' }}>{label}</p>}
    </div>
  )
}

/** Versión mini para botones */
export function LoaderDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: 'currentColor',
            animation: 'loaderDot 1s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  )
}
