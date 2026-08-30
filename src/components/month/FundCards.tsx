// Tarjetas del Mes: Gastos hormiga y Modo quincena/semanal
// (el saldo real vive en la tarjeta de Balance; se configura en Ajustes)
import { useMemo, useState } from 'react'
import { Coffee, Plus, X } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { hormigasTotal, quincenaSplit } from '../../lib/fund'
import { buildPayables } from '../../lib/finance'
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

/* ─── Modo quincena / semanal: cómo se reparte tu mes ──────────────────────────
   Se adapta al plan de pago configurado en Ajustes → Ingresos: quincenal o
   mensual muestra las 2 quincenas; semanal muestra las semanas del mes. */

interface Tramo { label: string; in: number; out: number }

export function QuincenaCard() {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const debts = useFinanceStore((s) => s.debts)
  const settings = useFinanceStore((s) => s.settings)

  const data = useMemo((): { title: string; tramos: Tramo[] } | null => {
    if (!month) return null
    const salary = month.income.salary
    if (salary <= 0) return null
    const items = buildPayables(month, debts)
    const sch = settings.paySchedule

    if (sch.frequency === 'weekly') {
      // Semana 1: días 1-7 · S2: 8-14 · S3: 15-21 · S4: 22-fin
      const { year, month: mm } = { year: month.year, month: month.month }
      const last = new Date(year, mm, 0).getDate()
      const ranges: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, last]]
      const targetJs = (sch.weekday + 1) % 7
      const perWeek = (salary * 12) / 52
      const tramos = ranges.map(([a, b], i): Tramo => {
        let pagos = 0
        for (let d = a; d <= b; d++) {
          if (new Date(year, mm - 1, d).getDay() === targetJs) pagos++
        }
        const out = items
          .filter((it) => {
            const eff = it.dueDay ?? (it.period === 'q1' ? 8 : 22)
            return eff >= a && eff <= b
          })
          .reduce((s, it) => s + it.amount, 0)
        return { label: `Semana ${i + 1} (${a}–${b})`, in: pagos * perWeek, out }
      })
      return { title: 'Tu mes por semanas', tramos }
    }

    const llega = quincenaSplit(salary, settings)
    const vence = {
      q1: items.filter((i) => i.period === 'q1').reduce((s, i) => s + i.amount, 0),
      q2: items.filter((i) => i.period === 'q2').reduce((s, i) => s + i.amount, 0),
    }
    return {
      title: 'Tu mes por quincenas',
      tramos: [
        { label: '1ª quincena', in: llega.q1, out: vence.q1 },
        { label: '2ª quincena', in: llega.q2, out: vence.q2 },
      ],
    }
  }, [month, debts, settings])

  if (!data) return null

  return (
    <div className="card p-4">
      <p className="text-[11.5px] font-semibold text-muted mb-2.5">{data.title}</p>
      <div className="grid grid-cols-2 gap-3">
        {data.tramos.map((t) => {
          const queda = t.in - t.out
          return (
            <div key={t.label} className="rounded-xl bg-elevated/60 border border-edge/60 p-3">
              <p className="text-[11px] font-bold text-ink">{t.label}</p>
              <p className="text-[11px] text-muted mt-1.5 flex justify-between">
                <span>Te llega</span>
                <span className="num font-semibold" style={{ color: 'var(--c-income)' }}>{formatMoney(Math.round(t.in))}</span>
              </p>
              <p className="text-[11px] text-muted mt-0.5 flex justify-between">
                <span>Vence</span>
                <span className="num font-semibold" style={{ color: 'var(--c-danger)' }}>−{formatMoney(Math.round(t.out))}</span>
              </p>
              <p className="text-[11.5px] mt-1 pt-1 border-t border-dashed flex justify-between" style={{ borderColor: 'var(--c-border)' }}>
                <span className="font-semibold text-ink">Te queda</span>
                <span className="num font-bold" style={{ color: queda >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>{formatMoney(Math.round(queda))}</span>
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
