// Tarjeta del Mes: Gastos hormiga
// (el saldo real vive en la tarjeta de Balance; se configura en Ajustes)
import { useState } from 'react'
import { Coffee, Plus, X } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { hormigasTotal } from '../../lib/fund'
import { formatMoney } from '../../lib/format'
import { CurrencyInput } from '../ui/CurrencyInput'

/* ─── Gastos hormiga: anota al instante lo pequeño ─────────────────────────── */

export function HormigasCard() {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const addHormiga = useFinanceStore((s) => s.addHormiga)
  const deleteHormiga = useFinanceStore((s) => s.deleteHormiga)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [open, setOpen] = useState(false)

  // fecha de corte de la semana: estable durante el render (regla de pureza)
  const [weekAgo] = useState(() => new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))

  if (!month) return null
  const hormigas = month.hormigas ?? []
  const totalMes = hormigasTotal(month)
  const totalSemana = hormigas.filter((h) => h.dateISO >= weekAgo).reduce((s, h) => s + h.amount, 0)

  const add = () => {
    if (amount <= 0) return
    addHormiga(monthId, { name: name.trim() || 'Hormiga', amount })
    setName('')
    setAmount(0)
  }

  return (
    <div className="card p-4">
      <button onClick={() => setOpen(!open)} className="pressable w-full flex items-center gap-2 text-left">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--c-warning) 16%, transparent)' }}>
          <Coffee size={15} style={{ color: 'var(--c-warning)' }} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-semibold text-ink">Gastos hormiga</span>
          <span className="block text-[11.5px] text-muted">
            Este mes <span className="num font-semibold" style={{ color: totalMes > 0 ? 'var(--c-warning)' : 'var(--c-muted)' }}>{formatMoney(Math.round(totalMes))}</span>
            {' · '}esta semana <span className="num font-semibold text-ink">{formatMoney(Math.round(totalSemana))}</span>
          </span>
        </span>
        <Plus size={16} className={`text-muted shrink-0 transition-transform ${open ? 'rotate-45' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 anim-fade flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              className="input-base flex-1"
              placeholder="Café, uber, snack…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <CurrencyInput value={amount} onChange={setAmount} className="w-30" />
            <button
              onClick={add}
              aria-label="Anotar gasto hormiga"
              className="pressable w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-white"
              style={{ background: 'var(--c-warning)' }}
            >
              <Plus size={18} />
            </button>
          </div>
          {hormigas.length > 0 && (
            <div className="flex flex-col divide-y divide-[var(--c-border)]">
              {hormigas.slice(-6).reverse().map((h) => (
                <div key={h.id} className="flex items-center gap-2 py-1.5">
                  <span className="text-[12.5px] text-ink flex-1 truncate">{h.name}</span>
                  <span className="text-[10.5px] text-muted num">{h.dateISO.slice(8, 10)}/{h.dateISO.slice(5, 7)}</span>
                  <span className="num text-[12.5px] font-semibold" style={{ color: 'var(--c-warning)' }}>−{formatMoney(h.amount)}</span>
                  <button onClick={() => deleteHormiga(monthId, h.id)} aria-label={`Quitar ${h.name}`} className="pressable w-6 h-6 rounded-full flex items-center justify-center text-muted">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
