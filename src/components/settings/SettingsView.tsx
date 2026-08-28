import { useRef, useState } from 'react'
import {
  AlarmClock, Bell, Cloud, CloudOff, Download, Image as ImageIcon, KeyRound,
  LogOut, Moon, Palette, PartyPopper, RefreshCw, Sparkles, Sun, Trash2,
  User as UserIcon, Vibrate, Volume2,
} from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { BG_PRESETS, PALETTES, compressImage } from '../../lib/themes'
import { CURRENCIES, formatMoney } from '../../lib/format'
import { requestPermission } from '../../lib/notifications'
import { aiAvailable } from '../../lib/ai'
import { firebaseReady, logout } from '../../lib/firebase'
import type { AuthState } from '../../hooks/useAuth'
import { buildWorkbook, downloadWorkbook } from '../../lib/excel'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Toggle } from '../ui/Toggle'
import { Segmented } from '../ui/Segmented'
import { ConfirmDialog } from '../ui/ConfirmDialog'

const ACCENT_CHOICES = ['#7c5cff', '#10b981', '#0ea5e9', '#f43f5e', '#d97706', '#ec4899', '#14b8a6', '#8b5cf6']

export function SettingsView({ auth }: { auth: AuthState }) {
  const profile = useFinanceStore((s) => s.profile)
  const settings = useFinanceStore((s) => s.settings)
  const setProfile = useFinanceStore((s) => s.setProfile)
  const setSettings = useFinanceStore((s) => s.setSettings)
  const setTheme = useFinanceStore((s) => s.setTheme)
  const setAnimations = useFinanceStore((s) => s.setAnimations)
  const setNotifications = useFinanceStore((s) => s.setNotifications)
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const activeMonthId = useFinanceStore((s) => s.activeMonthId)
  const resetAll = useFinanceStore((s) => s.resetAll)

  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notifMsg, setNotifMsg] = useState('')
  const [exporting, setExporting] = useState(false)

  const t = settings.theme
  const a = settings.animations
  const n = settings.notifications

  const enableNotifs = async (on: boolean) => {
    if (!on) { setNotifications({ enabled: false }); return }
    const ok = await requestPermission()
    if (ok) { setNotifications({ enabled: true }); setNotifMsg('') }
    else setNotifMsg('Permiso denegado. Actívalo en la configuración del teléfono.')
  }

  const pickImage = async (f: File | undefined) => {
    if (!f) return
    try {
      const data = await compressImage(f)
      setTheme({ background: { type: 'image', value: data } })
    } catch { /* imagen inválida */ }
  }

  const exportExcel = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const blob = await buildWorkbook(months, debts, profile, activeMonthId)
      await downloadWorkbook(blob, `SNBusiness-${activeMonthId}.xlsx`)
    } catch { /* nada */ }
    setExporting(false)
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-28 pt-2 flex flex-col gap-5">
        <header>
          <h2 className="font-display text-[22px] font-bold text-ink">Ajustes</h2>
          <p className="text-[13px] text-muted mt-0.5">Personaliza SNBusiness a tu manera</p>
        </header>

        {/* ── Cuenta ── */}
        <Section icon={<UserIcon size={15} />} title="Cuenta y sincronización">
          {firebaseReady ? (
            auth.user ? (
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ background: 'var(--app-gradient)' }}>
                  {auth.user.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink truncate">{auth.user.name}</p>
                  <p className="text-[12px] text-muted truncate flex items-center gap-1">
                    <Cloud size={11} style={{ color: 'var(--c-income)' }} /> {auth.user.email} · sincronizado
                  </p>
                </div>
                <button
                  onClick={() => { void logout() }}
                  className="pressable btn-ghost !py-2 !px-3 text-[12.5px] flex items-center gap-1.5"
                >
                  <LogOut size={13} /> Salir
                </button>
              </div>
            ) : (
              <button onClick={auth.unskip} className="pressable btn-primary w-full !py-3 text-[14px]">
                Iniciar sesión / crear cuenta
              </button>
            )
          ) : (
            <p className="text-[12.5px] text-muted flex items-start gap-2">
              <CloudOff size={14} className="shrink-0 mt-0.5" />
              Modo local. Para respaldar tus datos y entrar con correo o Google, configura Firebase en el archivo .env (mira SETUP.md).
            </p>
          )}
        </Section>

        {/* ── Perfil ── */}
        <Section icon={<UserIcon size={15} />} title="Perfil">
          <Field label="Nombre">
            <input className="input-base" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
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
            <Field label="Día de pago">
              <input
                type="number" min={1} max={31} className="input-base num" value={profile.payday}
                onChange={(e) => setProfile({ payday: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
              />
            </Field>
          </div>
          <Field label="Salario por defecto">
            <CurrencyInput value={settings.defaultSalary} onChange={(v) => setSettings({ defaultSalary: v })} />
          </Field>
          <Row
            icon={<RefreshCw size={16} />}
            title="Generar mes automáticamente"
            desc="Al entrar a un mes nuevo se copian tus pagos recurrentes"
          >
            <Toggle checked={settings.autoRollover} onChange={(v) => setSettings({ autoRollover: v })} label="Mes automático" />
          </Row>
        </Section>

        {/* ── Tema (punto 17) ── */}
        <Section icon={<Palette size={15} />} title="Tema y apariencia">
          <Segmented
            value={t.mode}
            onChange={(mode) => setTheme({ mode })}
            options={[
              { value: 'dark', label: <><Moon size={14} /> Oscuro</> },
              { value: 'light', label: <><Sun size={14} /> Claro</> },
            ]}
          />
          <div>
            <p className="text-[12px] text-muted mb-2 mt-1">Paleta</p>
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
          </div>
          <div>
            <p className="text-[12px] text-muted mb-2">Color de acento</p>
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
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  value={t.accent ?? '#7c5cff'}
                  onChange={(e) => setTheme({ accent: e.target.value })}
                />
              </label>
            </div>
          </div>
          <div>
            <p className="text-[12px] text-muted mb-2">Fondo</p>
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
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => void pickImage(e.target.files?.[0])}
              />
              <label className="pressable card !rounded-xl h-14 flex flex-col items-center justify-center gap-1 text-muted relative cursor-pointer">
                <span className="w-4 h-4 rounded-full border border-edge" style={{ background: t.background.type === 'color' ? t.background.value : 'var(--c-elevated)' }} />
                <span className="text-[10.5px] font-medium">Color</span>
                <input
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  value={t.background.type === 'color' ? t.background.value : '#0b0d14'}
                  onChange={(e) => setTheme({ background: { type: 'color', value: e.target.value } })}
                />
              </label>
            </div>
          </div>
        </Section>

        {/* ── Animaciones (punto 25) ── */}
        <Section icon={<PartyPopper size={15} />} title="Animaciones y sonidos">
          <Row icon={<PartyPopper size={16} />} title="Confeti al pagar" desc="Explosión de confeti en el botón">
            <Toggle checked={a.confetti} onChange={(v) => setAnimations({ confetti: v })} label="Confeti" />
          </Row>
          <Row icon={<Sparkles size={16} />} title="Lluvia de billetes" desc="Billetes y monedas al pagar">
            <Toggle checked={a.cash} onChange={(v) => setAnimations({ cash: v })} label="Billetes" />
          </Row>
          <Row icon={<Volume2 size={16} />} title="Sonidos" desc="Cha-ching al pagar y fanfarria al completar">
            <Toggle checked={a.sounds} onChange={(v) => setAnimations({ sounds: v })} label="Sonidos" />
          </Row>
          <Row icon={<Vibrate size={16} />} title="Vibración" desc="Respuesta háptica en acciones">
            <Toggle checked={a.haptics} onChange={(v) => setAnimations({ haptics: v })} label="Vibración" />
          </Row>
          <Row icon={<RefreshCw size={16} />} title="Transiciones" desc="Animaciones al cambiar de pantalla">
            <Toggle checked={a.transitions} onChange={(v) => setAnimations({ transitions: v })} label="Transiciones" />
          </Row>
          <Row icon={<PartyPopper size={16} />} title="Celebración de mes" desc="Festejo al completar todos los pagos">
            <Toggle checked={a.celebration} onChange={(v) => setAnimations({ celebration: v })} label="Celebración" />
          </Row>
        </Section>

        {/* ── Notificaciones (puntos 9 y 12) ── */}
        <Section icon={<Bell size={15} />} title="Notificaciones y alarmas">
          <Row icon={<Bell size={16} />} title="Recordatorios de pago" desc="Avisos antes de cada vencimiento">
            <Toggle checked={n.enabled} onChange={(v) => void enableNotifs(v)} label="Recordatorios" />
          </Row>
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
                <input
                  id="notif-time" type="time" className="input-base !w-auto"
                  value={n.time} onChange={(e) => setNotifications({ time: e.target.value })}
                />
              </div>
              <Row icon={<AlarmClock size={16} />} title="Modo alarma" desc="Suena como alarma de teléfono, insistente (punto 12)">
                <Toggle checked={n.alarmMode} onChange={(v) => setNotifications({ alarmMode: v })} label="Alarma" />
              </Row>
            </div>
          )}
        </Section>

        {/* ── IA (punto 26) ── */}
        <Section icon={<Sparkles size={15} />} title="Inteligencia artificial">
          <Row icon={<Sparkles size={16} />} title="Funciones con IA" desc="Consejos, planes de pago y análisis con Gemini">
            <Toggle checked={settings.aiEnabled} onChange={(v) => setSettings({ aiEnabled: v })} label="IA" />
          </Row>
          {settings.aiEnabled && (
            <div className="anim-fade">
              <Field label={aiAvailable() ? 'Clave de Gemini (configurada)' : 'Clave de Gemini (pégala aquí)'}>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    className="input-base !pl-9"
                    type="password"
                    placeholder={aiAvailable() ? '••••••••••••  (usando la del .env)' : 'AIza…'}
                    value={settings.geminiKey}
                    onChange={(e) => setSettings({ geminiKey: e.target.value.trim() })}
                  />
                </div>
              </Field>
              <p className="text-[11.5px] text-muted mt-1.5">
                Gratis en aistudio.google.com. La clave se guarda solo en tu dispositivo.
              </p>
            </div>
          )}
        </Section>

        {/* ── Datos ── */}
        <Section icon={<Download size={15} />} title="Datos">
          <button onClick={exportExcel} disabled={exporting} className="pressable btn-ghost w-full flex items-center justify-center gap-2 disabled:opacity-60">
            <Download size={15} /> {exporting ? 'Generando…' : 'Exportar a Excel (con plantilla)'}
          </button>
          <button
            onClick={() => setConfirmReset(true)}
            className="pressable w-full rounded-2xl font-semibold py-3 flex items-center justify-center gap-2"
            style={{ background: 'color-mix(in oklab, var(--c-danger) 13%, transparent)', color: 'var(--c-danger)' }}
          >
            <Trash2 size={15} /> Borrar todos los datos
          </button>
          <p className="text-[11px] text-muted text-center">
            SNBusiness v1.0 · datos totales: {Object.keys(months).length} meses · {debts.length} deudas ·
            salario por defecto {formatMoney(settings.defaultSalary)}
          </p>
        </Section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="¿Borrar todo?"
        message="Se eliminarán todos los meses, deudas y configuraciones de este dispositivo. Si tienes cuenta, la nube se sobrescribirá con el estado vacío."
        confirmLabel="Borrar todo"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { resetAll(); setConfirmReset(false) }}
      />
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 flex flex-col gap-3.5">
      <h3 className="text-[12.5px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
        <span style={{ color: 'var(--app-accent-soft)' }}>{icon}</span> {title}
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

function Row({ icon, title, desc, children }: {
  icon: React.ReactNode; title: string; desc: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-elevated border border-edge flex items-center justify-center shrink-0 text-muted">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        <p className="text-[11.5px] text-muted">{desc}</p>
      </div>
      {children}
    </div>
  )
}
