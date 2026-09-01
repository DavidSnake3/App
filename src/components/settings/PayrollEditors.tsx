// Editores universales de planilla: deducciones de ley con techo, impuesto
// sobre la renta por tramos y pagos extraordinarios (aguinaldo, 13.º, 14.º).
import { useState } from 'react'
import { Info, Landmark, Percent, PartyPopper, Plus, Scale, X } from 'lucide-react'
import type { ExtraPay, StatutoryDeduction, TaxBracket } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import {
  LEGAL_NOTICE, PERIOD_UNIT, extraPaysYearTotal, payrollBreakdown,
  periodToMonthlyFactor, statutoryList,
} from '../../lib/payroll'
import { formatMoney, formatMoneyExact } from '../../lib/format'
import { uid } from '../../lib/finance'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Toggle } from '../ui/Toggle'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/* ─── Deducciones de ley (varias, con techo de cotización) ─────────────────── */

export function StatutoryEditor() {
  const p = useFinanceStore((s) => s.settings.payroll)
  const setPayroll = useFinanceStore((s) => s.setPayroll)
  const bd = payrollBreakdown(p)
  const list = statutoryList(p)
  const [openCaps, setOpenCaps] = useState(false)

  const save = (next: StatutoryDeduction[]) => setPayroll({
    statutory: next,
    ccssPct: Math.round(next.reduce((t, d) => t + (d.mode === 'fixed' ? 0 : d.pct), 0) * 100) / 100,
    statutoryName: next.length === 1 ? next[0].name : 'Deducciones de ley',
  })

  const update = (id: string, patch: Partial<StatutoryDeduction>) =>
    save(list.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted flex items-center gap-1.5">
          <Landmark size={13} /> Deducciones de ley (seguro social, pensión, salud…)
        </p>
        <button
          onClick={() => setOpenCaps(!openCaps)}
          className="pressable text-[11px] font-semibold"
          style={{ color: 'var(--app-accent-soft)' }}
        >
          {openCaps ? 'Ocultar techos' : 'Ver techos'}
        </button>
      </div>

      {list.map((d) => {
        const row = bd.statutoryRows.find((r) => r.name === d.name)
        return (
          <div key={d.id} className="card p-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                className="input-base flex-1 !py-2 !text-[13px]"
                placeholder="Nombre (CCSS, IMSS, AFP…)"
                value={d.name}
                onChange={(e) => update(d.id, { name: e.target.value })}
              />
              {d.mode === 'fixed' ? (
                <div className="w-28 shrink-0">
                  <CurrencyInput
                    value={d.amount ?? 0}
                    onChange={(v) => update(d.id, { amount: v })}
                    className="[&_input]:!py-2 [&_input]:!text-[13px]"
                  />
                </div>
              ) : (
                <div className="relative w-24 shrink-0">
                  <input
                    type="number" min={0} max={60} step="0.01" inputMode="decimal"
                    className="input-base num !py-2 !text-[13px] !pr-7"
                    value={d.pct}
                    onChange={(e) => update(d.id, { pct: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
                  />
                  <Percent size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
                </div>
              )}
              {list.length > 1 && (
                <button
                  onClick={() => save(list.filter((x) => x.id !== d.id))}
                  aria-label={`Quitar ${d.name}`}
                  className="pressable w-10 shrink-0 rounded-xl bg-elevated border border-edge flex items-center justify-center text-muted"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {/* algunas deducciones de ley son un monto fijo, no un porcentaje */}
            <div className="flex rounded-xl bg-elevated border border-edge p-0.5 gap-0.5">
              {([
                { id: 'percent' as const, label: 'Porcentaje' },
                { id: 'fixed' as const, label: 'Monto fijo' },
              ]).map((m) => {
                const activo = (d.mode ?? 'percent') === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => update(d.id, { mode: m.id })}
                    className={`pressable flex-1 min-h-7 rounded-lg text-[11px] font-semibold ${
                      activo ? 'bg-card text-ink border border-edge' : 'text-muted'
                    }`}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>

            {openCaps && d.mode !== 'fixed' && (
              <div className="anim-fade">
                <label className="text-[11px] text-muted block mb-1">
                  Techo de cotización mensual (0 = sin techo)
                </label>
                <CurrencyInput
                  value={d.cap ?? 0}
                  onChange={(v) => update(d.id, { cap: v })}
                  className="[&_input]:!py-2 [&_input]:!text-[13px]"
                />
              </div>
            )}
            {p.gross > 0 && row && (
              <p className="text-[11px] text-muted">
                Te quita <span className="num font-bold" style={{ color: 'var(--c-danger)' }}>−{formatMoneyExact(row.amount)}</span> {PERIOD_UNIT[bd.period]}
                {row.capped && <span style={{ color: 'var(--c-warning)' }}> · llegaste al techo</span>}
              </p>
            )}
          </div>
        )
      })}

      <button
        onClick={() => save([...list, { id: uid(), name: '', pct: 0, cap: 0 }])}
        className="pressable rounded-xl border border-dashed py-2 text-[12.5px] font-semibold flex items-center justify-center gap-1.5"
        style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 45%, var(--c-border))', color: 'var(--app-accent-soft)' }}
      >
        <Plus size={14} /> Agregar otra deducción de ley
      </button>

      {p.gross > 0 && bd.ccss > 0 && (
        <p className="text-[11px] text-muted">
          Total de ley: <span className="num font-bold" style={{ color: 'var(--c-danger)' }}>−{formatMoneyExact(bd.ccss)}</span> {PERIOD_UNIT[bd.period]}
          {bd.period !== 'monthly' && (
            <> ≈ <span className="num">−{formatMoney(Math.round(bd.ccss * periodToMonthlyFactor(bd.period)))}</span> al mes</>
          )}
        </p>
      )}
    </div>
  )
}

/* ─── Impuesto sobre la renta por tramos ───────────────────────────────────── */

export function TaxEditor() {
  const p = useFinanceStore((s) => s.settings.payroll)
  const setPayroll = useFinanceStore((s) => s.setPayroll)
  const bd = payrollBreakdown(p)
  const brackets = p.taxBrackets ?? []
  const [open, setOpen] = useState(false)

  const save = (next: TaxBracket[]) => setPayroll({ taxBrackets: next })
  const update = (i: number, patch: Partial<TaxBracket>) =>
    save(brackets.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))

  return (
    <div className="card p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
            <Scale size={14} /> Impuesto sobre la renta
          </p>
          <p className="text-[11.5px] text-muted mt-0.5">
            Se calcula por tramos sobre tu ingreso gravable del mes
          </p>
        </div>
        <Toggle
          checked={Boolean(p.taxEnabled)}
          onChange={(v) => setPayroll({ taxEnabled: v })}
          label="Impuesto"
        />
      </div>

      {p.taxEnabled && (
        <div className="anim-fade flex flex-col gap-2">
          {p.gross > 0 && (
            <div className="rounded-xl px-3 py-2" style={{ background: 'color-mix(in oklab, var(--c-danger) 8%, transparent)' }}>
              <p className="text-[11.5px] text-muted">
                Gravable del mes: <span className="num font-semibold text-ink">{formatMoney(Math.round(bd.monthlyTaxable))}</span>
              </p>
              <p className="text-[12.5px] mt-0.5">
                Impuesto: <span className="num font-bold" style={{ color: 'var(--c-danger)' }}>−{formatMoneyExact(bd.tax)}</span>
                <span className="text-[11px] text-muted"> {PERIOD_UNIT[bd.period]}</span>
              </p>
            </div>
          )}

          <button
            onClick={() => setOpen(!open)}
            className="pressable text-[12px] font-semibold self-start"
            style={{ color: 'var(--app-accent-soft)' }}
          >
            {open ? 'Ocultar tramos' : `Ver y editar tramos (${brackets.length})`}
          </button>

          {open && (
            <div className="flex flex-col gap-2 anim-fade">
              {brackets.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted w-12 shrink-0">
                    {b.upTo == null ? 'Resto' : 'Hasta'}
                  </span>
                  {b.upTo == null ? (
                    <span className="flex-1 text-[12px] text-muted">sin límite</span>
                  ) : (
                    <CurrencyInput
                      value={b.upTo}
                      onChange={(v) => update(i, { upTo: v })}
                      className="flex-1 [&_input]:!py-1.5 [&_input]:!text-[12.5px]"
                    />
                  )}
                  <div className="relative w-20 shrink-0">
                    <input
                      type="number" min={0} max={60} step="0.01" inputMode="decimal"
                      className="input-base num !py-1.5 !text-[12.5px] !pr-6"
                      value={b.pct}
                      onChange={(e) => update(i, { pct: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
                    />
                    <Percent size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
                  </div>
                  <button
                    onClick={() => save(brackets.filter((_, idx) => idx !== i))}
                    aria-label="Quitar tramo"
                    className="pressable w-7 h-7 rounded-full flex items-center justify-center text-muted shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => save([...brackets.slice(0, -1), { upTo: 0, pct: 0 }, ...brackets.slice(-1)])}
                className="pressable text-[12px] font-semibold self-start flex items-center gap-1"
                style={{ color: 'var(--app-accent-soft)' }}
              >
                <Plus size={13} /> Agregar tramo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Pagos extraordinarios: aguinaldo, 13.º, 14.º, primas ─────────────────── */

export function ExtraPaysEditor() {
  const p = useFinanceStore((s) => s.settings.payroll)
  const setPayroll = useFinanceStore((s) => s.setPayroll)
  const bd = payrollBreakdown(p)
  const list = p.extraPays ?? []
  const total = extraPaysYearTotal(p, bd.monthlyNet)

  const save = (next: ExtraPay[]) => setPayroll({ extraPays: next })
  const update = (id: string, patch: Partial<ExtraPay>) =>
    save(list.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-muted flex items-center gap-1.5">
        <PartyPopper size={13} /> Pagos extraordinarios (aguinaldo, 13.º, 14.º, primas)
      </p>

      {list.map((e) => (
        <div key={e.id} className="card p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              className="input-base flex-1 !py-2 !text-[13px]"
              placeholder="Nombre (Aguinaldo, 13.º…)"
              value={e.name}
              onChange={(ev) => update(e.id, { name: ev.target.value })}
            />
            <select
              className="input-base w-24 shrink-0 !py-2 !text-[13px]"
              value={e.month}
              onChange={(ev) => update(e.id, { month: Number(ev.target.value) })}
            >
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <button
              onClick={() => save(list.filter((x) => x.id !== e.id))}
              aria-label={`Quitar ${e.name}`}
              className="pressable w-10 shrink-0 rounded-xl bg-elevated border border-edge flex items-center justify-center text-muted"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="input-base flex-1 !py-2 !text-[13px]"
              value={e.mode}
              onChange={(ev) => update(e.id, { mode: ev.target.value as ExtraPay['mode'] })}
            >
              <option value="salary">Fracción de mi salario</option>
              <option value="fixed">Monto fijo</option>
            </select>
            {e.mode === 'salary' ? (
              <select
                className="input-base w-32 shrink-0 !py-2 !text-[13px]"
                value={e.factor}
                onChange={(ev) => update(e.id, { factor: Number(ev.target.value) })}
              >
                <option value={1}>1 salario</option>
                <option value={0.5}>Medio (15 días)</option>
                <option value={0.33}>Un tercio</option>
                <option value={0.25}>Un cuarto</option>
              </select>
            ) : (
              <CurrencyInput
                value={e.amount}
                onChange={(v) => update(e.id, { amount: v })}
                className="w-32 shrink-0 [&_input]:!py-2 [&_input]:!text-[13px]"
              />
            )}
          </div>
          {bd.monthlyNet > 0 && (
            <p className="text-[11px] text-muted">
              En {MONTHS[e.month - 1]} recibirías{' '}
              <span className="num font-bold" style={{ color: 'var(--c-income)' }}>
                {formatMoney(Math.round(e.mode === 'fixed' ? e.amount : bd.monthlyNet * (e.factor || 1)))}
              </span>
            </p>
          )}
        </div>
      ))}

      <button
        onClick={() => save([...list, { id: uid(), name: '', month: 12, mode: 'salary', factor: 1, amount: 0 }])}
        className="pressable rounded-xl border border-dashed py-2 text-[12.5px] font-semibold flex items-center justify-center gap-1.5"
        style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 45%, var(--c-border))', color: 'var(--app-accent-soft)' }}
      >
        <Plus size={14} /> Agregar pago extraordinario
      </button>

      {total > 0 && (
        <p className="text-[11.5px] text-muted">
          Al año recibirías <span className="num font-bold" style={{ color: 'var(--c-income)' }}>{formatMoney(total)}</span> extra.
          Aparece en la proyección del Año.
        </p>
      )}
    </div>
  )
}

/* ─── Aviso legal ──────────────────────────────────────────────────────────── */

export function LegalNotice() {
  return (
    <div
      className="card p-3.5 flex gap-2.5"
      style={{ borderColor: 'color-mix(in oklab, var(--c-warning) 35%, var(--c-border))' }}
    >
      <Info size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--c-warning)' }} />
      <p className="text-[11px] text-muted leading-relaxed">{LEGAL_NOTICE}</p>
    </div>
  )
}
