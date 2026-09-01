// Plan financiero (mejora 3): compara tu reparto REAL del mes contra la regla
// que elegiste (50/30/20, 40/30/20/10, 70/20/10…) y explica cada porcentaje.
import { useMemo, useState } from 'react'
import { Check, ChevronDown, Info, Scale } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { FINANCIAL_PLANS, financialPlan, planStatus } from '../../lib/financialPlans'
import { depositsInMonth } from '../../lib/fund'
import { formatMoney } from '../../lib/format'
import { BottomSheet } from '../ui/BottomSheet'

export function PlanCard() {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const debts = useFinanceStore((s) => s.debts)
  const settings = useFinanceStore((s) => s.settings)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)

  const plan = financialPlan(settings.financialPlanId)
  const data = useMemo(() => {
    if (!plan || !month) return null
    return planStatus(plan, month, debts, settings, depositsInMonth(settings, monthId), settings.financialPlanCustom)
  }, [plan, month, debts, settings, monthId])

  // Sin plan elegido: invitación
  if (!plan) {
    return (
      <>
        <button
          onClick={() => setPickerOpen(true)}
          className="pressable card p-3.5 flex items-center gap-3 text-left"
          style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 45%, var(--c-border))' }}
        >
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in oklab, var(--app-accent) 18%, transparent)' }}
          >
            <Scale size={17} style={{ color: 'var(--app-accent-soft)' }} />
          </span>
          <span className="flex-1">
            <span className="block text-[13.5px] font-semibold text-ink">Elegí tu plan financiero</span>
            <span className="block text-[11.5px] text-muted mt-0.5">
              50/30/20 y otras reglas para repartir tu ingreso sin pensarlo
            </span>
          </span>
          <ChevronDown size={16} className="text-muted shrink-0 -rotate-90" />
        </button>
        <PlanPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      </>
    )
  }

  return (
    <>
      <div className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Scale size={12} /> Plan {plan.name}
            </p>
            <p className="text-[11.5px] text-muted mt-0.5 truncate">{plan.tagline}</p>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="pressable text-[11.5px] font-semibold shrink-0"
            style={{ color: 'var(--app-accent-soft)' }}
          >
            Cambiar
          </button>
        </div>

        {data && data.income > 0 ? (
          <div className="flex flex-col gap-2.5 mt-3">
            {data.buckets.map((b) => {
              const over = b.diff < 0
              const pctBar = b.target > 0 ? Math.min(100, (b.actual / b.target) * 100) : 0
              return (
                <button
                  key={b.key}
                  onClick={() => setDetail(b.key)}
                  className="pressable text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] text-ink flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                      {b.label}
                      <span className="text-[10.5px] text-muted">{b.pct}%</span>
                      <Info size={10} className="text-muted" />
                    </span>
                    <span className="num text-[12px] shrink-0">
                      <span className="font-bold" style={{ color: over ? 'var(--c-danger)' : 'var(--c-text)' }}>
                        {formatMoney(b.actual)}
                      </span>
                      <span className="text-muted"> / {formatMoney(b.target)}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-elevated overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pctBar}%`, background: over ? 'var(--c-danger)' : b.color }}
                    />
                  </div>
                  <p className="text-[10.5px] mt-0.5" style={{ color: over ? 'var(--c-danger)' : 'var(--c-muted)' }}>
                    {over
                      ? `Te pasaste ${formatMoney(Math.abs(b.diff))} (vas al ${b.actualPct}% de tu ingreso)`
                      : `Te queda margen de ${formatMoney(b.diff)} · vas al ${b.actualPct}%`}
                  </p>
                </button>
              )
            })}
            <p className="text-[10.5px] text-muted">
              Sobre un ingreso de <span className="num font-semibold text-ink">{formatMoney(data.income)}</span>.
              Tocá una bolsa para ver qué incluye.
            </p>
          </div>
        ) : (
          <p className="text-[12.5px] text-muted mt-3">
            Configurá tu ingreso en Ajustes para ver cómo va tu reparto.
          </p>
        )}
      </div>

      <PlanPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      {/* Explicación de una bolsa */}
      {detail && (() => {
        const b = plan.buckets.find((x) => x.key === detail)
        if (!b) return null
        return (
          <BottomSheet open onClose={() => setDetail(null)} title={b.label} subtitle={`${b.pct}% de tu ingreso`}>
            <div className="flex flex-col gap-3 pb-2">
              <p className="text-[13.5px] text-ink leading-relaxed">{b.desc}</p>
              <div className="card p-3.5">
                <p className="text-[11.5px] text-muted">En la app cuenta como esta bolsa:</p>
                <p className="text-[12.5px] text-ink mt-1">
                  {b.kinds.map((k) => (
                    k === 'servicio' ? 'servicios obligatorios'
                      : k === 'gasto' ? 'gastos'
                        : k === 'personal' ? 'personales'
                          : k === 'deuda' ? 'cuotas de deudas'
                            : 'lo que apartás al ahorro'
                  )).join(', ')}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="pressable btn-primary w-full">Entendido</button>
            </div>
          </BottomSheet>
        )
      })()}
    </>
  )
}

/* ─── Selector de plan con la explicación de cada porcentaje ─────────────── */

export function PlanPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useFinanceStore((s) => s.settings)
  const setSettings = useFinanceStore((s) => s.setSettings)
  const [expand, setExpand] = useState<string | null>(null)

  if (!open) return null

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Tu plan financiero"
      subtitle="Una regla simple para repartir cada ingreso. Podés cambiarla cuando quieras."
    >
      <div className="flex flex-col gap-2.5 pb-2">
        {FINANCIAL_PLANS.map((p) => {
          const activo = settings.financialPlanId === p.id
          const abierto = expand === p.id
          return (
            <div
              key={p.id}
              className="card p-3.5"
              style={activo ? { borderColor: 'var(--app-accent)', background: 'color-mix(in oklab, var(--app-accent) 7%, var(--c-card))' } : undefined}
            >
              <button onClick={() => setExpand(abierto ? null : p.id)} className="pressable w-full text-left">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[16px] font-bold text-ink flex-1">{p.name}</span>
                  {activo && <Check size={16} style={{ color: 'var(--app-accent-soft)' }} />}
                  <ChevronDown
                    size={15}
                    className="text-muted transition-transform"
                    style={abierto ? { transform: 'rotate(180deg)' } : undefined}
                  />
                </div>
                <p className="text-[12px] text-muted mt-0.5">{p.tagline}</p>
                {/* barra de proporciones */}
                <div className="flex h-2.5 rounded-full overflow-hidden mt-2">
                  {p.buckets.map((b) => (
                    <span key={b.key} style={{ width: `${b.pct}%`, background: b.color }} />
                  ))}
                </div>
              </button>

              {abierto && (
                <div className="anim-fade mt-2.5 flex flex-col gap-2">
                  {p.buckets.map((b) => (
                    <div key={b.key} className="flex gap-2.5">
                      <span
                        className="num text-[13px] font-bold shrink-0 w-9 text-right"
                        style={{ color: b.color }}
                      >
                        {b.pct}%
                      </span>
                      <span className="flex-1">
                        <span className="block text-[12.5px] font-semibold text-ink">{b.label}</span>
                        <span className="block text-[11.5px] text-muted leading-snug mt-0.5">{b.desc}</span>
                      </span>
                    </div>
                  ))}
                  <p className="text-[10.5px] text-muted mt-1">
                    Ideal para: {p.bestFor} · {p.source}
                  </p>
                  <button
                    onClick={() => { setSettings({ financialPlanId: p.id }); onClose() }}
                    className="pressable btn-primary w-full !py-2 text-[13px] mt-1"
                  >
                    {activo ? 'Mantener este plan' : `Usar el plan ${p.name}`}
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {settings.financialPlanId && (
          <button
            onClick={() => { setSettings({ financialPlanId: undefined }); onClose() }}
            className="pressable text-[12.5px] text-muted underline decoration-dotted self-center"
          >
            Quitar el plan
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
