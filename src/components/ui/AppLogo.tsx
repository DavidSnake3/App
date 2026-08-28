import { SN_GRADIENT, SN_HEAD, SN_N, SN_S } from '../../lib/logo'

/** Marca SN. `size` es la ALTURA; el ancho se ajusta solo (marca apaisada). */
export function AppLogo({ size = 64, id = 'snb' }: { size?: number; id?: string }) {
  const w = Math.round(size * (400 / 230))
  return (
    <svg width={w} height={size} viewBox="0 0 400 230" role="img" aria-label="SNBusiness">
      <defs>
        <linearGradient id={`${id}-g`} x1="50" y1="120" x2="392" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={SN_GRADIENT[0]} />
          <stop offset="100%" stopColor={SN_GRADIENT[1]} />
        </linearGradient>
      </defs>
      <path d={SN_S} fill="none" stroke={`url(#${id}-g)`} strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />
      <path d={SN_N} fill="none" stroke={`url(#${id}-g)`} strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" />
      <path d={SN_HEAD} fill={`url(#${id}-g)`} />
    </svg>
  )
}
