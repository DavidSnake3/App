// "Me deben": préstamos propios. Una cuenta por persona con cuánto le presté,
// desde cuándo me debe y los abonos que me ha hecho (mejora 1).
import { useState } from 'react'
import {
  CalendarClock, Check, HandCoins, Pencil, Phone, Plus, Trash2, User, X,
} from 'lucide-react'
import type { Loan } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { loanIsSettled, loanPaid, loanProgress, loanRemaining, loanTotals, sinceLabel } from '../../lib/loans'
import { formatMoney } from '../../lib/format'
import { CurrencyInput } from '../ui/CurrencyInput'
import { ProgressRing } from '../ui/ProgressRing'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { BottomSheet } from '../ui/BottomSheet'
import { payBurst } from '../../lib/fx'

export function LoansView() {
  const loans = useFinanceStore((s) => s.loans)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Loan | null>(null)

  const totals = loanTotals(loans)
  const activos = loans.filter((l) => !loanIsSettled(l))
  const pagados = loans.filter((l) => loanIsSettled(l))

  return (
    <>
      {/* Resumen */}
      <div className="card p-4 grid grid-cols-2 gap-4 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--c-income), var(--app-accent))' }} />
        <div>
          <p className="text-[11.5px] text-muted">Te deben</p>
          <p className="num text-[22px] font-bold leading-tight" style={{ color: 'var(--c-income)' }}>
            {formatMoney(Math.round(totals.pendiente))}
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            {totals.personas} persona{totals.personas === 1 ? '' : 's'} · {totals.activos} préstamo{totals.activos === 1 ? '' : 's'}
          </p>
        </div>
        <div>
          <p className="text-[11.5px] text-muted">Ya te abonaron</p>
          <p className="num text-[22px] font-bold text-ink leading-tight">
            {formatMoney(Math.round(totals.abonado))}
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            de {formatMoney(Math.round(totals.prestado))} prestados
          </p>
        </div>
      </div>

      {loans.length === 0 && (
        <div className="card p-8 text-center anim-pop">
          <HandCoins size={26} className="mx-auto mb-2" style={{ color: 'var(--app-accent-soft)' }} />
          <p className="text-[15px] font-semibold text-ink">Nadie te debe nada</p>
          <p className="text-[13px] text-muted mt-1.5">
            Cuando le prestes plata a alguien, anótalo aquí: llevás cuánto le prestaste,
            desde cuándo y lo que te va abonando.
          </p>
        </div>
      )}

      {activos.map((l) => <LoanCard key={l.id} loan={l} onEdit={setEditing} />)}

      {pagados.length > 0 && (
        <>
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted mt-1">
            Ya te pagaron ({pagados.length})
          </p>
          {pagados.map((l) => <LoanCard key={l.id} loan={l} onEdit={setEditing} />)}
        </>
      )}

      <button
        onClick={() => { setEditing(null); setAddOpen(true) }}
        className="pressable rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 py-4 text-[13.5px] font-semibold"
        style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 50%, var(--c-border))', color: 'var(--app-accent-soft)' }}
      >
        <Plus size={17} /> Presté plata a alguien
      </button>

      <p className="text-[11px] text-muted">
        Lo que prestás sale de tu saldo real y cada abono vuelve a él.
      </p>

      <LoanSheet
        open={addOpen || Boolean(editing)}
        loan={editing}
        onClose={() => { setAddOpen(false); setEditing(null) }}
      />
    </>
  )
}

/* ─── Tarjeta de un préstamo ────────────────────────────────────────────── */

function LoanCard({ loan, onEdit }: { loan: Loan; onEdit: (l: Loan) => void }) {
  const addLoanPayment = useFinanceStore((s) => s.addLoanPayment)
  const deleteLoanPayment = useFinanceStore((s) => s.deleteLoanPayment)
  const deleteLoan = useFinanceStore((s) => s.deleteLoan)
  const animPrefs = useFinanceStore((s) => s.settings.animations)

  const [abono, setAbono] = useState(0)
  const [open, setOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const pendiente = loanRemaining(loan)
  const abonado = loanPaid(loan)
  const listo = loanIsSettled(loan)

  const registrar = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (abono <= 0) return
    addLoanPayment(loan.id, Math.min(abono, pendiente || abono), 'Abono')
    payBurst(e.currentTarget, animPrefs)
    setAbono(0)
  }

  return (
    <div className={`card p-4 flex flex-col gap-3 ${listo ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3">
        <ProgressRing progress={loanProgress(loan)} size={48} stroke={6} color={listo ? 'var(--c-income)' : 'var(--app-accent)'}>
          {listo
            ? <Check size={16} style={{ color: 'var(--c-income)' }} />
            : <span className="num text-[10.5px] font-bold text-ink">{Math.round(loanProgress(loan) * 100)}%</span>}
        </ProgressRing>
        <button onClick={() => setOpen(!open)} className="pressable flex-1 min-w-0 text-left">
          <span className="block text-[14.5px] font-semibold text-ink truncate flex items-center gap-1.5">
            <User size={13} className="shrink-0 text-muted" /> {loan.person}
          </span>
          {listo ? (
            <span className="block text-[12px]" style={{ color: 'var(--c-income)' }}>
              Te pagó todo · {formatMoney(loan.amount)}
            </span>
          ) : (
            <span className="num block text-[17px] font-bold" style={{ color: 'var(--c-income)' }}>
              {formatMoney(Math.round(pendiente))}
              <span className="text-[11.5px] text-muted font-normal"> de {formatMoney(loan.amount)}</span>
            </span>
          )}
          <span className="block text-[11px] text-muted mt-0.5 flex items-center gap-1">
            <CalendarClock size={11} /> le presté {sinceLabel(loan.dateISO)}
            {loan.dueDateISO && <> · quedó de pagar el {loan.dueDateISO.slice(8, 10)}/{loan.dueDateISO.slice(5, 7)}</>}
          </span>
        </button>
        <button
          onClick={() => onEdit(loan)}
          aria-label={`Editar préstamo de ${loan.person}`}
          className="pressable w-8 h-8 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted shrink-0"
        >
          <Pencil size={13} />
        </button>
      </div>

      {!listo && (
        <div className="flex gap-2">
          <CurrencyInput value={abono} onChange={setAbono} className="flex-1" />
          <button
            onClick={registrar}
            className="pressable rounded-2xl px-4 text-[13px] font-semibold text-white shrink-0"
            style={{ background: 'var(--c-income)' }}
          >
            Me abonó
          </button>
        </div>
      )}

      {open && (
        <div className="anim-fade flex flex-col gap-2">
          {loan.phone && (
            <p className="text-[12px] text-muted flex items-center gap-1.5">
              <Phone size={12} /> {loan.phone}
            </p>
          )}
          {loan.note && <p className="text-[12px] text-muted">{loan.note}</p>}

          {loan.payments.length > 0 ? (
            <div className="flex flex-col divide-y divide-[var(--c-border)]">
              <p className="text-[11px] font-semibold text-muted pb-1">
                Abonos ({loan.payments.length}) · total {formatMoney(Math.round(abonado))}
              </p>
              {loan.payments.slice().reverse().map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-1.5">
                  <span className="text-[12.5px] text-ink flex-1 truncate">{p.note || 'Abono'}</span>
                  <span className="text-[10.5px] text-muted num">{p.dateISO.slice(8, 10)}/{p.dateISO.slice(5, 7)}</span>
                  <span className="num text-[12.5px] font-semibold" style={{ color: 'var(--c-income)' }}>
                    +{formatMoney(p.amount)}
                  </span>
                  <button
                    onClick={() => deleteLoanPayment(loan.id, p.id)}
                    aria-label="Eliminar abono"
                    className="pressable w-6 h-6 rounded-full flex items-center justify-center text-muted"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted">Todavía no te ha abonado nada.</p>
          )}

          <button
            onClick={() => setConfirmDel(true)}
            className="pressable btn-ghost w-full flex items-center justify-center gap-2 text-[13px]"
            style={{ color: 'var(--c-danger)' }}
          >
            <Trash2 size={14} /> Eliminar este préstamo
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDel}
        title={`¿Eliminar el préstamo de ${loan.person}?`}
        message="Se borra la cuenta y su historial de abonos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => { deleteLoan(loan.id); setConfirmDel(false) }}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  )
}

/* ─── Crear / editar préstamo ───────────────────────────────────────────── */

function LoanSheet({ open, loan, onClose }: { open: boolean; loan: Loan | null; onClose: () => void }) {
  if (!open) return null
  return <LoanForm key={loan?.id ?? 'new'} loan={loan} onClose={onClose} />
}

function LoanForm({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  const addLoan = useFinanceStore((s) => s.addLoan)
  const updateLoan = useFinanceStore((s) => s.updateLoan)

  const [person, setPerson] = useState(() => loan?.person ?? '')
  const [amount, setAmount] = useState(() => loan?.amount ?? 0)
  const [phone, setPhone] = useState(() => loan?.phone ?? '')
  const [dateISO, setDateISO] = useState(() => loan?.dateISO?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
  const [dueDateISO, setDue] = useState(() => loan?.dueDateISO?.slice(0, 10) ?? '')
  const [note, setNote] = useState(() => loan?.note ?? '')
  const [error, setError] = useState('')

  const guardar = () => {
    if (person.trim().length < 2) { setError('Escribe a quién le prestaste.'); return }
    if (amount <= 0) { setError('Escribe cuánto le prestaste.'); return }
    const data = {
      person: person.trim(),
      amount: Math.round(amount),
      phone: phone.trim() || undefined,
      dateISO,
      dueDateISO: dueDateISO || undefined,
      note: note.trim() || undefined,
    }
    if (loan) updateLoan(loan.id, data)
    else addLoan(data)
    onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={loan ? 'Editar préstamo' : 'Le presté plata a alguien'}
      subtitle="Llevá el control de lo que te deben y de cada abono"
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-[12.5px] text-muted block mb-1.5">¿A quién le prestaste? *</label>
          <input
            className="input-base"
            placeholder="Nombre de la persona"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-[12.5px] text-muted block mb-1.5">¿Cuánto le prestaste? *</label>
          <CurrencyInput value={amount} onChange={setAmount} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12.5px] text-muted block mb-1.5">Desde cuándo</label>
            <input type="date" className="input-base" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
          </div>
          <div>
            <label className="text-[12.5px] text-muted block mb-1.5">Quedó de pagar</label>
            <input type="date" className="input-base" value={dueDateISO} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-[12.5px] text-muted block mb-1.5">Teléfono (opcional)</label>
          <input className="input-base" type="tel" placeholder="8888-8888" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="text-[12.5px] text-muted block mb-1.5">Nota (opcional)</label>
          <input className="input-base" placeholder="Ej. para el arreglo del carro" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <p className="text-[13px] anim-shake" style={{ color: 'var(--c-danger)' }}>{error}</p>}

        <button onClick={guardar} className="pressable btn-primary w-full flex items-center justify-center gap-2">
          <HandCoins size={16} /> {loan ? 'Guardar cambios' : 'Registrar el préstamo'}
        </button>
      </div>
    </BottomSheet>
  )
}
