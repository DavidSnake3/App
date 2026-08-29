import { useState } from 'react'
import { BadgeCheck, Sparkles } from 'lucide-react'
import { Loader } from '../ui/Loader'
import type { PaymentPlan } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { buildHeuristicPlans, financeSnapshot } from '../../lib/plans'
import { aiAvailable, getAIPlans } from '../../lib/ai'
import { formatMoney } from '../../lib/format'
import { BottomSheet } from '../ui/BottomSheet'

interface Props {
  open: boolean
  onClose: () => void
}

/** 3 formas recomendadas de pago; la default es la del usuario (puntos 6 y 14) */
export function PlansSheet({ open, onClose }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Planes de pago"
      subtitle="Elige cómo atacar el mes. Tu plan actual es el predeterminado."
    >
      {open && <PlansContent />}
    </BottomSheet>
  )
}

function PlansContent() {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const debts = useFinanceStore((s) => s.debts)
  const profile = useFinanceStore((s) => s.profile)
  const planChoice = useFinanceStore((s) => s.settings.planChoice)
  const aiEnabled = useFinanceStore((s) => s.settings.aiEnabled)
  const setSettings = useFinanceStore((s) => s.setSettings)

  const [plans, setPlans] = useState<PaymentPlan[]>(
    () => (month ? buildHeuristicPlans(month, debts, profile) : []),
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const generateAI = async () => {
    if (!month) return
    setAiLoading(true)
    setAiError('')
    try {
      const aiPlans = await getAIPlans(financeSnapshot(month, debts, profile))
      if (aiPlans.length) {
        setPlans((prev) => [prev[0], ...aiPlans])
        setExpanded(aiPlans[0].id)
      } else {
        setAiError('La IA no devolvió planes. Intenta de nuevo.')
      }
    } catch {
      setAiError('No se pudo conectar con la IA. Revisa tu conexión o tu clave en Ajustes.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
      <div className="flex flex-col gap-3">
        {aiEnabled && (
          <button
            onClick={generateAI}
            disabled={aiLoading}
            className="pressable card p-3.5 flex items-center gap-3 text-left disabled:opacity-60"
            style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 45%, var(--c-border))' }}
          >
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--app-accent) 20%, transparent)' }}>
              <Sparkles size={17} style={{ color: 'var(--app-accent-soft)' }} className={aiLoading ? 'animate-pulse' : ''} />
            </span>
            <span className="flex-1">
              <span className="block text-[13.5px] font-semibold text-ink">
                {aiLoading ? 'Analizando tus finanzas…' : 'Generar 3 planes con IA'}
              </span>
              <span className="block text-[11.5px] text-muted mt-0.5">
                {aiAvailable() ? 'Personalizados según tus deudas, gastos y salario' : 'Configura tu clave de Gemini en Ajustes'}
              </span>
            </span>
          </button>
        )}
        {aiLoading && <Loader size={56} label="La IA está armando tus planes…" />}
        {aiError && <p className="text-[12.5px] px-1" style={{ color: 'var(--c-danger)' }}>{aiError}</p>}

        {plans.map((p) => {
          const selected = planChoice === p.id
          const isOpen = expanded === p.id
          const totalPlan = p.pasos.reduce((s, x) => s + x.amount, 0)
          return (
            <div
              key={p.id}
              className="card overflow-hidden transition-all"
              style={selected ? { borderColor: 'color-mix(in oklab, var(--app-accent) 60%, var(--c-border))' } : undefined}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(isOpen ? null : p.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') setExpanded(isOpen ? null : p.id) }}
                className="pressable p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-[15px] font-bold text-ink font-display">{p.nombre}</h4>
                    {p.id === 'propio' && <span className="chip chip-active !py-0.5 !px-2 !text-[10.5px]">Predeterminado</span>}
                    {p.esIA && <span className="chip !py-0.5 !px-2 !text-[10.5px]" style={{ color: 'var(--app-accent-soft)' }}><Sparkles size={10} /> IA</span>}
                  </div>
                  <p className="text-[12.5px] text-muted mt-1 leading-relaxed">{p.descripcion}</p>
                </div>
                {selected && <BadgeCheck size={20} style={{ color: 'var(--app-accent-soft)' }} className="shrink-0" />}
              </div>

              {isOpen && (
                <div className="px-4 pb-4 anim-fade">
                  {p.pasos.length > 0 && (
                    <div className="rounded-xl bg-elevated/70 border border-edge overflow-hidden mb-3">
                      {p.pasos.slice(0, 10).map((s, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 border-b border-edge/50 last:border-0">
                          <span className="num text-[11px] font-bold w-9 shrink-0 text-center rounded-md py-0.5" style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)', color: 'var(--app-accent-soft)' }}>
                            d{s.day}
                          </span>
                          <span className="flex-1 text-[13px] text-ink truncate">
                            {s.name}
                            {s.detail && <span className="block text-[10.5px] text-muted">{s.detail}</span>}
                          </span>
                          <span className="num text-[13px] font-semibold text-ink">{formatMoney(s.amount)}</span>
                        </div>
                      ))}
                      {p.pasos.length > 10 && (
                        <p className="text-[11px] text-muted px-3 py-1.5">y {p.pasos.length - 10} pasos más…</p>
                      )}
                    </div>
                  )}
                  <ul className="flex flex-col gap-1 mb-3">
                    {p.ventajas.map((v, i) => (
                      <li key={i} className="text-[12.5px] text-muted flex gap-1.5">
                        <span style={{ color: 'var(--c-income)' }}>•</span> {v}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] text-muted">
                      Total del plan: <span className="num font-bold text-ink">{formatMoney(totalPlan)}</span>
                      {p.duracionMeses ? ` · ~${p.duracionMeses} meses` : ''}
                    </p>
                    <button
                      onClick={() => setSettings({ planChoice: p.id })}
                      className={`pressable text-[13px] font-semibold rounded-xl px-3.5 py-2 ${selected ? 'btn-ghost' : 'text-white'}`}
                      style={selected ? undefined : { background: 'var(--app-accent)' }}
                    >
                      {selected ? 'Elegido' : 'Usar este plan'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
  )
}
