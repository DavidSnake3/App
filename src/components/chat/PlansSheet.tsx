// Planes de Snake: capacidad del chatbot. Los precios se muestran en la moneda
// del usuario, convertidos con el tipo de cambio real (Costa Rica va en colones).
// Los pagos AÚN NO están habilitados: la app está en desarrollo.
import { useEffect, useState } from 'react'
import { Check, Clock, Crown, Sparkles, Star, Zap } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { PLANS, plan as getPlan, planPrice, yearSaving, type PlanId } from '../../lib/plans'
import { getRates, type RatesSnapshot } from '../../lib/rates'
import { isAdmin } from '../../lib/firebase'
import { BottomSheet } from '../ui/BottomSheet'
import { Segmented } from '../ui/Segmented'

const ICONS: Record<PlanId, React.ReactNode> = {
  gratis: <Zap size={18} />,
  plus: <Star size={18} />,
  premium: <Crown size={18} />,
}

export function PlansSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useFinanceStore((s) => s.profile)
  const setProfile = useFinanceStore((s) => s.setProfile)
  const usage = useFinanceStore((s) => s.usage)
  const [cycle, setCycle] = useState<'month' | 'year'>('month')
  const [snap, setSnap] = useState<RatesSnapshot | null>(null)

  // tipo de cambio para mostrar el precio en la moneda del país
  useEffect(() => {
    if (!open) return
    let alive = true
    const t = setTimeout(() => {
      void getRates(false).then((r) => { if (alive) setSnap(r) }).catch(() => {})
    }, 0)
    return () => { alive = false; clearTimeout(t) }
  }, [open])

  if (!open) return null

  const actual = profile.snakePlan ?? 'gratis'
  const admin = isAdmin({ email: profile.email } as Parameters<typeof isAdmin>[0])

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Planes de Snake"
      subtitle="Toda la app es gratis siempre. Los planes solo amplían la capacidad del asistente."
    >
      <div className="flex flex-col gap-3 pb-2">
        {/* Aviso: todavía no hay pagos */}
        <div
          className="rounded-xl px-3.5 py-2.5 flex items-start gap-2.5"
          style={{ background: 'color-mix(in oklab, var(--c-warning) 12%, transparent)' }}
        >
          <Clock size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--c-warning)' }} />
          <p className="text-[11.5px] text-ink leading-snug">
            <span className="font-semibold">Próximamente.</span> La app está en desarrollo y
            todavía no hay forma de pagar: podés ver los planes, pero por ahora todos
            usan el plan Gratis.
          </p>
        </div>

        <Segmented
          value={cycle}
          onChange={setCycle}
          options={[
            { value: 'month', label: 'Mensual' },
            { value: 'year', label: 'Anual · 2 meses gratis' },
          ]}
        />

        {PLANS.map((p) => {
          const price = planPrice(p, profile.currency, snap, cycle)
          const esActual = actual === p.id
          const recomendado = p.id === 'plus'
          return (
            <div
              key={p.id}
              className="card p-4 relative overflow-hidden"
              style={esActual
                ? { borderColor: 'var(--app-accent)', background: 'color-mix(in oklab, var(--app-accent) 7%, var(--c-card))' }
                : recomendado
                  ? { borderColor: 'color-mix(in oklab, var(--app-accent) 45%, var(--c-border))' }
                  : undefined}
            >
              {recomendado && !esActual && (
                <span
                  className="absolute top-0 right-0 text-[9.5px] font-bold px-2.5 py-1 rounded-bl-xl text-white"
                  style={{ background: 'var(--app-gradient)' }}
                >
                  RECOMENDADO
                </span>
              )}

              <div className="flex items-center gap-2.5">
                <span
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: p.id === 'gratis'
                      ? 'var(--c-elevated)'
                      : 'color-mix(in oklab, var(--app-accent) 18%, transparent)',
                    color: p.id === 'gratis' ? 'var(--c-muted)' : 'var(--app-accent-soft)',
                  }}
                >
                  {ICONS[p.id]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[17px] font-bold text-ink leading-tight">
                    {p.name}
                    {esActual && (
                      <span className="text-[10px] font-semibold ml-1.5" style={{ color: 'var(--app-accent-soft)' }}>
                        · TU PLAN
                      </span>
                    )}
                  </p>
                  <p className="text-[11.5px] text-muted leading-snug">{p.tagline}</p>
                </div>
              </div>

              {/* Precio en la moneda del usuario */}
              <div className="mt-3 flex items-end gap-1.5">
                <span
                  className="num text-[24px] font-bold leading-none"
                  style={{ color: p.usdMonth === 0 ? 'var(--c-income)' : 'var(--c-text)' }}
                >
                  {price.label}
                </span>
                {p.usdMonth > 0 && (
                  <span className="text-[11.5px] text-muted mb-0.5">
                    /{cycle === 'year' ? 'año' : 'mes'}
                  </span>
                )}
              </div>
              {p.usdMonth > 0 && (
                <p className="text-[10.5px] text-muted mt-0.5">
                  {cycle === 'year'
                    ? `Ahorrás ${yearSaving(p)}% contra el mensual`
                    : `o ${planPrice(p, profile.currency, snap, 'year').label} al año`}
                  {price.estimated && ' · convertido al tipo de cambio de hoy'}
                </p>
              )}

              <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-edge/60">
                {p.perks.map((perk) => (
                  <p key={perk} className="text-[12px] text-ink flex items-start gap-2">
                    <Check
                      size={13}
                      className="shrink-0 mt-0.5"
                      style={{ color: p.id === 'gratis' ? 'var(--c-muted)' : 'var(--c-income)' }}
                    />
                    {perk}
                  </p>
                ))}
              </div>

              {/* Botón (deshabilitado mientras no haya pagos) */}
              {p.usdMonth > 0 && !esActual && (
                <button
                  disabled
                  className="w-full mt-3 rounded-xl py-2.5 text-[13px] font-semibold opacity-60 cursor-not-allowed"
                  style={{ background: 'var(--c-elevated)', color: 'var(--c-muted)' }}
                >
                  Disponible pronto
                </button>
              )}

              {/* Modo desarrollo: probar los planes sin pago */}
              {admin && !esActual && (
                <button
                  onClick={() => setProfile({ snakePlan: p.id })}
                  className="pressable w-full mt-2 rounded-xl py-2 text-[12px] font-semibold"
                  style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)', color: 'var(--app-accent-soft)' }}
                >
                  Probar este plan (modo desarrollo)
                </button>
              )}
            </div>
          )
        })}

        {/* Consumo de hoy */}
        <div className="card p-3.5">
          <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
            <Sparkles size={12} /> Tu consumo de hoy
          </p>
          <p className="text-[12.5px] text-ink mt-1">
            <span className="num font-bold">{usage?.msgs ?? 0}</span> de{' '}
            <span className="num">{getPlan(actual).limits.msgsPerDay}</span> mensajes ·{' '}
            <span className="num font-bold">{((usage?.tokens ?? 0) / 1000).toFixed(1)}k</span> de{' '}
            <span className="num">{(getPlan(actual).limits.tokensPerDay / 1000).toFixed(0)}k</span> tokens
          </p>
          <p className="text-[11px] text-muted mt-1">
            Este mes: {usage?.monthMsgs ?? 0} mensajes · {((usage?.monthTokens ?? 0) / 1000).toFixed(1)}k tokens
          </p>
        </div>

        <p className="text-[10.5px] text-muted text-center leading-relaxed">
          Los precios fuera de Costa Rica se convierten desde dólares con el tipo de cambio
          del día, así que pueden variar unos centavos.
        </p>
      </div>
    </BottomSheet>
  )
}
