// Ajustes → Ingresos y planilla → Pagos fijos.
// Lo que sale sí o sí cada mes: se administra aquí y cada mes nuevo nace con
// estos pagos ya puestos.
import { useState } from 'react'
import {
  CalendarSync, Heart, Pause, Play, Receipt, Repeat2, ShieldCheck, Trash2, Plus,
} from 'lucide-react'
import type { ExpenseKind, Recurrence, RecurringTemplate } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { RECURRENCE_EVERY_LABEL, recurringMonthlyTotal, templateHits } from '../../lib/recurring'
import { RECOMMENDED_RECURRENCES, RECURRENCE_LABEL } from '../../lib/finance'
import { currentMonthId, monthLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'
import { IconPicker } from '../ui/IconPicker'
import { MonthField } from '../ui/DatePicker'
import { ConfirmDialog } from '../ui/ConfirmDialog'

const KIND_ICON: Record<ExpenseKind, React.ReactNode> = {
  servicio: <ShieldCheck size={13} />,
  gasto: <Receipt size={13} />,
  personal: <Heart size={13} />,
}

const KIND_COLOR: Record<ExpenseKind, string> = {
  servicio: 'var(--app-accent)',
  gasto: 'var(--c-warning)',
  personal: '#ec4899',
}

export function RecurringSection() {
  const recurring = useFinanceStore((s) => s.recurring)
  const toggleTemplate = useFinanceStore((s) => s.toggleTemplate)
  const deleteTemplate = useFinanceStore((s) => s.deleteTemplate)
  const applyTemplatesEverywhere = useFinanceStore((s) => s.applyTemplatesEverywhere)

  const [sheet, setSheet] = useState<{ open: boolean; editing: RecurringTemplate | null }>({
    open: false, editing: null,
  })
  const [porBorrar, setPorBorrar] = useState<RecurringTemplate | null>(null)
  const [aplicado, setAplicado] = useState(false)

  const nowId = currentMonthId()
  const activos = recurring.filter((t) => t.active)
  const total = recurringMonthlyTotal(recurring, nowId)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-muted flex items-center gap-1.5">
          <Repeat2 size={13} /> Pagos fijos (salen todos los meses)
        </p>
        {recurring.length > 0 && (
          <span className="num text-[11.5px] font-semibold" style={{ color: 'var(--app-accent-soft)' }}>
            {formatMoney(Math.round(total))} / mes
          </span>
        )}
      </div>

      {recurring.length === 0 ? (
        <div className="card p-4 text-center">
          <span
            className="w-11 h-11 rounded-2xl mx-auto flex items-center justify-center"
            style={{
              background: 'color-mix(in oklab, var(--app-accent) 14%, transparent)',
              color: 'var(--app-accent-soft)',
            }}
          >
            <CalendarSync size={19} />
          </span>
          <p className="text-[13.5px] font-semibold text-ink mt-2.5">Sin pagos fijos todavía</p>
          <p className="text-[11.5px] text-muted mt-1 leading-snug">
            Agrega aquí el alquiler, la luz, el internet… y cada mes nuevo va a nacer con
            ellos puestos. También se crean solos cuando marcas un pago como recurrente.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recurring.map((t, i) => {
            const tocaEsteMes = templateHits(t, nowId)
            return (
              <div
                key={t.id}
                className="tile p-3 flex items-center gap-2.5 anim-rise"
                style={{
                  animationDelay: `${i * 40}ms`,
                  background: `linear-gradient(155deg, color-mix(in oklab, ${KIND_COLOR[t.kind]} ${t.active ? 8 : 3}%, var(--c-card)) 0%, var(--c-card) 60%)`,
                  opacity: t.active ? 1 : 0.6,
                }}
              >
                <span
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(145deg, color-mix(in oklab, ${KIND_COLOR[t.kind]} 24%, transparent), color-mix(in oklab, ${KIND_COLOR[t.kind]} 8%, transparent))`,
                    color: KIND_COLOR[t.kind],
                    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${KIND_COLOR[t.kind]} 28%, transparent)`,
                  }}
                >
                  <ItemIcon icon={t.icon} name={t.name} kind={t.kind} size={17} />
                </span>

                <button
                  onClick={() => setSheet({ open: true, editing: t })}
                  className="pressable flex-1 min-w-0 text-left"
                >
                  <span className="block text-[13.5px] font-semibold text-ink truncate">{t.name}</span>
                  <span className="block text-[10.5px] text-muted truncate">
                    {RECURRENCE_EVERY_LABEL[t.recurrence] ?? RECURRENCE_LABEL[t.recurrence]}
                    {t.dueDay ? ` · día ${t.dueDay}` : ''}
                    {!t.active ? ' · en pausa' : tocaEsteMes ? '' : ' · no toca este mes'}
                  </span>
                </button>

                <span className="display-money text-[13.5px] font-bold text-ink shrink-0">
                  {formatMoney(t.amount)}
                </span>

                <button
                  onClick={() => toggleTemplate(t.id)}
                  aria-label={t.active ? `Pausar ${t.name}` : `Activar ${t.name}`}
                  className="pressable w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-edge"
                  style={{
                    color: t.active ? 'var(--c-muted)' : 'var(--c-income)',
                    background: 'var(--c-elevated)',
                  }}
                >
                  {t.active ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button
                  onClick={() => setPorBorrar(t)}
                  aria-label={`Eliminar ${t.name}`}
                  className="pressable w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ color: 'var(--c-danger)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSheet({ open: true, editing: null })}
          className="pressable rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 py-2.5 text-[12.5px] font-semibold"
          style={{
            borderColor: 'color-mix(in oklab, var(--app-accent) 50%, var(--c-border))',
            color: 'var(--app-accent-soft)',
          }}
        >
          <Plus size={15} /> Nuevo pago fijo
        </button>
        <button
          onClick={() => { applyTemplatesEverywhere(); setAplicado(true) }}
          disabled={!activos.length}
          className="pressable card px-3 py-2.5 text-[12.5px] font-semibold text-ink disabled:opacity-40"
        >
          {aplicado ? 'Listo ✓' : 'Ponerlos en mis meses'}
        </button>
      </div>
      <p className="text-[11px] text-muted leading-snug">
        Cada mes nuevo nace con estos pagos. «Ponerlos en mis meses» los agrega también a
        los meses que ya tenés creados de este mes en adelante (nunca duplica ni toca el pasado).
      </p>

      <TemplateSheet
        open={sheet.open}
        editing={sheet.editing}
        onClose={() => setSheet({ open: false, editing: null })}
      />

      <ConfirmDialog
        open={Boolean(porBorrar)}
        title={`¿Eliminar el pago fijo "${porBorrar?.name}"?`}
        message="Deja de aparecer en los meses nuevos y se quita de los meses que aún no empiezan. Lo que ya pagaste no se toca."
        confirmLabel="Eliminar"
        danger
        onCancel={() => setPorBorrar(null)}
        onConfirm={() => {
          if (porBorrar) deleteTemplate(porBorrar.id, true)
          setPorBorrar(null)
        }}
      />
    </div>
  )
}

/* ─── Alta y edición de un pago fijo ────────────────────────────────────── */

function TemplateSheet({ open, editing, onClose }: {
  open: boolean
  editing: RecurringTemplate | null
  onClose: () => void
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar pago fijo' : 'Nuevo pago fijo'}
      subtitle="Aparecerá solo en cada mes que le toque"
    >
      {open && <TemplateForm key={editing?.id ?? 'nuevo'} editing={editing} onDone={onClose} />}
    </BottomSheet>
  )
}

function TemplateForm({ editing, onDone }: { editing: RecurringTemplate | null; onDone: () => void }) {
  const addTemplate = useFinanceStore((s) => s.addTemplate)
  const updateTemplate = useFinanceStore((s) => s.updateTemplate)
  const applyTemplatesEverywhere = useFinanceStore((s) => s.applyTemplatesEverywhere)

  const [name, setName] = useState(editing?.name ?? '')
  const [amount, setAmount] = useState(editing?.amount ?? 0)
  const [kind, setKind] = useState<ExpenseKind>(editing?.kind ?? 'servicio')
  const [icon, setIcon] = useState(editing?.icon ?? '')
  const [dueDay, setDueDay] = useState<number | ''>(editing?.dueDay ?? '')
  const [recurrence, setRecurrence] = useState<Recurrence>(editing?.recurrence ?? 'monthly')
  const [anchorMonthId, setAnchor] = useState(editing?.anchorMonthId ?? currentMonthId())

  const puedeGuardar = name.trim().length > 0 && amount > 0

  const guardar = () => {
    if (!puedeGuardar) return
    const datos = {
      name: name.trim(),
      amount,
      kind,
      icon: icon || undefined,
      dueDay: dueDay === '' ? undefined : Math.max(1, Math.min(31, Number(dueDay))),
      recurrence,
      anchorMonthId,
      active: editing?.active ?? true,
    }
    if (editing) updateTemplate(editing.id, datos)
    else addTemplate(datos)
    applyTemplatesEverywhere()
    onDone()
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div>
        <label className="text-[12px] font-semibold text-muted">¿Qué pagas todos los meses?</label>
        <input
          className="input-base mt-1.5"
          placeholder="Alquiler, luz, internet…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="text-[12px] font-semibold text-muted">¿De cuánto?</label>
        <CurrencyInput value={amount} onChange={setAmount} className="mt-1.5" />
      </div>

      <div>
        <label className="text-[12px] font-semibold text-muted">Tipo</label>
        <div className="flex rounded-2xl bg-elevated border border-edge p-1 gap-1 mt-1.5">
          {(['servicio', 'gasto', 'personal'] as ExpenseKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`pressable flex-1 min-h-10 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1.5 ${
                kind === k ? 'bg-card text-ink border border-edge' : 'text-muted'
              }`}
            >
              {KIND_ICON[k]} {k === 'servicio' ? 'Servicio' : k === 'gasto' ? 'Gasto' : 'Personal'}
            </button>
          ))}
        </div>
      </div>

      <IconPicker value={icon} onChange={setIcon} name={name} kind={kind} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[12px] font-semibold text-muted">Día de pago</label>
          <input
            type="number"
            min={1}
            max={31}
            placeholder="—"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value === '' ? '' : Math.min(31, Math.max(1, Number(e.target.value))))}
            className="input-base mt-1.5 num text-center"
          />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-muted">Cada cuánto</label>
          <select
            className="input-base mt-1.5 text-[13px]"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
          >
            {RECOMMENDED_RECURRENCES.map((r) => (
              <option key={r} value={r}>{RECURRENCE_EVERY_LABEL[r] ?? RECURRENCE_LABEL[r]}</option>
            ))}
          </select>
        </div>
      </div>

      <MonthField
        value={anchorMonthId}
        onChange={setAnchor}
        label="Desde qué mes"
        title="¿Desde cuándo lo pagas?"
      />

      <p className="text-[11px] text-muted leading-snug">
        Se va a crear solo en {monthLabel(anchorMonthId)} y en los meses siguientes que le
        toquen. Si ya existe un pago con ese nombre en el mes, no se duplica.
      </p>

      <button
        onClick={guardar}
        disabled={!puedeGuardar}
        className="pressable btn-primary w-full disabled:opacity-50"
      >
        {editing ? 'Guardar cambios' : 'Crear pago fijo'}
      </button>
    </div>
  )
}
