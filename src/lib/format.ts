// Formateo de moneda y números según el perfil del usuario

let _currency = 'CRC'
let _locale = 'es-CR'
let _second = ''
let _rate = 0

export function setCurrency(code: string) {
  _currency = code || 'CRC'
}

/** Región para formato de números y fechas (app universal) */
export function setLocale(locale: string) {
  _locale = locale || 'es-CR'
}

export function getLocale(): string {
  return _locale
}

/** Segunda moneda opcional: cuántas unidades equivalen a 1 de la principal */
export function setSecondCurrency(code: string, rate: number) {
  _second = code || ''
  _rate = rate > 0 ? rate : 0
}

/** Equivalente en la segunda moneda, o null si no está configurada */
export function formatSecond(amount: number): string | null {
  if (!_second || _rate <= 0) return null
  return formatMoney(amount * _rate, _second)
}

export function getCurrency(): string {
  return _currency
}

/**
 * Redondeo a céntimos. TODO monto que se guarda pasa por aquí: la app trabaja
 * con decimales (un recibo de 12 345,67 es 12 345,67, no 12 346), pero nunca
 * arrastra basura de coma flotante como 0.1 + 0.2 = 0.30000000000000004.
 */
export function money2(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.round((v + Number.EPSILON) * 100) / 100
}

/** ¿El monto tiene céntimos? */
export function hasCents(amount: number): boolean {
  return Math.round(amount * 100) % 100 !== 0
}

/**
 * Moneda como en los recibos: con céntimos SOLO cuando existen.
 * Así ₡25 000 se lee limpio y ₡12 345,67 se lee completo, en cualquier moneda.
 */
export function formatMoney(amount: number, currency = _currency): string {
  const dec = hasCents(amount) ? 2 : 0
  try {
    return new Intl.NumberFormat(_locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString(_locale)}`
  }
}

export function formatMoneyShort(amount: number, currency = _currency): string {
  const symbol = currencySymbol(currency)
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${symbol}${Math.round(abs / 1_000)}K`
  return `${sign}${symbol}${Math.round(abs)}`
}

/** Número con separadores de miles según la región del usuario */
export function formatNumber(value: number, decimals = 0): string {
  try {
    return new Intl.NumberFormat(_locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  } catch {
    return String(value)
  }
}

/**
 * Fecha corta según la región del usuario.
 *
 * Ojo: `new Date('2026-09-01')` se interpreta como UTC y en América se ve como
 * el día anterior. Las fechas de solo día se construyen a mano para que el día
 * que el usuario escribió sea el que se muestra.
 */
export function formatDate(iso?: string): string {
  if (!iso) return ''
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10)) && iso.length <= 10
  const d = soloFecha
    ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
    : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return d.toLocaleDateString(_locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

export function currencySymbol(currency = _currency): string {
  const map: Record<string, string> = {
    CRC: '₡', USD: '$', EUR: '€', MXN: '$', COP: '$', GTQ: 'Q',
    HNL: 'L', NIO: 'C$', PAB: 'B/.', PEN: 'S/', CLP: '$', ARS: '$',
    DOP: 'RD$', BRL: 'R$', UYU: '$U', BOB: 'Bs', PYG: '₲', VES: 'Bs',
  }
  return map[currency] ?? currency
}

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'CRC', label: '₡ Colón (Costa Rica)' },
  { code: 'USD', label: '$ Dólar (EE. UU.)' },
  { code: 'EUR', label: '€ Euro' },
  { code: 'MXN', label: '$ Peso mexicano' },
  { code: 'COP', label: '$ Peso colombiano' },
  { code: 'GTQ', label: 'Q Quetzal' },
  { code: 'HNL', label: 'L Lempira' },
  { code: 'NIO', label: 'C$ Córdoba' },
  { code: 'PAB', label: 'B/. Balboa' },
  { code: 'PEN', label: 'S/ Sol' },
  { code: 'DOP', label: 'RD$ Peso dominicano' },
  { code: 'CLP', label: '$ Peso chileno' },
  { code: 'ARS', label: '$ Peso argentino' },
  { code: 'BRL', label: 'R$ Real brasileño' },
  { code: 'BOB', label: 'Bs Boliviano' },
  { code: 'UYU', label: '$U Peso uruguayo' },
  { code: 'PYG', label: '₲ Guaraní' },
]

export const LOCALES: { code: string; label: string }[] = [
  { code: 'es-CR', label: 'Español · 1 234,56 (Costa Rica)' },
  { code: 'es-MX', label: 'Español · 1,234.56 (México)' },
  { code: 'es-CO', label: 'Español · 1.234,56 (Colombia)' },
  { code: 'es-AR', label: 'Español · 1.234,56 (Argentina)' },
  { code: 'es-CL', label: 'Español · 1.234,56 (Chile)' },
  { code: 'es-PE', label: 'Español · 1,234.56 (Perú)' },
  { code: 'es-ES', label: 'Español · 1.234,56 (España)' },
  { code: 'en-US', label: 'English · 1,234.56 (EE. UU.)' },
  { code: 'pt-BR', label: 'Português · 1.234,56 (Brasil)' },
]

export function formatPercent(v: number): string {
  return `${Math.round(v * 100)}%`
}

/** Alias histórico: `formatMoney` ya muestra los céntimos cuando existen */
export const formatMoneyExact = formatMoney

/** El separador decimal de la región: coma en Costa Rica, punto en EE. UU. */
export function decimalSeparator(): string {
  try {
    return new Intl.NumberFormat(_locale).formatToParts(1.1)
      .find((p) => p.type === 'decimal')?.value ?? '.'
  } catch {
    return '.'
  }
}

/**
 * Lee un monto escrito por una persona, en cualquier región: "1 234,56",
 * "1,234.56", "₡12.345,67" o "1234.5". Devuelve el número o NaN.
 */
export function parseMoney(text: string): number {
  const limpio = text.replace(/[^\d.,-]/g, '').trim()
  if (!limpio) return NaN
  const dec = decimalSeparator()
  const miles = dec === ',' ? '.' : ','
  // se quitan los separadores de miles y se normaliza el decimal a punto
  const normal = limpio.split(miles).join('').replace(dec, '.')
  const n = Number(normal)
  return Number.isFinite(n) ? n : NaN
}
