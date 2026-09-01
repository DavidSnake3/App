// Selector visual del estilo de la cuenta: se ve la tarjeta antes de elegirla.
import { Check } from 'lucide-react'
import type { AccountType } from '../../types/finance'
import { ACCOUNT_LOOKS, CARD_NETWORKS, defaultLookFor } from '../../lib/accountLooks'
import { AccountFace } from './AccountFace'

interface Props {
  value?: string
  onChange: (id: string) => void
  type: AccountType
  /** red de la tarjeta (solo para las de crédito) */
  network?: string
  onNetworkChange?: (n: string) => void
}

export function AccountLookPicker({ value, onChange, type, network, onNetworkChange }: Props) {
  const actual = value || defaultLookFor(type)
  const tarjetas = ACCOUNT_LOOKS.filter((l) => l.familia === 'tarjeta')
  const otros = ACCOUNT_LOOKS.filter((l) => l.familia === 'otro')
  const esCredito = type === 'credito'
  // en una tarjeta de crédito se muestran primero las tarjetas
  const grupos = esCredito
    ? [{ titulo: 'Tarjetas', items: tarjetas }, { titulo: 'Otros', items: otros }]
    : [{ titulo: 'Cuentas', items: otros }, { titulo: 'Tarjetas', items: tarjetas }]

  return (
    <div>
      <label className="text-[12px] font-semibold text-muted">¿Cómo se ve?</label>
      <p className="text-[11px] text-muted mt-0.5 leading-snug">
        Para reconocerla de un vistazo, igual que en tu billetera.
      </p>

      {grupos.map((g) => (
        <div key={g.titulo} className="mt-2.5">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1.5">
            {g.titulo}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {g.items.map((l, i) => {
              const activo = l.id === actual
              return (
                <button
                  key={l.id}
                  onClick={() => onChange(l.id)}
                  aria-label={l.label}
                  className="pressable rounded-2xl border p-2 flex flex-col items-center gap-1.5 transition-all duration-200 anim-rise"
                  style={{
                    animationDelay: `${Math.min(i * 25, 200)}ms`,
                    borderColor: activo ? l.color : 'var(--c-border)',
                    background: activo
                      ? `color-mix(in oklab, ${l.color} 13%, var(--c-elevated))`
                      : 'var(--c-elevated)',
                    boxShadow: activo ? `0 6px 18px -12px ${l.color}` : undefined,
                  }}
                >
                  <span className="relative">
                    <AccountFace
                      account={{ type, look: l.id, network: esCredito ? network : undefined }}
                      size={40}
                    />
                    {activo && (
                      <span
                        className="absolute -right-1 -top-1 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: l.color, color: '#fff' }}
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span
                    className="text-[9px] leading-tight text-center w-full truncate"
                    style={{ color: activo ? 'var(--c-text)' : 'var(--c-muted)' }}
                  >
                    {l.label.replace('Tarjeta ', '')}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {esCredito && onNetworkChange && (
        <div className="mt-3">
          <label className="text-[12px] font-semibold text-muted">Red de la tarjeta</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <button
              onClick={() => onNetworkChange('')}
              className={`pressable chip ${!network ? 'chip-active' : ''}`}
            >
              Sin indicar
            </button>
            {CARD_NETWORKS.map((n) => (
              <button
                key={n}
                onClick={() => onNetworkChange(n)}
                className={`pressable chip ${network === n ? 'chip-active' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
