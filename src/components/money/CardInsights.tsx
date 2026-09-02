// Lo que hay que saber de una tarjeta de crédito, en claro:
// los tres montos (mínimo, contado, actual), qué parte del mínimo baja la
// deuda, cuánto costaría pagar solo el mínimo y cómo salir más rápido.
import { useState } from 'react'
import {
  AlertTriangle, ChevronDown, GraduationCap, Info, Scale, TrendingDown,
} from 'lucide-react'
import type { Account } from '../../types/finance'
import type { CardStatement } from '../../lib/accounts'
import { fixedPaymentFor, minSettings, payToReachUsage, payoffWithMinimum } from '../../lib/accounts'
import { formatMoney, money2 } from '../../lib/format'
import { useFinanceStore } from '../../store/useFinanceStore'

/** Los tres montos + el desglose del mínimo + la simulación */
export function CardInsights({ account, st, onPay }: {
  account: Account
  st: CardStatement
  onPay: (monto: number) => void
}) {
  const countryId = useFinanceStore((s) => s.settings.payroll.countryId)
  const cfg = minSettings(account, countryId)
  const min = st.minimum
  const sim = payoffWithMinimum(account, st.pending, countryId)
  const [abierto, setAbierto] = useState(false)

  const aCapital = Math.round(min.toCapital * 100)
  const cuota24 = fixedPaymentFor(account, st.pending, 24)
  const sim24Intereses = Math.max(0, money2(cuota24 * 24 - st.pending))
  const ahorro = sim.months == null
    ? Math.max(0, money2(sim.paidAtHorizon + sim.balanceAtHorizon - st.pending - sim24Intereses))
    : Math.max(0, Math.round(sim.interest - sim24Intereses))

  return (
    <>
      {/* Los tres montos, con el de contado como protagonista */}
      <div className="card p-4">
        <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
          <Scale size={12} /> CUÁNTO PAGAR
        </p>

        <button
          onClick={() => onPay(money2(st.pending))}
          className="pressable w-full mt-2.5 rounded-2xl p-3.5 text-left"
          style={{
            background: 'color-mix(in oklab, var(--c-income) 12%, transparent)',
            border: '1px solid color-mix(in oklab, var(--c-income) 45%, var(--c-border))',
          }}
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[12.5px] font-bold text-ink">Pago de contado</span>
            <span className="num text-[20px] font-bold" style={{ color: 'var(--c-income)' }}>
              {formatMoney(st.pending)}
            </span>
          </span>
          <span className="block text-[11px] text-muted mt-0.5 leading-snug">
            Es el único monto que, pagado completo antes del {fechaCorta(st.dueISO)},
            <b> no genera intereses</b>.
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          <button
            onClick={() => onPay(Math.round(cuota24))}
            className="pressable rounded-2xl p-3 text-left border border-edge bg-elevated"
          >
            <span className="block text-[11.5px] font-semibold text-ink">Para salir en 2 años</span>
            <span className="num block text-[15px] font-bold text-ink mt-0.5">{formatMoney(cuota24)}</span>
            <span className="block text-[10px] text-muted mt-0.5">al mes, cuota fija</span>
          </button>
          <button
            onClick={() => onPay(money2(min.total))}
            className="pressable rounded-2xl p-3 text-left border border-edge"
            style={{ background: 'var(--c-card)' }}
          >
            <span className="block text-[11.5px] font-semibold text-muted">Pago mínimo</span>
            <span className="num block text-[15px] font-bold text-muted mt-0.5">{formatMoney(min.total)}</span>
            <span className="block text-[10px] text-muted mt-0.5">solo evita la mora</span>
          </button>
        </div>
      </div>

      {/* Qué parte del mínimo baja la deuda */}
      {min.total > 0 && (
        <div
          className="card p-4"
          style={aCapital < 25
            ? { borderColor: 'color-mix(in oklab, var(--c-warning) 50%, var(--c-border))' }
            : undefined}
        >
          <p className="text-[12px] font-semibold text-muted flex items-center gap-1.5">
            <TrendingDown size={12} /> Si pagas el mínimo de {formatMoney(min.total)}
          </p>

          {/* barra: cuánto baja la deuda vs cuánto es interés y cargos */}
          <div className="h-2.5 rounded-full overflow-hidden mt-2.5 flex">
            <div
              style={{
                width: `${Math.max(2, aCapital)}%`,
                background: 'var(--c-income)',
              }}
            />
            <div className="flex-1" style={{ background: 'var(--c-danger)' }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[11.5px]">
            <span className="text-muted">
              Baja tu deuda:{' '}
              <span className="num font-bold" style={{ color: 'var(--c-income)' }}>
                {formatMoney(min.capital)}
              </span>{' '}
              ({aCapital}%)
            </span>
            <span className="text-muted">
              Se va en intereses:{' '}
              <span className="num font-bold" style={{ color: 'var(--c-danger)' }}>
                {formatMoney(Math.max(0, min.total - min.capital))}
              </span>
            </span>
          </div>

          {/* desglose exacto */}
          <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-edge/60">
            <Fila label={cfg.mode === 'plazo'
              ? `Amortización (saldo ÷ ${cfg.months} meses)`
              : `Amortización (${cfg.pct}% del saldo)`} valor={min.amortization} />
            <Fila label="Intereses del período" valor={min.interest} rojo />
            {min.installments > 0 && <Fila label="Cuotas de compras a plazos" valor={min.installments} />}
            {min.moratory > 0 && <Fila label="Intereses de mora" valor={min.moratory} rojo />}
            {min.fees > 0 && <Fila label="Cargo por cobranza" valor={min.fees} rojo />}
          </div>

          {/* la simulación */}
          <div
            className="mt-3 rounded-xl px-3 py-2.5"
            style={{
              background: sim.perpetual
                ? 'color-mix(in oklab, var(--c-danger) 12%, transparent)'
                : 'color-mix(in oklab, var(--c-warning) 12%, transparent)',
            }}
          >
            {sim.perpetual ? (
              <p className="text-[11.5px] text-ink leading-snug">
                <AlertTriangle size={12} className="inline mr-1" style={{ color: 'var(--c-danger)' }} />
                <b>Pagando solo el mínimo esta deuda no se acaba.</b> En{' '}
                {plazoLabel(sim.horizonMonths)} habrías pagado{' '}
                <span className="num font-bold">{formatMoney(sim.paidAtHorizon)}</span>
                {sim.balanceAtHorizon > 1 && (
                  <> y todavía deberías{' '}
                    <span className="num font-bold" style={{ color: 'var(--c-danger)' }}>
                      {formatMoney(sim.balanceAtHorizon)}
                    </span>
                  </>
                )}.
              </p>
            ) : (
              <p className="text-[11.5px] text-ink leading-snug">
                Pagando solo el mínimo tardarías <b>{plazoLabel(sim.months)}</b> y pagarías{' '}
                <span className="num font-bold" style={{ color: 'var(--c-danger)' }}>
                  {formatMoney(sim.interest)}
                </span>{' '}
                de intereses.
              </p>
            )}
            {ahorro != null && ahorro > 0 && (
              <p className="text-[11.5px] text-ink mt-1.5 leading-snug">
                Con <span className="num font-bold">{formatMoney(cuota24)}</span> al mes sales en 2 años
                y te ahorras <span className="num font-bold" style={{ color: 'var(--c-income)' }}>{formatMoney(ahorro)}</span>.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Utilización del límite, medida al corte */}
      {Boolean(account.credit?.limit) && (
        <div className="card p-4">
          <p className="text-[12px] font-semibold text-muted">Uso de tu límite</p>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-[11.5px] text-muted">Reportado en el corte</span>
            <span
              className="num text-[17px] font-bold"
              style={{ color: st.usageAtCutoff > 0.5 ? 'var(--c-danger)' : st.usageAtCutoff > 0.3 ? 'var(--c-warning)' : 'var(--c-income)' }}
            >
              {Math.round(st.usageAtCutoff * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-elevated overflow-hidden mt-1.5 relative">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(2, Math.round(st.usageAtCutoff * 100))}%`,
                background: st.usageAtCutoff > 0.5
                  ? 'var(--c-danger)'
                  : st.usageAtCutoff > 0.3 ? 'var(--c-warning)' : 'var(--c-income)',
              }}
            />
            {/* marca del 30% recomendado */}
            <div className="absolute top-0 bottom-0" style={{ left: '30%', width: 1.5, background: 'var(--c-text)', opacity: 0.5 }} />
          </div>
          <p className="text-[11px] text-muted mt-1.5 leading-snug">
            Lo recomendado es mantenerlo bajo el 30% (la marca de la barra). Se mide el día del
            corte, así que para bajarlo hay que abonar <b>antes</b> del {fechaCorta(st.cutoffISO)}.
            {st.usageAtCutoff > 0.3 && (
              <> Abonando <span className="num font-semibold text-ink">
                {formatMoney(payToReachUsage(account, st.debt, 0.3))}
              </span> antes del corte, reportarías 30%.</>
            )}
          </p>
        </div>
      )}

      {/* Glosario: lo que hay que saber */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setAbierto(!abierto)}
          className="pressable w-full px-4 py-3.5 flex items-center gap-2.5 text-left"
        >
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in oklab, var(--app-accent) 14%, transparent)', color: 'var(--app-accent-soft)' }}
          >
            <GraduationCap size={16} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13.5px] font-semibold text-ink">Cómo funciona tu tarjeta</span>
            <span className="block text-[11px] text-muted">Corte, contado, mínimo, mora e intereses</span>
          </span>
          <ChevronDown
            size={16}
            className="text-muted shrink-0 transition-transform"
            style={{ transform: abierto ? 'rotate(180deg)' : undefined }}
          />
        </button>

        {abierto && (
          <div className="px-4 pb-4 flex flex-col gap-2.5 anim-fade">
            <Termino
              titulo="Fecha de corte"
              texto={`El día que el banco cierra tu estado de cuenta (el ${account.credit?.cutoffDay ?? '—'} de cada mes). Todo lo que compres después ya cuenta para el mes siguiente.`}
            />
            <Termino
              titulo="Fecha límite de pago"
              texto={`El día ${account.credit?.dueDay ?? '—'}: hasta ahí tienes para pagar lo del corte sin intereses. Ese espacio entre corte y pago es el período de gracia.`}
            />
            <Termino
              titulo="Pago de contado"
              texto="Todo el saldo del corte. Es el único que evita intereses: si lo pagas completo y a tiempo, los intereses del período se reversan."
            />
            <Termino
              titulo="Pago mínimo"
              texto={cfg.mode === 'plazo'
                ? `Lo menos que puedes pagar para no caer en mora. Aquí se calcula como el saldo entre ${cfg.months} meses (el plazo de financiamiento) más los intereses del período, las cuotas y lo que esté en mora. Pagar solo esto es carísimo.`
                : `Lo menos que puedes pagar para no caer en mora: ${cfg.pct}% del saldo más los intereses del período y las cuotas. Pagar solo esto es carísimo.`}
            />
            <Termino
              titulo="Intereses corrientes"
              texto={`Se cobran por día sobre lo que quede financiado, a ${st.monthlyRate.toFixed(2)}% mensual (${(st.monthlyRate * 12).toFixed(2)}% al año). No se capitalizan: no se cobran intereses sobre intereses.`}
            />
            <Termino
              titulo="Mora"
              texto={`Si no pagas al menos el mínimo en la fecha límite entras en mora. La tasa de mora aquí es ${st.moratoryRate.toFixed(2)}% mensual (el corriente más ${cfg.moratoryExtra} puntos) y se cobra sobre la parte de capital que quedó sin pagar, no sobre todo el saldo.`}
            />
            <Termino
              titulo="Cargo por cobranza"
              texto={`Además de la mora, el banco suele cobrar un cargo por gestión de cobro (aquí ${cfg.lateFeePct}% de lo que está en mora${cfg.lateFeeCap > 0 ? `, con tope de ${formatMoney(cfg.lateFeeCap)}` : ''}) a partir del día ${cfg.lateFeeAfterDays} de atraso.`}
            />
            <Termino
              titulo="Retiro de efectivo"
              texto="Sacar efectivo con la tarjeta no tiene período de gracia: cobra comisión y empieza a generar intereses desde el mismo día. Es la forma más cara de usarla."
            />
            <Termino
              titulo="Compras a cuotas"
              texto="Al pago mínimo entra solo la cuota del mes, pero el banco te bloquea del límite el precio completo de la compra desde el primer día."
            />
            <p className="text-[10.5px] text-muted leading-relaxed mt-1">
              Los porcentajes y plazos los pones tú al editar la tarjeta: cada banco tiene los
              suyos y vienen en tu estado de cuenta y en el folleto del producto.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

function Fila({ label, valor, rojo }: { label: string; valor: number; rojo?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
      <span className="text-muted truncate">{label}</span>
      <span
        className="num font-semibold shrink-0"
        style={{ color: rojo ? 'var(--c-danger)' : 'var(--c-text)' }}
      >
        {formatMoney(valor)}
      </span>
    </div>
  )
}

function Termino({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl bg-elevated border border-edge px-3 py-2.5">
      <p className="text-[12px] font-semibold text-ink flex items-center gap-1.5">
        <Info size={11} style={{ color: 'var(--app-accent-soft)' }} /> {titulo}
      </p>
      <p className="text-[11.5px] text-muted mt-1 leading-snug">{texto}</p>
    </div>
  )
}

/** meses si son menos de 2 años; años redondeados si es más (regla del Reg Z) */
function plazoLabel(meses: number | null): string {
  if (meses == null) return 'muchísimos años'
  if (meses < 24) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anios = Math.round(meses / 12)
  return `${anios} años`
}

function fechaCorta(iso: string): string {
  if (!iso) return '—'
  const [, mes, dia] = iso.split('-')
  const nombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${Number(dia)} de ${nombres[Number(mes) - 1] ?? ''}`
}
