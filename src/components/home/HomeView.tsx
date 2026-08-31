import { useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, ChevronUp, Plus, Proportions, Sparkles, TriangleAlert, Wallet, X } from 'lucide-react'
import type { WidgetConf, WidgetId, WidgetSize } from '../../types/finance'
import { DEFAULT_WIDGETS, useFinanceStore } from '../../store/useFinanceStore'
import { useChat } from '../../store/useChat'
import type { AuthState } from '../../hooks/useAuth'
import { greeting, longToday } from '../../lib/dates'
import { buildWorkbook, downloadWorkbook } from '../../lib/excel'
import { withLoading } from '../../store/useLoading'
import { vibrate } from '../../lib/fx'
import { BottomSheet } from '../ui/BottomSheet'
import { RenderWidget } from './widgets'
import { WIDGET_META, type WidgetCtx } from './widgetMeta'

const SIZE_ORDER: WidgetSize[] = ['sm', 'lg', 'xl']
const SIZE_LABEL: Record<WidgetSize, string> = { sm: 'S', lg: 'M', xl: 'L' }

/** Menú de inicio con widgets personalizables (mantén presionado para editar) */
export function HomeView({ auth }: { auth: AuthState }) {
  const profile = useFinanceStore((s) => s.profile)
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const homeWidgets = useFinanceStore((s) => s.settings.homeWidgets)
  const animPrefs = useFinanceStore((s) => s.settings.animations)
  const payrollGross = useFinanceStore((s) => s.settings.payroll.gross)
  const defaultSalary = useFinanceStore((s) => s.settings.defaultSalary)
  const setSettings = useFinanceStore((s) => s.setSettings)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)
  const openChat = useChat((s) => s.openChat)

  const widgets = homeWidgets ?? DEFAULT_WIDGETS
  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Mantener presionado ~0.7 s sobre un widget para entrar al modo edición (mejora 5)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressStart = useRef<{ x: number; y: number } | null>(null)

  const beginPress = (x: number, y: number) => {
    if (editMode) return
    pressStart.current = { x, y }
    pressTimer.current = setTimeout(() => {
      setEditMode(true)
      vibrate(45, animPrefs)
    }, 700)
  }
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
    pressStart.current = null
  }
  const movePress = (x: number, y: number) => {
    if (!pressStart.current) return
    const dx = Math.abs(x - pressStart.current.x)
    const dy = Math.abs(y - pressStart.current.y)
    if (dx > 12 || dy > 12) cancelPress() // es un scroll, no un long-press
  }

  const save = (list: WidgetConf[]) => setSettings({ homeWidgets: list })

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= widgets.length) return
    const next = [...widgets]
    ;[next[i], next[j]] = [next[j], next[i]]
    save(next)
  }
  const resize = (i: number) =>
    save(widgets.map((w, idx) => {
      if (idx !== i) return w
      const nextSize = SIZE_ORDER[(SIZE_ORDER.indexOf(w.size) + 1) % SIZE_ORDER.length]
      return { ...w, size: nextSize }
    }))
  const remove = (i: number) => save(widgets.filter((_, idx) => idx !== i))
  const add = (id: WidgetId) => {
    save([...widgets, { id, size: WIDGET_META[id].defaultSize }])
    setAddOpen(false)
  }

  const available = (Object.keys(WIDGET_META) as WidgetId[]).filter(
    (id) => !widgets.some((w) => w.id === id),
  )

  const ctx: WidgetCtx = {
    setActiveTab,
    exporting,
    exportExcel: async () => {
      if (exporting) return
      setExporting(true)
      try {
        await withLoading('Generando tu Excel…', async () => {
          const blob = await buildWorkbook(months, debts, profile, monthId)
          await downloadWorkbook(blob, `SNFinance-${monthId}.xlsx`)
        })
      } catch { /* silencioso */ }
      setExporting(false)
    },
  }

  const photo = auth.user?.photo || profile.photoUrl

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-28 pt-2 flex flex-col gap-4">

        {/* Saludo + avatar (foto de Google) */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-muted capitalize truncate">{longToday()}</p>
            <h1 className="font-display text-[24px] font-bold text-ink leading-tight truncate">
              {greeting()}{profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
            </h1>
          </div>
          {photo ? (
            <img
              src={photo}
              alt="Foto de perfil"
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-2xl object-cover border border-edge shrink-0"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-display font-bold text-[16px] shrink-0"
              style={{ background: 'var(--app-gradient)' }}
              aria-hidden="true"
            >
              {(profile.name || 'S').charAt(0).toUpperCase()}
            </div>
          )}
        </header>

        {editMode && (
          <p className="text-[12px] text-muted -mt-2 anim-fade">
            Modo edición: mueve (↑↓), tamaño (S·M·L), quita (✕) o agrega widgets.
          </p>
        )}

        {/* Alerta: ingresos sin configurar (mejora 11) */}
        {payrollGross <= 0 && defaultSalary <= 0 && (
          <div
            className="card p-3.5 anim-pop"
            style={{ borderColor: 'color-mix(in oklab, var(--c-warning) 55%, var(--c-border))' }}
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--c-warning) 18%, transparent)' }}>
                <TriangleAlert size={17} style={{ color: 'var(--c-warning)' }} />
              </span>
              <span className="flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">Te falta configurar tus ingresos</span>
                <span className="block text-[11.5px] text-muted mt-0.5">Sin tu salario no puedo calcular tu balance, tu saldo real ni tus planes</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <button
                onClick={() => openChat('', 'welcome')}
                className="pressable rounded-xl py-2 text-[12.5px] font-semibold text-white flex items-center justify-center gap-1.5"
                style={{ background: 'var(--app-gradient)' }}
              >
                <Sparkles size={13} /> Que Snake me ayude
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className="pressable btn-ghost !py-2 !text-[12.5px] flex items-center justify-center gap-1"
              >
                Hacerlo yo <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Cuadrícula de widgets (mantén presionado un widget para editar) */}
        <div
          className="grid grid-cols-2 gap-3"
          onTouchStart={(e) => beginPress(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => movePress(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={cancelPress}
          onTouchCancel={cancelPress}
          onMouseDown={(e) => beginPress(e.clientX, e.clientY)}
          onMouseMove={(e) => movePress(e.clientX, e.clientY)}
          onMouseUp={cancelPress}
          onMouseLeave={cancelPress}
        >
          {widgets.map((w, i) => (
            <div
              key={w.id}
              className={`relative anim-fade ${editMode ? 'widget-wiggle' : ''}`}
              style={{ gridColumn: w.size === 'sm' ? 'span 1' : 'span 2' }}
            >
              {editMode && (
                <div className="absolute -top-2.5 right-2 z-10 flex gap-1 rounded-full border border-edge bg-elevated shadow-lg px-1 py-0.5">
                  <EditBtn label="Subir" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp size={13} /></EditBtn>
                  <EditBtn label="Bajar" onClick={() => move(i, 1)} disabled={i === widgets.length - 1}><ChevronDown size={13} /></EditBtn>
                  <EditBtn label={`Tamaño ${SIZE_LABEL[w.size]}`} onClick={() => resize(i)}>
                    <span className="flex items-center gap-0.5 text-[10px] font-bold">
                      <Proportions size={11} />{SIZE_LABEL[w.size]}
                    </span>
                  </EditBtn>
                  <EditBtn label="Quitar" onClick={() => remove(i)} danger><X size={13} /></EditBtn>
                </div>
              )}
              <div style={editMode ? { outline: '1.5px dashed color-mix(in oklab, var(--app-accent) 55%, transparent)', outlineOffset: 3, borderRadius: 20 } : undefined}>
                <RenderWidget id={w.id} size={w.size} ctx={ctx} />
              </div>
            </div>
          ))}

          {/* Agregar widget */}
          {editMode && available.length > 0 && (
            <button
              onClick={() => setAddOpen(true)}
              className="pressable rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 py-5 text-[13.5px] font-semibold col-span-2"
              style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 50%, var(--c-border))', color: 'var(--app-accent-soft)' }}
            >
              <Plus size={17} /> Agregar widget
            </button>
          )}
        </div>

        {widgets.length === 0 && !editMode && (
          <button onClick={() => setEditMode(true)} className="pressable card p-6 text-center">
            <Wallet size={26} className="mx-auto mb-2" style={{ color: 'var(--app-accent-soft)' }} />
            <p className="text-[15px] font-semibold text-ink">Tu inicio está vacío</p>
            <p className="text-[13px] text-muted mt-1">Toca para agregar widgets a tu gusto</p>
          </button>
        )}
      </div>

      {/* Botón Listo del modo edición */}
      {editMode && (
        <button
          onClick={() => setEditMode(false)}
          className="pressable absolute bottom-[74px] left-1/2 -translate-x-1/2 z-30 rounded-full px-6 py-3 font-semibold text-white text-[14px] flex items-center gap-2 anim-pop"
          style={{ background: 'var(--app-gradient)', boxShadow: '0 10px 30px color-mix(in oklab, var(--app-accent) 45%, transparent)' }}
        >
          <Check size={16} /> Listo
        </button>
      )}

      {/* Selector de widgets disponibles */}
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Agregar widget" subtitle="Elige qué quieres ver en tu inicio">
        <div className="flex flex-col gap-2">
          {available.map((id) => (
            <button key={id} onClick={() => add(id)} className="pressable card p-3.5 flex items-center gap-3 text-left">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)', color: 'var(--app-accent-soft)' }}>
                {WIDGET_META[id].icon}
              </span>
              <span className="flex-1">
                <span className="block text-[14.5px] font-semibold text-ink">{WIDGET_META[id].name}</span>
                <span className="block text-[12px] text-muted mt-0.5">{WIDGET_META[id].desc}</span>
              </span>
              <Plus size={17} className="text-muted shrink-0" />
            </button>
          ))}
          {available.length === 0 && <p className="text-[13px] text-muted">Ya agregaste todos los widgets disponibles.</p>}
        </div>
      </BottomSheet>

    </div>
  )
}

function EditBtn({ children, label, onClick, disabled, danger }: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="pressable min-w-7 h-7 px-1 rounded-full flex items-center justify-center disabled:opacity-30"
      style={{ color: danger ? 'var(--c-danger)' : 'var(--c-text)' }}
    >
      {children}
    </button>
  )
}
