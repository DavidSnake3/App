import { ArrowLeftRight, CreditCard, HandCoins, PiggyBank, Wallet } from 'lucide-react'
import type { MoneySub } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useMoney } from '../../hooks/useLedger'
import { monthMovements } from '../../lib/accounts'
import { savingsTotal } from '../../lib/fund'
import { loanRemaining } from '../../lib/loans'
import { formatMoney } from '../../lib/format'
import { HubHeader, HubMenu, HubTitle, type HubItem } from '../layout/HubMenu'
import { AccountsSection } from './AccountsSection'
import { MovementsSection } from './MovementsSection'
import { CardsSection } from './CardsSection'
import { SavingsSection } from '../settings/SavingsSection'
import { LoansView } from '../debts/LoansView'

const TITULOS: Record<MoneySub, { title: string; subtitle: string }> = {
  cuentas: { title: 'Tus cuentas', subtitle: 'Efectivo, banco, ahorros y tarjetas' },
  movimientos: { title: 'Movimientos', subtitle: 'Todo lo que entra y sale, con categoría' },
  tarjetas: { title: 'Tarjetas de crédito', subtitle: 'Corte, pago, intereses y cuotas' },
  ahorros: { title: 'Ahorros', subtitle: 'Tus sobres, metas y aportes' },
  prestamos: { title: 'Le presté', subtitle: 'Lo que te deben y sus abonos' },
}

/** Hub "Dinero": dónde está tu plata y por dónde se mueve */
export function MoneyView() {
  const sub = (useFinanceStore((s) => s.subs.money) ?? '') as MoneySub | ''
  const setSub = useFinanceStore((s) => s.setSub)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const loans = useFinanceStore((s) => s.loans)
  const settings = useFinanceStore((s) => s.settings)
  const money = useMoney()

  const movs = monthMovements(month)
  const porCobrar = loans.reduce((s, l) => s + loanRemaining(l), 0)
  const ahorrado = savingsTotal(settings)

  const items: HubItem<MoneySub>[] = [
    {
      id: 'cuentas',
      title: 'Cuentas',
      desc: 'Efectivo, banco y ahorros',
      icon: <Wallet size={19} />,
      stat: money.balances.length ? formatMoney(Math.round(money.cash)) : 'Crear la primera',
      tone: 'income',
      badge: money.balances.length || undefined,
    },
    {
      id: 'movimientos',
      title: 'Movimientos',
      desc: 'Lo que entra y sale, por categoría',
      icon: <ArrowLeftRight size={19} />,
      stat: movs.length ? `${movs.length} este mes` : 'Anotar el primero',
      tone: 'accent',
    },
    {
      id: 'tarjetas',
      title: 'Tarjetas',
      desc: 'Corte, pago, intereses y cuotas',
      icon: <CreditCard size={19} />,
      stat: money.cards.length ? formatMoney(Math.round(money.cardDebt)) : 'Agregar tarjeta',
      tone: 'danger',
      badge: money.cards.length || undefined,
    },
    {
      id: 'ahorros',
      title: 'Ahorros',
      desc: 'Sobres, metas y aportes',
      icon: <PiggyBank size={19} />,
      stat: ahorrado > 0 ? formatMoney(Math.round(ahorrado)) : 'Crear un sobre',
      tone: 'warning',
    },
    {
      id: 'prestamos',
      title: 'Le presté',
      desc: 'Lo que te deben y sus abonos',
      icon: <HandCoins size={19} />,
      stat: loans.length ? formatMoney(Math.round(porCobrar)) : 'Sin préstamos',
      tone: 'accent',
      badge: loans.length || undefined,
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain" style={{ scrollbarGutter: 'stable' }}>
      <div className="px-4 pb-32 pt-2 flex flex-col gap-4">
        {!sub ? (
          <div className="flex flex-col gap-4 anim-page">
            <HubTitle title="Dinero" subtitle="Dónde está tu plata y por dónde se mueve" />
            <ResumenDinero />
            <HubMenu items={items} onPick={(id) => setSub('money', id)} />
          </div>
        ) : (
          <div key={sub} className="flex flex-col gap-4 anim-page">
            <HubHeader
              title={TITULOS[sub].title}
              subtitle={TITULOS[sub].subtitle}
              onBack={() => setSub('money', '')}
            />
            {sub === 'cuentas' && <AccountsSection />}
            {sub === 'movimientos' && <MovementsSection />}
            {sub === 'tarjetas' && <CardsSection />}
            {sub === 'ahorros' && <SavingsSection />}
            {sub === 'prestamos' && <LoansView />}
          </div>
        )}
      </div>
    </div>
  )
}

/** Cinta de resumen arriba del menú: efectivo, tarjetas y neto */
function ResumenDinero() {
  const money = useMoney()
  if (!money.hasAccounts) return null
  return (
    <div className="card p-4 relative overflow-hidden anim-pop">
      <div
        className="absolute -right-8 -top-10 w-40 h-40 rounded-full opacity-25 blur-2xl pointer-events-none"
        style={{ background: 'var(--app-gradient)' }}
      />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Efectivo real</p>
      <p
        className="num text-[28px] font-bold leading-none mt-1"
        style={{ color: money.cash >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}
      >
        {formatMoney(Math.round(money.cash))}
      </p>
      {money.cardDebt > 0 && (
        <p className="text-[11.5px] text-muted mt-1.5">
          Debes en tarjetas{' '}
          <span className="num font-semibold" style={{ color: 'var(--c-danger)' }}>
            {formatMoney(Math.round(money.cardDebt))}
          </span>
          {' · '}te queda neto{' '}
          <span className="num font-semibold text-ink">{formatMoney(Math.round(money.net))}</span>
        </p>
      )}
    </div>
  )
}
