// Planes financieros: reglas de reparto del ingreso, con la explicación de
// cada porcentaje. Son métodos conocidos de finanzas personales:
//
// - 50/30/20 — Elizabeth Warren y Amelia Warren Tyagi, "All Your Worth"
//   (2005). Es la regla más usada y la que recomiendan bancos y educadores.
// - 60/20/20, 70/20/10 y 80/20 — variantes populares para ingresos ajustados
//   o para quien prefiere una regla de dos partes ("págate primero").
// - 40/30/20/10 — versión de cuatro sobres que separa la deuda del ahorro.
// - Presupuesto base cero — cada unidad de dinero tiene un destino asignado
//   (popularizado por Zero-Based Budgeting y por YNAB).
import { money2 } from './format'
import type { AppSettings, Debt, MonthData } from '../types/finance'
import { kindTotals } from './fund'

export interface PlanBucket {
  key: string
  label: string
  pct: number
  /** qué entra en esta bolsa, en palabras del usuario */
  desc: string
  /** tipos de la app que caen aquí */
  kinds: ('servicio' | 'gasto' | 'personal' | 'deuda' | 'ahorro')[]
  color: string
}

export interface FinancialPlan {
  id: string
  name: string
  tagline: string
  /** para quién es recomendable */
  bestFor: string
  buckets: PlanBucket[]
  source: string
}

const C_NEED = 'var(--app-accent)'
const C_WANT = 'var(--c-warning)'
const C_SAVE = 'var(--c-income)'
const C_DEBT = 'var(--c-danger)'

export const FINANCIAL_PLANS: FinancialPlan[] = [
  {
    id: '50-30-20',
    name: '50 / 30 / 20',
    tagline: 'El clásico, equilibrado y fácil de mantener',
    bestFor: 'La mayoría de las personas con salario estable',
    source: 'Regla de Elizabeth Warren ("All Your Worth")',
    buckets: [
      {
        key: 'necesidades', label: 'Necesidades', pct: 50, color: C_NEED,
        desc: 'Lo que no podés dejar de pagar: alquiler, luz, agua, internet, comida básica, transporte y las cuotas mínimas de tus deudas.',
        kinds: ['servicio', 'deuda'],
      },
      {
        key: 'gustos', label: 'Gustos', pct: 30, color: C_WANT,
        desc: 'Lo que hace la vida agradable pero podrías recortar: salidas, streaming, ropa, antojos, gimnasio, viajes.',
        kinds: ['gasto', 'personal'],
      },
      {
        key: 'ahorro', label: 'Ahorro y deuda extra', pct: 20, color: C_SAVE,
        desc: 'Tu futuro: fondo de emergencia, metas, inversión y los abonos EXTRA a deudas para salir más rápido.',
        kinds: ['ahorro'],
      },
    ],
  },
  {
    id: '40-30-20-10',
    name: '40 / 30 / 20 / 10',
    tagline: 'Separa la deuda del ahorro en cuatro sobres',
    bestFor: 'Quien tiene deudas y quiere atacarlas sin dejar de ahorrar',
    source: 'Variante de cuatro bolsas de la regla 50/30/20',
    buckets: [
      {
        key: 'necesidades', label: 'Necesidades', pct: 40, color: C_NEED,
        desc: 'Techo, servicios, comida y transporte: lo indispensable del mes.',
        kinds: ['servicio'],
      },
      {
        key: 'gustos', label: 'Gustos', pct: 30, color: C_WANT,
        desc: 'Ocio, antojos y todo lo que podrías recortar si el mes se aprieta.',
        kinds: ['gasto', 'personal'],
      },
      {
        key: 'ahorro', label: 'Ahorro', pct: 20, color: C_SAVE,
        desc: 'Fondo de emergencia y metas: primero te pagás a vos.',
        kinds: ['ahorro'],
      },
      {
        key: 'deuda', label: 'Deudas', pct: 10, color: C_DEBT,
        desc: 'Cuotas y abonos para bajar el saldo de tus deudas.',
        kinds: ['deuda'],
      },
    ],
  },
  {
    id: '60-20-20',
    name: '60 / 20 / 20',
    tagline: 'Cuando el costo de vida se lleva más de la mitad',
    bestFor: 'Ingresos ajustados o alquiler alto',
    source: 'Variante conservadora de la regla 50/30/20',
    buckets: [
      {
        key: 'necesidades', label: 'Necesidades', pct: 60, color: C_NEED,
        desc: 'Todo lo obligatorio: vivienda, servicios, comida, transporte y cuotas mínimas.',
        kinds: ['servicio', 'deuda'],
      },
      {
        key: 'gustos', label: 'Gustos', pct: 20, color: C_WANT,
        desc: 'Lo que disfrutás, con un margen más chico pero real.',
        kinds: ['gasto', 'personal'],
      },
      {
        key: 'ahorro', label: 'Ahorro', pct: 20, color: C_SAVE,
        desc: 'Aunque sea poco, todos los meses: así se construye el colchón.',
        kinds: ['ahorro'],
      },
    ],
  },
  {
    id: '70-20-10',
    name: '70 / 20 / 10',
    tagline: 'Simple: vivir, ahorrar y bajar deuda',
    bestFor: 'Quien quiere pocas reglas y claridad',
    source: 'Regla 70/20/10 de presupuesto personal',
    buckets: [
      {
        key: 'vida', label: 'Gastos de vida', pct: 70, color: C_NEED,
        desc: 'Todo lo que gastás para vivir: obligaciones y gustos juntos, sin separarlos.',
        kinds: ['servicio', 'gasto', 'personal'],
      },
      {
        key: 'ahorro', label: 'Ahorro e inversión', pct: 20, color: C_SAVE,
        desc: 'Emergencias, metas e inversión a largo plazo.',
        kinds: ['ahorro'],
      },
      {
        key: 'deuda', label: 'Deuda o donación', pct: 10, color: C_DEBT,
        desc: 'Abonos extra a deudas; si no tenés deudas, ayuda o donación.',
        kinds: ['deuda'],
      },
    ],
  },
  {
    id: '80-20',
    name: '80 / 20',
    tagline: '"Págate primero": la regla de una sola decisión',
    bestFor: 'Quien odia los presupuestos detallados',
    source: 'Regla "pay yourself first" (80/20)',
    buckets: [
      {
        key: 'vida', label: 'Para vivir', pct: 80, color: C_NEED,
        desc: 'Todo tu mes: obligaciones, gustos y cuotas. Sin subcategorías.',
        kinds: ['servicio', 'gasto', 'personal', 'deuda'],
      },
      {
        key: 'ahorro', label: 'Ahorro', pct: 20, color: C_SAVE,
        desc: 'Se aparta ANTES de gastar, el mismo día que te pagan.',
        kinds: ['ahorro'],
      },
    ],
  },
]

export function financialPlan(id?: string): FinancialPlan | undefined {
  return FINANCIAL_PLANS.find((p) => p.id === id)
}

export interface PlanBucketStatus extends PlanBucket {
  /** meta en dinero según el ingreso */
  target: number
  /** lo que realmente va en esa bolsa este mes */
  actual: number
  /** % real del ingreso */
  actualPct: number
  /** diferencia contra la meta (negativo = te pasaste) */
  diff: number
}

/**
 * Compara tu reparto REAL del mes contra el plan elegido. El ahorro usa lo
 * que apartaste de verdad más lo que te sobró (que también es ahorro).
 */
export function planStatus(
  plan: FinancialPlan,
  month: MonthData,
  debts: Debt[],
  settings: AppSettings,
  savedThisMonth: number,
  custom?: { key: string; pct: number }[],
): { income: number; buckets: PlanBucketStatus[] } {
  const income = month.income.salary + month.income.additional
  const kinds = kindTotals(month, debts)
  const byKind: Record<string, number> = {
    servicio: kinds.find((k) => k.kind === 'servicio')?.total ?? 0,
    gasto: kinds.find((k) => k.kind === 'gasto')?.total ?? 0,
    personal: kinds.find((k) => k.kind === 'personal')?.total ?? 0,
    deuda: kinds.find((k) => k.kind === 'deuda')?.total ?? 0,
    ahorro: savedThisMonth,
  }
  // las deudas que se pagan por planilla no aparecen en el mes: se suman aquí
  const viaPlanilla = settings.payroll.deductions
    .filter((d) => d.debtId)
    .reduce((s, d) => s + d.amount, 0)
  byKind.deuda += viaPlanilla

  const buckets = plan.buckets.map((b): PlanBucketStatus => {
    const pct = custom?.find((c) => c.key === b.key)?.pct ?? b.pct
    const actual = b.kinds.reduce((s, k) => s + (byKind[k] ?? 0), 0)
    const target = Math.round((income * pct) / 100)
    return {
      ...b,
      pct,
      target,
      actual: money2(actual),
      actualPct: income > 0 ? Math.round((actual / income) * 100) : 0,
      diff: money2(target - actual),
    }
  })
  return { income, buckets }
}
