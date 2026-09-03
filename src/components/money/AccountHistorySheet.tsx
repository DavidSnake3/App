// Historial de UNA cuenta: todo lo que entró y salió de ella, del día más
// nuevo al más viejo. Se abre al tocar la cuenta; editarla queda abajo.
import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Pencil, Settings2 } from 'lucide-react'
import type { Account, Category, Movement } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { allMovements, accountById, movementDelta } from '../../lib/accounts'
import { formatMoney, money2 } from '../../lib/format'
import { dayLabel } from '../../lib/dates'
import { categoryColor, movementIcon } from '../../lib/categories'
import { ItemIcon } from '../../lib/icons'
import { BottomSheet } from '../ui/BottomSheet'
import { AccountFace } from '../ui/AccountFace'
import { MovementSheet } from './MovementSheet'

/** Un movimiento ya resuelto para ESTA cuenta: cuánto le entró o le salió */
interface Fila {
  mv: Movement
  delta: number
  /** la otra punta de una transferencia */
  otra?: string
}

export function AccountHistorySheet({
  account, balance, open, onClose, onEdit,
}: {
  account: Account | null
  balance: number
  open: boolean
  onClose: () => void
  onEdit: () => void
}) {
  return (
    <BottomSheet
      open={open && Boolean(account)}
      onClose={onClose}
      title={account ? account.name : 'Cuenta'}
      subtitle="Todo lo que entró y salió de esta cuenta"
    >
      {account && <Historial account={account} balance={balance} />}
      {account && (
        <button onClick={onEdit} className="pressable btn-ghost w-full mt-3 flex items-center justify-center gap-2">
          <Settings2 size={15} /> Editar cuenta
        </button>
      )}
    </BottomSheet>
  )
}

function Historial({ account, balance }: { account: Account; balance: number }) {
  const months = useFinanceStore((s) => s.months)
  const accounts = useFinanceStore((s) => s.accounts)
  const cats = useFinanceStore((s) => s.settings.categories)
  const [editando, setEditando] = useState<Movement | null>(null)

  // solo lo que de verdad tocó esta cuenta, con su signo ya resuelto
  const filas = useMemo<Fila[]>(() => {
    const out: Fila[] = []
    for (const mv of allMovements(months)) {
      const delta = movementDelta(mv, account.id, accounts)
      if (delta === 0 && mv.accountId !== account.id && mv.toAccountId !== account.id) continue
      const otroId = mv.accountId === account.id ? mv.toAccountId : mv.accountId
      out.push({ mv, delta, otra: accountById(accounts, otroId)?.name })
    }
    return out
  }, [months, accounts, account.id])

  const entro = money2(filas.filter((f) => f.delta > 0).reduce((s, f) => s + f.delta, 0))
  const salio = money2(filas.filter((f) => f.delta < 0).reduce((s, f) => s - f.delta, 0))

  // agrupado por día, del más nuevo al más viejo
  const porDia = useMemo(() => {
    const mapa = new Map<string, Fila[]>()
    for (const f of filas) {
      const dia = f.mv.dateISO.slice(0, 10)
      const lista = mapa.get(dia)
      if (lista) lista.push(f)
      else mapa.set(dia, [f])
    }
    return [...mapa.entries()]
  }, [filas])

  return (
    <div className="flex flex-col gap-3.5 pb-1">
      {/* Saldo de la cuenta */}
      <div className="card-soft p-3.5 flex items-center gap-3">
        <AccountFace account={account} size={46} />
        <div className="flex-1 min-w-0">
          <p className="text-[11.5px] text-muted">Saldo de hoy</p>
          <p
            className="display-money text-[22px] font-bold leading-tight"
            style={{ color: balance < 0 ? 'var(--c-danger)' : 'var(--c-text)' }}
          >
            {formatMoney(balance)}
          </p>
        </div>
      </div>

      {/* Entró y salió */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="card-soft p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <ArrowDownLeft size={12} style={{ color: 'var(--c-income)' }} /> Entró
          </p>
          <p className="display-money text-[16px] font-bold mt-0.5" style={{ color: 'var(--c-income)' }}>
            {formatMoney(entro)}
          </p>
        </div>
        <div className="card-soft p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <ArrowUpRight size={12} style={{ color: 'var(--c-danger)' }} /> Salió
          </p>
          <p className="display-money text-[16px] font-bold mt-0.5" style={{ color: 'var(--c-danger)' }}>
            {formatMoney(salio)}
          </p>
        </div>
      </div>

      {/* El historial */}
      {porDia.length === 0 ? (
        <p className="text-[12.5px] text-muted text-center py-6 leading-snug">
          Todavía no hay movimientos en esta cuenta.<br />
          Los pagos que marqués y lo que anotés aparecerá aquí.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-muted">
            Movimientos <span className="font-normal">· tocá uno para editarlo</span>
          </p>
          {porDia.map(([dia, lista]) => (
            <div key={dia}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                {dayLabel(dia)}
              </p>
              <div className="card overflow-hidden divide-y divide-[var(--c-border)]">
                {lista.map((f) => (
                  <FilaMov key={f.mv.id} fila={f} cats={cats} onEdit={() => setEditando(f.mv)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <MovementSheet open={Boolean(editando)} editing={editando} onClose={() => setEditando(null)} />
    </div>
  )
}

function FilaMov({ fila, cats, onEdit }: { fila: Fila; cats?: Category[]; onEdit: () => void }) {
  const { mv, delta, otra } = fila
  const entra = delta > 0
  const tono = mv.kind === 'transferencia'
    ? 'var(--app-accent)'
    : entra ? 'var(--c-income)' : categoryColor(mv.categoryId, cats)

  return (
    <button onClick={onEdit} className="pressable w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left">
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in oklab, ${tono} 14%, transparent)`, color: tono }}
      >
        {mv.kind === 'transferencia'
          ? <ArrowLeftRight size={15} />
          : <ItemIcon icon={movementIcon(mv, cats)} name={mv.name} size={15} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-ink truncate">{mv.name}</span>
        <span className="block text-[11px] text-muted truncate">
          {mv.kind === 'transferencia' && otra
            ? (entra ? `Desde ${otra}` : `Hacia ${otra}`)
            : mv.note || (entra ? 'Entró' : 'Salió')}
        </span>
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span
          className="display-money text-[14px] font-bold"
          style={{ color: entra ? 'var(--c-income)' : 'var(--c-text)' }}
        >
          {entra ? '+' : '−'}{formatMoney(Math.abs(delta))}
        </span>
        <Pencil size={11} className="text-muted" />
      </span>
    </button>
  )
}
