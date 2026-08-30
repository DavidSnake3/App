// Formateo de moneda y números según el perfil del usuario

let _currency = 'CRC'

export function setCurrency(code: string) {
  _currency = code || 'CRC'
}

export function getCurrency(): string {
  return _currency
}

const ZERO_DECIMAL = new Set(['CRC', 'COP', 'CLP', 'PYG', 'JPY'])

export function formatMoney(amount: number, currency = _currency): string {
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2
  try {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString('es-CR')}`
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

export function currencySymbol(currency = _currency): string {
  const map: Record<string, string> = {
    CRC: '₡', USD: '$', EUR: '€', MXN: '$', COP: '$', GTQ: 'Q',
    HNL: 'L', NIO: 'C$', PAB: 'B/.', PEN: 'S/', CLP: '$', ARS: '$',
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
]

export function formatPercent(v: number): string {
  return `${Math.round(v * 100)}%`
}

/** Como los comprobantes reales: muestra céntimos solo cuando existen */
export function formatMoneyExact(amount: number, currency = _currency): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0
  try {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency,
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: hasCents ? 2 : 0,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString('es-CR')}`
  }
}
