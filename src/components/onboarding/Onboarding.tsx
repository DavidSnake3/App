import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Bell, CalendarRange, Check, ChevronDown, FileUp,
  MessageCircle, Palette, Rocket, Wallet,
} from 'lucide-react'
import type { AppUser } from '../../lib/firebase'
import type { PayPeriod } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { currentMonthId } from '../../lib/dates'
import { CURRENCIES, formatMoney, formatMoneyExact } from '../../lib/format'
import { COUNTRY_PRESETS, PERIOD_UNIT, countryPreset, payrollBreakdown } from '../../lib/payroll'
import { PALETTES } from '../../lib/themes'
import { celebrate } from '../../lib/fx'
import { requestPermission } from '../../lib/notifications'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Segmented } from '../ui/Segmented'
import { AppLogo } from '../ui/AppLogo'
import { AnimacionesSection, AparienciaSection } from '../settings/SettingsView'

interface ServiceDraft { name: string; amount: number; on: boolean; dueDay: number }

const SUGGESTED_SERVICES: ServiceDraft[] = [
  { name: 'Luz', amount: 0, on: false, dueDay: 28 },
  { name: 'Agua', amount: 0, on: false, dueDay: 28 },
  { name: 'Internet', amount: 0, on: false, dueDay: 28 },
  { name: 'Celular', amount: 0, on: false, dueDay: 15 },
  { name: 'Alquiler', amount: 0, on: false, dueDay: 1 },
  { name: 'Streaming', amount: 0, on: false, dueDay: 10 },
]

type StepId = 'bienvenida' | 'datos' | 'ingresos' | 'modo' | 'servicios' | 'final' | 'snake'

/** Lo que Snake necesita para armar el plan (se muestra en el último paso) */
const SNAKE_NEEDS = [
  'Tu salario bruto y cada cuánto te pagan',
  "Tus deducciones de ley, créditos o adelantos",
  'Tus gastos fijos y servicios del mes',
  'Tus deudas: saldo, cuota y día de pago',
]

/** Onboarding: con Google se saltan los datos personales (mejora 11) */
export function Onboarding({ user }: { user: AppUser | null }) {
  const setProfile = useFinanceStore((s) => s.setProfile)
  const setPayroll = useFinanceStore((s) => s.setPayroll)
  const setPaySchedule = useFinanceStore((s) => s.setPaySchedule)
  const setTheme = useFinanceStore((s) => s.setTheme)
  const setNotifications = useFinanceStore((s) => s.setNotifications)
  const ensureMonthExists = useFinanceStore((s) => s.ensureMonthExists)
  const addExpense = useFinanceStore((s) => s.addExpense)
  const animPrefs = useFinanceStore((s) => s.settings.animations)
  const themeNow = useFinanceStore((s) => s.settings.theme)

  // Con cuenta de Google no preguntamos nombre/correo/teléfono
  const steps: StepId[] = useMemo(
    () => user
      ? ['bienvenida', 'ingresos', 'modo', 'servicios', 'final', 'snake']
      : ['bienvenida', 'datos', 'ingresos', 'modo', 'servicios', 'final', 'snake'],
    [user],
  )

  const [idx, setIdx] = useState(0)
  const step = steps[idx]

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState('')
  const [currency, setCurr] = useState('CRC')

  // Ingresos/planilla (mejoras 9 y 11): el período del comprobante REAL
  const [inputPeriod, setInputPeriod] = useState<PayPeriod>('monthly')
  const [gross, setGross] = useState(0)
  const [skipPayroll, setSkipPayroll] = useState(false)
  // País: define el nombre y el % de la deducción de ley (app universal)
  const [countryId, setCountryId] = useState('cr')
  const preset = countryPreset(countryId) ?? COUNTRY_PRESETS[0]
  const bdPreview = payrollBreakdown({ inputPeriod, gross, ccssPct: preset.pct, deductions: [], viewPeriod: 'monthly' })

  const [planMode, setPlanMode] = useState<'monthly' | 'annual'>('monthly')
  const [services, setServices] = useState(SUGGESTED_SERVICES)
  const [notifOn, setNotifOn] = useState(false)
  const [error, setError] = useState('')
  // último paso: cómo quiere arrancar su plan con Snake
  const [snakeChoice, setSnakeChoice] = useState<'plan' | 'comprobante' | null>(null)
  // paso "Personaliza": desplegar tema/animaciones/sonidos completos
  const [showMore, setShowMore] = useState(false)

  const canNext = useMemo(() => {
    if (step === 'datos') return name.trim().length >= 2
    if (step === 'ingresos') return skipPayroll || gross > 0
    return true
  }, [step, name, gross, skipPayroll])

  const next = () => {
    if (!canNext) {
      setError(step === 'datos' ? 'Tu nombre es obligatorio.' : 'Escribe tu salario bruto o elige configurarlo después.')
      return
    }
    // Si vuelve y escribe su salario, ya no cuenta como "configurar después"
    if (step === 'ingresos' && gross > 0) setSkipPayroll(false)
    setError('')
    setIdx((i) => Math.min(steps.length - 1, i + 1))
  }

  const finish = (choice?: 'plan' | 'comprobante' | 'skipped') => {
    const snakeIntro = choice ?? snakeChoice
    if (!snakeIntro) {
      setError('Elige cómo quieres armar tu plan, o toca «Prefiero configurarlo después».')
      return
    }
    setError('')
    const monthId = currentMonthId()
    setProfile({
      name: (user?.name ?? name).trim(),
      email: (user?.email ?? email).trim(),
      phone: phone.trim(),
      photoUrl: user?.photo ?? '',
      currency,
      payday: 30,
      payFrequency: inputPeriod === 'weekly' ? 'monthly' : inputPeriod === 'biweekly' ? 'biweekly' : 'monthly',
      planMode,
      onboarded: true,
      snakeIntro,
    })
    // La planilla manda: configura salario del mes automáticamente (mejora general)
    if (!skipPayroll && gross > 0) {
      setPayroll({
        inputPeriod,
        gross,
        countryId: preset.id,
        statutoryName: preset.label,
        ccssPct: preset.pct,
      })
      // El plan de pago arranca alineado al período del comprobante
      setPaySchedule(
        inputPeriod === 'weekly'
          ? { frequency: 'weekly', weekday: 4 }
          : { frequency: inputPeriod, paydays: inputPeriod === 'biweekly' ? [15, 30] : [30] },
      )
    }
    ensureMonthExists(monthId)
    for (const s of services) {
      if (!s.on || s.amount <= 0) continue
      addExpense(monthId, {
        name: s.name,
        amount: s.amount,
        paid: false,
        dueDay: s.dueDay,
        period: s.dueDay <= 15 ? 'q1' : 'q2',
        kind: 'servicio',
        recurrence: 'monthly',
        children: [],
      })
    }
    if (notifOn) setNotifications({ enabled: true })
    celebrate(animPrefs)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progreso */}
      <div className="flex gap-1.5 px-6 pt-5">
        {steps.map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= idx ? 'var(--app-accent)' : 'var(--c-border)' }}
          />
        ))}
      </div>

      <div key={step} className="flex-1 overflow-y-auto px-6 py-6 anim-page">
        {step === 'bienvenida' && (
          <div className="flex flex-col items-center text-center pt-10">
            <AppLogo size={92} />
            <h1 className="font-display text-[30px] font-bold text-ink mt-6 leading-tight">SNBusiness</h1>
            {user && (
              <p className="text-[14px] font-semibold mt-2" style={{ color: 'var(--app-accent-soft)' }}>
                ¡Hola, {user.name.split(' ')[0]}!
              </p>
            )}
            <p className="text-[15px] text-muted mt-3 leading-relaxed max-w-[280px]">
              Tus ingresos, gastos, servicios y deudas bajo control, en tu moneda y con las
              deducciones de tu país. Con planes inteligentes para llegar tranquilo a fin de mes.
            </p>
            <div className="mt-8 flex flex-col gap-2.5 w-full max-w-[300px]">
              {[
                'Organiza tu mes en segundos',
                'Semanal, quincenal o mensual: como te paguen',
                'Recordatorios y alarmas de pago',
                'Snake: tu asistente financiero con IA',
              ].map((txt) => (
                <div key={txt} className="flex items-center gap-2.5 card px-4 py-3">
                  <Check size={15} style={{ color: 'var(--c-income)' }} className="shrink-0" />
                  <span className="text-[13.5px] text-ink text-left">{txt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'datos' && (
          <StepShell title="Cuéntanos de ti" subtitle="Solo lo necesario para personalizar tu experiencia.">
            <Field label="Tu nombre *">
              <input className="input-base" placeholder="Ej. David" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Correo (opcional)">
              <input className="input-base" type="email" placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Teléfono (opcional)">
              <input className="input-base" type="tel" placeholder="8888-8888" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Tu moneda">
              <select className="input-base" value={currency} onChange={(e) => setCurr(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
          </StepShell>
        )}

        {step === 'ingresos' && (
          <StepShell
            title="Tu comprobante salarial"
            subtitle="Como viene en tu comprobante real: semanal, quincenal o mensual. La app calcula tu deducción de ley y tu neto."
          >
            <Field label="Tu país">
              <select
                className="input-base"
                value={countryId}
                onChange={(e) => {
                  const c = countryPreset(e.target.value)
                  if (!c) return
                  setCountryId(c.id)
                  if (c.currency) setCurr(c.currency)
                }}
              >
                {COUNTRY_PRESETS.map((c) => <option key={c.id} value={c.id}>{c.country}</option>)}
              </select>
              <p className="text-[11px] text-muted mt-1">
                Define tu moneda y tu deducción de ley: <span className="font-semibold text-ink">{preset.label}</span>
                {preset.pct > 0 && <> ({preset.pct}%)</>}. Puedes ajustarlo cuando quieras.
              </p>
            </Field>
            <Field label="Tu moneda">
              <select className="input-base" value={currency} onChange={(e) => setCurr(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="¿Cada cuánto te pagan?">
              <Segmented
                value={inputPeriod}
                onChange={(v) => setInputPeriod(v)}
                options={[
                  { value: 'weekly', label: 'Semanal' },
                  { value: 'biweekly', label: 'Quincenal' },
                  { value: 'monthly', label: 'Mensual' },
                ]}
              />
            </Field>
            <Field label={`Salario BRUTO ${PERIOD_UNIT[inputPeriod]}`}>
              <CurrencyInput value={gross} onChange={(v) => { setGross(v); if (v > 0) setSkipPayroll(false) }} />
            </Field>
            {gross > 0 && (
              <div className="card bg-elevated/60 p-3.5 anim-fade">
                <p className="text-[12.5px] text-muted">
                  {preset.label}{preset.pct > 0 ? ` (${preset.pct}%)` : ''}: <span className="num font-semibold" style={{ color: 'var(--c-danger)' }}>−{formatMoneyExact(bdPreview.ccss)}</span>
                </p>
                <p className="text-[13px] text-ink mt-1">
                  Líquido {PERIOD_UNIT[inputPeriod]}: <span className="num font-bold" style={{ color: 'var(--c-income)' }}>{formatMoneyExact(bdPreview.net)}</span>
                  {inputPeriod !== 'monthly' && (
                    <> · al mes: <span className="num font-bold">{formatMoney(Math.round(bdPreview.monthlyNet))}</span></>
                  )}
                </p>
                <p className="text-[11px] text-muted mt-1.5">Tu país, el nombre y el % de la deducción se ajustan después en Ajustes → Ingresos.</p>
              </div>
            )}
            <button
              onClick={() => { setSkipPayroll(true); setError(''); setIdx((i) => Math.min(steps.length - 1, i + 1)) }}
              className="pressable text-[13px] text-muted underline decoration-dotted self-start"
            >
              Prefiero configurarlo después
            </button>
          </StepShell>
        )}

        {step === 'modo' && (
          <StepShell title="¿Cómo quieres planificar?" subtitle="Puedes cambiarlo después en Ajustes.">
            <div className="flex flex-col gap-3">
              <ModeCard
                icon={<Wallet size={20} />}
                title="Mes a mes"
                desc="Cada mes te pregunta si copiar tus pagos recurrentes. Ideal para empezar."
                selected={planMode === 'monthly'}
                onClick={() => setPlanMode('monthly')}
              />
              <ModeCard
                icon={<CalendarRange size={20} />}
                title="Año completo"
                desc="Visualiza y proyecta los 12 meses desde el inicio: ideal si tienes deudas largas."
                selected={planMode === 'annual'}
                onClick={() => setPlanMode('annual')}
              />
            </div>
          </StepShell>
        )}

        {step === 'servicios' && (
          <StepShell title="Servicios del mes" subtitle="Marca los que pagas y ponles monto: se repetirán cada mes (puedes editar o agregar más luego).">
            <div className="flex flex-col gap-2">
              {services.map((s, i) => (
                <div key={s.name} className={`card p-3 flex items-center gap-3 transition-opacity ${s.on ? '' : 'opacity-60'}`}>
                  <button
                    onClick={() => setServices((prev) => prev.map((x, j) => j === i ? { ...x, on: !x.on } : x))}
                    aria-label={`Activar ${s.name}`}
                    className="pressable w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{
                      borderColor: s.on ? 'var(--app-accent)' : 'var(--c-border)',
                      background: s.on ? 'var(--app-accent)' : 'transparent',
                      color: '#fff',
                    }}
                  >
                    {s.on && <Check size={14} strokeWidth={3} />}
                  </button>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14.5px] font-medium text-ink">{s.name}</span>
                    <span className="block text-[10.5px] text-muted">(Más utilizados)</span>
                  </span>
                  {s.on && (
                    <CurrencyInput
                      value={s.amount}
                      onChange={(v) => setServices((prev) => prev.map((x, j) => j === i ? { ...x, amount: v } : x))}
                      className="w-36"
                    />
                  )}
                </div>
              ))}
            </div>
          </StepShell>
        )}

        {step === 'final' && (
          <StepShell
            title="Personaliza tu app"
            subtitle="Tema, colores, fondo, animaciones, sonidos y recordatorios. Todo esto lo puedes cambiar después en Ajustes."
          >
            {/* Paleta rápida (se oculta al abrir el bloque completo) */}
            <div className={showMore ? 'hidden' : ''}>
              <p className="text-[12px] text-muted mb-2">Paleta de color</p>
              <div className="grid grid-cols-3 gap-2">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setTheme({ paletteId: p.id, accent: undefined })}
                    className="pressable card p-2.5 flex items-center gap-2"
                    style={themeNow.paletteId === p.id ? { borderColor: p.accent } : undefined}
                  >
                    <span className="w-6 h-6 rounded-lg shrink-0" style={{ background: p.gradient }} />
                    <span className="text-[11.5px] font-medium text-ink truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recordatorios */}
            <button
              onClick={async () => {
                const ok = await requestPermission()
                setNotifOn(ok)
              }}
              className="pressable card p-4 flex items-center gap-3 w-full text-left"
              style={notifOn ? { borderColor: 'color-mix(in oklab, var(--c-income) 55%, var(--c-border))' } : undefined}
            >
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--app-accent) 18%, transparent)' }}>
                <Bell size={18} style={{ color: 'var(--app-accent-soft)' }} />
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-semibold text-ink">
                  {notifOn ? 'Recordatorios activados' : 'Activar recordatorios de pago'}
                </span>
                <span className="block text-[12px] text-muted mt-0.5">
                  {notifOn ? 'Te avisaremos antes de cada vencimiento' : 'Nunca más un pago olvidado'}
                </span>
              </span>
              {notifOn && <Check size={18} style={{ color: 'var(--c-income)' }} />}
            </button>

            {/* Todo lo demás: se despliega para no saturar */}
            <button
              onClick={() => setShowMore(!showMore)}
              className="pressable card p-3.5 flex items-center gap-3 text-left"
            >
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)' }}>
                <Palette size={17} style={{ color: 'var(--app-accent-soft)' }} />
              </span>
              <span className="flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">Tema, fondo, animaciones y sonidos</span>
                <span className="block text-[11.5px] text-muted mt-0.5">
                  {showMore ? 'Toca para ocultar' : 'Modo claro/oscuro, tu propia foto de fondo, confeti, vibración y sonidos'}
                </span>
              </span>
              <ChevronDown
                size={17}
                className="text-muted shrink-0 transition-transform"
                style={showMore ? { transform: 'rotate(180deg)' } : undefined}
              />
            </button>

            {showMore && (
              <div className="flex flex-col gap-4 anim-fade">
                <AparienciaSection />
                <AnimacionesSection />
              </div>
            )}
          </StepShell>
        )}

        {/* Último paso: arrancar el plan con Snake (o dejarlo para después) */}
        {step === 'snake' && (
          <StepShell
            title="Arma tu plan con Snake"
            subtitle="Tu asistente hace las cuentas por vos y te dice qué pagar y cuánto apartar."
          >
            <div className="card p-3.5" style={{ background: 'color-mix(in oklab, var(--app-accent) 8%, var(--c-card))' }}>
              <p className="text-[12px] font-semibold text-ink mb-1.5">Para tu plan, Snake necesita:</p>
              <div className="flex flex-col gap-1">
                {SNAKE_NEEDS.map((n) => (
                  <p key={n} className="text-[12px] text-muted flex items-start gap-1.5">
                    <Check size={12} className="shrink-0 mt-0.5" style={{ color: 'var(--c-income)' }} />
                    {n}
                  </p>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <ModeCard
                icon={<FileUp size={20} />}
                title="Subir mi comprobante salarial"
                desc="Foto o PDF: Snake lee tu bruto, tu deducción de ley y tus créditos en segundos."
                selected={snakeChoice === 'comprobante'}
                onClick={() => { setSnakeChoice('comprobante'); setError('') }}
              />
              <ModeCard
                icon={<MessageCircle size={20} />}
                title="Que Snake me guíe"
                desc="Le contás lo que ganás y tus pagos por el chat, y él arma el plan."
                selected={snakeChoice === 'plan'}
                onClick={() => { setSnakeChoice('plan'); setError('') }}
              />
            </div>

            <button
              onClick={() => finish('skipped')}
              className="pressable text-[13px] text-muted underline decoration-dotted self-start"
            >
              Prefiero configurarlo después
            </button>
          </StepShell>
        )}
      </div>

      {error && <p className="text-[13px] text-center anim-shake px-6 pb-2" style={{ color: 'var(--c-danger)' }}>{error}</p>}

      {/* Controles */}
      <div className="px-6 pb-[calc(1.4rem+env(safe-area-inset-bottom))] flex gap-2.5">
        {idx > 0 && (
          <button onClick={() => setIdx((i) => i - 1)} aria-label="Atrás" className="pressable btn-ghost !px-4">
            <ArrowLeft size={17} />
          </button>
        )}
        {idx < steps.length - 1 ? (
          <button onClick={next} className="pressable btn-primary flex-1 flex items-center justify-center gap-2">
            {idx === 0 ? 'Comenzar' : 'Continuar'} <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={() => finish()} className="pressable btn-primary flex-1 flex items-center justify-center gap-2">
            <Rocket size={16} /> {snakeChoice ? 'Entrar y hablar con Snake' : 'Entrar a SNBusiness'}
          </button>
        )}
      </div>
    </div>
  )
}

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-[24px] font-bold text-ink leading-tight">{title}</h2>
        <p className="text-[13.5px] text-muted mt-1.5">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12.5px] text-muted block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ModeCard({ icon, title, desc, selected, onClick }: {
  icon: React.ReactNode; title: string; desc: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="pressable card p-4 flex gap-3 text-left"
      style={selected ? { borderColor: 'var(--app-accent)', background: 'color-mix(in oklab, var(--app-accent) 8%, var(--c-card))' } : undefined}
    >
      <span
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: selected ? 'var(--app-gradient)' : 'var(--c-elevated)', color: selected ? '#fff' : 'var(--c-muted)' }}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-[15px] font-bold text-ink">{title}</span>
        <span className="block text-[12.5px] text-muted mt-1 leading-relaxed">{desc}</span>
      </span>
      {selected && <Check size={18} className="shrink-0 mt-1" style={{ color: 'var(--app-accent-soft)' }} />}
    </button>
  )
}
