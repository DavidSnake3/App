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

const ZERO_DECIMAL = new Set(['CRC', 'COP', 'CLP', 'PYG', 'JPY'])

export function formatMoney(amount: number, currency = _currency): string {
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2
  try {
    return new Intl.NumberFormat(_locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
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

/** Como los comprobantes reales: muestra céntimos solo cuando existen */
export function formatMoneyExact(amount: number, currency = _currency): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0
  try {
    return new Intl.NumberFormat(_locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString(_locale)}`
  }
}
