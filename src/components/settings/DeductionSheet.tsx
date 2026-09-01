// Alta y edición de una deducción del comprobante: monto fijo o porcentaje,
// y si es un adelanto de salario, con qué día te lo depositan.
import { useState } from 'react'
import { CalendarClock, Info, Percent, Wallet } from 'lucide-react'
import type { PayPeriod, PayrollDeduction } from '../../types/finance'
import { deductionValue } from '../../lib/payroll'
import { formatMoney } from '../../lib/format'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'

interface Props {
  open: boolean
  onClose: () => void
  /** deducción que se edita (null = nueva) */
  editing?: PayrollDeduction | null
  /** período del comprobante: el adelanto solo aplica al mensual */
  inputPeriod: PayPeriod
  /** bruto del período, para la vista previa */
  gross: number
  onSave: (d: Omit<PayrollDeduction, 'id'>) => void
}

export function DeductionSheet({ open, onClose, editing, inputPeriod, gross, onSave }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar deducción' : 'Nueva deducción'}
      subtitle="Puede ser un monto fijo o un porcentaje de tu salario"
    >
      {open && (
        <DeductionForm
          key={editing?.id ?? 'nueva'}
          editing={editing}
          inputPeriod={inputPeriod}
          gross={gross}
          onSave={(d) => { onSave(d); onClose() }}
        />
      )}
    </BottomSheet>
  )
}

function DeductionForm({ editing, inputPeriod, gross, onSave }: Omit<Props, 'open' | 'onClose'>) {
  const [name, setName] = useState(editing?.name ?? '')
  const [mode, setMode] = useState<'fixed' | 'percent'>(editing?.mode ?? 'fixed')
  const [amount, setAmount] = useState(editing?.amount ?? 0)
  const [pct, setPct] = useState(editing?.pct ?? 0)
  const [base, setBase] = useState<'gross' | 'net'>(editing?.base ?? 'gross')
  const [isAdvance, setIsAdvance] = useState(Boolean(editing?.isAdvance))
  const [advanceDay, setAdvanceDay] = useState(editing?.advanceDay ?? 15)
  const [advanceAdjust, setAdvanceAdjust] = useState<'before' | 'after' | 'none'>(
    editing?.advanceAdjust ?? 'before',
  )

  const puedeAdelanto = inputPeriod === 'monthly'
  const datos: Omit<PayrollDeduction, 'id'> = {
    name: name.trim(),
    amount: mode === 'fixed' ? amount : 0,
    mode,
    pct: mode === 'percent' ? pct : undefined,
    base: mode === 'percent' ? base : undefined,
    isAdvance: puedeAdelanto && isAdvance,
    advanceDay: puedeAdelanto && isAdvance ? advanceDay : undefined,
    advanceAdjust: puedeAdelanto && isAdvance ? advanceAdjust : undefined,
  }
  const preview = deductionValue({ ...datos, id: 'preview' }, gross, gross)
  const puedeGuardar = name.trim().length > 0 && (mode === 'fixed' ? amount > 0 : pct > 0)

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div>
        <label className="text-[12px] font-semibold text-muted">¿Qué te descuentan?</label>
        <input
          className="input-base mt-1.5"
          placeholder="Ej. Adelanto de quincena, préstamo del banco…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      {/* Monto fijo o porcentaje */}
      <div className="flex rounded-2xl bg-elevated border border-edge p-1 gap-1">
        {([
          { id: 'fixed' as const, label: 'Monto fijo', icon: <Wallet size={13} /> },
          { id: 'percent' as const, label: 'Porcentaje', icon: <Percent size={13} /> },
        ]).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`pressable flex-1 min-h-10 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1.5 ${
              mode === m.id ? 'bg-card text-ink border border-edge' : 'text-muted'
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {mode === 'fixed' ? (
        <div>
          <label className="text-[12px] font-semibold text-muted">¿De cuánto?</label>
          <CurrencyInput value={amount} onChange={setAmount} className="mt-1.5" />
        </div>
      ) : (
        <>
          <div>
            <label className="text-[12px] font-semibold text-muted">¿Qué porcentaje?</label>
            <div className="relative mt-1.5">
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={pct || ''}
                onChange={(e) => setPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                placeholder="45.11"
                className="input-base num text-right pr-9 text-[17px]"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted text-[15px]">%</span>
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-muted">¿Sobre qué se calcula?</label>
            <div className="flex rounded-2xl bg-elevated border border-edge p-1 gap-1 mt-1.5">
              {([
                { id: 'gross' as const, label: 'Salario bruto' },
                { id: 'net' as const, label: 'Salario neto' },
              ]).map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBase(b.id)}
                  className={`pressable flex-1 min-h-9 rounded-xl text-[12px] font-semibold ${
                    base === b.id ? 'bg-card text-ink border border-edge' : 'text-muted'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          {pct > 0 && gross > 0 && (
            <div
              className="rounded-xl px-3.5 py-2.5 flex items-start gap-2.5"
              style={{ background: 'color-mix(in oklab, var(--app-accent) 10%, transparent)' }}
            >
              <Info size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--app-accent-soft)' }} />
              <p className="text-[11.5px] text-ink leading-snug">
                {pct}% de {formatMoney(gross)} ={' '}
                <span className="num font-bold">{formatMoney(Math.round(preview))}</span>
                {isAdvance ? ' que te adelantan' : ' que te descuentan'}.
              </p>
            </div>
          )}
        </>
      )}

      {/* ¿Es un adelanto de salario? */}
      {puedeAdelanto && (
        <div className="rounded-2xl border border-edge bg-elevated p-3">
          <button
            onClick={() => setIsAdvance((v) => !v)}
            className="pressable w-full flex items-center justify-between text-left"
          >
            <span className="flex-1 min-w-0 pr-2">
              <span className="block text-[12.5px] font-semibold text-ink">
                Es un adelanto de mi salario
              </span>
              <span className="block text-[10.5px] text-muted leading-snug mt-0.5">
                No es plata perdida: es parte de tu pago que te dan antes
              </span>
            </span>
            <span
              className="w-10 h-6 rounded-full relative transition-colors shrink-0"
              style={{ background: isAdvance ? 'var(--app-accent)' : 'var(--c-border)' }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: isAdvance ? 'translateX(16px)' : 'translateX(0)' }}
              />
            </span>
          </button>

          {isAdvance && (
            <div className="mt-3 flex flex-col gap-3 anim-fade">
              <div>
                <label className="text-[12px] font-semibold text-muted flex items-center gap-1.5">
                  <CalendarClock size={12} /> ¿Qué día te lo depositan?
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={advanceDay}
                  onChange={(e) => setAdvanceDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  className="input-base mt-1.5 num text-center"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-muted">
                  Si ese día cae fin de semana…
                </label>
                <div className="flex rounded-2xl bg-card border border-edge p-1 gap-1 mt-1.5">
                  {([
                    { id: 'before' as const, label: 'Pagan antes' },
                    { id: 'after' as const, label: 'Pagan después' },
                    { id: 'none' as const, label: 'Día exacto' },
                  ]).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setAdvanceAdjust(o.id)}
                      className={`pressable flex-1 min-h-9 rounded-xl text-[11.5px] font-semibold ${
                        advanceAdjust === o.id ? 'bg-elevated text-ink border border-edge' : 'text-muted'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted leading-snug">
                Con esto la app sabe que el día {advanceDay} ya tienes esa plata, y el resto
                te llega el día de pago.
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => onSave(datos)}
        disabled={!puedeGuardar}
        className="pressable btn-primary w-full disabled:opacity-50"
      >
        {editing ? 'Guardar cambios' : 'Agregar deducción'}
      </button>
    </div>
  )
}
