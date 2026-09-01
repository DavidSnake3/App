// Copiar los pagos de otro mes al mes actual, eligiendo cuáles.
import { useMemo, useState } from 'react'
import { Check, CopyCheck, Repeat2 } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { addMonthsToId, monthLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { MonthField } from '../ui/DatePicker'

export function CopyMonthSheet({ open, onClose, targetMonthId }: {
  open: boolean
  onClose: () => void
  targetMonthId: string
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Copiar pagos a ${monthLabel(targetMonthId)}`}
      subtitle="Elige de qué mes y cuáles quieres traer"
    >
      {open && <CopyForm key={targetMonthId} targetMonthId={targetMonthId} onDone={onClose} />}
    </BottomSheet>
  )
}

function CopyForm({ targetMonthId, onDone }: { targetMonthId: string; onDone: () => void }) {
  const months = useFinanceStore((s) => s.months)
  const copyExpensesFrom = useFinanceStore((s) => s.copyExpensesFrom)

  const [fromId, setFromId] = useState(addMonthsToId(targetMonthId, -1))
  const origen = months[fromId]
  const destino = months[targetMonthId]

  // los que ya están en el destino no se pueden volver a traer
  const yaEstan = useMemo(
    () => new Set((destino?.expenses ?? []).map((e) => e.name.trim().toLowerCase())),
    [destino],
  )
  const disponibles = useMemo(
    () => (origen?.expenses ?? []).filter((e) => !yaEstan.has(e.name.trim().toLowerCase())),
    [origen, yaEstan],
  )

  const [sel, setSel] = useState<string[]>([])
  const [inicializado, setInicializado] = useState('')
  // al cambiar de mes origen, se preseleccionan todos los disponibles
  if (inicializado !== fromId) {
    setInicializado(fromId)
    setSel(disponibles.map((e) => e.id))
  }

  const total = disponibles
    .filter((e) => sel.includes(e.id))
    .reduce((s, e) => s + e.amount, 0)

  const alternar = (id: string) =>
    setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <div className="flex flex-col gap-4 pb-2">
      <MonthField
        value={fromId}
        onChange={setFromId}
        label="Copiar desde"
        title="¿De qué mes los traigo?"
      />

      {!origen ? (
        <p className="text-[12.5px] text-muted">
          No hay datos de {monthLabel(fromId)}. Elige otro mes.
        </p>
      ) : disponibles.length === 0 ? (
        <p className="text-[12.5px] text-muted">
          {origen.expenses.length === 0
            ? `${monthLabel(fromId)} no tiene pagos.`
            : `Ya tienes todos los pagos de ${monthLabel(fromId)} en este mes.`}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-muted">
              {sel.length} de {disponibles.length} seleccionados
            </p>
            <button
              onClick={() => setSel(sel.length === disponibles.length ? [] : disponibles.map((e) => e.id))}
              className="pressable text-[11.5px] font-semibold"
              style={{ color: 'var(--app-accent-soft)' }}
            >
              {sel.length === disponibles.length ? 'Quitar todos' : 'Marcar todos'}
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-[46vh] overflow-y-auto overscroll-contain">
            {disponibles.map((e) => {
              const marcado = sel.includes(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => alternar(e.id)}
                  className="pressable tile p-3 flex items-center gap-2.5 text-left"
                  style={{
                    background: marcado
                      ? 'color-mix(in oklab, var(--app-accent) 10%, var(--c-card))'
                      : 'var(--c-card)',
                    borderColor: marcado
                      ? 'color-mix(in oklab, var(--app-accent) 45%, var(--c-border))'
                      : 'var(--c-border)',
                  }}
                >
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
                    style={marcado
                      ? { background: 'var(--app-gradient)', borderColor: 'transparent', color: '#fff' }
                      : { borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}
                  >
                    {marcado ? <Check size={15} /> : <ItemIcon icon={e.icon} name={e.name} kind={e.kind} size={14} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-ink truncate">{e.name}</span>
                    <span className="block text-[10.5px] text-muted">
                      {e.kind === 'servicio' ? 'Servicio' : e.kind === 'personal' ? 'Personal' : 'Gasto'}
                      {e.dueDay ? ` · vence el ${e.dueDay}` : ''}
                      {e.recurrence !== 'once' ? ' · se repite' : ''}
                    </span>
                  </span>
                  <span className="num text-[13px] font-semibold text-ink shrink-0">
                    {formatMoney(e.amount)}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5"
            style={{ background: 'color-mix(in oklab, var(--app-accent) 10%, transparent)' }}
          >
            <Repeat2 size={14} className="shrink-0" style={{ color: 'var(--app-accent-soft)' }} />
            <p className="text-[11.5px] text-ink leading-snug">
              Se copian sin marcar como pagados, por{' '}
              <span className="num font-bold">{formatMoney(total)}</span> en total.
            </p>
          </div>

          <button
            onClick={() => { copyExpensesFrom(targetMonthId, fromId, sel); onDone() }}
            disabled={sel.length === 0}
            className="pressable btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CopyCheck size={16} /> Copiar {sel.length} {sel.length === 1 ? 'pago' : 'pagos'}
          </button>
        </>
      )}
    </div>
  )
}
