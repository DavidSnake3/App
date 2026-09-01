import { useState } from 'react'
import { AlarmClock, Heart, Receipt, ShieldCheck } from 'lucide-react'
import type { Expense, ExpenseKind, Recurrence } from '../../types/finance'
import { RECOMMENDED_RECURRENCES, RECURRENCE_LABEL } from '../../lib/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { activeAccounts, isCredit } from '../../lib/accounts'
import { ItemIcon } from '../../lib/icons'
import { IconPicker } from '../ui/IconPicker'
import { ColorPicker } from '../ui/ColorPicker'
import { CategoryPicker } from '../ui/CategoryPicker'
import { guessCategory } from '../../lib/categories'
import { KIND_COLORS } from '../../lib/itemColors'
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
  const [color, setColor] = useState(editing?.color ?? '')
  // categoría: se adivina por el nombre hasta que el usuario elija una
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '')
  const [catManual, setCatManual] = useState(Boolean(editing?.categoryId))
  // al editar un pago fijo: aplicar el cambio solo aquí o también más adelante
  const [aplicarATodos, setAplicarATodos] = useState(true)
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
  const accounts = useFinanceStore((s) => s.accounts)
  const cuentas = activeAccounts(accounts)
  const [accountId, setAccountId] = useState(editing?.accountId ?? '')
  const cuentaElegida = cuentas.find((a) => a.id === accountId)

  const save = () => {
    if (!name.trim()) { setError('Ponle un nombre al pago.'); return }
    if (amount <= 0 && !editing?.children.length) { setError('El monto debe ser mayor a 0.'); return }
    const day = dueDay === '' ? undefined : Math.max(1, Math.min(31, Number(dueDay)))
    const payload = {
      name: name.trim(),
      amount,
      kind,
      icon: icon || undefined,
      color: color || undefined,
      categoryId: categoryId || guessCategory(name.trim(), 'gasto'),
      recurrence: (isRecurring ? recurrence : 'once') as Recurrence,
      dueDay: day,
      period: (day && day <= 15 ? 'q1' : 'q2') as Expense['period'],
      accountId: accountId || undefined,
      reminder: reminderOn
        ? { enabled: true, daysBefore: remDays, time: remTime, alarm: remAlarm }
        : undefined,
    }
    if (editing) updateExpense(monthId, editing.id, payload, aplicarATodos ? 'siempre' : 'mes')
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
          onChange={(e) => {
            setName(e.target.value)
            if (!catManual) setCategoryId(guessCategory(e.target.value, 'gasto'))
          }}
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

      {/* Categoría: es la que suma en los reportes por categoría */}
      <CategoryPicker
        value={categoryId || guessCategory(name, 'gasto')}
        onChange={(id) => { setCategoryId(id); setCatManual(true) }}
        kind="gasto"
        hint="Con esta categoría aparece en los reportes al marcarlo pagado."
      />

      {/* Con qué cuenta se paga: si es tarjeta, se vuelve deuda de la tarjeta */}
      {cuentas.length > 0 && (
        <div>
          <span className="text-[13px] font-medium text-muted block mb-1.5">¿Con qué cuenta lo pagas?</span>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setAccountId('')}
              className={`chip shrink-0 ${accountId === '' ? 'chip-active' : ''}`}
            >
              La principal
            </button>
            {cuentas.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                className={`chip shrink-0 ${accountId === a.id ? 'chip-active' : ''}`}
              >
                <ItemIcon icon={a.icon} name={a.name} size={12} /> {a.name}
              </button>
            ))}
          </div>
          {cuentaElegida && isCredit(cuentaElegida) && (
            <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: 'var(--c-warning)' }}>
              Al marcarlo pagado se suma a la deuda de {cuentaElegida.name}, no baja tu efectivo.
            </p>
          )}
        </div>
      )}

      {/* Ícono a elegir (mejoras 6 y 10) */}
      <div>
        <span className="text-[13px] font-medium text-muted block mb-1.5">Ícono</span>
        <IconPicker value={icon} onChange={setIcon} name={name} kind={kind} />

        <ColorPicker
          value={color}
          onChange={setColor}
          label="Color del pago"
          fallback={KIND_COLORS[kind]}
          hint="Para reconocerlo de un vistazo en la lista del mes."
        />
      </div>

      {/* Recurrente vs único (punto 8) */}
      <div className="card p-3.5 bg-elevated/60">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-ink">¿Es recurrente?</p>
            <p className="text-[12px] text-muted mt-0.5">
              {isRecurring
                ? 'Sale en todos los meses de aquí en adelante, sin que lo pongas'
                : 'Pago único, solo este mes'}
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

        {/* Al editar un pago fijo: hasta donde llega el cambio */}
        {editing?.templateId && (
          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-edge/60">
            <div>
              <p className="text-[13px] font-medium text-ink">Aplicar a los meses siguientes</p>
              <p className="text-[11.5px] text-muted mt-0.5">
                {aplicarATodos
                  ? 'El cambio se copia a los meses que vienen'
                  : 'El cambio queda solo en este mes'}
              </p>
            </div>
            <Toggle checked={aplicarATodos} onChange={setAplicarATodos} label="Meses siguientes" />
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
