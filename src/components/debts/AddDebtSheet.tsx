import { useState } from 'react'
import type { Debt } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { addMonthsToId, currentMonthId, monthLabel, parseMonthId } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { ICON_IDS, ITEM_ICONS } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Segmented } from '../ui/Segmented'
import { Toggle } from '../ui/Toggle'

interface Props {
  open: boolean
  onClose: () => void
  editing?: Debt | null
}

type Mode = 'cuotas' | 'fecha' | 'cuota'

/** Alta de deuda: por nº de cuotas, fecha de finalización o monto de cuota (punto 4) */
export function AddDebtSheet({ open, onClose, editing }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? 'Editar deuda' : 'Nueva deuda'}>
      {open && <DebtForm key={editing?.id ?? 'nueva'} editing={editing} onDone={onClose} />}
    </BottomSheet>
  )
}

function DebtForm({ editing, onDone }: { editing?: Debt | null; onDone: () => void }) {
  const addDebt = useFinanceStore((s) => s.addDebt)
  const updateDebt = useFinanceStore((s) => s.updateDebt)

  const [name, setName] = useState(editing?.name ?? '')
  const [total, setTotal] = useState(editing?.total ?? 0)
  const [mode, setMode] = useState<Mode>('cuotas')
  const [installments, setInstallments] = useState(editing?.installments ?? 12)
  const [monthly, setMonthly] = useState(editing?.monthlyPayment ?? 0)
  const [startMonth, setStartMonth] = useState(editing?.startMonthId ?? currentMonthId())
  const [endMonth, setEndMonth] = useState(
    editing
      ? addMonthsToId(editing.startMonthId, editing.installments - 1)
      : addMonthsToId(currentMonthId(), 11),
  )
  const [dueDay, setDueDay] = useState(editing?.dueDay ?? 15)
  const [icon, setIcon] = useState(editing?.icon ?? '')
  const [account, setAccount] = useState(editing?.account ?? '')
  const [payMethod, setPayMethod] = useState(editing?.payMethod ?? '')
  const [viaPlanilla, setViaPlanilla] = useState(editing?.viaPlanilla ?? false)
  const [error, setError] = useState('')

  // Derivar cuotas/cuota mensual según el modo elegido
  const derive = (): { n: number; pay: number } | null => {
    if (total <= 0) return null
    if (mode === 'cuotas') {
      const n = Math.max(1, Math.round(installments))
      return { n, pay: Math.ceil(total / n) }
    }
    if (mode === 'cuota') {
      if (monthly <= 0) return null
      const n = Math.max(1, Math.ceil(total / monthly))
      return { n, pay: monthly }
    }
    const a = parseMonthId(startMonth)
    const b = parseMonthId(endMonth)
    const n = Math.max(1, (b.year - a.year) * 12 + (b.month - a.month) + 1)
    return { n, pay: Math.ceil(total / n) }
  }

  const preview = derive()

  const save = () => {
    if (!name.trim()) { setError('Ponle un nombre a la deuda.'); return }
    const d = derive()
    if (!d) { setError('Revisa el monto total y las cuotas.'); return }
    const payload = {
      name: name.trim(),
      total,
      monthlyPayment: d.pay,
      installments: d.n,
      startMonthId: startMonth,
      dueDay: Math.max(1, Math.min(31, dueDay)),
      icon: icon || undefined,
      account: account.trim() || undefined,
      payMethod: payMethod.trim() || undefined,
      viaPlanilla,
    }
    if (editing) updateDebt(editing.id, payload)
    else addDebt(payload)
    onDone()
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="debt-name" className="text-[13px] font-medium text-muted block mb-1.5">Nombre</label>
        <input
          id="debt-name" className="input-base" placeholder="Ej. Préstamo carro, tarjeta…"
          value={name} onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="text-[13px] font-medium text-muted block mb-1.5">Monto total de la deuda</label>
        <CurrencyInput value={total} onChange={setTotal} />
      </div>

      <div>
        <span className="text-[13px] font-medium text-muted block mb-1.5">¿Cómo la quieres definir?</span>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'cuotas', label: 'Nº de cuotas' },
            { value: 'fecha', label: 'Fecha final' },
            { value: 'cuota', label: 'Cuota fija' },
          ]}
        />
      </div>

      {mode === 'cuotas' && (
        <div className="anim-fade">
          <label htmlFor="debt-n" className="text-[13px] font-medium text-muted block mb-1.5">¿Cuántas cuotas mensuales?</label>
          <input
            id="debt-n" type="number" min={1} max={480} inputMode="numeric" className="input-base num"
            value={installments} onChange={(e) => setInstallments(Number(e.target.value))}
          />
        </div>
      )}

      {mode === 'cuota' && (
        <div className="anim-fade">
          <label className="text-[13px] font-medium text-muted block mb-1.5">¿Cuánto puedes pagar por mes?</label>
          <CurrencyInput value={monthly} onChange={setMonthly} />
        </div>
      )}

      {mode === 'fecha' && (
        <div className="anim-fade">
          <label htmlFor="debt-end" className="text-[13px] font-medium text-muted block mb-1.5">Fecha de finalización</label>
          <input
            id="debt-end" type="month" className="input-base"
            value={endMonth} min={startMonth}
            onChange={(e) => setEndMonth(e.target.value || endMonth)}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="debt-start" className="text-[13px] font-medium text-muted block mb-1.5">Primera cuota</label>
          <input
            id="debt-start" type="month" className="input-base"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value || startMonth)}
          />
        </div>
        <div>
          <label htmlFor="debt-day" className="text-[13px] font-medium text-muted block mb-1.5">Día de pago</label>
          <input
            id="debt-day" type="number" min={1} max={31} inputMode="numeric" className="input-base num"
            value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))}
          />
        </div>
      </div>

      {preview && (
        <div className="card bg-elevated/60 p-3.5 anim-fade">
          <p className="text-[13px] text-muted">
            Pagarás <span className="num font-bold text-ink">{formatMoney(preview.pay)}</span> al mes
            durante <span className="num font-bold text-ink">{preview.n}</span> cuota{preview.n === 1 ? '' : 's'} ·
            termina en <span className="font-semibold text-ink">{monthLabel(addMonthsToId(startMonth, preview.n - 1))}</span>
          </p>
        </div>
      )}

      {/* Ícono (mejora 10) */}
      <div>
        <span className="text-[13px] font-medium text-muted block mb-1.5">Ícono</span>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {ICON_IDS.map((id) => {
            const { Icon, label } = ITEM_ICONS[id]
            const active = icon === id
            return (
              <button
                key={id}
                onClick={() => setIcon(active ? '' : id)}
                aria-label={label}
                title={label}
                className="pressable w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                style={{
                  borderColor: active ? 'var(--app-accent)' : 'var(--c-border)',
                  background: active ? 'color-mix(in oklab, var(--app-accent) 18%, transparent)' : 'var(--c-elevated)',
                  color: active ? 'var(--app-accent-soft)' : 'var(--c-muted)',
                }}
              >
                <Icon size={17} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Datos del estado de cuenta (mejora 7) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="debt-acc" className="text-[13px] font-medium text-muted block mb-1.5">Cuenta / referencia <span className="opacity-60">(opcional)</span></label>
          <input id="debt-acc" className="input-base" placeholder="Ej. 90301-0" value={account} onChange={(e) => setAccount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="debt-met" className="text-[13px] font-medium text-muted block mb-1.5">Método de pago <span className="opacity-60">(opcional)</span></label>
          <input id="debt-met" className="input-base" placeholder="Ej. SINPE, ventanilla" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} />
        </div>
      </div>

      {/* Se deduce de planilla (mejoras 2 y 8) */}
      <div className="card p-3.5 bg-elevated/60 flex items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium text-ink">Se deduce de mi planilla</p>
          <p className="text-[12px] text-muted mt-0.5">
            La cuota sale de tu salario (no aparece en los pagos del mes). Agrégala también como deducción en Ajustes → Ingresos.
          </p>
        </div>
        <Toggle checked={viaPlanilla} onChange={setViaPlanilla} label="Por planilla" />
      </div>

      {error && <p className="text-[13px] anim-shake" style={{ color: 'var(--c-danger)' }}>{error}</p>}

      <button onClick={save} className="pressable btn-primary w-full">
        {editing ? 'Guardar cambios' : 'Agregar deuda'}
      </button>
    </div>
  )
}
