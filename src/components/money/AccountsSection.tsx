import { useState } from 'react'
import {
  ChevronRight, CreditCard, Eye, EyeOff, Plus, Repeat, Star, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import type { Account } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useMoney } from '../../hooks/useLedger'
import { accountTypeLabel } from '../../lib/accounts'
import { formatMoney } from '../../lib/format'
import { accountColor } from '../../lib/itemColors'
import { AccountFace } from '../ui/AccountFace'
import { AccountSheet } from './AccountSheet'
import { MovementSheet } from './MovementSheet'

/** Cuentas: de aquí sale el efectivo real y la deuda de las tarjetas */
export function AccountsSection() {
  const money = useMoney()
  const setSub = useFinanceStore((s) => s.setSub)
  const [sheet, setSheet] = useState<{ open: boolean; editing: Account | null; balance: number }>({
    open: false, editing: null, balance: 0,
  })
  const [movOpen, setMovOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [oculto, setOculto] = useState(false)

  const abrirNueva = () => setSheet({ open: true, editing: null, balance: 0 })

  return (
    <>
      {/* Total: efectivo real */}
      <div className="card-glow p-4 anim-pop">
        <span className="glow-dot" />
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <button
            onClick={() => setOculto((v) => !v)}
            aria-label={oculto ? 'Mostrar montos' : 'Ocultar montos'}
            className="pressable w-9 h-9 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted"
          >
            {oculto ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button
            onClick={abrirNueva}
            aria-label="Nueva cuenta"
            className="pressable w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{ background: 'var(--app-gradient)' }}
          >
            <Plus size={16} />
          </button>
        </div>
        <span className="orb -right-6 -top-12 w-28 h-28" style={{ background: 'var(--app-gradient)' }} />
        <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
          <Wallet size={12} /> EFECTIVO REAL
        </p>
        <p className="display-money text-[34px] font-bold text-ink mt-1.5 anim-money">
          {oculto ? '••••••' : formatMoney(money.cash)}
        </p>
        <p className="text-[11.5px] text-muted mt-1">
          Lo que de verdad tienes disponible hoy
        </p>

        {money.cardDebt > 0 && (
          <div className="mt-3 pt-3 border-t border-edge/60 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10.5px] text-muted flex items-center gap-1">
                <CreditCard size={10} /> Deuda de tarjetas
              </p>
              <p className="num text-[16px] font-bold" style={{ color: 'var(--c-danger)' }}>
                {oculto ? '•••' : formatMoney(money.cardDebt)}
              </p>
            </div>
            <div>
              <p className="text-[10.5px] text-muted flex items-center gap-1">
                <TrendingUp size={10} /> Te queda neto
              </p>
              <p
                className="num text-[16px] font-bold"
                style={{ color: money.net >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}
              >
                {oculto ? '•••' : formatMoney(money.net)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Cuentas de efectivo */}
      {money.balances.length === 0 ? (
        <div className="card p-6 text-center anim-pop">
          <span
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: 'color-mix(in oklab, var(--app-accent) 14%, transparent)', color: 'var(--app-accent-soft)' }}
          >
            <Wallet size={24} />
          </span>
          <p className="text-[15px] font-semibold text-ink mt-3">Agrega tu primera cuenta</p>
          <p className="text-[12.5px] text-muted mt-1 leading-snug">
            Empieza con el efectivo que traes o la cuenta donde te cae el salario.
            Después puedes agregar tarjetas.
          </p>
          <button onClick={abrirNueva} className="pressable btn-primary w-full mt-4">
            Agregar cuenta
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {money.balances.map(({ account, balance }) => {
            const tono = accountColor(account)
            return (
            <button
              key={account.id}
              onClick={() => setSheet({ open: true, editing: account, balance })}
              className="pressable tile p-3.5 flex items-center gap-3 text-left anim-rise"
              style={{
                background: `linear-gradient(155deg, color-mix(in oklab, ${tono} 11%, var(--c-card)) 0%, var(--c-card) 60%)`,
                borderColor: `color-mix(in oklab, ${tono} 24%, var(--c-border))`,
              }}
            >
              <AccountFace account={account} size={46} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold text-ink truncate">{account.name}</span>
                  {account.isMain && (
                    <Star size={11} style={{ color: 'var(--app-accent-soft)' }} />
                  )}
                </span>
                <span className="block text-[11.5px] text-muted">
                  {accountTypeLabel(account.type)}
                  {!account.includeInTotal && ' · no suma al total'}
                </span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span
                  className="display-money text-[16px] font-bold"
                  style={{ color: balance < 0 ? 'var(--c-danger)' : 'var(--c-text)' }}
                >
                  {oculto ? '•••' : formatMoney(balance)}
                </span>
                <ChevronRight size={14} className="text-muted" />
              </span>
            </button>
            )
          })}
        </div>
      )}

      {/* Tarjetas (resumen; el detalle está en el submenú Tarjetas) */}
      {money.cards.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[11.5px] font-bold uppercase tracking-wider text-muted px-1">
            Tarjetas de crédito
          </p>
          {money.cards.map(({ account, statement }) => {
            const tono = accountColor(account)
            return (
            <button
              key={account.id}
              onClick={() => setSub('money', 'tarjetas')}
              className="pressable tile p-3.5 flex items-center gap-3 text-left anim-rise"
              style={{
                background: `linear-gradient(155deg, color-mix(in oklab, ${tono} 11%, var(--c-card)) 0%, var(--c-card) 60%)`,
                borderColor: statement.overdue
                  ? 'color-mix(in oklab, var(--c-danger) 55%, var(--c-border))'
                  : `color-mix(in oklab, ${tono} 24%, var(--c-border))`,
              }}
            >
              <AccountFace account={account} size={46} />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-ink truncate">{account.name}</span>
                <span className="block text-[11.5px] text-muted">
                  {statement.overdue
                    ? `Venció hace ${Math.abs(statement.daysToDue)} días`
                    : statement.pending > 0
                      ? `Paga en ${statement.daysToDue} ${statement.daysToDue === 1 ? 'día' : 'días'}`
                      : 'Al día'}
                </span>
              </span>
              <span className="text-right shrink-0">
                <span className="num block text-[15.5px] font-bold" style={{ color: 'var(--c-danger)' }}>
                  {oculto ? '•••' : formatMoney(statement.debt)}
                </span>
                {account.credit?.limit ? (
                  <span className="num block text-[10.5px] text-muted">
                    {Math.round(statement.usage * 100)}% del límite
                  </span>
                ) : null}
              </span>
            </button>
            )
          })}
        </div>
      )}

      {/* Acciones */}
      {money.balances.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={abrirNueva}
              className="pressable card px-3 py-3 flex items-center justify-center gap-2 text-[13px] font-semibold text-ink"
            >
              <Plus size={15} /> Nueva cuenta
            </button>
            <button
              onClick={() => setMovOpen(true)}
              className="pressable px-3 py-3 rounded-2xl flex items-center justify-center gap-2 text-[13px] font-semibold text-white"
              style={{ background: 'var(--app-gradient)' }}
            >
              <TrendingDown size={15} /> Registrar
            </button>
          </div>
          {(money.balances.length > 1 || money.cards.length > 0) && (
            <button
              onClick={() => setTransferOpen(true)}
              className="pressable card px-3 py-3 flex items-center justify-center gap-2 text-[13px] font-semibold text-ink"
            >
              <Repeat size={15} /> Mover plata entre cuentas
            </button>
          )}
        </>
      )}

      <AccountSheet
        open={sheet.open}
        onClose={() => setSheet({ open: false, editing: null, balance: 0 })}
        editing={sheet.editing}
        currentBalance={sheet.balance}
      />
      <MovementSheet open={movOpen} onClose={() => setMovOpen(false)} />
      <MovementSheet
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        defaultKind="transferencia"
      />
    </>
  )
}
