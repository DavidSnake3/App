// Un solo lugar donde se arma el contexto de saldos: así todas las vistas
// (inicio, cuentas, tarjetas, mes) usan exactamente los mismos números.
import { useMemo } from 'react'
import type { Account, AppSettings, Debt, Installment, Loan, MonthData } from '../types/finance'
import { useFinanceStore } from '../store/useFinanceStore'
import type { BalanceCtx } from '../lib/accounts'
import {
  accountBalance, activeAccounts, cardStatement, isCredit, mainAccount,
  totalCardDebt, totalCardInterest, totalCash,
} from '../lib/accounts'
import { generalFlow } from '../lib/fund'
import { currentMonthId } from '../lib/dates'

export interface LedgerInput {
  months: Record<string, MonthData>
  accounts: Account[]
  installments: Installment[]
  debts: Debt[]
  loans: Loan[]
  settings: AppSettings
  today?: Date
}

/** Contexto de saldos listo para usar (incluye el flujo de la cuenta principal) */
export function makeLedger(input: LedgerInput): BalanceCtx {
  const { months, accounts, installments, debts, loans, settings } = input
  const today = input.today ?? new Date()
  const principal = mainAccount(accounts)
  const anchor = (principal?.openingISO || '').slice(0, 7)
    || settings.fund?.anchorMonthId
    || currentMonthId()
  return {
    months,
    accounts,
    installments,
    debts,
    settings,
    loans,
    today,
    generalFlow: generalFlow(months, debts, settings, anchor, today, loans, accounts),
  }
}

/** Hook: contexto de saldos memorizado */
export function useLedger(): BalanceCtx {
  const months = useFinanceStore((s) => s.months)
  const accounts = useFinanceStore((s) => s.accounts)
  const installments = useFinanceStore((s) => s.installments)
  const debts = useFinanceStore((s) => s.debts)
  const loans = useFinanceStore((s) => s.loans)
  const settings = useFinanceStore((s) => s.settings)
  return useMemo(
    () => makeLedger({ months, accounts, installments, debts, loans, settings }),
    [months, accounts, installments, debts, loans, settings],
  )
}

export interface MoneySnapshot {
  /** cuentas de efectivo/banco/ahorro que suman al total */
  cash: number
  /** deuda total de las tarjetas */
  cardDebt: number
  /** interés que ya se está cobrando por atrasos */
  cardInterest: number
  /** patrimonio simple: efectivo − deuda de tarjetas */
  net: number
  /** true cuando el usuario ya tiene cuentas creadas */
  hasAccounts: boolean
  /** saldos por cuenta */
  balances: { account: Account; balance: number }[]
  /** tarjetas con su estado de cuenta */
  cards: { account: Account; statement: ReturnType<typeof cardStatement> }[]
  ctx: BalanceCtx
}

/** Hook: resumen del dinero, listo para pintar */
export function useMoney(): MoneySnapshot {
  const ctx = useLedger()
  return useMemo(() => {
    const activas = activeAccounts(ctx.accounts)
    const balances = activas
      .filter((a) => !isCredit(a))
      .map((a) => ({ account: a, balance: accountBalance(a, ctx) }))
    const cards = activas
      .filter(isCredit)
      .map((a) => ({ account: a, statement: cardStatement(a, ctx) }))
    const cash = totalCash(ctx)
    const deuda = totalCardDebt(ctx)
    return {
      cash,
      cardDebt: deuda,
      cardInterest: totalCardInterest(ctx),
      net: Math.round((cash - deuda) * 100) / 100,
      hasAccounts: activas.length > 0,
      balances,
      cards,
      ctx,
    }
  }, [ctx])
}
