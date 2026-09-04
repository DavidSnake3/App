// Tarjeta de Balance del mes + desglose financiero detallado (mejoras 3, 4,
// 14, 17, 18, 19). Todo se puede ver en semanal, quincenal o mensual.
import { useMemo, useState } from 'react'
import {
  ArrowLeftRight, ChevronRight, CreditCard, Heart, Landmark, Pencil, PiggyBank,
  Receipt, ShieldCheck, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import type { PayPeriod } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { getMonthSummary } from '../../lib/finance'
import {
  carryOver, depositsInMonth, envelopeTotal, kindTotals, outOfBalance, paymentMovementIds,
  prevMonthLeftover, realBalance, receivedInMonth, savingsTotal,
} from '../../lib/fund'
import { cashMovementsNet, movementsExpense, movementsIncome } from '../../lib/accounts'
import { PERIOD_LABEL, PERIOD_UNIT, convertPeriod } from '../../lib/payroll'
import { isCurrentMonth, monthLabel } from '../../lib/dates'
import { formatMoney, formatSecond, money2 } from '../../lib/format'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'

const KIND_ICON = {
  servicio: <ShieldCheck size={13} />,
  gasto: <Receipt size={13} />,
  personal: <Heart size={13} />,
  deuda: <CreditCard size={13} />,
} as const

const KIND_COLOR = {
  servicio: 'var(--app-accent)',
  gasto: 'var(--c-warning)',
  personal: '#ec4899',
  deuda: 'var(--c-danger)',
} as const

/** Selector de período: la vista financiera flexible de la app (mejora 19) */
function PeriodTabs({ value, onChange }: { value: PayPeriod; onChange: (p: PayPeriod) => void }) {
  return (
    <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-elevated/70 border border-edge/60 p-0.5 shrink-0">
      {(['weekly', 'biweekly', 'monthly'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className="pressable text-[10px] font-semibold rounded-md px-2 py-1 transition-colors"
          style={value === p ? { background: 'var(--app-accent)', color: '#fff' } : { color: 'var(--c-muted)' }}
        >
          {PERIOD_LABEL[p]}
        </button>
      ))}
    </div>
  )
}

/** Datos del mes, ya convertidos al período de vista elegido */
function useBalanceData(view: PayPeriod) {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const months = useFinanceStore((s) => s.months)
  const debts = useFinanceStore((s) => s.debts)
  const settings = useFinanceStore((s) => s.settings)
  const accounts = useFinanceStore((s) => s.accounts)
  const installments = useFinanceStore((s) => s.installments)
  const loans = useFinanceStore((s) => s.loans)
  const budgets = useFinanceStore((s) => s.budgets)

  return useMemo(() => {
    if (!month) return null
    const s0 = getMonthSummary(month, debts)
    const kinds = kindTotals(month, debts)
    const deudas = kinds.find((k) => k.kind === 'deuda')?.total ?? 0
    const otros = kinds.filter((k) => k.kind !== 'deuda').reduce((t, k) => t + k.total, 0)
    /*
     * Movimientos del mes (antes "gastos hormiga"). Los que nacieron de marcar
     * un pago quedan FUERA: ese pago ya está contado en `totalExpenses` y
     * sumarlo otra vez restaba la misma plata dos veces, dejando el balance
     * mucho más negativo de lo real.
     */
    const dePagos = paymentMovementIds(month, debts)
    // lo que el usuario marcó como "no cuenta en el balance" se queda fuera
    const fuera = outOfBalance(month, budgets)
    const sinBalance = new Set([...dePagos, ...fuera.movimientos])
    const movSalidas = movementsExpense(month, sinBalance)
    const movEntradas = movementsIncome(month, sinBalance)
    const movNeto = -cashMovementsNet(month, accounts, sinBalance)
    const ahorroMes = depositsInMonth(settings, monthId)
    const prevLeft = prevMonthLeftover(months, debts, settings, monthId, loans, accounts)
    const saldo = isCurrentMonth(monthId)
      ? realBalance(months, debts, settings, new Date(), loans, accounts, installments)
      : null
    const v = (n: number) => convertPeriod(n, 'monthly', view)
    // los pagos excluidos no inflan ni el total ni el balance
    const s = {
      ...s0,
      totalExpenses: money2(s0.totalExpenses - fuera.pagos),
      savings: money2(s0.savings + fuera.pagos),
    }
    return {
      monthId, month, settings, debts, months, kinds, saldo, v,
      raw: { ...s, deudas, otros, movSalidas, movEntradas, movNeto, ahorroMes, prevLeft },
      view: {
        salario: v(month.income.salary),
        adicional: v(month.income.additional),
        deudas: v(deudas),
        otros: v(otros),
        movSalidas: v(movSalidas),
        movEntradas: v(movEntradas),
        sobrante: v(month.income.salary - deudas),
        balance: v(s.savings - movNeto),
        prevLeft: v(prevLeft),
      },
    }
  }, [month, months, debts, settings, monthId, view, accounts, installments, loans, budgets])
}

export function BalanceCard({ compact = false }: { compact?: boolean }) {
  const viewPeriod = useFinanceStore((s) => s.settings.payroll.viewPeriod)
  const setPayroll = useFinanceStore((s) => s.setPayroll)
  const [open, setOpen] = useState(false)
  const d = useBalanceData(viewPeriod)
  if (!d) return null

  const { view, raw, saldo } = d
  const positivo = view.balance >= 0

  return (
    <>
      <div className="card-glow p-4">
        <span className="glow-dot" />
        <span className="orb -right-6 -top-12 w-32 h-32" style={{ background: 'var(--app-gradient)' }} />

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Balance {PERIOD_LABEL[viewPeriod].toLowerCase()}
            </p>
            <p
              className="display-money text-[30px] font-bold mt-1.5 anim-money"
              style={{ color: positivo ? 'var(--c-income)' : 'var(--c-danger)' }}
            >
              {formatMoney(money2(view.balance))}
            </p>
            {formatSecond(money2(view.balance)) && (
              <p className="text-[11px] text-muted num mt-0.5">≈ {formatSecond(money2(view.balance))}</p>
            )}
          </div>
          <PeriodTabs value={viewPeriod} onChange={(p) => setPayroll({ viewPeriod: p })} />
        </div>

        {/* El cálculo en el orden pedido: deudas, salario, sobrante, anterior */}
        {!compact && (
        <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-edge/60">
          <Row label="Total deudas" value={-view.deudas} icon={<CreditCard size={12} />} />
          <Row label="Salario neto" value={view.salario} icon={<Wallet size={12} />} positive />
          <div
            className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg"
            style={{ background: 'color-mix(in oklab, var(--app-accent) 10%, transparent)' }}
          >
            <span className="text-[12.5px] font-bold text-ink">Sobrante tras deudas</span>
            <span
              className="num text-[14.5px] font-bold"
              style={{ color: view.sobrante >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}
            >
              {formatMoney(Math.round(view.sobrante))}
            </span>
          </div>
          {Math.abs(raw.prevLeft) >= 1 && (
            <Row
              label="Sobrante del mes anterior"
              value={view.prevLeft}
              icon={<TrendingUp size={12} />}
              positive={view.prevLeft >= 0}
            />
          )}
          {view.adicional > 0 && (
            <Row label="Ingresos adicionales" value={view.adicional} icon={<TrendingUp size={12} />} positive />
          )}
          {view.otros > 0 && (
            <Row label="Servicios, gastos y personales" value={-view.otros} icon={<Receipt size={12} />} />
          )}
          {view.movSalidas > 0 && (
            <Row label="Movimientos" value={-view.movSalidas} icon={<ArrowLeftRight size={12} />} />
          )}
        </div>
        )}

        {saldo != null && (
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-edge/60">
            <span className="text-[12px] text-muted flex items-center gap-1.5">
              <Landmark size={12} style={{ color: 'var(--c-income)' }} /> Saldo real en el banco
            </span>
            <span
              className="num text-[15px] font-bold"
              style={{ color: saldo >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}
            >
              {formatMoney(money2(saldo))}
            </span>
          </div>
        )}

        <div className="h-2 rounded-full bg-elevated overflow-hidden mt-3">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.round(raw.progress * 100)}%`, background: 'var(--app-gradient)' }}
          />
        </div>

        <button
          onClick={() => setOpen(true)}
          className="pressable w-full flex items-center justify-between mt-2.5 text-[12px]"
        >
          <span className="text-muted">
            <span className="num font-semibold text-ink">{raw.countPaid}/{raw.countTotal}</span> pagados
          </span>
          <span className="font-semibold flex items-center gap-0.5" style={{ color: 'var(--app-accent-soft)' }}>
            {compact ? 'Ver mi plan del mes' : 'Ver desglose completo'} <ChevronRight size={13} />
          </span>
        </button>
      </div>

      <BalanceDetailSheet open={open} onClose={() => setOpen(false)} view={viewPeriod} />
    </>
  )
}

function Row({ label, value, icon, positive }: {
  label: string; value: number; icon?: React.ReactNode; positive?: boolean
}) {
  const neg = value < 0
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="text-muted flex items-center gap-1.5 truncate pr-2">{icon}{label}</span>
      <span
        className="num font-semibold shrink-0"
        style={{ color: neg ? 'var(--c-danger)' : positive ? 'var(--c-income)' : 'var(--c-text)' }}
      >
        {neg ? '−' : positive ? '+' : ''}{formatMoney(Math.abs(Math.round(value)))}
      </span>
    </div>
  )
}

/* ─── Desglose financiero completo (mejoras 3 y 17) ────────────────────────── */

function BalanceDetailSheet({ open, onClose, view }: { open: boolean; onClose: () => void; view: PayPeriod }) {
  const d = useBalanceData(view)
  if (!open || !d) return null

  const { kinds, raw, saldo, settings, monthId, month, months, debts, v } = d
  const disponible = raw.totalIncome + raw.prevLeft
  const salidas = raw.totalExpenses + raw.movSalidas + raw.ahorroMes
  const comprometido = disponible > 0 ? Math.min(100, Math.round((salidas / disponible) * 100)) : 0
  const balance = raw.savings - raw.movNeto
  const envelopes = settings.savings.envelopes ?? []
  const ahorrado = savingsTotal(settings)
  const recibido = receivedInMonth(month, settings)
  const arrastre = carryOver(months, debts, settings)
  const salarioSolo = month.income.salary

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Desglose de ${monthLabel(monthId)}`}
      subtitle={`Montos ${PERIOD_UNIT[view]}`}
    >
      <div className="flex flex-col gap-3 pb-2">

        {/* Resultado grande */}
        <div
          className="rounded-2xl p-4 text-center"
          style={{ background: `color-mix(in oklab, ${balance >= 0 ? 'var(--c-income)' : 'var(--c-danger)'} 12%, transparent)` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Balance {PERIOD_LABEL[view].toLowerCase()}</p>
          <p
            className="num text-[31px] font-bold leading-none mt-1.5"
            style={{ color: balance >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}
          >
            {formatMoney(Math.round(v(balance)))}
          </p>
          {formatSecond(Math.round(v(balance))) && (
            <p className="text-[11.5px] text-muted num mt-1">≈ {formatSecond(Math.round(v(balance)))}</p>
          )}
          <p className="text-[11.5px] text-muted mt-2">
            Tienes comprometido el <span className="num font-bold text-ink">{comprometido}%</span> de lo que entra
          </p>
          <div className="h-1.5 rounded-full bg-elevated overflow-hidden mt-1.5">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${comprometido}%`,
                background: comprometido > 90 ? 'var(--c-danger)' : comprometido > 70 ? 'var(--c-warning)' : 'var(--c-income)',
              }}
            />
          </div>
        </div>

        {/* Lo que entra */}
        <Block title="Lo que entra" icon={<TrendingUp size={13} />} color="var(--c-income)">
          <DetailRow label="Salario neto" value={v(salarioSolo)} hint="Se configura en Ajustes → Ingresos" />
          <AdditionalRow monthId={monthId} amount={month.income.additional} shown={v(month.income.additional)} />
          {Math.abs(raw.prevLeft) >= 1 && (
            <DetailRow label="Sobrante del mes anterior" value={v(raw.prevLeft)} hint="Lo que no gastaste el mes pasado" />
          )}
          <DetailRow label="Total disponible" value={v(disponible)} strong color="var(--c-income)" />
        </Block>

        {/* Lo que sale, con subtotales por tipo */}
        <Block title="Lo que sale" icon={<TrendingDown size={13} />} color="var(--c-danger)">
          {kinds.filter((k) => k.count > 0).map((k) => (
            <div
              key={k.kind}
              className="flex flex-col gap-0.5 py-1.5 border-b border-dashed"
              style={{ borderColor: 'var(--c-border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-ink flex items-center gap-1.5">
                  <span style={{ color: KIND_COLOR[k.kind] }}>{KIND_ICON[k.kind]}</span>
                  {k.label}
                  <span className="text-[10px] text-muted">({k.count})</span>
                </span>
                <span className="num text-[13px] font-bold text-ink">{formatMoney(Math.round(v(k.total)))}</span>
              </div>
              <div className="flex items-center justify-between text-[10.5px] text-muted pl-5">
                <span>Pagado {formatMoney(Math.round(v(k.paid)))} · {k.countPaid}/{k.count}</span>
                <span style={{ color: k.pending > 0 ? 'var(--c-warning)' : 'var(--c-income)' }}>
                  {k.pending > 0 ? `Falta ${formatMoney(Math.round(v(k.pending)))}` : 'Al día'}
                </span>
              </div>
            </div>
          ))}
          {raw.movSalidas > 0 && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[12.5px] text-ink flex items-center gap-1.5">
                <ArrowLeftRight size={13} style={{ color: 'var(--c-warning)' }} /> Movimientos
              </span>
              <span className="num text-[13px] font-bold text-ink">{formatMoney(Math.round(v(raw.movSalidas)))}</span>
            </div>
          )}
          {raw.ahorroMes > 0 && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[12.5px] text-ink flex items-center gap-1.5">
                <PiggyBank size={13} style={{ color: 'var(--c-income)' }} /> Apartado al ahorro
              </span>
              <span className="num text-[13px] font-bold text-ink">{formatMoney(Math.round(v(raw.ahorroMes)))}</span>
            </div>
          )}
          <DetailRow label="Total de salidas" value={v(salidas)} strong color="var(--c-danger)" />
        </Block>

        {/* Tu dinero hoy */}
        {saldo != null && (
          <Block title="Tu dinero hoy" icon={<Landmark size={13} />} color="var(--c-income)">
            <DetailRow label="Recibido este mes" value={v(recibido)} />
            <DetailRow label="Pagado" value={-v(raw.paidAmount)} />
            {raw.movSalidas > 0 && <DetailRow label="Movimientos del mes" value={-v(raw.movSalidas)} />}
            {raw.movEntradas > 0 && <DetailRow label="Ingresos extra" value={v(raw.movEntradas)} />}
            {raw.ahorroMes > 0 && <DetailRow label="Apartado al ahorro" value={-v(raw.ahorroMes)} />}
            {Math.abs(arrastre) >= 1 && <DetailRow label="Sobrante arrastrado" value={v(arrastre)} />}
            <DetailRow
              label="Saldo real en el banco"
              value={saldo}
              strong
              color={saldo >= 0 ? 'var(--c-income)' : 'var(--c-danger)'}
            />
          </Block>
        )}

        {/* Ahorros por sobres */}
        {(envelopes.length > 0 || ahorrado > 0) && (
          <Block title="Tus ahorros" icon={<PiggyBank size={13} />} color="var(--app-accent-soft)">
            {envelopes.map((e) => {
              const t = envelopeTotal(e)
              const pct = e.goal > 0 ? Math.min(100, Math.round((t / e.goal) * 100)) : 0
              return (
                <div key={e.id} className="py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] text-ink truncate pr-2">{e.name}</span>
                    <span className="num text-[13px] font-bold text-ink shrink-0">
                      {formatMoney(Math.round(t))}
                      {e.goal > 0 && <span className="text-[10.5px] text-muted"> / {formatMoney(e.goal)}</span>}
                    </span>
                  </div>
                  {e.goal > 0 && (
                    <div className="h-1.5 rounded-full bg-elevated overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--c-income), var(--app-accent))' }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
            <DetailRow label="Ahorro total" value={ahorrado} strong color="var(--app-accent-soft)" />
          </Block>
        )}

        <p className="text-[10.5px] text-muted text-center">
          El ahorro se guarda aparte: no cuenta como saldo disponible del mes.
        </p>
      </div>
    </BottomSheet>
  )
}

function Block({ title, icon, color, children }: {
  title: string; icon: React.ReactNode; color: string; children: React.ReactNode
}) {
  return (
    <div className="card p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color }}>
        {icon} {title}
      </p>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

function DetailRow({ label, value, strong, color, hint }: {
  label: string; value: number; strong?: boolean; color?: string; hint?: string
}) {
  return (
    <div
      className={strong ? 'flex flex-col mt-1.5 pt-1.5 border-t' : 'flex flex-col py-0.5'}
      style={strong ? { borderColor: 'var(--c-border)' } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className={strong ? 'text-[12.5px] font-bold text-ink' : 'text-[12.5px] text-muted'}>{label}</span>
        <span
          className={`num shrink-0 ${strong ? 'text-[15px] font-bold' : 'text-[12.5px] font-semibold'}`}
          style={{ color: color ?? (value < 0 ? 'var(--c-danger)' : 'var(--c-text)') }}
        >
          {value < 0 ? '−' : ''}{formatMoney(Math.abs(Math.round(value)))}
        </span>
      </div>
      {hint && <span className="text-[10.5px] text-muted">{hint}</span>}
    </div>
  )
}

/** Ingresos adicionales del mes: editables desde el desglose */
function AdditionalRow({ monthId, amount, shown }: { monthId: string; amount: number; shown: number }) {
  const updateIncome = useFinanceStore((st) => st.updateIncome)
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-[12.5px] text-muted flex-1">Ingresos adicionales</span>
        <CurrencyInput
          value={amount}
          onChange={(val) => updateIncome(monthId, { additional: val })}
          className="w-32 [&_input]:!py-1 [&_input]:!text-[13px]"
          autoFocus
        />
        <button
          onClick={() => setEditing(false)}
          className="pressable text-[11.5px] font-semibold shrink-0"
          style={{ color: 'var(--app-accent-soft)' }}
        >
          Listo
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="pressable flex items-center justify-between py-0.5 w-full">
      <span className="text-[12.5px] text-muted flex items-center gap-1">
        Ingresos adicionales <Pencil size={10} />
      </span>
      <span className="num text-[12.5px] font-semibold text-ink">{formatMoney(Math.round(shown))}</span>
    </button>
  )
}
