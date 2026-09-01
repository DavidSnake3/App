// Ajustes > Snake y planes: plan actual, consumo del asistente y (solo admin)
// la clave de Gemini. Los pagos todavía no están habilitados.
import { useState } from 'react'
import { Crown, KeyRound, Sparkles, Star, Zap } from 'lucide-react'
import type { AuthState } from '../../hooks/useAuth'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useChat } from '../../store/useChat'
import { plan as getPlan, type PlanId } from '../../lib/plans'
import { aiAvailable } from '../../lib/ai'
import { isAdmin } from '../../lib/firebase'
import { PlansSheet } from '../chat/PlansSheet'

const ICONS: Record<PlanId, React.ReactNode> = {
  gratis: <Zap size={17} />,
  plus: <Star size={17} />,
  premium: <Crown size={17} />,
}

/** Barra de consumo con color según qué tan cerca del límite está */
function Meter({ label, used, max, unit }: { label: string; used: number; max: number; unit?: string }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100))
  const color = pct >= 100 ? 'var(--c-danger)' : pct > 75 ? 'var(--c-warning)' : 'var(--app-gradient)'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-muted">{label}</span>
        <span className="num text-[12.5px] font-semibold text-ink">
          {used}{unit} <span className="text-muted font-normal">/ {max}{unit}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-elevated overflow-hidden mt-1">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export function SnakeSection({ auth }: { auth: AuthState }) {
  const profile = useFinanceStore((s) => s.profile)
  const usage = useFinanceStore((s) => s.usage)
  const geminiKey = useFinanceStore((s) => s.settings.geminiKey)
  const setSettings = useFinanceStore((s) => s.setSettings)
  const openChat = useChat((s) => s.openChat)
  const [plansOpen, setPlansOpen] = useState(false)
  const [keyDraft, setKeyDraft] = useState(geminiKey)
  const [saved, setSaved] = useState(false)

  const p = getPlan(profile.snakePlan)
  const hoy = new Date().toISOString().slice(0, 10)
  const alDia = usage?.dayKey === hoy
  const msgs = alDia ? usage.msgs : 0
  const tokens = alDia ? usage.tokens : 0
  const adjuntos = alDia ? usage.attachments : 0
  const admin = isAdmin(auth.user)

  return (
    <>
      {/* Plan actual */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <span
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: p.id === 'gratis' ? 'var(--c-elevated)' : 'color-mix(in oklab, var(--app-accent) 18%, transparent)',
              color: p.id === 'gratis' ? 'var(--c-muted)' : 'var(--app-accent-soft)',
            }}
          >
            {ICONS[p.id]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-[17px] font-bold text-ink leading-tight">Plan {p.name}</p>
            <p className="text-[11.5px] text-muted leading-snug">{p.tagline}</p>
          </div>
        </div>
        <p className="text-[11.5px] text-muted mt-3 leading-snug">
          Toda la app es gratis siempre. Los planes solo amplían la capacidad de Snake:
          más mensajes, más memoria de la conversación y respuestas más profundas.
        </p>
        <button
          onClick={() => setPlansOpen(true)}
          className="pressable w-full mt-3 rounded-xl py-2.5 text-[13px] font-semibold text-white"
          style={{ background: 'var(--app-gradient)' }}
        >
          Ver los 3 planes
        </button>
      </div>

      {/* Consumo */}
      <div className="card p-4 flex flex-col gap-3">
        <p className="text-[12px] font-semibold text-muted flex items-center gap-1.5">
          <Sparkles size={12} /> Tu consumo de hoy
        </p>
        <Meter label="Mensajes" used={msgs} max={p.limits.msgsPerDay} />
        <Meter label="Tokens" used={Math.round(tokens / 1000)} max={Math.round(p.limits.tokensPerDay / 1000)} unit="k" />
        <Meter label="Facturas y fotos" used={adjuntos} max={p.limits.attachmentsPerDay} />
        <p className="text-[11px] text-muted">
          Se renueva solo cada día a medianoche. Este mes:{' '}
          <span className="num">{usage?.monthMsgs ?? 0}</span> mensajes ·{' '}
          <span className="num">{((usage?.monthTokens ?? 0) / 1000).toFixed(1)}k</span> tokens.
        </p>
        <button
          onClick={() => openChat()}
          className="pressable rounded-xl py-2 text-[12.5px] font-semibold"
          style={{ background: 'var(--c-elevated)', color: 'var(--c-text)' }}
        >
          Abrir Snake
        </button>
      </div>

      {/* Capacidad del plan, en palabras simples */}
      <div className="card p-4">
        <p className="text-[12px] font-semibold text-muted">Qué incluye tu plan</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {p.perks.map((perk) => (
            <p key={perk} className="text-[12px] text-ink leading-snug">• {perk}</p>
          ))}
        </div>
      </div>

      {/* Clave de IA: solo para el administrador */}
      {admin && (
        <div className="card p-4">
          <p className="text-[12px] font-semibold text-muted flex items-center gap-1.5">
            <KeyRound size={12} /> Clave de Gemini (solo admin)
          </p>
          <p className="text-[11.5px] text-muted mt-1 leading-snug">
            {aiAvailable()
              ? 'La IA está activa. Si la dejas vacía se usa la clave de compilación.'
              : 'Sin clave, Snake no puede responder. Pega una clave de Google AI Studio.'}
          </p>
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => { setKeyDraft(e.target.value); setSaved(false) }}
            placeholder="AIza…"
            className="w-full mt-2.5 rounded-xl px-3 py-2.5 text-[13px] bg-elevated border border-edge text-ink outline-none"
          />
          <button
            onClick={() => { setSettings({ geminiKey: keyDraft.trim() }); setSaved(true) }}
            className="pressable w-full mt-2 rounded-xl py-2 text-[12.5px] font-semibold text-white"
            style={{ background: 'var(--app-gradient)' }}
          >
            {saved ? 'Guardada' : 'Guardar clave'}
          </button>
        </div>
      )}

      <PlansSheet open={plansOpen} onClose={() => setPlansOpen(false)} />
    </>
  )
}
