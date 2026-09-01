// Selectores de fecha y de mes propios de la app: se ven igual en Android y en
// el navegador, en el idioma del usuario, y con la marca de la app.
import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTH_NAMES, WEEKDAY_SHORT, currentMonthId, daysInMonth, firstWeekday, todayISO } from '../../lib/dates'
import { BottomSheet } from './BottomSheet'

/* ─── helpers ──────────────────────────────────────────────────────────── */

function partes(iso: string): { y: number; m: number; d: number } {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  return { y: y || 2000, m: m || 1, d: d || 1 }
}

function isoDe(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "1 de septiembre de 2026", con "Hoy" y "Ayer" cuando aplica */
function labelFecha(iso: string): string {
  const hoy = todayISO().slice(0, 10)
  if (iso === hoy) return 'Hoy'
  const h = partes(hoy)
  const ayer = new Date(h.y, h.m - 1, h.d - 1)
  if (iso === isoDe(ayer.getFullYear(), ayer.getMonth() + 1, ayer.getDate())) return 'Ayer'
  const p = partes(iso)
  return `${p.d} de ${MONTH_NAMES[p.m - 1]?.toLowerCase() ?? ''} de ${p.y}`
}

/** "Septiembre 2026" */
function labelMes(monthId: string): string {
  const p = partes(`${monthId}-01`)
  return `${MONTH_NAMES[p.m - 1] ?? ''} ${p.y}`
}

/* ─── Campo de fecha ───────────────────────────────────────────────────── */

interface DateFieldProps {
  /** 'yyyy-MM-dd' */
  value: string
  onChange: (iso: string) => void
  label?: string
  /** título de la hoja */
  title?: string
  /** no permitir fechas posteriores a hoy */
  maxToday?: boolean
}

/** Botón + hoja con calendario para elegir un día */
export function DateField({ value, onChange, label, title = 'Elige la fecha', maxToday }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {label && <label className="text-[12px] font-semibold text-muted block mb-1.5">{label}</label>}
      <button
        onClick={() => setOpen(true)}
        className="pressable w-full flex items-center gap-3 rounded-2xl border border-edge bg-elevated px-3.5 py-3 text-left"
      >
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--app-accent) 15%, transparent)', color: 'var(--app-accent-soft)' }}
        >
          <CalendarDays size={17} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold text-ink truncate">{labelFecha(value)}</span>
          <span className="block text-[11px] text-muted">Toca para cambiarla</span>
        </span>
        <ChevronRight size={15} className="text-muted shrink-0" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <Calendario
          value={value}
          maxToday={maxToday}
          onPick={(iso) => { onChange(iso); setOpen(false) }}
        />
      </BottomSheet>
    </>
  )
}

/** Calendario del mes con navegación y atajos */
function Calendario({ value, onPick, maxToday }: {
  value: string
  onPick: (iso: string) => void
  maxToday?: boolean
}) {
  const sel = partes(value)
  const [vista, setVista] = useState(`${sel.y}-${String(sel.m).padStart(2, '0')}`)
  const hoy = todayISO().slice(0, 10)

  const p = partes(`${vista}-01`)
  const total = daysInMonth(vista)
  const inicio = firstWeekday(vista) // 0 = lunes
  const celdas: (number | null)[] = [
    ...Array.from({ length: inicio }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ]

  const mover = (delta: number) => {
    const d = new Date(p.y, p.m - 1 + delta, 1)
    setVista(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* mes que se está viendo */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => mover(-1)}
          aria-label="Mes anterior"
          className="pressable w-10 h-10 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted"
        >
          <ChevronLeft size={17} />
        </button>
        <p className="font-display text-[16px] font-bold text-ink">{labelMes(vista)}</p>
        <button
          onClick={() => mover(1)}
          aria-label="Mes siguiente"
          className="pressable w-10 h-10 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      {/* días de la semana */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_SHORT.map((d, i) => (
          <span key={`${d}-${i}`} className="text-[10.5px] font-bold text-muted text-center py-1">{d}</span>
        ))}
      </div>

      {/* días */}
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((dia, i) => {
          if (dia == null) return <span key={`v-${i}`} />
          const iso = isoDe(p.y, p.m, dia)
          const activo = iso === value
          const esHoy = iso === hoy
          const futuro = Boolean(maxToday) && iso > hoy
          return (
            <button
              key={iso}
              disabled={futuro}
              onClick={() => onPick(iso)}
              className="pressable aspect-square rounded-xl flex items-center justify-center text-[13.5px] font-semibold transition-all duration-150 anim-rise"
              style={{
                animationDelay: `${Math.min(i * 8, 200)}ms`,
                ...(activo
                  ? {
                      background: 'var(--app-gradient)',
                      color: '#fff',
                      boxShadow: '0 6px 16px color-mix(in oklab, var(--app-accent) 40%, transparent)',
                    }
                  : {
                      background: 'var(--c-elevated)',
                      color: futuro ? 'color-mix(in oklab, var(--c-muted) 50%, transparent)' : 'var(--c-text)',
                      border: esHoy ? '1.5px solid var(--app-accent)' : '1px solid var(--c-border)',
                      opacity: futuro ? 0.45 : 1,
                    }),
              }}
            >
              {dia}
            </button>
          )
        })}
      </div>

      {/* atajos */}
      <div className="flex gap-2">
        <button
          onClick={() => onPick(hoy)}
          className="pressable flex-1 rounded-xl py-2.5 text-[12.5px] font-semibold text-white"
          style={{ background: 'var(--app-gradient)' }}
        >
          Hoy
        </button>
        <button
          onClick={() => {
            const h = partes(hoy)
            const a = new Date(h.y, h.m - 1, h.d - 1)
            onPick(isoDe(a.getFullYear(), a.getMonth() + 1, a.getDate()))
          }}
          className="pressable flex-1 rounded-xl py-2.5 text-[12.5px] font-semibold"
          style={{ background: 'var(--c-elevated)', color: 'var(--c-text)' }}
        >
          Ayer
        </button>
      </div>
    </div>
  )
}

/* ─── Campo de mes ─────────────────────────────────────────────────────── */

interface MonthFieldProps {
  /** 'yyyy-MM' */
  value: string
  onChange: (monthId: string) => void
  label?: string
  title?: string
  /** estilo compacto: solo el nombre del mes con flechas */
  compact?: boolean
}

/** Botón + hoja con la grilla de meses del año */
export function MonthField({ value, onChange, label, title = 'Elige el mes', compact }: MonthFieldProps) {
  const [open, setOpen] = useState(false)
  const p = partes(`${value}-01`)

  const mover = (delta: number) => {
    const d = new Date(p.y, p.m - 1 + delta, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-2">
          <button
            onClick={() => mover(-1)}
            aria-label="Mes anterior"
            className="pressable w-9 h-9 rounded-full bg-card border border-edge flex items-center justify-center text-muted shrink-0"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            onClick={() => setOpen(true)}
            className="pressable flex-1 min-w-0 rounded-2xl px-3 py-2 flex items-center justify-center gap-2 border border-edge"
            style={{ background: 'var(--c-card)' }}
          >
            <CalendarDays size={14} style={{ color: 'var(--app-accent-soft)' }} />
            <span className="text-[13.5px] font-bold text-ink truncate">{labelMes(value)}</span>
          </button>
          <button
            onClick={() => mover(1)}
            aria-label="Mes siguiente"
            className="pressable w-9 h-9 rounded-full bg-card border border-edge flex items-center justify-center text-muted shrink-0"
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
          <GrillaMeses value={value} onPick={(m) => { onChange(m); setOpen(false) }} />
        </BottomSheet>
      </>
    )
  }

  return (
    <>
      {label && <label className="text-[12px] font-semibold text-muted block mb-1.5">{label}</label>}
      <button
        onClick={() => setOpen(true)}
        className="pressable w-full flex items-center gap-3 rounded-2xl border border-edge bg-elevated px-3.5 py-3 text-left"
      >
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--app-accent) 15%, transparent)', color: 'var(--app-accent-soft)' }}
        >
          <CalendarDays size={17} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold text-ink truncate">{labelMes(value)}</span>
          <span className="block text-[11px] text-muted">Toca para cambiarlo</span>
        </span>
        <ChevronRight size={15} className="text-muted shrink-0" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <GrillaMeses value={value} onPick={(m) => { onChange(m); setOpen(false) }} />
      </BottomSheet>
    </>
  )
}

/** Grilla de los 12 meses con navegación de año */
function GrillaMeses({ value, onPick }: { value: string; onPick: (monthId: string) => void }) {
  const sel = partes(`${value}-01`)
  const [anio, setAnio] = useState(sel.y)
  const ahora = currentMonthId()

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setAnio((y) => y - 1)}
          aria-label="Año anterior"
          className="pressable w-10 h-10 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted"
        >
          <ChevronLeft size={17} />
        </button>
        <p className="num font-display text-[18px] font-bold text-ink">{anio}</p>
        <button
          onClick={() => setAnio((y) => y + 1)}
          aria-label="Año siguiente"
          className="pressable w-10 h-10 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MONTH_NAMES.map((nombre, i) => {
          const id = `${anio}-${String(i + 1).padStart(2, '0')}`
          const activo = id === value
          const esAhora = id === ahora
          return (
            <button
              key={id}
              onClick={() => onPick(id)}
              className="pressable rounded-2xl py-3 text-[12.5px] font-semibold transition-all duration-150 anim-rise"
              style={{
                animationDelay: `${i * 22}ms`,
                ...(activo
                  ? {
                      background: 'var(--app-gradient)',
                      color: '#fff',
                      boxShadow: '0 6px 18px color-mix(in oklab, var(--app-accent) 38%, transparent)',
                    }
                  : {
                      background: 'var(--c-elevated)',
                      color: 'var(--c-text)',
                      border: esAhora ? '1.5px solid var(--app-accent)' : '1px solid var(--c-border)',
                    }),
              }}
            >
              {nombre.slice(0, 3)}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => onPick(ahora)}
        className="pressable rounded-xl py-2.5 text-[12.5px] font-semibold"
        style={{ background: 'var(--c-elevated)', color: 'var(--c-text)' }}
      >
        Mes actual
      </button>
    </div>
  )
}
