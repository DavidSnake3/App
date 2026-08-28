/** Logo de SNBusiness (punto 19): moneda con chispa de crecimiento */
export function AppLogo({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="SNBusiness">
      <defs>
        <linearGradient id="snb-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--app-accent)" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--app-accent) 45%, #0b0d14)" />
        </linearGradient>
        <linearGradient id="snb-spark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="88" height="88" rx="24" fill="url(#snb-bg)" />
      <rect x="4" y="4" width="88" height="88" rx="24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
      {/* línea de crecimiento */}
      <path
        d="M22 62 L38 48 L50 56 L74 32"
        fill="none" stroke="url(#snb-spark)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M62 30 L76 30 L76 44" fill="none" stroke="url(#snb-spark)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      {/* moneda */}
      <circle cx="30" cy="70" r="9" fill="#ffd166" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
      <circle cx="30" cy="70" r="4.5" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />
    </svg>
  )
}
