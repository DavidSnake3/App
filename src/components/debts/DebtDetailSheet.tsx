import { useMemo, useState } from 'react'
import { Landmark, Pencil } from 'lucide-react'
import type { Debt } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { addMonthsToId, currentMonthId, monthLabel } from '../../lib/dates'
import { debtEndMonthId, debtIsActiveInMonth, debtPaidCount } from '../../lib/finance'
import { formatMoney } from '../../lib/format'
import { payBurst } from '../../lib/fx'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'

interface Props {
  debt: Debt | null
  onClose: () => void
  onEdit: (d: Debt) => void
}

/** Detalle premium de deuda: estado de cuenta estilo recibo de abono (mejora 7) */
export function DebtDetailSheet({ debt, onClose, onEdit }: Props) {
  return (
    <BottomSheet
      open={!!debt}
      onClose={onClose}
      title={debt?.name ?? ''}
      subtitle={debt?.account ? `Cuenta: ${debt.account}` : 'Estado de cuenta'}
    >
      {debt && <DebtDetail key={debt.id} debt={debt} onEdit={onEdit} />}
    </BottomSheet>
  )
}

function DebtDetail({ debt, onEdit }: { debt: Debt; onEdit: (d: Debt) => void }) {
  const payDebtInstallment = useFinanceStore((s) => s.payDebtInstallment)
  const toggleDebtPaid = useFinanceStore((s) => s.toggleDebtPaid)
  const animPrefs = useFinanceStore((s) => s.settings.animations)
  const activeMonthId = useFinanceStore((s) => s.activeMonthId)

  const [abonoOpen, setAbonoOpen] = useState(false)
  const [monto, setMonto] = useState(debt.monthlyPayment)
  const [interes, setInteres] = useState(0)

  const info = useMemo(() => {
    const nowId = currentMonthId()
    const monthIds = Array.from({ length: debt.installments }, (_, i) => addMonthsToId(debt.startMonthId, i))
    const paidEntries = monthIds
      .map((id) => ({ id, p: debt.payments[id] }))
      .filter((x) => x.p?.paid)
    const lastPaid = paidEntries[paidEntries.length - 1]
    const pagado = paidEntries.reduce((s, x) => s + (x.p?.amount ?? 0), 0)
    const saldo = Math.max(0, debt.total - pagado)
    const saldoAnterior = lastPaid ? saldo + (lastPaid.p?.amount ?? 0) : debt.total
    const nextUnpaid = monthIds.find((id) => !debt.payments[id]?.paid)
    const overdue = monthIds
      .filter((id) => id < nowId && !debt.payments[id]?.paid)
      .reduce((s) => s + debt.monthlyPayment, 0)
    // La cuota a abonar es la del MES QUE ESTÁS VIENDO si está pendiente;
    // solo si ya está pagada se ofrece la siguiente sin pagar (mejora 5)
    const activePending = debtIsActiveInMonth(debt, activeMonthId) && !debt.payments[activeMonthId]?.paid
    const target = activePending ? activeMonthId : nextUnpaid
    return { monthIds, paidEntries, lastPaid, saldo, saldoAnterior, nextUnpaid, overdue, nowId, target }
  }, [debt, activeMonthId])

  const registrarAbono = (el: HTMLElement | null) => {
    if (!info.target) return
    const capital = Math.max(0, monto - interes)
    payDebtInstallment(debt.id, info.target, { amount: monto, capital, interest: interes || undefined })
    payBurst(el, animPrefs)
    setAbonoOpen(false)
  }


  const fmtFecha = (iso?: string) => iso ? new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

  return (
    <div className="flex flex-col gap-4">
      {/* ── Estado de cuenta estilo recibo ── */}
      <div className="card bg-elevated/50 p-4 num text-[13px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-2 font-bold text-ink text-[13.5px]">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)', color: 'var(--app-accent-soft)' }}>
              <ItemIcon icon={debt.icon} name={debt.name} kind="deuda" size={14} />
            </span>
            ESTADO DE CUENTA
          </span>
          {debt.payMethod && <span className="text-[10.5px] text-muted uppercase">{debt.payMethod}</span>}
        </div>
        <DashLine />
        <ReceiptRow label="SALDO ANTERIOR" value={formatMoney(info.saldoAnterior)} />
        {info.lastPaid?.p && (
          <>
            <ReceiptRow label="APORTE CAPITAL" value={formatMoney(info.lastPaid.p.capital ?? info.lastPaid.p.amount)} tone="income" />
            {(info.lastPaid.p.interest ?? 0) > 0 && (
              <ReceiptRow label="APORTE INTERESES" value={formatMoney(info.lastPaid.p.interest ?? 0)} tone="warning" />
            )}
          </>
        )}
        <ReceiptRow label="NUEVO SALDO" value={formatMoney(info.saldo)} strong />
        <DashLine />
        <ReceiptRow label="Cuotas pagadas" value={String(debtPaidCount(debt))} />
        <ReceiptRow label="Cuotas pendientes" value={String(Math.max(0, debt.installments - debtPaidCount(debt)))} />
        <ReceiptRow label="Mensualidad" value={formatMoney(debt.monthlyPayment)} />
        <DashLine />
        <ReceiptRow
          label="PRÓXIMO PAGO"
          value={info.nextUnpaid ? `${String(debt.dueDay).padStart(2, '0')}/${info.nextUnpaid.split('-')[1]}/${info.nextUnpaid.split('-')[0]}` : 'COMPLETADA'}
          strong
        />
        <ReceiptRow
          label="MONTO AL DÍA"
          value={info.overdue > 0 ? formatMoney(info.overdue) : formatMoney(0)}
          tone={info.overdue > 0 ? 'danger' : 'income'}
        />
      </div>

      {/* Progreso */}
      <div>
        <div className="flex justify-between text-[11.5px] text-muted mb-1.5">
          <span>Progreso · termina en {monthLabel(debtEndMonthId(debt), true)}</span>
          <span className="num">{Math.round((debtPaidCount(debt) / debt.installments) * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-elevated overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, Math.round((debtPaidCount(debt) / debt.installments) * 100))}%`, background: 'var(--app-gradient)' }} />
        </div>
      </div>

      {/* Registrar abono (siempre indica claramente QUÉ mes se está pagando) */}
      {info.target && !abonoOpen && (
        <button onClick={() => setAbonoOpen(true)} className="pressable btn-primary w-full">
          Registrar abono de {monthLabel(info.target, true)}
        </button>
      )}
      {abonoOpen && info.target && (
        <div className="card p-3.5 flex flex-col gap-3 anim-fade" style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 45%, var(--c-border))' }}>
          <p className="text-[13px] font-semibold text-ink">Abono de la cuota de {monthLabel(info.target)}</p>
          <div>
            <label className="text-[12px] text-muted block mb-1">Monto del abono</label>
            <CurrencyInput value={monto} onChange={setMonto} />
          </div>
          <div>
            <label className="text-[12px] text-muted block mb-1">De eso, intereses <span className="opacity-60">(opcional)</span></label>
            <CurrencyInput value={interes} onChange={setInteres} />
            {interes > 0 && monto >= interes && (
              <p className="text-[11.5px] text-muted mt-1">
                Aporte a capital: <span className="num font-semibold" style={{ color: 'var(--c-income)' }}>{formatMoney(monto - interes)}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAbonoOpen(false)} className="pressable btn-ghost flex-1">Cancelar</button>
            <button onClick={(e) => registrarAbono(e.currentTarget)} className="pressable btn-primary flex-1">Confirmar</button>
          </div>
        </div>
      )}

      {/* Historial de abonos */}
      {info.paidEntries.length > 0 && (
        <div>
          <p className="text-[12.5px] font-bold uppercase tracking-wider text-muted mb-2">Historial de abonos</p>
          <div className="card overflow-hidden divide-y divide-[var(--c-border)]">
            {[...info.paidEntries].reverse().map(({ id, p }) => (
              <div key={id} className="px-3.5 py-2.5 flex items-center gap-3">
                <Landmark size={14} className="text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink">{monthLabel(id)}</p>
                  <p className="text-[11px] text-muted">
                    {fmtFecha(p?.paidAt)}
                    {(p?.interest ?? 0) > 0 && ` · capital ${formatMoney(p?.capital ?? 0)} + int. ${formatMoney(p?.interest ?? 0)}`}
                  </p>
                </div>
                <span className="num text-[13px] font-bold" style={{ color: 'var(--c-income)' }}>{formatMoney(p?.amount ?? 0)}</span>
                <button
                  onClick={() => toggleDebtPaid(debt.id, id)}
                  className="pressable text-[10.5px] text-muted underline decoration-dotted"
                >
                  deshacer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => onEdit(debt)} className="pressable btn-ghost w-full flex items-center justify-center gap-2">
        <Pencil size={14} /> Editar deuda
      </button>
    </div>
  )
}

function ReceiptRow({ label, value, strong, tone }: {
  label: string; value: string; strong?: boolean; tone?: 'income' | 'danger' | 'warning'
}) {
  const color = tone === 'income' ? 'var(--c-income)' : tone === 'danger' ? 'var(--c-danger)' : tone === 'warning' ? 'var(--c-warning)' : strong ? 'var(--c-text)' : 'var(--c-muted)'
  return (
    <div className="flex items-center justify-between py-[3px]">
      <span className={strong ? 'font-bold text-ink' : 'text-muted'} style={{ fontSize: strong ? 13 : 12.5 }}>{label}</span>
      <span className={`num ${strong ? 'font-bold' : 'font-semibold'}`} style={{ color, fontSize: strong ? 14.5 : 13 }}>{value}</span>
    </div>
  )
}

function DashLine() {
  return <div className="border-t border-dashed my-2" style={{ borderColor: 'var(--c-border)' }} />
}
