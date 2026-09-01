// La "carita" de una cuenta: se dibuja como una mini tarjeta (con su banda y
// su chip) o como un monedero/billete, según el estilo elegido. Es lo que
// hace que reconozcas la cuenta de un vistazo en la lista.
import { accountLook, defaultLookFor } from '../../lib/accountLooks'
import type { Account } from '../../types/finance'

interface Props {
  account: Pick<Account, 'type' | 'look' | 'network' | 'color'>
  /** ancho en píxeles; el alto sale de la proporción de una tarjeta */
  size?: number
  className?: string
}

export function AccountFace({ account, size = 44, className = '' }: Props) {
  const look = accountLook(account.look) ?? accountLook(defaultLookFor(account.type))!
  const esTarjeta = look.familia === 'tarjeta'
  const h = esTarjeta ? Math.round(size * 0.64) : size
  const { Icon } = look

  return (
    <span
      className={`relative flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: h,
        borderRadius: esTarjeta ? Math.round(size * 0.14) : Math.round(size * 0.28),
        background: account.color
          ? `linear-gradient(135deg, ${account.color}, color-mix(in oklab, ${account.color} 45%, #000))`
          : look.gradient,
        boxShadow: `0 6px 16px -9px ${look.color}`,
      }}
    >
      {esTarjeta ? (
        <>
          {/* banda magnética */}
          <span
            className="absolute left-0 right-0"
            style={{ top: '22%', height: '16%', background: 'rgb(0 0 0 / 0.28)' }}
          />
          {/* chip */}
          <span
            className="absolute"
            style={{
              left: '12%', top: '48%',
              width: '18%', height: '20%',
              borderRadius: 2,
              background: 'rgb(255 255 255 / 0.55)',
            }}
          />
          {account.network && (
            <span
              className="absolute font-bold leading-none"
              style={{
                right: '9%', bottom: '13%',
                fontSize: Math.max(5, Math.round(size * 0.13)),
                color: look.ink,
                opacity: 0.9,
                letterSpacing: '-0.02em',
              }}
            >
              {account.network}
            </span>
          )}
          {/* brillo diagonal */}
          <span
            className="absolute inset-0"
            style={{ background: 'linear-gradient(115deg, rgb(255 255 255 / 0.18) 0%, transparent 45%)' }}
          />
        </>
      ) : (
        <Icon size={Math.round(size * 0.46)} style={{ color: look.ink }} />
      )}
    </span>
  )
}
