// Impuesto sobre las ventas de cada país.
//
// En Costa Rica la factura del súper trae varias tarifas a la vez: 13% para
// casi todo, 1% para la canasta básica, 2% para medicinas y seguros y 4% para
// salud privada y tiquetes aéreos. Por eso el cierre de una compra deja poner
// varias líneas de IVA, no una sola.
//
// Cada país tiene su nombre y sus tarifas: IVA, IGV en Perú, ITBIS en
// República Dominicana, ISV en Honduras, ITBMS en Panamá.

import type { PurchaseTotals } from '../types/finance'
export type { PurchaseTotals }

export interface TaxRate {
  /** el porcentaje: 13 = 13% */
  rate: number
  /** para qué es, en una línea corta */
  label: string
}

export interface TaxProfile {
  /** cómo se llama el impuesto en ese país */
  name: string
  /** la tarifa que se usa para casi todo */
  general: number
  /** todas las tarifas, de la más común a la menos */
  rates: TaxRate[]
}

/** Perfil de impuesto por moneda (que es como la app identifica el país) */
export const TAX_BY_CURRENCY: Record<string, TaxProfile> = {
  CRC: {
    name: 'IVA', general: 13,
    rates: [
      { rate: 13, label: 'General' },
      { rate: 4, label: 'Salud privada y tiquetes aéreos' },
      { rate: 2, label: 'Medicinas, seguros y educación' },
      { rate: 1, label: 'Canasta básica' },
      { rate: 0, label: 'Exento' },
    ],
  },
  MXN: {
    name: 'IVA', general: 16,
    rates: [
      { rate: 16, label: 'General' },
      { rate: 8, label: 'Zona fronteriza' },
      { rate: 0, label: 'Tasa cero (alimentos y medicinas)' },
    ],
  },
  COP: {
    name: 'IVA', general: 19,
    rates: [
      { rate: 19, label: 'General' },
      { rate: 5, label: 'Reducida' },
      { rate: 0, label: 'Excluido o exento' },
    ],
  },
  GTQ: { name: 'IVA', general: 12, rates: [{ rate: 12, label: 'General' }, { rate: 0, label: 'Exento' }] },
  HNL: {
    name: 'ISV', general: 15,
    rates: [
      { rate: 15, label: 'General' },
      { rate: 18, label: 'Licores y tabaco' },
      { rate: 0, label: 'Exento' },
    ],
  },
  NIO: { name: 'IVA', general: 15, rates: [{ rate: 15, label: 'General' }, { rate: 0, label: 'Exento' }] },
  PAB: {
    name: 'ITBMS', general: 7,
    rates: [
      { rate: 7, label: 'General' },
      { rate: 10, label: 'Licores y hospedaje' },
      { rate: 15, label: 'Tabaco' },
      { rate: 0, label: 'Exento' },
    ],
  },
  PEN: { name: 'IGV', general: 18, rates: [{ rate: 18, label: 'General' }, { rate: 0, label: 'Exonerado' }] },
  DOP: {
    name: 'ITBIS', general: 18,
    rates: [
      { rate: 18, label: 'General' },
      { rate: 16, label: 'Reducida' },
      { rate: 0, label: 'Exento' },
    ],
  },
  CLP: { name: 'IVA', general: 19, rates: [{ rate: 19, label: 'General' }, { rate: 0, label: 'Exento' }] },
  ARS: {
    name: 'IVA', general: 21,
    rates: [
      { rate: 21, label: 'General' },
      { rate: 10.5, label: 'Reducida' },
      { rate: 27, label: 'Servicios regulados' },
      { rate: 0, label: 'Exento' },
    ],
  },
  BOB: { name: 'IVA', general: 13, rates: [{ rate: 13, label: 'General' }, { rate: 0, label: 'Exento' }] },
  UYU: {
    name: 'IVA', general: 22,
    rates: [{ rate: 22, label: 'General' }, { rate: 10, label: 'Reducida' }, { rate: 0, label: 'Exento' }],
  },
  PYG: {
    name: 'IVA', general: 10,
    rates: [{ rate: 10, label: 'General' }, { rate: 5, label: 'Reducida' }, { rate: 0, label: 'Exento' }],
  },
  BRL: { name: 'ICMS', general: 18, rates: [{ rate: 18, label: 'General' }, { rate: 12, label: 'Reducida' }, { rate: 0, label: 'Isento' }] },
  EUR: {
    name: 'IVA', general: 21,
    rates: [{ rate: 21, label: 'General' }, { rate: 10, label: 'Reducida' }, { rate: 4, label: 'Superreducida' }, { rate: 0, label: 'Exento' }],
  },
  USD: {
    name: 'Impuesto', general: 0,
    rates: [{ rate: 0, label: 'Sin impuesto' }],
  },
}

const POR_DEFECTO: TaxProfile = {
  name: 'Impuesto', general: 0, rates: [{ rate: 0, label: 'Sin impuesto' }],
}

export function taxProfile(currency: string): TaxProfile {
  return TAX_BY_CURRENCY[currency] ?? POR_DEFECTO
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

/** Suma de todas las líneas de impuesto */
export function taxTotal(t: PurchaseTotals | undefined): number {
  return round2((t?.taxes ?? []).reduce((s, x) => s + (x.amount || 0), 0))
}

/**
 * El total que se cobra de verdad.
 *
 * Si el usuario escribió el total de la factura, ese manda: es el número que
 * de verdad salió de su cuenta. Si no, se arma con lo que anotó.
 */
export function purchaseTotal(t: PurchaseTotals | undefined, fallback: number): number {
  if (!t) return round2(fallback)
  if (typeof t.total === 'number' && t.total > 0) return round2(t.total)
  const base = t.subtotal || fallback
  return round2(base - (t.discount ?? 0) - (t.exonerated ?? 0) + taxTotal(t))
}

/** El total calculado a partir de las líneas, para comparar con la factura */
export function computedTotal(t: PurchaseTotals): number {
  return round2((t.subtotal || 0) - (t.discount ?? 0) - (t.exonerated ?? 0) + taxTotal(t))
}

/** Sugerencia de impuesto: lo que daría aplicar la tarifa a la base gravada */
export function suggestTax(t: PurchaseTotals, rate: number): number {
  const base = (t.subtotal || 0) - (t.discount ?? 0) - (t.exonerated ?? 0) - (t.exempt ?? 0)
  return round2(Math.max(0, base) * (rate / 100))
}
