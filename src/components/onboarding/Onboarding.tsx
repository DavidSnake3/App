import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, CalendarRange, Check, Rocket, Wallet } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { currentMonthId } from '../../lib/dates'
import { CURRENCIES } from '../../lib/format'
import { PALETTES } from '../../lib/themes'
import { celebrate } from '../../lib/fx'
import { requestPermission } from '../../lib/notifications'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Segmented } from '../ui/Segmented'
import { AppLogo } from '../ui/AppLogo'

interface ServiceDraft { name: string; amount: number; on: boolean; dueDay: number }

const SUGGESTED_SERVICES: ServiceDraft[] = [
  { name: 'Luz', amount: 0, on: false, dueDay: 28 },
  { name: 'Agua', amount: 0, on: false, dueDay: 28 },
  { name: 'Internet', amount: 0, on: false, dueDay: 28 },
  { name: 'Celular', amount: 0, on: false, dueDay: 15 },
  { name: 'Alquiler', amount: 0, on: false, dueDay: 1 },
  { name: 'Streaming', amount: 0, on: false, dueDay: 10 },
]

/** Onboarding obligatorio de primera vez (punto 24) */
export function Onboarding() {
  const setProfile = useFinanceStore((s) => s.setProfile)
  const setSettings = useFinanceStore((s) => s.setSettings)
  const setTheme = useFinanceStore((s) => s.setTheme)
  const setNotifications = useFinanceStore((s) => s.setNotifications)
  const ensureMonthExists = useFinanceStore((s) => s.ensureMonthExists)
  const addExpense = useFinanceStore((s) => s.addExpense)
  const animPrefs = useFinanceStore((s) => s.settings.animations)
  const themeNow = useFinanceStore((s) => s.settings.theme)

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [currency, setCurr] = useState('CRC')
  const [salary, setSalary] = useState(0)
  const [payFrequency, setPayFrequency] = useState<'monthly' | 'biweekly'>('monthly')
  const [payday, setPayday] = useState(30)
  const [planMode, setPlanMode] = useState<'monthly' | 'annual'>('monthly')
  const [services, setServices] = useState(SUGGESTED_SERVICES)
  const [notifOn, setNotifOn] = useState(false)
  const [error, setError] = useState('')

  const TOTAL = 6

  const canNext = useMemo(() => {
    if (step === 1) return name.trim().length >= 2
    if (step === 2) return salary > 0
    return true
  }, [step, name, salary])

  const next = () => {
    if (!canNext) {
      setError(step === 1 ? 'Tu nombre es obligatorio.' : 'Ingresa tu salario para planificar.')
      return
    }
    setError('')
    setStep((s) => Math.min(TOTAL - 1, s + 1))
  }

  const finish = () => {
    const monthId = currentMonthId()
    setProfile({
      name: name.trim(), email: email.trim(), phone: phone.trim(),
      currency, payday, payFrequency, planMode, onboarded: true,
    })
    setSettings({ defaultSalary: salary })
    ensureMonthExists(monthId)
    useFinanceStore.getState().updateIncome(monthId, { salary })
    for (const s of services) {
      if (!s.on) continue
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
        {Array.from({ length: TOTAL }).map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= step ? 'var(--app-accent)' : 'var(--c-border)' }}
          />
        ))}
      </div>

      <div key={step} className="flex-1 overflow-y-auto px-6 py-6 anim-page">
        {step === 0 && (
          <div className="flex flex-col items-center text-center pt-10">
            <AppLogo size={92} />
            <h1 className="font-display text-[30px] font-bold text-ink mt-6 leading-tight">SNBusiness</h1>
            <p className="text-[15px] text-muted mt-3 leading-relaxed max-w-[280px]">
              Tus gastos, servicios y deudas bajo control. Con planes inteligentes para llegar tranquilo a fin de mes.
            </p>
            <div className="mt-8 flex flex-col gap-2.5 w-full max-w-[300px]">
              {[
                'Organiza el mes en segundos',
                'Recordatorios y alarmas de pago',
                'Planes de pago con IA',
              ].map((txt) => (
                <div key={txt} className="flex items-center gap-2.5 card px-4 py-3">
                  <Check size={15} style={{ color: 'var(--c-income)' }} className="shrink-0" />
                  <span className="text-[13.5px] text-ink text-left">{txt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
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

        {step === 2 && (
          <StepShell title="Tus ingresos" subtitle="Para calcular tu balance y recomendarte planes de pago.">
            <Field label="Salario mensual *">
              <CurrencyInput value={salary} onChange={setSalary} />
            </Field>
            <Field label="¿Cómo te pagan?">
              <Segmented
                value={payFrequency}
                onChange={setPayFrequency}
                options={[
                  { value: 'monthly', label: 'Mensual' },
                  { value: 'biweekly', label: 'Quincenal' },
                ]}
              />
            </Field>
            <Field label="Día en que recibes tu pago">
              <input
                type="number" min={1} max={31} className="input-base num" value={payday}
                onChange={(e) => setPayday(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
              />
            </Field>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="¿Cómo quieres planificar?" subtitle="Puedes cambiarlo después en Ajustes.">
            <div className="flex flex-col gap-3">
              <ModeCard
                icon={<Wallet size={20} />}
                title="Mes a mes"
                desc="Cada mes se genera automáticamente con tus pagos recurrentes. Ideal para empezar."
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

        {step === 4 && (
          <StepShell title="Servicios obligatorios" subtitle="Márcalos y ponles monto: se repetirán cada mes (puedes editar luego).">
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
                  <span className="text-[14.5px] font-medium text-ink flex-1">{s.name}</span>
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

        {step === 5 && (
          <StepShell title="Último toque" subtitle="Elige tu estilo y activa los recordatorios.">
            <div>
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
          </StepShell>
        )}
      </div>

      {error && <p className="text-[13px] text-center anim-shake px-6 pb-2" style={{ color: 'var(--c-danger)' }}>{error}</p>}

      {/* Controles */}
      <div className="px-6 pb-[calc(1.4rem+env(safe-area-inset-bottom))] flex gap-2.5">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} aria-label="Atrás" className="pressable btn-ghost !px-4">
            <ArrowLeft size={17} />
          </button>
        )}
        {step < TOTAL - 1 ? (
          <button onClick={next} className="pressable btn-primary flex-1 flex items-center justify-center gap-2">
            {step === 0 ? 'Comenzar' : 'Continuar'} <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={finish} className="pressable btn-primary flex-1 flex items-center justify-center gap-2">
            <Rocket size={16} /> Entrar a SNBusiness
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
