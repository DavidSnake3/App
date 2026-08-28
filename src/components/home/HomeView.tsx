import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Maximize2, Minimize2, Plus, SlidersHorizontal, Wallet, X } from 'lucide-react'
import type { WidgetConf, WidgetId } from '../../types/finance'
import { DEFAULT_WIDGETS, useFinanceStore } from '../../store/useFinanceStore'
import type { AuthState } from '../../hooks/useAuth'
import { greeting, longToday } from '../../lib/dates'
import { buildWorkbook, downloadWorkbook } from '../../lib/excel'
import { PlansSheet } from '../debts/PlansSheet'
import { BottomSheet } from '../ui/BottomSheet'
import { RenderWidget } from './widgets'
import { WIDGET_META, type WidgetCtx } from './widgetMeta'

/** Menú de inicio con widgets personalizables (puntos 5, 16, 18 + widgets) */
export function HomeView({ auth }: { auth: AuthState }) {
  const profile = useFinanceStore((s) => s.profile)
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const homeWidgets = useFinanceStore((s) => s.settings.homeWidgets)
  const setSettings = useFinanceStore((s) => s.setSettings)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)

  const widgets = homeWidgets ?? DEFAULT_WIDGETS
  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const save = (list: WidgetConf[]) => setSettings({ homeWidgets: list })

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= widgets.length) return
    const next = [...widgets]
    ;[next[i], next[j]] = [next[j], next[i]]
    save(next)
  }
  const resize = (i: number) =>
    save(widgets.map((w, idx) => idx === i ? { ...w, size: w.size === 'lg' ? 'sm' : 'lg' } : w))
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
    openPlans: () => setPlansOpen(true),
    exporting,
    exportExcel: async () => {
      if (exporting) return
      setExporting(true)
      try {
        const blob = await buildWorkbook(months, debts, profile, monthId)
        await downloadWorkbook(blob, `SNBusiness-${monthId}.xlsx`)
      } catch { /* silencioso */ }
      setExporting(false)
    },
  }

  const photo = auth.user?.photo || profile.photoUrl

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pb-28 pt-2 flex flex-col gap-4">

        {/* Saludo + avatar (foto de Google) + editar widgets */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-muted capitalize truncate">{longToday()}</p>
            <h1 className="font-display text-[24px] font-bold text-ink leading-tight truncate">
              {greeting()}{profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditMode((v) => !v)}
              aria-label={editMode ? 'Terminar edición' : 'Personalizar widgets'}
              className="pressable w-10 h-10 rounded-full border flex items-center justify-center"
              style={editMode
                ? { background: 'var(--app-accent)', borderColor: 'var(--app-accent)', color: '#fff' }
                : { background: 'var(--c-card)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}
            >
              {editMode ? <Check size={17} /> : <SlidersHorizontal size={16} />}
            </button>
            {photo ? (
              <img
                src={photo}
                alt="Foto de perfil"
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-2xl object-cover border border-edge"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-display font-bold text-[16px]"
                style={{ background: 'var(--app-gradient)' }}
                aria-hidden="true"
              >
                {(profile.name || 'S').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </header>

        {editMode && (
          <p className="text-[12px] text-muted -mt-2 anim-fade">
            Modo edición: mueve (↑↓), cambia tamaño, quita (✕) o agrega widgets.
          </p>
        )}

        {/* Cuadrícula de widgets */}
        <div className="grid grid-cols-2 gap-3">
          {widgets.map((w, i) => (
            <div
              key={w.id}
              className="relative anim-fade"
              style={{ gridColumn: w.size === 'lg' ? 'span 2' : 'span 1' }}
            >
              {editMode && (
                <div
                  className="absolute -top-2.5 right-2 z-10 flex gap-1 rounded-full border border-edge bg-elevated shadow-lg px-1 py-0.5"
                >
                  <EditBtn label="Subir" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp size={13} /></EditBtn>
                  <EditBtn label="Bajar" onClick={() => move(i, 1)} disabled={i === widgets.length - 1}><ChevronDown size={13} /></EditBtn>
                  <EditBtn label={w.size === 'lg' ? 'Achicar' : 'Agrandar'} onClick={() => resize(i)}>
                    {w.size === 'lg' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
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

      <PlansSheet open={plansOpen} onClose={() => setPlansOpen(false)} />
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
      className="pressable w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30"
      style={{ color: danger ? 'var(--c-danger)' : 'var(--c-text)' }}
    >
      {children}
    </button>
  )
}
