// Préstamos informales en las dos direcciones:
//   · "Le presté"  → plata que le presté a alguien (me deben)
//   · "Me prestaron" → plata que alguien me prestó (yo debo), sin fecha ni papeles
// Es la misma mecánica con el signo invertido: cada préstamo y cada abono sale
// o entra de la cuenta que se elija y queda anotado en Movimientos.
import { useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, CalendarClock, Check, HandCoins, Pencil, Phone,
  Plus, Trash2, User, Wallet, X,
} from 'lucide-react'
import type { Loan, LoanKind } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import {
  LOAN_COPY, loanHistory, loanIsSettled, loanLent, loanPaid, loanProgress,
  loanRemaining, loanTotals, loansOfKind, sinceLabel,
} from '../../lib/loans'
import { accountById, activeAccounts, isCredit } from '../../lib/accounts'
import { formatMoney } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { todayLocalISO } from '../../lib/dates'
import { accountColor } from '../../lib/itemColors'
import { CurrencyInput } from '../ui/CurrencyInput'
import { ProgressRing } from '../ui/ProgressRing'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { BottomSheet } from '../ui/BottomSheet'
import { DateField } from '../ui/DatePicker'
import { payBurst } from '../../lib/fx'
import { useBackClose } from '../../hooks/useBackClose'

/** Color de cada dirección: lo que me deben suma, lo que debo pesa */
function tono(kind: LoanKind): string {
  return kind === 'borrowed' ? 'var(--c-warning)' : 'var(--c-income)'
}

export function LoansView({ kind = 'lent' }: { kind?: LoanKind }) {
  const todos = useFinanceStore((s) => s.loans)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Loan | null>(null)

  const copy = LOAN_COPY[kind]
  const color = tono(kind)
  const loans = loansOfKind(todos, kind)
  const totals = loanTotals(loans)
  const activos = loans.filter((l) => !loanIsSettled(l))
  const pagados = loans.filter((l) => loanIsSettled(l))

  return (
    <>
      {/* Resumen */}
      <div className="card p-4 grid grid-cols-2 gap-4 relative overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg, ${color}, var(--app-accent))` }}
        />
        <div>
          <p className="text-[11.5px] text-muted">{copy.saldo}</p>
          <p className="num text-[22px] font-bold leading-tight" style={{ color }}>
            {formatMoney(Math.round(totals.pendiente))}
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            {totals.personas} persona{totals.personas === 1 ? '' : 's'} · {totals.activos} préstamo{totals.activos === 1 ? '' : 's'}
          </p>
        </div>
        <div>
          <p className="text-[11.5px] text-muted">{copy.abonado}</p>
          <p className="num text-[22px] font-bold text-ink leading-tight">
            {formatMoney(Math.round(totals.abonado))}
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            de {formatMoney(Math.round(totals.prestado))} {copy.totalLabel}
          </p>
        </div>
      </div>

      {loans.length === 0 && (
        <div className="card p-8 text-center anim-pop">
          <HandCoins size={26} className="mx-auto mb-2" style={{ color }} />
          <p className="text-[15px] font-semibold text-ink">{copy.vacioTitulo}</p>
          <p className="text-[13px] text-muted mt-1.5">{copy.vacioTexto}</p>
        </div>
      )}

      {activos.map((l) => <LoanCard key={l.id} loan={l} kind={kind} onEdit={setEditing} />)}

      {pagados.length > 0 && (
        <>
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted mt-1">
            {copy.saldadosTitulo} ({pagados.length})
          </p>
          {pagados.map((l) => <LoanCard key={l.id} loan={l} kind={kind} onEdit={setEditing} />)}
        </>
      )}

      <button
        onClick={() => { setEditing(null); setAddOpen(true) }}
        className="pressable rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 py-4 text-[13.5px] font-semibold"
        style={{ borderColor: `color-mix(in oklab, ${color} 50%, var(--c-border))`, color }}
      >
        <Plus size={17} /> {copy.nuevo}
      </button>

      <p className="text-[11px] text-muted">{copy.pie}</p>

      <LoanSheet
        open={addOpen || Boolean(editing)}
        loan={editing}
        kind={kind}
        onClose={() => { setAddOpen(false); setEditing(null) }}
      />
    </>
  )
}

/* ─── Tarjeta de un préstamo ────────────────────────────────────────────── */

function LoanCard({ loan, kind, onEdit }: { loan: Loan; kind: LoanKind; onEdit: (l: Loan) => void }) {
  const accounts = useFinanceStore((s) => s.accounts)
  const addLoanPayment = useFinanceStore((s) => s.addLoanPayment)
  const deleteLoanPayment = useFinanceStore((s) => s.deleteLoanPayment)
  const deleteLoanAdvance = useFinanceStore((s) => s.deleteLoanAdvance)
  const deleteLoan = useFinanceStore((s) => s.deleteLoan)
  const animPrefs = useFinanceStore((s) => s.settings.animations)

  const [abono, setAbono] = useState(0)
  const [open, setOpen] = useState(false)
  const [masOpen, setMasOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  // el atrás del celular cierra el detalle antes de salir del submenú
  useBackClose(open, () => setOpen(false))

  const copy = LOAN_COPY[kind]
  const color = tono(kind)
  const meprestaron = kind === 'borrowed'
  const pendiente = loanRemaining(loan)
  const prestado = loanLent(loan)
  const abonado = loanPaid(loan)
  const listo = loanIsSettled(loan)
  const historial = loanHistory(loan)
  const cuenta = accountById(accounts, loan.accountId)

  const registrar = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (abono <= 0) return
    addLoanPayment(loan.id, Math.min(abono, pendiente || abono), 'Abono')
    payBurst(e.currentTarget, animPrefs)
    setAbono(0)
  }

  return (
    <div className={`card p-4 flex flex-col gap-3 ${listo ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-3">
        <ProgressRing progress={loanProgress(loan)} size={48} stroke={6} color={listo ? 'var(--c-income)' : color}>
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
              {meprestaron ? 'Ya le pagaste todo' : 'Te pagó todo'} · {formatMoney(prestado)}
            </span>
          ) : (
            <span className="num block text-[17px] font-bold" style={{ color }}>
              {formatMoney(Math.round(pendiente))}
              <span className="text-[11.5px] text-muted font-normal"> de {formatMoney(prestado)}</span>
            </span>
          )}
          <span className="block text-[11px] text-muted mt-0.5 flex items-center gap-1">
            <CalendarClock size={11} /> {meprestaron ? 'te prestó' : 'le presté'} {sinceLabel(loan.dateISO)}
            {(loan.advances?.length ?? 0) > 0 && <> · {loan.advances?.length} veces más</>}
            {loan.dueDateISO && <> · {meprestaron ? 'quedaste' : 'quedó'} de pagar el {loan.dueDateISO.slice(8, 10)}/{loan.dueDateISO.slice(5, 7)}</>}
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

      {/* Abono rápido + volver a prestar */}
      <div className="flex gap-2">
        <CurrencyInput value={abono} onChange={setAbono} className="flex-1" />
        <button
          onClick={registrar}
          className="pressable rounded-2xl px-3.5 text-[12.5px] font-semibold text-white shrink-0"
          style={{ background: meprestaron ? 'var(--c-danger)' : 'var(--c-income)' }}
        >
          {meprestaron ? 'Le aboné' : 'Me abonó'}
        </button>
        <button
          onClick={() => setMasOpen(true)}
          aria-label={`${copy.masBoton} · ${loan.person}`}
          className="pressable rounded-2xl px-3.5 text-[12.5px] font-semibold shrink-0 border"
          style={{
            borderColor: `color-mix(in oklab, ${color} 45%, var(--c-border))`,
            color,
            background: `color-mix(in oklab, ${color} 10%, transparent)`,
          }}
        >
          {meprestaron ? '+ Me prestó' : '+ Presté'}
        </button>
      </div>

      {open && (
        <div className="anim-fade flex flex-col gap-2">
          {loan.phone && (
            <p className="text-[12px] text-muted flex items-center gap-1.5">
              <Phone size={12} /> {loan.phone}
            </p>
          )}
          {cuenta && (
            <p className="text-[12px] text-muted flex items-center gap-1.5">
              <Wallet size={12} style={{ color: accountColor(cuenta) }} />
              {meprestaron ? 'Entró a' : 'Sale de'} {cuenta.name}
            </p>
          )}
          {loan.note && <p className="text-[12px] text-muted">{loan.note}</p>}

          {/* Historial completo: préstamos y abonos, del más nuevo al viejo */}
          <div className="flex flex-col divide-y divide-[var(--c-border)]">
            <div className="flex items-baseline justify-between pb-1">
              <p className="text-[11px] font-semibold text-muted">
                Historial ({historial.length})
              </p>
              <p className="text-[11px] text-muted">
                {meprestaron ? 'te prestaron' : 'prestado'} <span className="num">{formatMoney(Math.round(prestado))}</span> · abonado{' '}
                <span className="num">{formatMoney(Math.round(abonado))}</span>
              </p>
            </div>
            {historial.map((ev) => {
              const esAbono = ev.tipo === 'abono'
              const inicial = ev.id.startsWith('inicial-')
              // entra plata cuando me abonan (le presté) o cuando me prestan
              const entra = meprestaron ? !esAbono : esAbono
              return (
                <div key={ev.id} className="flex items-center gap-2 py-1.5">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: entra
                        ? 'color-mix(in oklab, var(--c-income) 16%, transparent)'
                        : 'color-mix(in oklab, var(--c-danger) 16%, transparent)',
                      color: entra ? 'var(--c-income)' : 'var(--c-danger)',
                    }}
                  >
                    {entra ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                  </span>
                  <span className="text-[12.5px] text-ink flex-1 truncate">
                    {ev.note || (esAbono ? copy.eventoAbono : copy.eventoPrestamo)}
                  </span>
                  <span className="text-[10.5px] text-muted num">
                    {ev.dateISO.slice(8, 10)}/{ev.dateISO.slice(5, 7)}
                  </span>
                  <span
                    className="num text-[12.5px] font-semibold"
                    style={{ color: entra ? 'var(--c-income)' : 'var(--c-text)' }}
                  >
                    {entra ? '+' : '−'}{formatMoney(ev.amount)}
                  </span>
                  {inicial ? (
                    <span className="w-6 h-6" />
                  ) : (
                    <button
                      onClick={() => (esAbono
                        ? deleteLoanPayment(loan.id, ev.id)
                        : deleteLoanAdvance(loan.id, ev.id))}
                      aria-label={esAbono ? 'Eliminar abono' : 'Eliminar préstamo extra'}
                      className="pressable w-6 h-6 rounded-full flex items-center justify-center text-muted"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={() => setConfirmDel(true)}
            className="pressable btn-ghost w-full flex items-center justify-center gap-2 text-[13px]"
            style={{ color: 'var(--c-danger)' }}
          >
            <Trash2 size={14} /> Eliminar este préstamo
          </button>
        </div>
      )}

      <LendMoreSheet open={masOpen} loan={loan} kind={kind} onClose={() => setMasOpen(false)} />

      <ConfirmDialog
        open={confirmDel}
        title={`¿Eliminar el préstamo de ${loan.person}?`}
        message="Se borra la cuenta, su historial y los movimientos que generó. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => { deleteLoan(loan.id); setConfirmDel(false) }}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  )
}

/* ─── Selector de cuenta compartido ─────────────────────────────────────── */

function AccountPicker({ value, onChange, label }: {
  value: string
  onChange: (id: string) => void
  label: string
}) {
  const accounts = useFinanceStore((s) => s.accounts)
  const activas = activeAccounts(accounts).filter((a) => !isCredit(a))
  if (activas.length === 0) return null

  return (
    <div>
      <label className="text-[12px] font-semibold text-muted">{label}</label>
      <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
        {activas.map((a) => {
          const activo = a.id === value
          const c = accountColor(a)
          return (
            <button
              key={a.id}
              onClick={() => onChange(a.id)}
              className="pressable shrink-0 rounded-2xl border px-3 py-2 flex items-center gap-2"
              style={activo
                ? { borderColor: c, background: `color-mix(in oklab, ${c} 14%, var(--c-elevated))` }
                : { borderColor: 'var(--c-border)', background: 'var(--c-elevated)' }}
            >
              <span style={{ color: activo ? c : 'var(--c-muted)' }}>
                <ItemIcon icon={a.icon} name={a.name} size={15} />
              </span>
              <span className="text-[12.5px] font-medium" style={{ color: activo ? 'var(--c-text)' : 'var(--c-muted)' }}>
                {a.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Otro préstamo con la misma persona ────────────────────────────────── */

function LendMoreSheet({ open, loan, kind, onClose }: {
  open: boolean; loan: Loan; kind: LoanKind; onClose: () => void
}) {
  const meprestaron = kind === 'borrowed'
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={meprestaron ? `${loan.person} te prestó más` : `Prestarle más a ${loan.person}`}
      subtitle={meprestaron
        ? 'Se suma a lo que le debés y entra a la cuenta que elijas'
        : 'Se suma a lo que te debe y sale de la cuenta que elijas'}
    >
      {open && <LendMoreForm key={`mas-${loan.id}`} loan={loan} kind={kind} onDone={onClose} />}
    </BottomSheet>
  )
}

function LendMoreForm({ loan, kind, onDone }: { loan: Loan; kind: LoanKind; onDone: () => void }) {
  const accounts = useFinanceStore((s) => s.accounts)
  const addLoanAdvance = useFinanceStore((s) => s.addLoanAdvance)
  const activas = activeAccounts(accounts).filter((a) => !isCredit(a))
  const principal = activas.find((a) => a.isMain) ?? activas[0]

  const meprestaron = kind === 'borrowed'
  const copy = LOAN_COPY[kind]
  const color = tono(kind)

  const [amount, setAmount] = useState(0)
  const [dateISO, setDateISO] = useState(todayLocalISO())
  const [accountId, setAccountId] = useState(loan.accountId ?? principal?.id ?? '')
  const [note, setNote] = useState('')

  const nuevoTotal = loanLent(loan) + amount
  const nuevoPendiente = loanRemaining(loan) + amount

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div>
        <label className="text-[12px] font-semibold text-muted">
          {meprestaron ? '¿Cuánto más te prestó?' : '¿Cuánto más le prestaste?'}
        </label>
        <CurrencyInput value={amount} onChange={setAmount} className="mt-1.5" autoFocus />
      </div>

      <DateField value={dateISO} onChange={setDateISO} label="¿Qué día?" />

      <AccountPicker value={accountId} onChange={setAccountId} label={copy.cuentaLabel} />

      <div>
        <label className="text-[12px] font-semibold text-muted">Nota (opcional)</label>
        <input
          className="input-base mt-1.5"
          placeholder="Ej. para la matrícula"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {amount > 0 && (
        <div
          className="rounded-xl px-3.5 py-2.5"
          style={{ background: `color-mix(in oklab, ${color} 10%, transparent)` }}
        >
          <p className="text-[11.5px] text-ink leading-snug">
            {meprestaron ? 'Le vas a deber ' : `${loan.person} te va a deber `}
            <span className="num font-bold">{formatMoney(Math.round(nuevoPendiente))}</span>
            {' '}(de <span className="num">{formatMoney(Math.round(nuevoTotal))}</span> en total).
            {meprestaron ? ' Se registra el movimiento y sube tu efectivo.' : ' Se registra el movimiento y baja tu efectivo.'}
          </p>
        </div>
      )}

      <button
        onClick={() => {
          if (amount <= 0) return
          addLoanAdvance(
            loan.id,
            Math.round(amount),
            note.trim() || (meprestaron ? 'Me prestó más' : 'Le presté más'),
            dateISO,
            accountId || undefined,
          )
          onDone()
        }}
        disabled={amount <= 0}
        className="pressable btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <HandCoins size={16} /> Registrar
      </button>
    </div>
  )
}

/* ─── Crear / editar préstamo ───────────────────────────────────────────── */

function LoanSheet({ open, loan, kind, onClose }: {
  open: boolean; loan: Loan | null; kind: LoanKind; onClose: () => void
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={loan ? 'Editar préstamo' : LOAN_COPY[kind].nuevo}
      subtitle={kind === 'borrowed'
        ? 'Llevá el control de lo que debés y de cada abono'
        : 'Llevá el control de lo que te deben y de cada abono'}
    >
      {open && <LoanForm key={loan?.id ?? 'new'} loan={loan} kind={kind} onClose={onClose} />}
    </BottomSheet>
  )
}

function LoanForm({ loan, kind, onClose }: { loan: Loan | null; kind: LoanKind; onClose: () => void }) {
  const accounts = useFinanceStore((s) => s.accounts)
  const addLoan = useFinanceStore((s) => s.addLoan)
  const updateLoan = useFinanceStore((s) => s.updateLoan)
  const activas = activeAccounts(accounts).filter((a) => !isCredit(a))
  const principal = activas.find((a) => a.isMain) ?? activas[0]

  const meprestaron = kind === 'borrowed'
  const copy = LOAN_COPY[kind]

  const [person, setPerson] = useState(() => loan?.person ?? '')
  const [amount, setAmount] = useState(() => loan?.amount ?? 0)
  const [phone, setPhone] = useState(() => loan?.phone ?? '')
  const [dateISO, setDateISO] = useState(() => loan?.dateISO?.slice(0, 10) ?? todayLocalISO())
  const [dueDateISO, setDue] = useState(() => loan?.dueDateISO?.slice(0, 10) ?? '')
  const [conFecha, setConFecha] = useState(() => Boolean(loan?.dueDateISO))
  const [accountId, setAccountId] = useState(() => loan?.accountId ?? principal?.id ?? '')
  const [note, setNote] = useState(() => loan?.note ?? '')
  const [error, setError] = useState('')

  const guardar = () => {
    if (person.trim().length < 2) {
      setError(meprestaron ? 'Escribe quién te prestó.' : 'Escribe a quién le prestaste.')
      return
    }
    if (amount <= 0) {
      setError(meprestaron ? 'Escribe cuánto te prestó.' : 'Escribe cuánto le prestaste.')
      return
    }
    const data = {
      kind,
      person: person.trim(),
      amount: Math.round(amount),
      phone: phone.trim() || undefined,
      dateISO,
      dueDateISO: conFecha && dueDateISO ? dueDateISO : undefined,
      accountId: accountId || undefined,
      note: note.trim() || undefined,
    }
    if (loan) updateLoan(loan.id, data)
    else addLoan(data)
    onClose()
  }

  return (
    <div className="flex flex-col gap-3.5 pb-2">
      <div>
        <label className="text-[12px] font-semibold text-muted block mb-1.5">{copy.personaLabel}</label>
        <input
          className="input-base"
          placeholder="Nombre de la persona"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          autoFocus
        />
      </div>
      <div>
        <label className="text-[12px] font-semibold text-muted block mb-1.5">
          {meprestaron ? '¿Cuánto te prestó?' : '¿Cuánto le prestaste?'}
        </label>
        <CurrencyInput value={amount} onChange={setAmount} />
      </div>

      <DateField
        value={dateISO}
        onChange={setDateISO}
        label={meprestaron ? '¿Desde cuándo le debés?' : '¿Desde cuándo te debe?'}
        maxToday
      />

      {!loan && <AccountPicker value={accountId} onChange={setAccountId} label={copy.cuentaLabel} />}

      {/* Fecha de pago (opcional: los informales casi nunca la tienen) */}
      <div className="rounded-2xl border border-edge bg-elevated p-3">
        <button
          onClick={() => setConFecha((v) => !v)}
          className="pressable w-full flex items-center justify-between text-left"
        >
          <span>
            <span className="block text-[12.5px] font-semibold text-ink">
              {meprestaron ? '¿Quedaste de pagarle un día?' : '¿Quedó de pagarte un día?'}
            </span>
            <span className="block text-[10.5px] text-muted">Opcional, para recordarte</span>
          </span>
          <span
            className="w-10 h-6 rounded-full relative transition-colors shrink-0"
            style={{ background: conFecha ? 'var(--app-accent)' : 'var(--c-border)' }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: conFecha ? 'translateX(16px)' : 'translateX(0)' }}
            />
          </span>
        </button>
        {conFecha && (
          <div className="mt-3 anim-fade">
            <DateField
              value={dueDateISO || todayLocalISO()}
              onChange={setDue}
              title="¿Qué día?"
            />
          </div>
        )}
      </div>

      <div>
        <label className="text-[12px] font-semibold text-muted block mb-1.5">Teléfono (opcional)</label>
        <input className="input-base" type="tel" placeholder="8888-8888" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className="text-[12px] font-semibold text-muted block mb-1.5">Nota (opcional)</label>
        <input className="input-base" placeholder="Ej. para el arreglo del carro" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {error && <p className="text-[13px] anim-shake" style={{ color: 'var(--c-danger)' }}>{error}</p>}

      <button onClick={guardar} className="pressable btn-primary w-full flex items-center justify-center gap-2">
        <HandCoins size={16} /> {loan ? 'Guardar cambios' : 'Registrar el préstamo'}
      </button>

      {!loan && (
        <p className="text-[11px] text-muted text-center">
          {meprestaron
            ? 'Se registra el movimiento y sube tu efectivo real.'
            : 'Se registra el movimiento y baja tu efectivo real.'}
        </p>
      )}
    </div>
  )
}
