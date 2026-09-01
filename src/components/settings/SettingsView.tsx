import { useRef, useState } from 'react'
import {
  AlarmClock, Bell, BellRing, Bug, ChevronRight, Cloud, CloudOff,
  Briefcase, Camera, Compass, Database, Download, FileText, HandCoins, Image as ImageIcon,
  Landmark, LifeBuoy, LogOut, Mail, MessageCircleQuestion, Moon, Palette,
  PartyPopper, PiggyBank, Play, Plus, Shapes, Sparkles, Sun, Trash2, Upload,
  User as UserIcon, Vibrate, Volume2, Wallet, X,
} from 'lucide-react'
import type {
  AlarmSoundId, Debt, PayPeriod, PayrollDeduction, PaySoundId, PendingAlarm, WorkerType,
} from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useChat } from '../../store/useChat'
import { BG_PRESETS, PALETTES, compressImage } from '../../lib/themes'
import { CURRENCIES, LOCALES, formatMoney, formatMoneyExact } from '../../lib/format'
import { mergeCategories } from '../../lib/categories'
import { useBackClose } from '../../hooks/useBackClose'
import { requestPermission, sendTestNotification } from '../../lib/notifications'
import { ALARM_SOUNDS, PAY_SOUNDS, previewAlarm, playSuccess } from '../../lib/sound'
import { firebaseReady, logout } from '../../lib/firebase'
import {
  COUNTRY_PRESETS, INPUT_PERIODS, PERIOD_LABEL, PERIOD_UNIT, WORKER_LABEL, convertPeriod,
  countryPreset, deductionLabel, formatPayday, hasPayrollDeductions, nextPaydays,
  payrollBreakdown, presetExtraPays, presetLabel, presetPct, presetStatutory,
} from '../../lib/payroll'
import { realBalance } from '../../lib/fund'
import { debtIsSettled, uid } from '../../lib/finance'
import { celebrate, payBurst } from '../../lib/fx'
import { applyBackup, exportBackup, readBackup } from '../../lib/backup'
import { exportState } from '../../store/useFinanceStore'
import { withLoading } from '../../store/useLoading'
import { buildWorkbook, downloadWorkbook } from '../../lib/excel'
import type { AuthState } from '../../hooks/useAuth'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Toggle } from '../ui/Toggle'
import { Segmented } from '../ui/Segmented'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { AlarmOverlay } from '../overlays/AlarmOverlay'
import { HubHeader, HubMenu, HubTitle, type HubItem } from '../layout/HubMenu'
import { payrollBreakdown as breakdown } from '../../lib/payroll'
import { savingsTotal } from '../../lib/fund'
import { plan as snakePlanOf } from '../../lib/plans'
import { SavingsSection } from './SavingsSection'
import { SnakeSection } from './SnakeSection'
import { DeductionSheet } from './DeductionSheet'
import { CategoriesSection } from './CategoriesSection'
import { ExtraPaysEditor, LegalNotice, StatutoryEditor, TaxEditor } from './PayrollEditors'

const ACCENT_CHOICES = ['#7c5cff', '#10b981', '#0ea5e9', '#f43f5e', '#d97706', '#ec4899', '#14b8a6', '#8b5cf6']

type SectionId = 'cuenta' | 'ingresos' | 'ahorros' | 'categorias' | 'snake' | 'apariencia' | 'animaciones' | 'notificaciones' | 'datos' | 'ayuda'

const SUPPORT_EMAIL = 'davidjosuevillegassalas@gmail.com'

/** Ajustes organizado por submenús (mejora 16) */
export function SettingsView({ auth }: { auth: AuthState }) {
  const section = (useFinanceStore((s) => s.subs.settings) ?? '') as SectionId | ''
  const setSub = useFinanceStore((s) => s.setSub)
  const setSection = (id: SectionId | null) => setSub('settings', id ?? '')

  const profile = useFinanceStore((s) => s.profile)
  const settings = useFinanceStore((s) => s.settings)
  const bd = breakdown(settings.payroll)
  const ahorrado = savingsTotal(settings)
  const totalCategorias = mergeCategories(settings.categories).filter((c) => !c.hidden).length

  const items: HubItem<SectionId>[] = [
    {
      id: 'cuenta',
      title: 'Cuenta y perfil',
      desc: 'Sesión, nombre, moneda y foto',
      icon: <UserIcon size={19} />,
      stat: profile.name || auth.user?.email || 'Sin nombre',
      tone: 'accent',
    },
    {
      id: 'ingresos',
      title: 'Ingresos y planilla',
      desc: 'Deducciones, plan de pago y salario',
      icon: <Wallet size={19} />,
      stat: bd.monthlyNet > 0 ? formatMoney(Math.round(bd.monthlyNet)) : 'Configurar',
      tone: 'income',
    },
    {
      id: 'ahorros',
      title: 'Ahorros',
      desc: 'Sobres, metas y aportes',
      icon: <PiggyBank size={19} />,
      stat: ahorrado > 0 ? formatMoney(Math.round(ahorrado)) : 'Crear un sobre',
      tone: 'warning',
    },
    {
      id: 'categorias',
      title: 'Categorías',
      desc: 'Ícono y color de cada categoría',
      icon: <Shapes size={19} />,
      stat: `${totalCategorias} categorías`,
      tone: 'accent',
    },
    {
      id: 'snake',
      title: 'Snake y planes',
      desc: 'Capacidad del asistente y consumo',
      icon: <Sparkles size={19} />,
      stat: `Plan ${snakePlanOf(profile.snakePlan).name}`,
      tone: 'accent',
    },
    {
      id: 'apariencia',
      title: 'Tema y apariencia',
      desc: 'Claro/oscuro, paletas y fondo',
      icon: <Palette size={19} />,
      stat: settings.theme.mode === 'dark' ? 'Oscuro' : 'Claro',
      tone: 'accent',
    },
    {
      id: 'animaciones',
      title: 'Animaciones y sonidos',
      desc: 'Confeti, sonidos y vibración',
      icon: <PartyPopper size={19} />,
      stat: settings.animations.transitions ? 'Activadas' : 'Reducidas',
      tone: 'warning',
    },
    {
      id: 'notificaciones',
      title: 'Notificaciones',
      desc: 'Recordatorios y modo alarma',
      icon: <Bell size={19} />,
      stat: settings.notifications.enabled ? 'Activadas' : 'Apagadas',
      tone: settings.notifications.enabled ? 'income' : 'danger',
    },
    {
      id: 'datos',
      title: 'Datos y respaldo',
      desc: 'Excel, respaldo y borrar todo',
      icon: <Database size={19} />,
      stat: 'Exportar / importar',
      tone: 'accent',
    },
    {
      id: 'ayuda',
      title: 'Ayuda y soporte',
      desc: 'Reporta un error o escríbenos',
      icon: <LifeBuoy size={19} />,
      stat: 'Estamos para ayudarte',
      tone: 'income',
    },
  ]

  if (section) {
    const meta = items.find((i) => i.id === section)
    return (
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 pb-28 pt-2 flex flex-col gap-4 anim-page">
          <HubHeader
            title={meta?.title ?? 'Ajustes'}
            subtitle={meta?.desc}
            onBack={() => setSection(null)}
          />
          {section === 'cuenta' && <CuentaSection auth={auth} />}
          {section === 'ingresos' && <IngresosSection />}
          {section === 'ahorros' && <SavingsSection />}
          {section === 'categorias' && <CategoriesSection />}
          {section === 'snake' && <SnakeSection auth={auth} />}
          {section === 'apariencia' && <AparienciaSection />}
          {section === 'animaciones' && <AnimacionesSection />}
          {section === 'notificaciones' && <NotificacionesSection />}
          {section === 'datos' && <DatosSection />}
          {section === 'ayuda' && <AyudaSection />}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-28 pt-2 flex flex-col gap-4 anim-page">
        <HubTitle title="Ajustes" subtitle="Personaliza SNFinance a tu manera" />

        {/* Menú en cuadros con el dato de cada sección */}
        <HubMenu items={items} onPick={(id) => setSection(id)} />

        <VersionFooter />
      </div>
    </div>
  )
}

function VersionFooter() {
  return <p className="text-[11px] text-muted text-center">SNFinance v3.6.0</p>
}

// ─── Cuenta y perfil ─────────────────────────────────────────────────────────

function CuentaSection({ auth }: { auth: AuthState }) {
  const profile = useFinanceStore((s) => s.profile)
  const setProfile = useFinanceStore((s) => s.setProfile)
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmOut, setConfirmOut] = useState(false)

  const photo = profile.photoUrl || auth.user?.photo || ''
  const fullName = [profile.name, profile.lastName].filter(Boolean).join(' ').trim()
  const initial = (profile.name || auth.user?.name || 'S').charAt(0).toUpperCase()

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return
    try {
      const data = await withLoading('Preparando tu foto…', () => compressImage(f, 480, 0.8))
      setProfile({ photoUrl: data })
    } catch { /* imagen inválida */ }
  }

  return (
    <>
      {/* Perfil grande y centrado (mejora 13) */}
      <div className="card p-5 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--app-gradient)' }} />
        <div className="relative">
          <div
            className="w-28 h-28 rounded-full p-[3px]"
            style={{ background: 'var(--app-gradient)' }}
          >
            {photo ? (
              <img
                src={photo}
                alt="Foto de perfil"
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover border-2"
                style={{ borderColor: 'var(--c-card)' }}
              />
            ) : (
              <span
                className="w-full h-full rounded-full flex items-center justify-center font-display text-[38px] font-bold text-white"
                style={{ background: 'var(--app-gradient)' }}
              >
                {initial}
              </span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Cambiar foto de perfil"
            className="pressable absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center text-white border-2"
            style={{ background: 'var(--app-accent)', borderColor: 'var(--c-card)' }}
          >
            <Camera size={15} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
          />
        </div>

        <h3 className="font-display text-[21px] font-bold text-ink mt-3.5 leading-tight">
          {fullName || 'Tu nombre'}
        </h3>
        {(profile.email || auth.user?.email) && (
          <p className="text-[12.5px] text-muted mt-1 flex items-center gap-1.5">
            {firebaseReady && auth.user
              ? <Cloud size={12} style={{ color: 'var(--c-income)' }} />
              : <CloudOff size={12} />}
            {profile.email || auth.user?.email}
          </p>
        )}
        {firebaseReady && auth.user && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-income)' }}>Sincronizado en la nube</p>
        )}
        {photo && profile.photoUrl && (
          <button
            onClick={() => setProfile({ photoUrl: '' })}
            className="pressable text-[11.5px] text-muted underline decoration-dotted mt-2"
          >
            Quitar mi foto
          </button>
        )}
      </div>

      <Card title="Tus datos">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre">
            <input className="input-base" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
          </Field>
          <Field label="Apellido">
            <input className="input-base" value={profile.lastName ?? ''} onChange={(e) => setProfile({ lastName: e.target.value })} />
          </Field>
        </div>
        <Field label="Correo">
          <input className="input-base" type="email" value={profile.email} onChange={(e) => setProfile({ email: e.target.value })} />
        </Field>
        <Field label="Teléfono (opcional)">
          <input className="input-base" type="tel" placeholder="8888-8888" value={profile.phone} onChange={(e) => setProfile({ phone: e.target.value })} />
        </Field>
        <Field label="Moneda">
          <select className="input-base" value={profile.currency} onChange={(e) => setProfile({ currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Formato de números y fechas">
          <select className="input-base" value={profile.locale ?? 'es-CR'} onChange={(e) => setProfile({ locale: e.target.value })}>
            {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </Field>
      </Card>

      {/* Segunda moneda opcional (app universal) */}
      <Card title="Ver equivalente en otra moneda">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Moneda">
            <select
              className="input-base"
              value={profile.secondCurrency ?? ''}
              onChange={(e) => setProfile({ secondCurrency: e.target.value })}
            >
              <option value="">Ninguna</option>
              {CURRENCIES.filter((c) => c.code !== profile.currency).map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label={`1 ${profile.currency} equivale a`}>
            <input
              type="number" min={0} step="0.0001" inputMode="decimal" className="input-base num"
              value={profile.exchangeRate ?? 0}
              onChange={(e) => setProfile({ exchangeRate: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
        </div>
        <p className="text-[11px] text-muted">
          El tipo de cambio lo escribes tú (la app funciona sin internet). Se muestra como
          referencia debajo de tu balance.
        </p>
      </Card>

      <Card title="Sesión">
        {firebaseReady ? (
          auth.user ? (
            <button
              onClick={() => setConfirmOut(true)}
              className="pressable btn-ghost w-full flex items-center justify-center gap-2 text-[13.5px]"
              style={{ color: 'var(--c-danger)' }}
            >
              <LogOut size={15} /> Cerrar sesión
            </button>
          ) : (
            <button onClick={auth.unskip} className="pressable btn-primary w-full !py-3 text-[14px]">
              Iniciar sesión / crear cuenta
            </button>
          )
        ) : (
          <p className="text-[12.5px] text-muted flex items-start gap-2">
            <CloudOff size={14} className="shrink-0 mt-0.5" /> Modo local: tus datos viven solo en este dispositivo.
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOut}
        title="¿Cerrar sesión?"
        message="Tus datos quedan guardados en la nube y vuelven cuando inicies sesión otra vez."
        confirmLabel="Cerrar sesión"
        onConfirm={() => { setConfirmOut(false); void logout() }}
        onCancel={() => setConfirmOut(false)}
      />
    </>
  )
}

// ─── Ingresos y planilla (mejoras 2, 3, 8, 15) ──────────────────────────────

function IngresosSection() {
  const settings = useFinanceStore((s) => s.settings)
  const profile = useFinanceStore((s) => s.profile)
  const debts = useFinanceStore((s) => s.debts)
  const setPayroll = useFinanceStore((s) => s.setPayroll)
  const setPaySchedule = useFinanceStore((s) => s.setPaySchedule)
  const setFundNow = useFinanceStore((s) => s.setFundNow)
  const disableFund = useFinanceStore((s) => s.disableFund)
  const months = useFinanceStore((s) => s.months)
  const setDefaultSalaryEverywhere = useFinanceStore((s) => s.setDefaultSalaryEverywhere)
  const setProfile = useFinanceStore((s) => s.setProfile)
  const updateDebt = useFinanceStore((s) => s.updateDebt)

  const p = settings.payroll
  const sch = settings.paySchedule
  const bd = payrollBreakdown(p)
  const [fundAmount, setFundAmount] = useState(0)
  const saldoReal = realBalance(months, debts, settings)

  const linkableDebts = debts.filter((d) => !debtIsSettled(d) && !d.viaPlanilla && !p.deductions.some((x) => x.debtId === d.id))
  const [dedSheet, setDedSheet] = useState<{ open: boolean; editing: PayrollDeduction | null }>({
    open: false, editing: null,
  })

  const guardarDed = (datos: Omit<PayrollDeduction, 'id'>) => {
    if (dedSheet.editing) {
      setPayroll({
        deductions: p.deductions.map((x) => (x.id === dedSheet.editing?.id ? { ...x, ...datos } : x)),
      })
    } else {
      setPayroll({ deductions: [...p.deductions, { ...datos, id: uid() } as PayrollDeduction] })
    }
  }

  const inputPeriod = p.inputPeriod ?? 'monthly'
  const salaried = hasPayrollDeductions(profile.workerType)

  const addDebtDed = (d: Debt) => {
    // La cuota de la deuda es MENSUAL; la deducción vive en el período del comprobante
    setPayroll({ deductions: [...p.deductions, { id: uid(), name: d.name, amount: convertPeriod(d.monthlyPayment, 'monthly', inputPeriod), debtId: d.id }] })
    updateDebt(d.id, { viaPlanilla: true })
  }
  const changeInputPeriod = (v: PayPeriod) => {
    if (v === inputPeriod) return
    // Las deducciones vinculadas a deuda se recalculan desde su cuota mensual real
    setPayroll({
      inputPeriod: v,
      deductions: p.deductions.map((d) => {
        if (!d.debtId) return d
        const debt = debts.find((x) => x.id === d.debtId)
        return debt ? { ...d, amount: convertPeriod(debt.monthlyPayment, 'monthly', v) } : d
      }),
    })
  }
  const removeDed = (id: string) => {
    const ded = p.deductions.find((x) => x.id === id)
    if (ded?.debtId) updateDebt(ded.debtId, { viaPlanilla: false })
    setPayroll({ deductions: p.deductions.filter((x) => x.id !== id) })
  }

  const next = nextPaydays(
    sch,
    p.gross > 0
      ? bd
      : { ...bd, monthlyNet: settings.defaultSalary, monthlyAdvance: 0, monthlySettlement: settings.defaultSalary },
    3,
  )

  return (
    <>
      {/* Cómo recibe su dinero (define si hay deducciones de planilla) */}
      <Card title="¿Cómo recibes tu dinero?" icon={<Briefcase size={14} />}>
        <select
          className="input-base"
          value={profile.workerType ?? 'asalariado'}
          onChange={(e) => setProfile({ workerType: e.target.value as WorkerType })}
        >
          {(['asalariado', 'independiente', 'ambos', 'pensionado', 'sinIngreso'] as const).map((t) => (
            <option key={t} value={t}>{WORKER_LABEL[t]}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted">
          {salaried
            ? 'Con planilla: la app calcula tus deducciones de ley y tu impuesto.'
            : 'Sin planilla: lo que escribas es lo que recibes, sin deducciones.'}
        </p>
      </Card>

      {/* Comprobante (mejoras 2, 8 y 9: semanal, quincenal o mensual) */}
      <Card title={salaried ? 'Comprobante salarial' : 'Tus ingresos'} icon={<FileText size={14} />}>
        <Field label="¿Cada cuánto recibes tu dinero?">
          <select
            className="input-base"
            value={inputPeriod}
            onChange={(e) => changeInputPeriod(e.target.value as PayPeriod)}
          >
            {INPUT_PERIODS.map((per) => (
              <option key={per} value={per}>{PERIOD_LABEL[per]}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted mt-1">
            Escribe los montos tal como vienen en tu comprobante ({PERIOD_UNIT[p.inputPeriod ?? 'monthly']}).
          </p>
        </Field>
        <Field label={salaried
          ? `Salario base BRUTO (${PERIOD_UNIT[inputPeriod]})`
          : `¿Cuánto recibes (${PERIOD_UNIT[inputPeriod]})?`}>
          <CurrencyInput value={p.gross} onChange={(v) => setPayroll({ gross: v })} />
        </Field>
        {/* Deducción de ley universal: cualquier país (mejora 10) */}
        <Field label="Tu país (define moneda, deducciones y formato)">
          <select
            className="input-base"
            value={p.countryId ?? 'cr'}
            onChange={(e) => {
              const c = countryPreset(e.target.value)
              if (!c) return
              setPayroll({
                countryId: c.id,
                statutoryName: presetLabel(c),
                ccssPct: presetPct(c),
                statutory: presetStatutory(c),
                taxEnabled: c.taxBrackets.some((b) => b.pct > 0),
                taxBrackets: c.taxBrackets,
                extraPays: presetExtraPays(c),
              })
              if (c.currency) setProfile({ currency: c.currency })
              if (c.locale) setProfile({ locale: c.locale })
            }}
          >
            {COUNTRY_PRESETS.map((c) => <option key={c.id} value={c.id}>{c.country}</option>)}
          </select>
          <p className="text-[11px] text-muted mt-1">
            Si te equivocaste de país solo cambialo aquí: se recargan sus deducciones,
            sus tramos y su moneda. Todo lo de abajo también se puede editar a mano.
          </p>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Moneda">
            <select
              className="input-base"
              value={profile.currency}
              onChange={(e) => setProfile({ currency: e.target.value })}
            >
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Formato de números">
            <select
              className="input-base"
              value={profile.locale ?? 'es-CR'}
              onChange={(e) => setProfile({ locale: e.target.value })}
            >
              {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label.split(' · ')[1] ?? l.label}</option>)}
            </select>
          </Field>
        </div>
        {salaried ? (
          <>
            <StatutoryEditor />
            <TaxEditor />
          </>
        ) : (
          <p className="text-[11.5px] text-muted">
            Como no trabajas con planilla, la app no resta deducciones de ley:
            el monto que escribiste es tu ingreso real.
          </p>
        )}

        <div>
          <p className="text-[12px] text-muted mb-1.5">Otras deducciones (créditos, adelantos, embargos…)</p>
          {p.deductions.length > 0 && (
            <div className="card overflow-hidden divide-y divide-[var(--c-border)] mb-2">
              {p.deductions.map((d) => {
                const valor = bd.deductions.find((x) => x.name === d.name)?.amount
                  ?? bd.advances.find((x) => x.name === d.name)?.amount
                  ?? d.amount
                return (
                  <div key={d.id} className="flex items-center gap-2 px-3 py-2">
                    {d.debtId ? <HandCoins size={13} className="text-accent-soft shrink-0" /> : <Landmark size={13} className="text-muted shrink-0" />}
                    <button
                      onClick={() => !d.debtId && setDedSheet({ open: true, editing: d })}
                      className={`flex-1 min-w-0 text-left ${d.debtId ? '' : 'pressable'}`}
                    >
                      <span className="block text-[13px] text-ink truncate">
                        {d.name}{d.debtId ? ' · deuda vinculada' : ''}
                      </span>
                      <span className="block text-[10.5px] text-muted truncate">
                        {d.isAdvance && <span style={{ color: 'var(--c-income)' }}>Adelanto</span>}
                        {d.isAdvance && d.advanceDay ? ` · día ${d.advanceDay}` : ''}
                        {deductionLabel(d) ? `${d.isAdvance ? ' · ' : ''}${deductionLabel(d)}` : ''}
                        {!d.debtId && !d.isAdvance && !deductionLabel(d) ? 'Monto fijo · toca para editar' : ''}
                      </span>
                    </button>
                    <span className="num text-[13px] font-semibold shrink-0" style={{ color: d.isAdvance ? 'var(--c-income)' : 'var(--c-danger)' }}>
                      {d.isAdvance ? '' : '−'}{formatMoney(Math.round(valor))}
                    </span>
                    <button onClick={() => removeDed(d.id)} aria-label={`Quitar ${d.name}`} className="pressable w-7 h-7 rounded-full flex items-center justify-center text-muted shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <button
            onClick={() => setDedSheet({ open: true, editing: null })}
            className="pressable w-full rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 py-3 text-[13px] font-semibold"
            style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 50%, var(--c-border))', color: 'var(--app-accent-soft)' }}
          >
            <Plus size={16} /> Agregar deducción o adelanto
          </button>
          <p className="text-[11px] text-muted mt-1.5">
            Puede ser un monto fijo o un porcentaje de tu salario. Si es un adelanto, indicas
            qué día te lo depositan.
          </p>
          {linkableDebts.length > 0 && (
            <div className="mt-2">
              <p className="text-[11.5px] text-muted mb-1">O vincula una deuda existente (se pagará por planilla):</p>
              <div className="flex flex-wrap gap-1.5">
                {linkableDebts.map((d) => (
                  <button key={d.id} onClick={() => addDebtDed(d)} className="pressable chip">
                    <HandCoins size={11} /> {d.name} · {formatMoney(d.monthlyPayment)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DeductionSheet
            open={dedSheet.open}
            onClose={() => setDedSheet({ open: false, editing: null })}
            editing={dedSheet.editing}
            inputPeriod={inputPeriod}
            gross={p.gross}
            onSave={guardarDed}
          />
        </div>

        {p.gross > 0 ? (
          <div className="card bg-elevated/60 p-3.5">
            <Row2 label={`Salario bruto (${PERIOD_UNIT[bd.period]})`} value={formatMoneyExact(bd.gross)} />
            {bd.statutoryRows.map((r, i) => (
              <Row2
                key={`s${i}`}
                label={r.fixed ? `${r.name} (monto fijo)` : `${r.name} (${r.pct}%)`}
                value={`−${formatMoneyExact(r.amount)}`}
                danger
              />
            ))}
            {bd.tax > 0 && <Row2 label="Impuesto sobre la renta" value={`−${formatMoneyExact(bd.tax)}`} danger />}
            {bd.deductions.map((d, i) => (
              <Row2
                key={i}
                label={d.detail ? `${d.name} (${d.detail})` : d.name}
                value={`−${formatMoneyExact(d.amount)}`}
                danger
              />
            ))}
            {bd.advances.map((a, i) => (
              <Row2
                key={`a${i}`}
                label={`${a.name}${a.detail ? ` (${a.detail})` : ''}${a.day ? ` · día ${a.day}` : ''}`}
                value={formatMoneyExact(a.amount)}
              />
            ))}
            <div className="border-t border-dashed my-1.5" style={{ borderColor: 'var(--c-border)' }} />
            <Row2 label={`LÍQUIDO ${PERIOD_LABEL[bd.period].toUpperCase()}`} value={formatMoneyExact(bd.net)} strong />
            {bd.period !== 'monthly' && (
              <Row2 label="Tu ingreso mensual" value={formatMoney(Math.round(bd.monthlyNet))} strong />
            )}
            <p className="text-[11px] text-muted mt-2">
              Tu ingreso mensual se aplica automáticamente al mes actual y los siguientes.
            </p>
          </div>
        ) : (
          <Field label="¿No usas planilla? Escribe tu salario NETO mensual">
            <CurrencyInput value={settings.defaultSalary} onChange={setDefaultSalaryEverywhere} />
            <p className="text-[11px] text-muted mt-1">Se aplica solo al mes actual y a los siguientes.</p>
          </Field>
        )}
      </Card>

      {/* Pagos extraordinarios y aviso legal (app universal) */}
      <Card title="Pagos extraordinarios" icon={<PartyPopper size={14} />}>
        <ExtraPaysEditor />
      </Card>

      <LegalNotice />

      {/* Plan de pago (mejora 3) */}
      <Card title="¿Cuándo te pagan?" icon={<AlarmClock size={14} />}>
        <Segmented
          value={sch.frequency}
          onChange={(f) => setPaySchedule({ frequency: f, paydays: f === 'monthly' ? [profile.payday || 30] : f === 'biweekly' ? [15, 30] : sch.paydays })}
          options={[
            { value: 'weekly', label: 'Semanal' },
            { value: 'biweekly', label: 'Quincenal' },
            { value: 'monthly', label: 'Mensual' },
          ]}
        />
        {sch.frequency === 'weekly' ? (
          <Field label="Día de la semana">
            <select
              className="input-base"
              value={sch.weekday}
              onChange={(e) => setPaySchedule({ weekday: Number(e.target.value) })}
            >
              {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={sch.frequency === 'biweekly' ? 'Primer día de pago' : 'Día de pago'}>
              <input
                type="number" min={1} max={31} inputMode="numeric" className="input-base num"
                value={sch.paydays[0] ?? 15}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(31, Number(e.target.value) || 1))
                  setPaySchedule({ paydays: sch.frequency === 'biweekly' ? [v, sch.paydays[1] ?? 30] : [v] })
                  setProfile({ payday: v })
                }}
              />
            </Field>
            {sch.frequency === 'biweekly' && (
              <Field label="Segundo día de pago">
                <input
                  type="number" min={1} max={31} inputMode="numeric" className="input-base num"
                  value={sch.paydays[1] ?? 30}
                  onChange={(e) => setPaySchedule({ paydays: [sch.paydays[0] ?? 15, Math.max(1, Math.min(31, Number(e.target.value) || 1))] })}
                />
              </Field>
            )}
          </div>
        )}
        <Field label="Si cae en fin de semana o feriado">
          <Segmented
            value={sch.adjustWeekend}
            onChange={(v) => setPaySchedule({ adjustWeekend: v })}
            options={[
              { value: 'before', label: 'Pagan antes' },
              { value: 'after', label: 'Pagan después' },
              { value: 'none', label: 'Día exacto' },
            ]}
          />
        </Field>
        {next.length > 0 && (bd.net > 0 || settings.defaultSalary > 0) && (
          <div className="card bg-elevated/60 p-3">
            <p className="text-[11.5px] font-semibold text-muted mb-1.5">Tus próximos pagos:</p>
            {next.map((pd, i) => (
              <p key={i} className="text-[12.5px] text-ink flex justify-between">
                <span className="capitalize">{formatPayday(pd.date)}{pd.adjusted ? ' *' : ''}</span>
                <span className="num font-semibold" style={{ color: 'var(--c-income)' }}>{formatMoney(Math.round(pd.amount))}</span>
              </p>
            ))}
            <p className="text-[10.5px] text-muted mt-1">Vista del comprobante: {PERIOD_LABEL[settings.payroll.viewPeriod]} (cámbiala en el widget del inicio).</p>
          </div>
        )}
      </Card>

      {/* Saldo real: control total del dinero (se configura aquí y se ve en Mes) */}
      <Card title="Saldo real (tu banco)" icon={<Landmark size={14} />}>
        {settings.fund?.enabled && saldoReal != null && (
          <div className="card bg-elevated/60 p-3.5 flex items-center justify-between">
            <span className="text-[12.5px] text-muted">Saldo actual calculado</span>
            <span className="num text-[17px] font-bold" style={{ color: saldoReal >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>
              {formatMoney(Math.round(saldoReal))}
            </span>
          </div>
        )}
        <Field label={settings.fund?.enabled ? 'Ajustar: ¿cuánto tienes HOY en el banco?' : 'Activar: ¿cuánto tienes HOY en el banco?'}>
          <div className="flex gap-2">
            <CurrencyInput value={fundAmount} onChange={setFundAmount} className="flex-1" />
            <button
              onClick={() => { setFundNow(fundAmount); setFundAmount(0) }}
              className="pressable rounded-2xl px-4 text-[13px] font-semibold text-white shrink-0"
              style={{ background: 'var(--app-gradient)' }}
            >
              {settings.fund?.enabled ? 'Ajustar' : 'Activar'}
            </button>
          </div>
        </Field>
        <p className="text-[11px] text-muted">
          Desde ese momento la app lo lleva en vivo: suma tus pagos de salario al llegar y resta
          cada pago, movimiento y aporte al ahorro. El sobrante del mes se arrastra solo al
          siguiente (aparte del ahorro). Lo ves en la pestaña Mes y en el widget «Saldo real».
        </p>
        {settings.fund?.enabled && (
          <button onClick={disableFund} className="pressable text-[12px] text-muted underline decoration-dotted self-start">
            Desactivar el saldo real
          </button>
        )}
      </Card>

    </>
  )
}

// ─── Apariencia ──────────────────────────────────────────────────────────────

export function AparienciaSection() {
  const settings = useFinanceStore((s) => s.settings)
  const setTheme = useFinanceStore((s) => s.setTheme)
  const fileRef = useRef<HTMLInputElement>(null)
  const t = settings.theme

  const pickImage = async (f: File | undefined) => {
    if (!f) return
    try {
      // 720px/0.62: suficiente para fondo y cabe en la nube (se guarda por cuenta)
      const data = await compressImage(f, 720, 0.62)
      setTheme({ background: { type: 'image', value: data } })
    } catch { /* imagen inválida */ }
  }

  return (
    <>
      <Card title="Modo">
        <Segmented
          value={t.mode}
          onChange={(mode) => setTheme({ mode })}
          options={[
            { value: 'dark', label: <><Moon size={14} /> Oscuro</> },
            { value: 'light', label: <><Sun size={14} /> Claro</> },
          ]}
        />
      </Card>
      <Card title="Paleta">
        <div className="grid grid-cols-3 gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => setTheme({ paletteId: p.id, accent: undefined })}
              className="pressable card p-2.5 flex items-center gap-2"
              style={t.paletteId === p.id && !t.accent ? { borderColor: p.accent } : undefined}
            >
              <span className="w-6 h-6 rounded-lg shrink-0" style={{ background: p.gradient }} />
              <span className="text-[11.5px] font-medium text-ink truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Color de acento">
        <div className="flex flex-wrap gap-2 items-center">
          {ACCENT_CHOICES.map((c) => (
            <button
              key={c}
              onClick={() => setTheme({ accent: c })}
              aria-label={`Acento ${c}`}
              className="pressable w-9 h-9 rounded-full border-2"
              style={{ background: c, borderColor: t.accent === c ? 'var(--c-text)' : 'transparent' }}
            />
          ))}
          <label className="pressable w-9 h-9 rounded-full border border-edge overflow-hidden relative cursor-pointer" aria-label="Color personalizado">
            <span className="absolute inset-0" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
            <input
              type="color" className="absolute inset-0 opacity-0 cursor-pointer"
              value={t.accent ?? '#7c5cff'}
              onChange={(e) => setTheme({ accent: e.target.value })}
            />
          </label>
        </div>
      </Card>
      <Card title="Fondo">
        <div className="grid grid-cols-4 gap-2">
          {BG_PRESETS.map((b) => (
            <button
              key={b.id}
              onClick={() => setTheme({ background: { type: 'default', value: b.id } })}
              className="pressable card !rounded-xl h-14 text-[10.5px] font-medium text-muted flex items-end justify-center pb-1"
              style={{
                background: b.value,
                borderColor: t.background.type === 'default' && t.background.value === b.id ? 'var(--app-accent)' : undefined,
              }}
            >
              {b.name}
            </button>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="pressable card !rounded-xl h-14 flex flex-col items-center justify-center gap-1 text-muted"
            style={t.background.type === 'image' ? { borderColor: 'var(--app-accent)' } : undefined}
          >
            <ImageIcon size={15} />
            <span className="text-[10.5px] font-medium">Tu foto</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pickImage(e.target.files?.[0])} />
          <label className="pressable card !rounded-xl h-14 flex flex-col items-center justify-center gap-1 text-muted relative cursor-pointer">
            <span className="w-4 h-4 rounded-full border border-edge" style={{ background: t.background.type === 'color' ? t.background.value : 'var(--c-elevated)' }} />
            <span className="text-[10.5px] font-medium">Color</span>
            <input
              type="color" className="absolute inset-0 opacity-0 cursor-pointer"
              value={t.background.type === 'color' ? t.background.value : '#0b0d14'}
              onChange={(e) => setTheme({ background: { type: 'color', value: e.target.value } })}
            />
          </label>
        </div>
      </Card>
    </>
  )
}

// ─── Animaciones y sonidos (mejoras 11 y 25) ─────────────────────────────────

export function AnimacionesSection() {
  const a = useFinanceStore((s) => s.settings.animations)
  const setAnimations = useFinanceStore((s) => s.setAnimations)

  return (
    <>
      <Card title="Animaciones">
        <RowToggle title="Confeti al pagar" desc="Explosión de confeti en el botón">
          <Toggle checked={a.confetti} onChange={(v) => setAnimations({ confetti: v })} label="Confeti" />
        </RowToggle>
        <RowToggle title="Lluvia de billetes" desc="Billetes y monedas al pagar">
          <Toggle checked={a.cash} onChange={(v) => setAnimations({ cash: v })} label="Billetes" />
        </RowToggle>
        <RowToggle title="Transiciones" desc="Animaciones al cambiar de pantalla">
          <Toggle checked={a.transitions} onChange={(v) => setAnimations({ transitions: v })} label="Transiciones" />
        </RowToggle>
        <RowToggle title="Celebración de mes" desc="Festejo al completar todos los pagos">
          <Toggle checked={a.celebration} onChange={(v) => setAnimations({ celebration: v })} label="Celebración" />
        </RowToggle>
        <RowToggle title="Vibración" desc="Respuesta háptica en acciones">
          <Toggle checked={a.haptics} onChange={(v) => setAnimations({ haptics: v })} label="Vibración" />
        </RowToggle>
        <div className="flex gap-2">
          <button onClick={(e) => payBurst(e.currentTarget, a)} className="pressable btn-ghost flex-1 flex items-center justify-center gap-2 text-[13px]">
            <Play size={13} /> Probar pago
          </button>
          <button onClick={() => { celebrate(a); if (a.sounds) playSuccess() }} className="pressable btn-ghost flex-1 flex items-center justify-center gap-2 text-[13px]">
            <PartyPopper size={13} /> Probar celebración
          </button>
        </div>
      </Card>

      <Card title="Sonidos" icon={<Volume2 size={14} />}>
        <RowToggle title="Sonidos activados" desc="Pagos, alarmas y fanfarrias">
          <Toggle checked={a.sounds} onChange={(v) => setAnimations({ sounds: v })} label="Sonidos" />
        </RowToggle>
        <div>
          <p className="text-[12px] text-muted mb-1.5">Sonido al pagar (toca para escuchar):</p>
          <div className="flex flex-wrap gap-1.5">
            {PAY_SOUNDS.map((s) => (
              <button
                key={s.id}
                onClick={() => { setAnimations({ paySound: s.id as PaySoundId }); s.play() }}
                className={`pressable chip ${a.paySound === s.id ? 'chip-active' : ''}`}
              >
                <Play size={11} /> {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[12px] text-muted mb-1.5">Sonido de alarma:</p>
          <div className="flex flex-wrap gap-1.5">
            {ALARM_SOUNDS.map((s) => (
              <button
                key={s.id}
                onClick={() => { setAnimations({ alarmSound: s.id as AlarmSoundId }); previewAlarm(s.id) }}
                className={`pressable chip ${a.alarmSound === s.id ? 'chip-active' : ''}`}
              >
                <Play size={11} /> {s.label}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </>
  )
}

// ─── Notificaciones (mejoras 9, 11 y 12) ─────────────────────────────────────

function NotificacionesSection() {
  const n = useFinanceStore((s) => s.settings.notifications)
  const setNotifications = useFinanceStore((s) => s.setNotifications)
  const [notifMsg, setNotifMsg] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [demoAlarm, setDemoAlarm] = useState<PendingAlarm | null>(null)
  // el atrás quita la alarma de prueba
  useBackClose(Boolean(demoAlarm), () => setDemoAlarm(null))

  const enableNotifs = async (on: boolean) => {
    if (!on) { setNotifications({ enabled: false }); return }
    const ok = await requestPermission()
    if (ok) { setNotifications({ enabled: true }); setNotifMsg('') }
    else setNotifMsg('Permiso denegado. Actívalo en la configuración del teléfono.')
  }

  const probarNotif = async () => {
    setTestMsg('')
    const r = await sendTestNotification()
    if (r === 'ok') setTestMsg('Enviada: te llega en unos segundos (mira la barra de notificaciones).')
    else if (r === 'sin-permiso') setTestMsg('Sin permiso: actívalo primero.')
    else setTestMsg('Este navegador no soporta notificaciones; en el APK sí funciona.')
  }

  return (
    <>
      <Card title="Recordatorios">
        <RowToggle title="Recordatorios de pago" desc="Avisos antes de cada vencimiento">
          <Toggle checked={n.enabled} onChange={(v) => void enableNotifs(v)} label="Recordatorios" />
        </RowToggle>
        {notifMsg && <p className="text-[12px]" style={{ color: 'var(--c-danger)' }}>{notifMsg}</p>}
        {n.enabled && (
          <div className="anim-fade flex flex-col gap-3">
            <div>
              <p className="text-[12px] text-muted mb-1.5">Avisarme:</p>
              <div className="flex flex-wrap gap-1.5">
                {[7, 3, 1, 0].map((d) => (
                  <button
                    key={d}
                    onClick={() => setNotifications({
                      daysBefore: n.daysBefore.includes(d)
                        ? n.daysBefore.filter((x) => x !== d)
                        : [...n.daysBefore, d].sort((x, y) => y - x),
                    })}
                    className={`pressable chip ${n.daysBefore.includes(d) ? 'chip-active' : ''}`}
                  >
                    {d === 0 ? 'El mismo día' : `${d} día${d === 1 ? '' : 's'} antes`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="notif-time" className="text-[12px] text-muted">Hora del aviso:</label>
              <input id="notif-time" type="time" className="input-base !w-auto" value={n.time} onChange={(e) => setNotifications({ time: e.target.value })} />
            </div>
            <RowToggle title="Modo alarma" desc="Suena como alarma de teléfono, insistente">
              <Toggle checked={n.alarmMode} onChange={(v) => setNotifications({ alarmMode: v })} label="Alarma" />
            </RowToggle>
          </div>
        )}
      </Card>

      <Card title="Pruebas" icon={<BellRing size={14} />}>
        <div className="flex gap-2">
          <button onClick={() => void probarNotif()} className="pressable btn-ghost flex-1 flex items-center justify-center gap-2 text-[13px]">
            <Bell size={13} /> Probar notificación
          </button>
          <button
            onClick={() => setDemoAlarm({
              id: 'demo', title: 'Prueba de alarma', body: 'Así sonará cuando un pago esté por vencer.',
              fireAt: Date.now(), itemName: 'Internet (ejemplo)', amount: 23000,
            })}
            className="pressable btn-ghost flex-1 flex items-center justify-center gap-2 text-[13px]"
          >
            <AlarmClock size={13} /> Probar alarma
          </button>
        </div>
        {testMsg && <p className="text-[12px] text-muted">{testMsg}</p>}
        <p className="text-[11px] text-muted flex items-start gap-1.5">
          <Vibrate size={11} className="mt-0.5 shrink-0" /> La alarma usa el sonido elegido en Animaciones y sonidos.
        </p>
      </Card>

      {demoAlarm && <AlarmOverlay alarm={demoAlarm} onDismiss={() => setDemoAlarm(null)} />}
    </>
  )
}

// ─── IA (solo administrador) ─────────────────────────────────────────────────

// ─── Datos y respaldo (mejora 14) ────────────────────────────────────────────

function DatosSection() {
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const profile = useFinanceStore((s) => s.profile)
  const activeMonthId = useFinanceStore((s) => s.activeMonthId)
  const resetAll = useFinanceStore((s) => s.resetAll)

  const importRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')
  const [pendingImport, setPendingImport] = useState<Awaited<ReturnType<typeof readBackup>> | null>(null)

  const exportExcel = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await withLoading('Generando tu Excel…', async () => {
        const blob = await buildWorkbook(months, debts, profile, activeMonthId)
        await downloadWorkbook(blob, `SNFinance-${activeMonthId}.xlsx`)
      })
    } catch { /* nada */ }
    setExporting(false)
  }

  const pickBackup = async (f: File | undefined) => {
    if (!f) return
    setBackupMsg('')
    try {
      setPendingImport(await withLoading('Leyendo tu respaldo…', () => readBackup(f)))
    } catch {
      setBackupMsg('Ese archivo no es un respaldo válido de SNFinance.')
    }
    if (importRef.current) importRef.current.value = ''
  }

    // cuánto pesa el estado que se sincroniza (el documento de la nube ~1 MB)
  const pesoKB = Math.round(new Blob([JSON.stringify(exportState())]).size / 1024)
  const pesoPct = Math.min(100, Math.round((pesoKB / 950) * 100))

  return (
    <>
      {pesoPct >= 55 && (
        <div className="card p-4" style={{ borderColor: pesoPct >= 85 ? 'color-mix(in oklab, var(--c-danger) 55%, var(--c-border))' : undefined }}>
          <p className="text-[13px] font-semibold text-ink">Espacio en la nube</p>
          <p className="text-[11.5px] text-muted mt-0.5 leading-snug">
            Tus datos ocupan <span className="num font-semibold">{pesoKB} KB</span> de los ~950 KB que
            caben en la nube. Si se llena, exporta un respaldo y borra meses viejos.
          </p>
          <div className="h-1.5 rounded-full bg-elevated overflow-hidden mt-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pesoPct}%`,
                background: pesoPct >= 85 ? 'var(--c-danger)' : 'var(--c-warning)',
              }}
            />
          </div>
        </div>
      )}

      <Card title="Exportar" icon={<Download size={14} />}>
        <button onClick={() => void exportExcel()} disabled={exporting} className="pressable btn-ghost w-full flex items-center justify-center gap-2 disabled:opacity-60">
          <Download size={15} /> {exporting ? 'Generando…' : 'Excel con plantilla (.xlsx)'}
        </button>
        <button onClick={() => void withLoading('Creando tu respaldo…', exportBackup)} className="pressable btn-ghost w-full flex items-center justify-center gap-2">
          <Database size={15} /> Respaldo completo (.json)
        </button>
        <p className="text-[11px] text-muted">El respaldo incluye meses, deudas, perfil y configuración.</p>
      </Card>

      <Card title="Importar" icon={<Upload size={14} />}>
        <button onClick={() => importRef.current?.click()} className="pressable btn-ghost w-full flex items-center justify-center gap-2">
          <Upload size={15} /> Importar respaldo (.json)
        </button>
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void pickBackup(e.target.files?.[0])} />
        {backupMsg && <p className="text-[12px]" style={{ color: 'var(--c-danger)' }}>{backupMsg}</p>}
      </Card>

      <Card title="Zona de riesgo" icon={<Trash2 size={14} />}>
        <button
          onClick={() => setConfirmReset(true)}
          className="pressable w-full rounded-2xl font-semibold py-3 flex items-center justify-center gap-2"
          style={{ background: 'color-mix(in oklab, var(--c-danger) 13%, transparent)', color: 'var(--c-danger)' }}
        >
          <Trash2 size={15} /> Borrar todos los datos
        </button>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="¿Borrar todo?"
        message="Se eliminarán todos los meses, deudas y configuraciones de este dispositivo. Si tienes cuenta, la nube se sobrescribirá con el estado vacío."
        confirmLabel="Borrar todo"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { resetAll(); setConfirmReset(false) }}
      />
      <ConfirmDialog
        open={!!pendingImport}
        title="¿Importar este respaldo?"
        message={`Contiene ${pendingImport?.months ?? 0} meses y ${pendingImport?.debts ?? 0} deudas (exportado: ${pendingImport?.fecha ?? ''}). Reemplazará TODOS los datos actuales.`}
        confirmLabel="Importar"
        onCancel={() => setPendingImport(null)}
        onConfirm={() => { if (pendingImport) applyBackup(pendingImport.data); setPendingImport(null) }}
      />
    </>
  )
}

// ─── Ayuda y soporte (mejora 14) ─────────────────────────────────────────────

function AyudaSection() {
  const openChat = useChat((s) => s.openChat)

  const mail = (subject: string, body: string) => {
    const info = `\n\n—\nSNFinance v3.6.0 · ${navigator.userAgent.slice(0, 80)}`
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + info)}`
  }

  const rows: { icon: React.ReactNode; title: string; desc: string; run: () => void }[] = [
    {
      icon: <Compass size={17} />,
      title: 'Ver el recorrido otra vez',
      desc: 'El paseo rápido por la app, como la primera vez',
      run: () => {
        useFinanceStore.getState().setProfile({ tourDone: false })
        useFinanceStore.getState().setActiveTab('home')
      },
    },
    {
      icon: <MessageCircleQuestion size={17} />,
      title: '¿Necesitas ayuda con la app?',
      desc: 'Pregúntale a Snake: conoce todas las funciones',
      run: () => openChat('¿Cómo se usa la app? Explícame lo básico.'),
    },
    {
      icon: <Bug size={17} />,
      title: 'Reportar un error o proponer una mejora',
      desc: 'Cuéntanos qué pasó o qué te gustaría ver',
      run: () => mail('SNFinance · Reporte de error / mejora', 'Hola, quiero reportar:\n\nQué pasó (o mi idea):\n\nPasos para verlo:\n1. \n2. \n\nPantalla donde ocurre: '),
    },
    {
      icon: <Mail size={17} />,
      title: 'Contactar al equipo',
      desc: 'Consultas, quejas o cualquier otro tema',
      run: () => mail('SNFinance · Contacto', 'Hola, les escribo por: '),
    },
  ]

  return (
    <>
      <Card title="¿En qué te ayudamos?">
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <button key={r.title} onClick={r.run} className="pressable card p-3.5 flex items-center gap-3 text-left">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--app-accent) 14%, transparent)', color: 'var(--app-accent-soft)' }}>
                {r.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-ink">{r.title}</span>
                <span className="block text-[11.5px] text-muted mt-0.5">{r.desc}</span>
              </span>
              <ChevronRight size={15} className="text-muted shrink-0" />
            </button>
          ))}
        </div>
      </Card>
    </>
  )
}

// ─── Piezas compartidas ──────────────────────────────────────────────────────

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4 flex flex-col gap-3.5">
      <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
        {icon && <span style={{ color: 'var(--app-accent-soft)' }}>{icon}</span>}
        {title}
      </h3>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[12px] text-muted block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function RowToggle({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        <p className="text-[11.5px] text-muted">{desc}</p>
      </div>
      {children}
    </div>
  )
}

function Row2({ label, value, danger, strong }: { label: string; value: string; danger?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-[2px]">
      <span className={`text-[12.5px] ${strong ? 'font-bold text-ink' : 'text-muted'}`}>{label}</span>
      <span
        className={`num text-[13px] ${strong ? 'font-bold text-[15px]' : 'font-semibold'}`}
        style={{ color: danger ? 'var(--c-danger)' : strong ? 'var(--c-income)' : 'var(--c-text)' }}
      >
        {value}
      </span>
    </div>
  )
}
