// Ahorro por SOBRES (mejora 5): varios ahorros a la vez, cada uno con su meta,
// con el dinero que ya tenías guardado y con aportes/retiros en cualquier momento.
import { useState } from 'react'
import { Minus, PiggyBank, Plus, ShieldCheck, Target, Trash2, X } from 'lucide-react'
import type { SavingsEnvelope } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { envelopeTotal, savingsTotal, suggestedEmergencyGoal } from '../../lib/fund'
import { payrollBreakdown } from '../../lib/payroll'
import { formatMoney } from '../../lib/format'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Toggle } from '../ui/Toggle'
import { Segmented } from '../ui/Segmented'
import { ProgressRing } from '../ui/ProgressRing'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export function SavingsSection() {
  const settings = useFinanceStore((s) => s.settings)
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const setSavings = useFinanceStore((s) => s.setSavings)
  const addEnvelope = useFinanceStore((s) => s.addEnvelope)

  const sav = settings.savings
  const envelopes = sav.envelopes ?? []
  const total = savingsTotal(settings)
  const emergencyGoal = suggestedEmergencyGoal(months, debts)

  const base = payrollBreakdown(settings.payroll).monthlyNet || settings.defaultSalary
  const planMensual = sav.mode === 'percent' ? Math.round(Math.max(0, base) * sav.value / 100) : sav.value

  const [newName, setNewName] = useState('')
  const [newGoal, setNewGoal] = useState(0)
  const [newInitial, setNewInitial] = useState(0)
  const [adding, setAdding] = useState(false)

  const create = () => {
    if (!newName.trim() && newGoal <= 0 && newInitial <= 0) return
    addEnvelope({ name: newName, goal: newGoal, initial: newInitial })
    setNewName(''); setNewGoal(0); setNewInitial(0); setAdding(false)
  }

  return (
    <>
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11.5px] text-muted">Ahorro total</p>
            <p className="num text-[24px] font-bold leading-tight" style={{ color: 'var(--c-income)' }}>
              {formatMoney(Math.round(total))}
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              {envelopes.length} sobre{envelopes.length === 1 ? '' : 's'}
            </p>
          </div>
          <span
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in oklab, var(--c-income) 16%, transparent)', color: 'var(--c-income)' }}
          >
            <PiggyBank size={22} />
          </span>
        </div>
      </div>

      {/* Plan mensual sugerido */}
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-ink">Meta de ahorro mensual</p>
            <p className="text-[11.5px] text-muted mt-0.5">Cuánto quieres apartar cada mes</p>
          </div>
          <Toggle checked={sav.enabled} onChange={(v) => setSavings({ enabled: v })} label="Ahorro" />
        </div>
        {sav.enabled && (
          <div className="anim-fade flex flex-col gap-3">
            <Segmented
              value={sav.mode}
              onChange={(m) => setSavings({ mode: m })}
              options={[
                { value: 'percent', label: '% del neto' },
                { value: 'fixed', label: 'Monto fijo' },
              ]}
            />
            {sav.mode === 'percent' ? (
              <div>
                <label className="text-[12.5px] text-muted block mb-1.5">Porcentaje: {sav.value}%</label>
                <input
                  type="range" min={1} max={50} value={sav.value}
                  onChange={(e) => setSavings({ value: Number(e.target.value) })}
                  className="w-full accent-[var(--app-accent)]"
                />
              </div>
            ) : (
              <div>
                <label className="text-[12.5px] text-muted block mb-1.5">Monto por mes</label>
                <CurrencyInput value={sav.value} onChange={(v) => setSavings({ value: v })} />
              </div>
            )}
            {planMensual > 0 && (
              <p className="text-[12px] text-muted">
                Tu meta: <span className="num font-bold" style={{ color: 'var(--c-income)' }}>{formatMoney(planMensual)}</span> al mes
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sobres */}
      {envelopes.map((e) => <EnvelopeCard key={e.id} env={e} />)}

      {/* Crear sobre */}
      {adding ? (
        <div className="card p-4 flex flex-col gap-3 anim-fade">
          <div className="flex items-center justify-between">
            <p className="text-[13.5px] font-semibold text-ink">Nuevo sobre de ahorro</p>
            <button onClick={() => setAdding(false)} aria-label="Cancelar" className="pressable text-muted"><X size={15} /></button>
          </div>
          <input
            className="input-base"
            placeholder="Nombre (ej. Emergencias, Viaje, Carro)"
            value={newName}
            onChange={(ev) => setNewName(ev.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted block mb-1.5">Ya tengo guardado</label>
              <CurrencyInput value={newInitial} onChange={setNewInitial} />
            </div>
            <div>
              <label className="text-[12px] text-muted block mb-1.5">Meta (opcional)</label>
              <CurrencyInput value={newGoal} onChange={setNewGoal} />
            </div>
          </div>
          {emergencyGoal > 0 && (
            <button
              onClick={() => { setNewName(newName || 'Fondo de emergencia'); setNewGoal(emergencyGoal) }}
              className="pressable card p-3 flex items-center gap-2.5 text-left"
              style={{ borderColor: 'color-mix(in oklab, var(--c-income) 40%, var(--c-border))' }}
            >
              <ShieldCheck size={16} className="shrink-0" style={{ color: 'var(--c-income)' }} />
              <span className="flex-1">
                <span className="block text-[12.5px] font-semibold text-ink">Usar fondo de emergencia</span>
                <span className="block text-[11px] text-muted mt-0.5">
                  {formatMoney(emergencyGoal)} = 3 meses de tus gastos promedio
                </span>
              </span>
            </button>
          )}
          <button
            onClick={create}
            className="pressable btn-primary w-full flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Crear sobre
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="pressable rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 py-4 text-[13.5px] font-semibold"
          style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 50%, var(--c-border))', color: 'var(--app-accent-soft)' }}
        >
          <Plus size={17} /> Crear un sobre de ahorro
        </button>
      )}

      <p className="text-[11px] text-muted">
        Cada aporte sale de tu saldo real y cada retiro vuelve a él. El dinero de los
        sobres no cuenta como saldo disponible del mes.
      </p>
    </>
  )
}

/* ─── Un sobre ─────────────────────────────────────────────────────────────── */

function EnvelopeCard({ env }: { env: SavingsEnvelope }) {
  const addEnvelopeDeposit = useFinanceStore((s) => s.addEnvelopeDeposit)
  const deleteEnvelopeDeposit = useFinanceStore((s) => s.deleteEnvelopeDeposit)
  const updateEnvelope = useFinanceStore((s) => s.updateEnvelope)
  const deleteEnvelope = useFinanceStore((s) => s.deleteEnvelope)

  const [amount, setAmount] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const total = envelopeTotal(env)
  const pct = env.goal > 0 ? Math.min(1, total / env.goal) : 0
  const movs = env.deposits.slice(-5).reverse()

  const aportar = (signo: 1 | -1) => {
    if (amount <= 0) return
    addEnvelopeDeposit(env.id, signo * amount, signo > 0 ? 'Aporte' : 'Retiro')
    setAmount(0)
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {env.goal > 0 ? (
          <ProgressRing progress={pct} size={52} stroke={6} color="var(--c-income)">
            <span className="num text-[11px] font-bold text-ink">{Math.round(pct * 100)}%</span>
          </ProgressRing>
        ) : (
          <span
            className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in oklab, var(--c-income) 14%, transparent)', color: 'var(--c-income)' }}
          >
            <PiggyBank size={20} />
          </span>
        )}
        <button onClick={() => setOpen(!open)} className="pressable flex-1 min-w-0 text-left">
          <span className="block text-[14.5px] font-semibold text-ink truncate">{env.name}</span>
          <span className="num block text-[17px] font-bold" style={{ color: 'var(--c-income)' }}>
            {formatMoney(Math.round(total))}
            {env.goal > 0 && <span className="text-[11.5px] text-muted font-normal"> / {formatMoney(env.goal)}</span>}
          </span>
        </button>
        <button
          onClick={() => setEditing(!editing)}
          aria-label={`Editar ${env.name}`}
          className="pressable w-8 h-8 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted shrink-0"
        >
          <Target size={13} />
        </button>
      </div>

      {/* Aportar o retirar en cualquier momento */}
      <div className="flex gap-2">
        <CurrencyInput value={amount} onChange={setAmount} className="flex-1" />
        <button
          onClick={() => aportar(1)}
          aria-label={`Aportar a ${env.name}`}
          className="pressable w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-white"
          style={{ background: 'var(--c-income)' }}
        >
          <Plus size={18} />
        </button>
        <button
          onClick={() => aportar(-1)}
          aria-label={`Retirar de ${env.name}`}
          className="pressable w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center bg-elevated border border-edge text-muted"
        >
          <Minus size={18} />
        </button>
      </div>

      {editing && (
        <div className="anim-fade flex flex-col gap-3 pt-1">
          <div>
            <label className="text-[12px] text-muted block mb-1.5">Nombre</label>
            <input
              className="input-base"
              value={env.name}
              onChange={(e) => updateEnvelope(env.id, { name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted block mb-1.5">Ya tenía guardado</label>
              <CurrencyInput value={env.initial} onChange={(v) => updateEnvelope(env.id, { initial: v })} />
            </div>
            <div>
              <label className="text-[12px] text-muted block mb-1.5">Meta</label>
              <CurrencyInput value={env.goal} onChange={(v) => updateEnvelope(env.id, { goal: v })} />
            </div>
          </div>
          <button
            onClick={() => setConfirmDel(true)}
            className="pressable btn-ghost w-full flex items-center justify-center gap-2 text-[13px]"
            style={{ color: 'var(--c-danger)' }}
          >
            <Trash2 size={14} /> Eliminar este sobre
          </button>
        </div>
      )}

      {open && env.deposits.length > 0 && (
        <div className="anim-fade flex flex-col divide-y divide-[var(--c-border)]">
          {movs.map((d) => (
            <div key={d.id} className="flex items-center gap-2 py-1.5">
              <span className="text-[12.5px] text-ink flex-1 truncate">{d.note || (d.amount >= 0 ? 'Aporte' : 'Retiro')}</span>
              <span className="text-[10.5px] text-muted num">{d.dateISO.slice(8, 10)}/{d.dateISO.slice(5, 7)}</span>
              <span
                className="num text-[12.5px] font-semibold"
                style={{ color: d.amount >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}
              >
                {d.amount >= 0 ? '+' : '−'}{formatMoney(Math.abs(d.amount))}
              </span>
              <button
                onClick={() => deleteEnvelopeDeposit(env.id, d.id)}
                aria-label="Eliminar movimiento"
                className="pressable w-6 h-6 rounded-full flex items-center justify-center text-muted"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDel}
        title={`¿Eliminar "${env.name}"?`}
        message="Se borra el sobre y su historial de aportes. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => { deleteEnvelope(env.id); setConfirmDel(false) }}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  )
}
