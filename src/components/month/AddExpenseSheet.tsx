import { useState } from 'react'
import { AlarmClock, Heart, Receipt, ShieldCheck } from 'lucide-react'
import type { Expense, ExpenseKind, Recurrence } from '../../types/finance'
import { RECOMMENDED_RECURRENCES, RECURRENCE_LABEL } from '../../lib/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { IconPicker } from '../ui/IconPicker'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Segmented } from '../ui/Segmented'
import { Toggle } from '../ui/Toggle'

interface Props {
  open: boolean
  onClose: () => void
  monthId: string
  editing?: Expense | null
  defaultKind?: ExpenseKind
}

/** Alta/edición de gastos y servicios (puntos 7, 8, 9) */
export function AddExpenseSheet({ open, onClose, monthId, editing, defaultKind = 'gasto' }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar pago' : defaultKind === 'servicio' ? 'Nuevo servicio obligatorio' : 'Nuevo gasto'}
    >
      {open && (
        <ExpenseForm
          key={editing?.id ?? `nuevo-${defaultKind}`}
          monthId={monthId}
          editing={editing}
          defaultKind={defaultKind}
          onDone={onClose}
        />
      )}
    </BottomSheet>
  )
}

function ExpenseForm({ monthId, editing, defaultKind, onDone }: {
  monthId: string
  editing?: Expense | null
  defaultKind: ExpenseKind
  onDone: () => void
}) {
  const addExpense = useFinanceStore((s) => s.addExpense)
  const updateExpense = useFinanceStore((s) => s.updateExpense)
  const globalNotif = useFinanceStore((s) => s.settings.notifications)

  const [name, setName] = useState(editing?.name ?? '')
  const [amount, setAmount] = useState(editing?.amount ?? 0)
  const [kind, setKind] = useState<ExpenseKind>(editing?.kind ?? defaultKind)
  const [icon, setIcon] = useState(editing?.icon ?? '')
  const [isRecurring, setIsRecurring] = useState(
    editing ? editing.recurrence !== 'once' : defaultKind === 'servicio',
  )
  const [recurrence, setRecurrence] = useState<Recurrence>(
    editing && editing.recurrence !== 'once' ? editing.recurrence : 'monthly',
  )
  const [dueDay, setDueDay] = useState<number | ''>(editing?.dueDay ?? '')
  const [reminderOn, setReminderOn] = useState(editing?.reminder?.enabled ?? false)
  const [remDays, setRemDays] = useState<number[]>(editing?.reminder?.daysBefore ?? globalNotif.daysBefore)
  const [remTime, setRemTime] = useState(editing?.reminder?.time ?? globalNotif.time)
  const [remAlarm, setRemAlarm] = useState(editing?.reminder?.alarm ?? false)
  const [error, setError] = useState('')

  const save = () => {
    if (!name.trim()) { setError('Ponle un nombre al pago.'); return }
    if (amount <= 0 && !editing?.children.length) { setError('El monto debe ser mayor a 0.'); return }
    const day = dueDay === '' ? undefined : Math.max(1, Math.min(31, Number(dueDay)))
    const payload = {
      name: name.trim(),
      amount,
      kind,
      icon: icon || undefined,
      recurrence: (isRecurring ? recurrence : 'once') as Recurrence,
      dueDay: day,
      period: (day && day <= 15 ? 'q1' : 'q2') as Expense['period'],
      reminder: reminderOn
        ? { enabled: true, daysBefore: remDays, time: remTime, alarm: remAlarm }
        : undefined,
    }
    if (editing) updateExpense(monthId, editing.id, payload)
    else addExpense(monthId, { ...payload, paid: false, children: [] })
    onDone()
  }

  const toggleRemDay = (d: number) =>
    setRemDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => b - a))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="exp-name" className="text-[13px] font-medium text-muted block mb-1.5">Nombre</label>
        <input
          id="exp-name"
          className="input-base"
          placeholder="Ej. Supermercado, Internet…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="text-[13px] font-medium text-muted block mb-1.5">Monto</label>
        <CurrencyInput value={amount} onChange={setAmount} />
      </div>

      <div>
        <span className="text-[13px] font-medium text-muted block mb-1.5">Tipo</span>
        <Segmented
          value={kind}
          onChange={(v) => setKind(v)}
          options={[
            { value: 'gasto', label: <><Receipt size={14} /> Gasto</> },
            { value: 'servicio', label: <><ShieldCheck size={14} /> Servicio</> },
            { value: 'personal', label: <><Heart size={14} /> Personal</> },
          ]}
        />
      </div>

      {/* Ícono a elegir (mejoras 6 y 10) */}
      <div>
        <span className="text-[13px] font-medium text-muted block mb-1.5">Ícono</span>
        <IconPicker value={icon} onChange={setIcon} name={name} kind={kind} />
      </div>

      {/* Recurrente vs único (punto 8) */}
      <div className="card p-3.5 bg-elevated/60">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-ink">¿Es recurrente?</p>
            <p className="text-[12px] text-muted mt-0.5">
              {isRecurring ? 'Se copiará automáticamente a los meses siguientes' : 'Pago único al contado, solo este mes'}
            </p>
          </div>
          <Toggle checked={isRecurring} onChange={setIsRecurring} label="Recurrente" />
        </div>
        {isRecurring && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {[...RECOMMENDED_RECURRENCES, 'bimonthly' as Recurrence, 'semiannual' as Recurrence].map((r) => (
              <button
                key={r}
                onClick={() => setRecurrence(r)}
                className={`pressable chip ${recurrence === r ? 'chip-active' : ''}`}
              >
                {RECURRENCE_LABEL[r]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="exp-day" className="text-[13px] font-medium text-muted block mb-1.5">
          Fecha límite de pago — día del mes <span className="opacity-60">(recomendado si es mensual)</span>
        </label>
        <input
          id="exp-day"
          type="number"
          min={1}
          max={31}
          inputMode="numeric"
          className="input-base num"
          placeholder="Ej. 15"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </div>

      {/* Recordatorio personalizado (puntos 9 y 12) */}
      <div className="card p-3.5 bg-elevated/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlarmClock size={17} className="text-accent-soft" />
            <p className="text-[14px] font-medium text-ink">Recordatorio propio</p>
          </div>
          <Toggle checked={reminderOn} onChange={setReminderOn} label="Recordatorio" />
        </div>
        {reminderOn && (
          <div className="mt-3 flex flex-col gap-3 anim-fade">
            <div>
              <span className="text-[12px] text-muted block mb-1.5">Avisarme antes:</span>
              <div className="flex flex-wrap gap-1.5">
                {[7, 3, 1, 0].map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleRemDay(d)}
                    className={`pressable chip ${remDays.includes(d) ? 'chip-active' : ''}`}
                  >
                    {d === 0 ? 'El mismo día' : `${d} día${d === 1 ? '' : 's'} antes`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="exp-time" className="text-[12px] text-muted">Hora:</label>
              <input
                id="exp-time"
                type="time"
                className="input-base !w-auto"
                value={remTime}
                onChange={(e) => setRemTime(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-ink">Sonar como alarma de teléfono</p>
              <Toggle checked={remAlarm} onChange={setRemAlarm} label="Alarma" />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-[13px] anim-shake" style={{ color: 'var(--c-danger)' }}>{error}</p>}

      <button onClick={save} className="pressable btn-primary w-full">
        {editing ? 'Guardar cambios' : 'Agregar'}
      </button>
    </div>
  )
}
