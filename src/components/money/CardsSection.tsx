import { useState } from 'react'
import {
  AlertTriangle, Banknote, CalendarClock, Check, CreditCard, Percent, Plus, Scissors, TrendingUp,
} from 'lucide-react'
import type { Account, Installment } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { useMoney } from '../../hooks/useLedger'
import {
  installmentNumber, installmentPaidCount, installmentRemaining, interestForecast,
  monthInstallments,
} from '../../lib/accounts'
import { currentMonthId, monthLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { ItemIcon } from '../../lib/icons'
import { CardInsights } from './CardInsights'
import { AccountSheet } from './AccountSheet'
import { InstallmentSheet } from './InstallmentSheet'
import { MovementSheet } from './MovementSheet'

/** Tarjetas de crédito: estado de cuenta, intereses y compras a cuotas */
export function CardsSection() {
  const money = useMoney()
  const installments = useFinanceStore((s) => s.installments)
  const toggleInstallmentPaid = useFinanceStore((s) => s.toggleInstallmentPaid)

  const [nuevaTarjeta, setNuevaTarjeta] = useState(false)
  const [editando, setEditando] = useState<Account | null>(null)
  const [cuotaSheet, setCuotaSheet] = useState<{ open: boolean; editing: Installment | null; accountId?: string }>({
    open: false, editing: null,
  })
  const [pago, setPago] = useState<{ open: boolean; accountId?: string; amount?: number }>({ open: false })
  const [retiro, setRetiro] = useState<{ open: boolean; accountId?: string }>({ open: false })

  const nowId = currentMonthId()

  if (!money.cards.length) {
    return (
      <>
        <div className="card p-6 text-center anim-pop">
          <span
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: 'color-mix(in oklab, var(--c-danger) 13%, transparent)', color: 'var(--c-danger)' }}
          >
            <CreditCard size={24} />
          </span>
          <p className="text-[15px] font-semibold text-ink mt-3">Sin tarjetas registradas</p>
          <p className="text-[12.5px] text-muted mt-1 leading-snug">
            Agrega tu tarjeta con su fecha de corte, fecha de pago e interés. Cada gasto que
            hagas con ella se vuelve deuda y te avisamos antes de que se venza.
          </p>
          <button onClick={() => setNuevaTarjeta(true)} className="pressable btn-primary w-full mt-4">
            Agregar tarjeta
          </button>
        </div>
        <AccountSheet
          open={nuevaTarjeta}
          onClose={() => setNuevaTarjeta(false)}
          defaultType="credito"
        />
      </>
    )
  }

  return (
    <>
      {money.cardInterest > 0 && (
        <div
          className="card p-3.5 flex items-start gap-2.5 anim-pop"
          style={{ borderColor: 'color-mix(in oklab, var(--c-danger) 55%, var(--c-border))' }}
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--c-danger)' }} />
          <div>
            <p className="text-[13px] font-semibold text-ink">
              Te están cobrando {formatMoney(money.cardInterest)} de intereses
            </p>
            <p className="text-[11.5px] text-muted mt-0.5 leading-snug">
              Es por lo que quedó sin pagar después de la fecha límite. Si abonas hoy, deja de crecer.
            </p>
          </div>
        </div>
      )}

      {money.cards.map(({ account, statement: st }) => {
        const cuotas = installments.filter((i) => i.accountId === account.id)
        const cuotasDelMes = monthInstallments(cuotas, nowId).filter((i) => i.accountId === account.id)
        const tasa = st.monthlyRate
        return (
          <div key={account.id} className="flex flex-col gap-2.5">
            {/* Tarjeta visual */}
            <div
              className="rounded-3xl p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, color-mix(in oklab, var(--app-accent) 45%, #111827) 0%, #0f1424 75%)',
                border: '1px solid color-mix(in oklab, var(--app-accent) 35%, var(--c-border))',
                boxShadow: '0 14px 34px rgb(0 0 0 / 0.35)',
              }}
            >
              <div
                className="absolute -right-10 -top-12 w-44 h-44 rounded-full opacity-30 blur-2xl pointer-events-none"
                style={{ background: 'var(--app-gradient)' }}
              />
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => setEditando(account)}
                  className="pressable flex items-center gap-2 text-left"
                >
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgb(255 255 255 / 0.14)', color: '#fff' }}
                  >
                    <ItemIcon icon={account.icon ?? 'tarjeta'} name={account.name} size={16} />
                  </span>
                  <span>
                    <span className="block text-[14.5px] font-bold text-white leading-tight">{account.name}</span>
                    <span className="block text-[10.5px]" style={{ color: 'rgb(255 255 255 / 0.65)' }}>
                      Toca para editar
                    </span>
                  </span>
                </button>
                {tasa > 0 && (
                  <span
                    className="num text-[10.5px] font-bold rounded-full px-2 py-1 flex items-center gap-1"
                    style={{ background: 'rgb(255 255 255 / 0.16)', color: '#fff' }}
                  >
                    <Percent size={9} />{tasa.toFixed(2)}% mes
                  </span>
                )}
              </div>

              <p className="text-[10.5px] mt-3" style={{ color: 'rgb(255 255 255 / 0.7)' }}>DEBES EN TOTAL</p>
              <p className="num text-[27px] font-bold text-white leading-none mt-0.5">
                {formatMoney(st.debt)}
              </p>

              {Boolean(account.credit?.limit) && (
                <>
                  <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: 'rgb(255 255 255 / 0.18)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.round(st.usage * 100)}%`,
                        background: st.usage > 0.8 ? 'var(--c-danger)' : '#fff',
                      }}
                    />
                  </div>
                  <p className="text-[10.5px] mt-1.5 flex items-center justify-between" style={{ color: 'rgb(255 255 255 / 0.75)' }}>
                    <span className="num">{Math.round(st.usage * 100)}% de {formatMoney(account.credit?.limit ?? 0)}</span>
                    <span className="num">Disponible {formatMoney(st.available)}</span>
                  </p>
                </>
              )}
            </div>

            {/* Estado de cuenta */}
            <div
              className="card p-4"
              style={st.overdue
                ? { borderColor: 'color-mix(in oklab, var(--c-danger) 55%, var(--c-border))' }
                : undefined}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10.5px] text-muted flex items-center gap-1">
                    <Scissors size={10} /> ÚLTIMO CORTE
                  </p>
                  <p className="num text-[13.5px] font-semibold text-ink mt-0.5">{fechaCorta(st.cutoffISO)}</p>
                </div>
                <div>
                  <p className="text-[10.5px] text-muted flex items-center gap-1">
                    <CalendarClock size={10} /> FECHA DE PAGO
                  </p>
                  <p
                    className="num text-[13.5px] font-semibold mt-0.5"
                    style={{ color: st.overdue ? 'var(--c-danger)' : 'var(--c-text)' }}
                  >
                    {fechaCorta(st.dueISO)}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-edge/60">
                <div className="flex items-baseline justify-between">
                  <p className="text-[12px] text-muted">Del corte hay que pagar</p>
                  <p className="num text-[17px] font-bold text-ink">{formatMoney(st.statementBalance)}</p>
                </div>
                {st.paidAfterCutoff > 0 && (
                  <div className="flex items-baseline justify-between mt-1">
                    <p className="text-[12px] text-muted">Ya abonaste</p>
                    <p className="num text-[13px] font-semibold" style={{ color: 'var(--c-income)' }}>
                      −{formatMoney(st.paidAfterCutoff)}
                    </p>
                  </div>
                )}
                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-[12px] font-semibold text-ink">
                    {st.pending > 0 ? 'Te falta' : 'Estás al día'}
                  </p>
                  <p
                    className="num text-[17px] font-bold"
                    style={{ color: st.pending > 0 ? 'var(--c-danger)' : 'var(--c-income)' }}
                  >
                    {formatMoney(st.pending)}
                  </p>
                </div>
              </div>

              {/* Interés / aviso */}
              {st.pending <= 0 ? (
                <div
                  className="mt-3 rounded-xl px-3 py-2.5 flex items-start gap-2"
                  style={{ background: 'color-mix(in oklab, var(--c-income) 12%, transparent)' }}
                >
                  <Check size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--c-income)' }} />
                  <p className="text-[11.5px] text-ink leading-snug">
                    Pagaste el corte completo: <b>cero intereses</b>. Así se usa una tarjeta.
                  </p>
                </div>
              ) : st.overdue ? (
                <div
                  className="mt-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'color-mix(in oklab, var(--c-danger) 12%, transparent)' }}
                >
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--c-danger)' }}>
                    Se te pasó la fecha por {Math.abs(st.daysToDue)} {Math.abs(st.daysToDue) === 1 ? 'día' : 'días'}
                  </p>
                  <p className="text-[11.5px] text-ink mt-1 leading-snug">
                    Interés de mora: <span className="num font-bold">{formatMoney(st.interest)}</span>
                    {st.lateFee > 0 && (
                      <> · cargo por cobranza: <span className="num font-bold">{formatMoney(st.lateFee)}</span></>
                    )}
                    . Debes <span className="num font-bold">{formatMoney(st.totalWithInterest)}</span> en total.
                  </p>
                  <p className="text-[11px] text-muted mt-1 leading-snug">
                    La mora se cobra al {st.moratoryRate.toFixed(2)}% mensual sobre el capital que
                    quedó sin pagar, no sobre todo el saldo.
                  </p>
                  {tasa > 0 && (
                    <p className="text-[11px] text-muted mt-1">
                      Si esperas un mes más se suman ≈{' '}
                      <span className="num">{formatMoney(interestForecast(account, st.pending, 1))}</span>.
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="mt-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'color-mix(in oklab, var(--c-warning) 12%, transparent)' }}
                >
                  <p className="text-[11.5px] text-ink leading-snug">
                    Si pagas <span className="num font-bold">{formatMoney(st.pending)}</span> antes del{' '}
                    {fechaCorta(st.dueISO)} <b>no se suman intereses nuevos</b>.
                    {tasa > 0 && (
                      <> Si no pagas, te cobrarían ≈{' '}
                        <span className="num">{formatMoney(st.interestIfUnpaid)}</span> el primer mes.
                      </>
                    )}
                  </p>
                  {st.interest > 0 && (
                    <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: 'var(--c-danger)' }}>
                      Ojo: ya llevas <span className="num font-bold">{formatMoney(st.interest)}</span> de
                      intereses por cortes anteriores sin pagar.
                    </p>
                  )}
                </div>
              )}

              {st.currentCycle > 0 && (
                <p className="text-[11px] text-muted mt-2.5 flex items-center gap-1.5">
                  <TrendingUp size={11} /> Del corte nuevo llevas{' '}
                  <span className="num font-semibold text-ink">{formatMoney(st.currentCycle)}</span>{' '}
                  (se paga el mes siguiente)
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <button
                  onClick={() => setPago({ open: true, accountId: account.id, amount: Math.round(st.pending) })}
                  className="pressable px-3 py-2.5 rounded-xl text-[12.5px] font-semibold text-white"
                  style={{ background: 'var(--app-gradient)' }}
                >
                  Pagar la tarjeta
                </button>
                <button
                  onClick={() => setCuotaSheet({ open: true, editing: null, accountId: account.id })}
                  className="pressable px-3 py-2.5 rounded-xl text-[12.5px] font-semibold"
                  style={{ background: 'var(--c-elevated)', color: 'var(--c-text)' }}
                >
                  Compra a cuotas
                </button>
              </div>
              <button
                onClick={() => setRetiro({ open: true, accountId: account.id })}
                className="pressable w-full mt-2 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-2"
                style={{ background: 'var(--c-elevated)', color: 'var(--c-text)' }}
              >
                <Banknote size={14} /> Retirar efectivo de esta tarjeta
              </button>
            </div>

            {/* Cuánto pagar, qué parte del mínimo baja la deuda y el glosario */}
            <CardInsights
              account={account}
              st={st}
              onPay={(monto) => setPago({ open: true, accountId: account.id, amount: monto })}
            />

            {/* Compras a cuotas de esta tarjeta */}
            {cuotas.length > 0 && (
              <div className="card p-4">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-muted">
                  Compras a cuotas
                </p>
                <div className="flex flex-col gap-2.5 mt-2.5">
                  {cuotas.map((i) => {
                    const n = installmentNumber(i, nowId)
                    const pagadas = installmentPaidCount(i)
                    const activa = n >= 1 && n <= i.count
                    const pagadaEsteMes = Boolean(i.payments[nowId]?.paid)
                    return (
                      <div key={i.id} className="rounded-2xl border border-edge bg-elevated p-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'color-mix(in oklab, var(--app-accent) 14%, transparent)', color: 'var(--app-accent-soft)' }}
                          >
                            <ItemIcon icon={i.icon} name={i.name} size={15} />
                          </span>
                          <button
                            onClick={() => setCuotaSheet({ open: true, editing: i })}
                            className="pressable flex-1 min-w-0 text-left"
                          >
                            <span className="block text-[13.5px] font-semibold text-ink truncate">{i.name}</span>
                            <span className="block text-[11px] text-muted">
                              {activa ? `Cuota ${n} de ${i.count}` : `${pagadas} de ${i.count} pagadas`}
                              {' · '}{formatMoney(i.monthly)} al mes
                            </span>
                          </button>
                          {activa && (
                            <button
                              onClick={() => toggleInstallmentPaid(i.id, nowId)}
                              aria-label={pagadaEsteMes ? 'Marcar sin pagar' : 'Marcar cuota pagada'}
                              className="pressable w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                              style={pagadaEsteMes
                                ? { background: 'color-mix(in oklab, var(--c-income) 18%, transparent)', borderColor: 'var(--c-income)', color: 'var(--c-income)' }
                                : { borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}
                            >
                              <Check size={15} />
                            </button>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full bg-card overflow-hidden mt-2.5">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.round((pagadas / Math.max(1, i.count)) * 100)}%`,
                              background: 'var(--app-gradient)',
                            }}
                          />
                        </div>
                        <p className="text-[10.5px] text-muted mt-1.5">
                          Falta <span className="num">{formatMoney(installmentRemaining(i))}</span>
                          {' · '}termina en {monthLabel(endOf(i))}
                        </p>
                      </div>
                    )
                  })}
                </div>
                {cuotasDelMes.length > 0 && (
                  <p className="text-[11px] text-muted mt-3">
                    Este mes las cuotas suman{' '}
                    <span className="num font-semibold text-ink">
                      {formatMoney(cuotasDelMes.reduce((s, i) => s + i.monthly, 0))}
                    </span>{' '}
                    de la deuda de {account.name}.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      <button
        onClick={() => setNuevaTarjeta(true)}
        className="pressable card px-3 py-3 flex items-center justify-center gap-2 text-[13px] font-semibold text-ink"
      >
        <Plus size={15} /> Agregar otra tarjeta
      </button>

      <AccountSheet open={nuevaTarjeta} onClose={() => setNuevaTarjeta(false)} defaultType="credito" />
      <AccountSheet
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        editing={editando}
        defaultType="credito"
      />
      <InstallmentSheet
        open={cuotaSheet.open}
        onClose={() => setCuotaSheet({ open: false, editing: null })}
        editing={cuotaSheet.editing}
        defaultAccountId={cuotaSheet.accountId}
      />
      <MovementSheet
        open={pago.open}
        onClose={() => setPago({ open: false })}
        defaultKind="transferencia"
        defaultToAccountId={pago.accountId}
        defaultAmount={pago.amount}
        defaultName="Pago de tarjeta"
      />
      <MovementSheet
        open={retiro.open}
        onClose={() => setRetiro({ open: false })}
        defaultKind="transferencia"
        defaultAccountId={retiro.accountId}
        defaultName="Retiro de efectivo"
      />
    </>
  )
}

function endOf(i: Installment): string {
  const [y, m] = i.startMonthId.split('-').map(Number)
  const d = new Date(y, (m - 1) + Math.max(0, i.count - 1), 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** '2026-09-05' → '5 de sep' */
function fechaCorta(iso: string): string {
  if (!iso) return '—'
  const [, mes, dia] = iso.split('-')
  const nombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${Number(dia)} de ${nombres[Number(mes) - 1] ?? ''}`
}
