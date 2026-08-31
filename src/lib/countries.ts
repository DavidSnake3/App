// Configuración de planilla por país (app universal).
//
// IMPORTANTE: los porcentajes, techos y tramos son una REFERENCIA editable del
// aporte del EMPLEADO, para que la app calcule un neto realista en cualquier
// país. Cada usuario puede corregir nombres, porcentajes, techos y tramos en
// Ajustes → Ingresos, porque las leyes cambian y hay regímenes distintos.
// La app no es asesoría fiscal: manda siempre el comprobante real.
import type { ExtraPay, StatutoryDeduction, TaxBracket } from '../types/finance'

export interface CountryPreset {
  id: string
  country: string
  currency: string
  locale: string
  /** deducciones de ley del empleado */
  statutory: { name: string; pct: number; cap?: number }[]
  /** tramos del impuesto sobre la renta (ingreso MENSUAL gravable) */
  taxBrackets: TaxBracket[]
  /** pagos extraordinarios típicos (aguinaldo, 13.º, 14.º…) */
  extraPays: { name: string; month: number; factor: number }[]
  /** nota corta sobre el régimen del país */
  note?: string
}

export const COUNTRY_PRESETS: CountryPreset[] = [
  {
    id: 'cr',
    country: 'Costa Rica',
    currency: 'CRC',
    locale: 'es-CR',
    statutory: [{ name: 'CCSS (SEM + IVM)', pct: 10.83 }],
    taxBrackets: [
      { upTo: 929000, pct: 0 },
      { upTo: 1363000, pct: 10 },
      { upTo: 2392000, pct: 15 },
      { upTo: 4783000, pct: 20 },
      { upTo: null, pct: 25 },
    ],
    extraPays: [{ name: 'Aguinaldo', month: 12, factor: 1 }],
    note: 'CCSS 10.83% e impuesto al salario por tramos mensuales.',
  },
  {
    id: 'mx',
    country: 'México',
    currency: 'MXN',
    locale: 'es-MX',
    statutory: [{ name: 'IMSS', pct: 2.78 }],
    taxBrackets: [
      { upTo: 8952, pct: 1.92 },
      { upTo: 75984, pct: 6.4 },
      { upTo: 133536, pct: 10.88 },
      { upTo: 155229, pct: 16 },
      { upTo: 185852, pct: 17.92 },
      { upTo: 374837, pct: 21.36 },
      { upTo: 590795, pct: 23.52 },
      { upTo: null, pct: 30 },
    ],
    extraPays: [{ name: 'Aguinaldo (15 días)', month: 12, factor: 0.5 }],
    note: 'ISR por tramos mensuales (simplificado, sin cuota fija ni subsidio).',
  },
  {
    id: 'gt',
    country: 'Guatemala',
    currency: 'GTQ',
    locale: 'es-GT',
    statutory: [{ name: 'IGSS', pct: 4.83 }],
    taxBrackets: [{ upTo: 25000, pct: 5 }, { upTo: null, pct: 7 }],
    extraPays: [
      { name: 'Aguinaldo', month: 12, factor: 1 },
      { name: 'Bono 14', month: 7, factor: 1 },
    ],
  },
  {
    id: 'sv',
    country: 'El Salvador',
    currency: 'USD',
    locale: 'es-SV',
    statutory: [
      { name: 'ISSS', pct: 3, cap: 1000 },
      { name: 'AFP', pct: 7.25 },
    ],
    taxBrackets: [
      { upTo: 472, pct: 0 },
      { upTo: 895, pct: 10 },
      { upTo: 2038, pct: 20 },
      { upTo: null, pct: 30 },
    ],
    extraPays: [{ name: 'Aguinaldo', month: 12, factor: 0.5 }],
  },
  {
    id: 'hn',
    country: 'Honduras',
    currency: 'HNL',
    locale: 'es-HN',
    statutory: [
      { name: 'IHSS', pct: 2.5, cap: 11705 },
      { name: 'RAP', pct: 1.5 },
    ],
    taxBrackets: [
      { upTo: 17300, pct: 0 },
      { upTo: 26400, pct: 15 },
      { upTo: 61400, pct: 20 },
      { upTo: null, pct: 25 },
    ],
    extraPays: [
      { name: 'Décimo tercero', month: 12, factor: 1 },
      { name: 'Décimo cuarto', month: 6, factor: 1 },
    ],
  },
  {
    id: 'ni',
    country: 'Nicaragua',
    currency: 'NIO',
    locale: 'es-NI',
    statutory: [{ name: 'INSS laboral', pct: 7 }],
    taxBrackets: [
      { upTo: 8333, pct: 0 },
      { upTo: 16666, pct: 15 },
      { upTo: 29166, pct: 20 },
      { upTo: 41666, pct: 25 },
      { upTo: null, pct: 30 },
    ],
    extraPays: [{ name: 'Aguinaldo', month: 12, factor: 1 }],
  },
  {
    id: 'pa',
    country: 'Panamá',
    currency: 'PAB',
    locale: 'es-PA',
    statutory: [
      { name: 'Seguro Social', pct: 9.75 },
      { name: 'Seguro Educativo', pct: 1.25 },
    ],
    taxBrackets: [
      { upTo: 916, pct: 0 },
      { upTo: 4166, pct: 15 },
      { upTo: null, pct: 25 },
    ],
    extraPays: [
      { name: 'XIII mes (abril)', month: 4, factor: 0.33 },
      { name: 'XIII mes (agosto)', month: 8, factor: 0.33 },
      { name: 'XIII mes (diciembre)', month: 12, factor: 0.33 },
    ],
  },
  {
    id: 'do',
    country: 'Rep. Dominicana',
    currency: 'DOP',
    locale: 'es-DO',
    statutory: [
      { name: 'SFS (salud)', pct: 3.04, cap: 154000 },
      { name: 'AFP (pensión)', pct: 2.87, cap: 385000 },
    ],
    taxBrackets: [
      { upTo: 34685, pct: 0 },
      { upTo: 52027, pct: 15 },
      { upTo: 72260, pct: 20 },
      { upTo: null, pct: 25 },
    ],
    extraPays: [{ name: 'Regalía pascual', month: 12, factor: 1 }],
  },
  {
    id: 'co',
    country: 'Colombia',
    currency: 'COP',
    locale: 'es-CO',
    statutory: [
      { name: 'Salud', pct: 4, cap: 35550000 },
      { name: 'Pensión', pct: 4, cap: 35550000 },
    ],
    taxBrackets: [
      { upTo: 4500000, pct: 0 },
      { upTo: 7000000, pct: 19 },
      { upTo: 17000000, pct: 28 },
      { upTo: null, pct: 33 },
    ],
    extraPays: [
      { name: 'Prima de servicios (junio)', month: 6, factor: 0.5 },
      { name: 'Prima de servicios (diciembre)', month: 12, factor: 0.5 },
    ],
    note: 'La retención en la fuente depende de UVT y deducciones: ajusta los tramos.',
  },
  {
    id: 'pe',
    country: 'Perú',
    currency: 'PEN',
    locale: 'es-PE',
    statutory: [{ name: 'ONP / AFP', pct: 13 }],
    taxBrackets: [
      { upTo: 2500, pct: 0 },
      { upTo: 10725, pct: 8 },
      { upTo: 21450, pct: 14 },
      { upTo: 38610, pct: 17 },
      { upTo: null, pct: 20 },
    ],
    extraPays: [
      { name: 'Gratificación (julio)', month: 7, factor: 1 },
      { name: 'Gratificación (diciembre)', month: 12, factor: 1 },
    ],
  },
  {
    id: 'ec',
    country: 'Ecuador',
    currency: 'USD',
    locale: 'es-EC',
    statutory: [{ name: 'IESS', pct: 9.45 }],
    taxBrackets: [
      { upTo: 979, pct: 0 },
      { upTo: 1247, pct: 5 },
      { upTo: 1560, pct: 10 },
      { upTo: 1874, pct: 12 },
      { upTo: null, pct: 15 },
    ],
    extraPays: [
      { name: 'Décimo tercero', month: 12, factor: 1 },
      { name: 'Décimo cuarto', month: 8, factor: 1 },
    ],
  },
  {
    id: 'cl',
    country: 'Chile',
    currency: 'CLP',
    locale: 'es-CL',
    statutory: [
      { name: 'AFP', pct: 10, cap: 3160000 },
      { name: 'Salud (Fonasa/Isapre)', pct: 7, cap: 3160000 },
      { name: 'Seguro de cesantía', pct: 0.6, cap: 4740000 },
    ],
    taxBrackets: [
      { upTo: 950000, pct: 0 },
      { upTo: 2110000, pct: 4 },
      { upTo: 3520000, pct: 8 },
      { upTo: 4920000, pct: 13.5 },
      { upTo: null, pct: 23 },
    ],
    extraPays: [],
  },
  {
    id: 'ar',
    country: 'Argentina',
    currency: 'ARS',
    locale: 'es-AR',
    statutory: [
      { name: 'Jubilación', pct: 11 },
      { name: 'Ley 19.032 (PAMI)', pct: 3 },
      { name: 'Obra social', pct: 3 },
    ],
    taxBrackets: [{ upTo: 2340000, pct: 0 }, { upTo: null, pct: 9 }],
    extraPays: [
      { name: 'Aguinaldo (junio)', month: 6, factor: 0.5 },
      { name: 'Aguinaldo (diciembre)', month: 12, factor: 0.5 },
    ],
  },
  {
    id: 'br',
    country: 'Brasil',
    currency: 'BRL',
    locale: 'pt-BR',
    statutory: [{ name: 'INSS', pct: 11, cap: 7786 }],
    taxBrackets: [
      { upTo: 2259, pct: 0 },
      { upTo: 2826, pct: 7.5 },
      { upTo: 3751, pct: 15 },
      { upTo: 4664, pct: 22.5 },
      { upTo: null, pct: 27.5 },
    ],
    extraPays: [{ name: '13º salário', month: 12, factor: 1 }],
  },
  {
    id: 'es',
    country: 'España',
    currency: 'EUR',
    locale: 'es-ES',
    statutory: [{ name: 'Seguridad Social', pct: 6.47, cap: 4720 }],
    taxBrackets: [
      { upTo: 1000, pct: 0 },
      { upTo: 1666, pct: 19 },
      { upTo: 2500, pct: 24 },
      { upTo: 5000, pct: 30 },
      { upTo: null, pct: 37 },
    ],
    extraPays: [
      { name: 'Paga extra (junio)', month: 6, factor: 1 },
      { name: 'Paga extra (diciembre)', month: 12, factor: 1 },
    ],
    note: 'El IRPF depende de tu situación personal: ajusta los tramos si tu nómina difiere.',
  },
  {
    id: 'us',
    country: 'Estados Unidos',
    currency: 'USD',
    locale: 'en-US',
    statutory: [
      { name: 'Social Security', pct: 6.2, cap: 14050 },
      { name: 'Medicare', pct: 1.45 },
    ],
    taxBrackets: [
      { upTo: 1160, pct: 10 },
      { upTo: 4266, pct: 12 },
      { upTo: 9100, pct: 22 },
      { upTo: 17383, pct: 24 },
      { upTo: 22079, pct: 32 },
      { upTo: 49150, pct: 35 },
      { upTo: null, pct: 37 },
    ],
    extraPays: [],
    note: 'Federal solamente: agrega tu impuesto estatal como deducción si aplica.',
  },
  {
    id: 'other',
    country: 'Otro país',
    currency: '',
    locale: '',
    statutory: [{ name: 'Deducción de ley', pct: 0 }],
    taxBrackets: [{ upTo: null, pct: 0 }],
    extraPays: [],
    note: 'Escribe el nombre y el % de tus deducciones tal como vienen en tu comprobante.',
  },
]

/** Nombre corto de la deducción de ley del país */
export function presetLabel(p: CountryPreset): string {
  return p.statutory.length === 1 ? p.statutory[0].name : 'Deducciones de ley'
}

/** Suma de los porcentajes de ley del país */
export function presetPct(p: CountryPreset): number {
  return Math.round(p.statutory.reduce((t, d) => t + d.pct, 0) * 100) / 100
}

export function countryPreset(id?: string): CountryPreset | undefined {
  return COUNTRY_PRESETS.find((c) => c.id === id)
}

let seq = 0
function nextId(prefix: string): string {
  seq += 1
  return `${prefix}${seq}-${Math.random().toString(36).slice(2, 7)}`
}

/** Deducciones de ley del preset listas para guardar */
export function presetStatutory(p: CountryPreset): StatutoryDeduction[] {
  return p.statutory.map((d) => ({ id: nextId('st'), name: d.name, pct: d.pct, cap: d.cap ?? 0 }))
}

/** Pagos extraordinarios del preset listos para guardar */
export function presetExtraPays(p: CountryPreset): ExtraPay[] {
  return p.extraPays.map((e) => ({
    id: nextId('ex'),
    name: e.name,
    month: e.month,
    mode: 'salary' as const,
    factor: e.factor,
    amount: 0,
  }))
}

export const LEGAL_NOTICE =
  'Los porcentajes, techos y tramos son una referencia editable para estimar tu ' +
  'neto. Las leyes cambian y cada persona tiene su situación: manda siempre tu ' +
  'comprobante real. SNBusiness te ayuda a organizarte, no sustituye asesoría fiscal.'
