import type { Debt, MonthData, PaymentPlan, PlanStep, UserProfile } from '../types/finance'
import { buildPayables, debtRemaining } from './finance'

/**
 * Planes de pago heurísticos (puntos 6 y 14).
 * El plan "propio" (lo que el usuario ya configuró) es siempre el default;
 * estos generan las alternativas recomendadas.
 */
export function buildHeuristicPlans(
  month: MonthData,
  debts: Debt[],
  profile: UserProfile,
): PaymentPlan[] {
  const items = buildPayables(month, debts)
  const pending = items.filter((i) => !i.paid)
  const payday = profile.payday || 1

  const ownSteps: PlanStep[] = pending.map((i) => ({
    name: i.name,
    amount: i.amount,
    day: i.dueDay ?? payday,
    detail: i.kind === 'deuda' ? `Cuota ${i.debtProgress?.current}/${i.debtProgress?.total}` : undefined,
  }))

  const propio: PaymentPlan = {
    id: 'propio',
    nombre: 'Tu plan',
    descripcion: 'Pagar cada cosa en su fecha de vencimiento, tal como lo configuraste.',
    pasos: ownSteps.sort((a, b) => a.day - b.day),
    ventajas: ['Sin cambios: sigues tu calendario actual', 'Evita recargos pagando en fecha'],
  }

  // Prioridad: servicios y deudas primero, apenas llega el salario
  const prioridad: PaymentPlan = {
    id: 'prioridad',
    nombre: 'Obligaciones primero',
    descripcion: `Apenas recibes tu pago (día ${payday}), liquida servicios obligatorios y cuotas de deuda; deja los gastos variables para después.`,
    pasos: [
      ...pending.filter((i) => i.kind === 'servicio' || i.kind === 'deuda')
        .map((i) => ({ name: i.name, amount: i.amount, day: payday, detail: 'Pagar el día de pago' })),
      ...pending.filter((i) => i.kind === 'gasto')
        .map((i) => ({ name: i.name, amount: i.amount, day: Math.min(payday + 5, 28), detail: 'Después de cubrir lo obligatorio' })),
    ],
    ventajas: [
      'Elimina el riesgo de cortes de servicios',
      'Nunca se te pasa una cuota de deuda',
      'Lo que sobra queda libre de culpa',
    ],
  }

  // Bola de nieve: deuda más pequeña primero (por saldo restante)
  const activeDebts = debts.filter((d) => debtRemaining(d) > 0)
  const nieveOrder = [...activeDebts].sort((a, b) => debtRemaining(a) - debtRemaining(b))
  const nieve: PaymentPlan = {
    id: 'nieve',
    nombre: 'Bola de nieve',
    descripcion: 'Paga primero la deuda con menor saldo para eliminarla rápido y ganar motivación; el resto se paga en su fecha.',
    pasos: [
      ...nieveOrder.map((d, i) => ({
        name: d.name,
        amount: d.monthlyPayment,
        day: i === 0 ? payday : d.dueDay,
        detail: i === 0
          ? `Prioridad #1 · restan ${''}${Math.max(1, Math.ceil(debtRemaining(d) / (d.monthlyPayment || 1)))} cuotas`
          : `Prioridad #${i + 1}`,
      })),
      ...pending.filter((i) => i.kind !== 'deuda')
        .map((i) => ({ name: i.name, amount: i.amount, day: i.dueDay ?? payday })),
    ],
    ventajas: [
      'Victorias rápidas: menos deudas activas pronto',
      'Ideal si necesitas ver progreso para mantenerte',
    ],
    duracionMeses: nieveOrder.length
      ? Math.ceil(debtRemaining(nieveOrder[0]) / (nieveOrder[0].monthlyPayment || 1))
      : undefined,
  }

  return [propio, prioridad, nieve]
}

/** Texto plano con el estado financiero, para dárselo a la IA como contexto */
export function financeSnapshot(month: MonthData, debts: Debt[], profile: UserProfile): string {
  const items = buildPayables(month, debts)
  const income = month.income.salary + month.income.additional
  const lines = [
    `Moneda: ${profile.currency}. Día de pago del salario: ${profile.payday}.`,
    `Ingresos del mes: ${income}.`,
    `Pagos del mes (nombre | monto | día de vencimiento | tipo | pagado):`,
    ...items.map((i) => `- ${i.name} | ${i.amount} | día ${i.dueDay ?? 'sin fecha'} | ${i.kind} | ${i.paid ? 'sí' : 'no'}`),
    `Deudas activas (nombre | saldo restante | cuota mensual | cuotas restantes):`,
    ...debts.filter((d) => debtRemaining(d) > 0).map((d) => {
      const paid = Object.values(d.payments).filter((p) => p.paid).length
      return `- ${d.name} | ${debtRemaining(d)} | ${d.monthlyPayment} | ${d.installments - paid}`
    }),
  ]
  return lines.join('\n')
}
