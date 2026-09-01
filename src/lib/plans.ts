// Planes de Snake (solo afectan al chatbot): capacidad de mensajes, tokens,
// memoria, modelo y profundidad de pensamiento.
//
// El precio base está en dólares y se convierte a la moneda del usuario con el
// tipo de cambio real (lib/rates.ts). Costa Rica tiene precio ancla en colones.
// Los pagos AÚN NO están habilitados: los planes se muestran, no se venden.
import type { RatesSnapshot } from './rates'
import { rateBetween } from './rates'
import { formatMoney } from './format'

export type PlanId = 'gratis' | 'plus' | 'premium'

export interface PlanLimits {
  /** mensajes por día */
  msgsPerDay: number
  /** tokens por día (entrada + salida, medidos de verdad) */
  tokensPerDay: number
  /** cuántos mensajes del historial recuerda Snake */
  context: number
  /** adjuntos (facturas) por día */
  attachmentsPerDay: number
  /** largo máximo de la respuesta */
  maxTokens: number
  /** presupuesto de razonamiento: 0 = respuestas rápidas */
  thinking: number
  /** modelo preferido */
  model: string
  /** puede ejecutar todas las acciones (no solo las básicas) */
  allActions: boolean
  /** reporte financiero escrito por la IA */
  aiReport: boolean
}

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  /** precio mensual en dólares (0 = gratis) */
  usdMonth: number
  /** precio anual en dólares (2 meses gratis) */
  usdYear: number
  /** precio ancla en colones (Costa Rica) */
  crcMonth: number
  crcYear: number
  limits: PlanLimits
  /** lo que se muestra en la tarjeta */
  perks: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'gratis',
    name: 'Gratis',
    tagline: 'Todo el control de tu plata, con Snake incluido',
    usdMonth: 0,
    usdYear: 0,
    crcMonth: 0,
    crcYear: 0,
    limits: {
      msgsPerDay: 8,
      tokensPerDay: 40_000,
      context: 6,
      attachmentsPerDay: 2,
      maxTokens: 1024,
      thinking: 0,
      model: 'gemini-flash-lite-latest',
      allActions: false,
      aiReport: false,
    },
    perks: [
      '8 mensajes con Snake al día',
      'Recuerda los últimos 6 mensajes',
      '2 facturas al día (foto o PDF)',
      'Acciones básicas: gastos, deudas y marcar pagos',
      'Toda la app sin límites: meses, deudas, ahorros, reportes',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'Snake con memoria larga y sin quedarte corto',
    usdMonth: 2.99,
    usdYear: 29.99,
    crcMonth: 1500,
    crcYear: 15000,
    limits: {
      msgsPerDay: 25,
      tokensPerDay: 250_000,
      context: 14,
      attachmentsPerDay: 15,
      maxTokens: 2048,
      thinking: 1024,
      model: 'gemini-flash-latest',
      allActions: true,
      aiReport: true,
    },
    perks: [
      '25 mensajes al día (3 veces más)',
      'Recuerda 14 mensajes: conversaciones de verdad',
      '15 facturas al día',
      'Respuestas más largas y mejor pensadas',
      'TODAS las acciones: planilla, ahorros, préstamos, presupuestos',
      'Reporte financiero escrito por Snake una vez al mes',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Para quien quiere a Snake pensando en grande',
    usdMonth: 7.99,
    usdYear: 79.99,
    crcMonth: 3900,
    crcYear: 39000,
    limits: {
      msgsPerDay: 60,
      tokensPerDay: 1_000_000,
      context: 24,
      attachmentsPerDay: 60,
      maxTokens: 4096,
      thinking: 4096,
      model: 'gemini-flash-latest',
      allActions: true,
      aiReport: true,
    },
    perks: [
      '60 mensajes al día',
      'Recuerda 24 mensajes: no pierde el hilo',
      '60 facturas al día',
      'Pensamiento profundo: planes largos y análisis completos',
      'Reportes financieros cuando quieras',
      'Todo lo de Plus incluido',
    ],
  },
]

export function plan(id?: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]
}

export function planLimits(id?: string): PlanLimits {
  return plan(id).limits
}

/** Acciones permitidas en el plan gratis (las demás piden mejorar de plan) */
export const BASIC_ACTIONS = new Set([
  'agregar_gasto', 'agregar_deuda', 'marcar_pagado', 'agregar_hormiga',
])

/* ─── Precios en la moneda del usuario ─────────────────────────────────── */

/** Redondeo "bonito" según la moneda (₡1.500, $59, S/ 11.90…) */
function prettyRound(value: number, currency: string): number {
  const big = ['CRC', 'COP', 'CLP', 'PYG', 'ARS', 'NIO']
  const mid = ['MXN', 'DOP', 'HNL', 'GTQ', 'CRC']
  if (big.includes(currency)) {
    // a múltiplos de 500 (₡1.500) o de 1.000 en monedas muy grandes
    const step = value > 20_000 ? 1000 : 500
    return Math.max(step, Math.round(value / step) * step)
  }
  if (mid.includes(currency)) {
    // a decenas terminadas en 9: 59, 149, 199…
    const r = Math.round(value / 10) * 10
    return Math.max(9, r - 1)
  }
  // USD, EUR, PEN, BRL, PAB…: precio con .99
  if (value >= 20) return Math.max(1, Math.floor(value)) + 0.99
  return Math.max(0.99, Math.floor(value) + 0.99)
}

export interface LocalPrice {
  /** monto en la moneda del usuario */
  amount: number
  /** ya formateado */
  label: string
  /** true si es una conversión estimada (no precio ancla) */
  estimated: boolean
}

/**
 * Precio del plan en la moneda del usuario. Costa Rica usa el precio ancla en
 * colones; el resto se convierte desde dólares con el tipo de cambio real.
 */
export function planPrice(
  p: Plan,
  currency: string,
  snap: RatesSnapshot | null,
  cycle: 'month' | 'year' = 'month',
): LocalPrice {
  if (p.usdMonth === 0) return { amount: 0, label: 'Gratis', estimated: false }

  // precio ancla de Costa Rica
  if (currency === 'CRC') {
    const amount = cycle === 'year' ? p.crcYear : p.crcMonth
    return { amount, label: formatMoney(amount, 'CRC'), estimated: false }
  }

  const usd = cycle === 'year' ? p.usdYear : p.usdMonth
  if (currency === 'USD') {
    return { amount: usd, label: formatMoney(usd, 'USD'), estimated: false }
  }

  const rate = rateBetween(snap, 'USD', currency)
  if (!rate) {
    // sin tipo de cambio: se muestra el precio en dólares
    return { amount: usd, label: `${formatMoney(usd, 'USD')} aprox.`, estimated: true }
  }
  const amount = prettyRound(usd * rate, currency)
  return { amount, label: formatMoney(amount, currency), estimated: true }
}

/** Ahorro del plan anual, en porcentaje */
export function yearSaving(p: Plan): number {
  if (p.usdMonth <= 0) return 0
  return Math.round((1 - p.usdYear / (p.usdMonth * 12)) * 100)
}
