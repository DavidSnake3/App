// Tipo de cambio en tiempo real (dólar, euro y la moneda del usuario).
//
// Fuente: exchange-api de fawazahmed0, servida por jsDelivr. Es un JSON
// estático en CDN: gratis, sin llave, sin límite de peticiones y con CORS
// abierto, así que funciona igual en el APK y en el navegador.
//   https://github.com/fawazahmed0/exchange-api
// Si no hay internet se usa la última cotización guardada (cache local).

const CACHE_KEY = 'snb-rates'
const FRESH_MS = 6 * 60 * 60 * 1000 // 6 horas

const PRIMARY = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies'
const FALLBACK = 'https://latest.currency-api.pages.dev/v1/currencies'

export interface RatesSnapshot {
  /** moneda base (en minúsculas, como la API) */
  base: string
  /** cuántas unidades de cada moneda equivalen a 1 de la base */
  rates: Record<string, number>
  /** fecha que reporta la fuente ('2026-08-31') */
  date: string
  /** cuándo se guardó en el dispositivo */
  fetchedAt: number
}

function readCache(): RatesSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const snap = JSON.parse(raw) as RatesSnapshot
    return snap?.rates ? snap : null
  } catch {
    return null
  }
}

function writeCache(snap: RatesSnapshot) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(snap)) } catch { /* lleno */ }
}

async function fetchJson(url: string, ms = 8000): Promise<Record<string, unknown>> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

/**
 * Cotizaciones con base USD. Devuelve la caché si está fresca; si `force` es
 * true consulta la fuente aunque la caché siga vigente.
 */
export async function getRates(force = false): Promise<RatesSnapshot | null> {
  const cached = readCache()
  const fresh = cached && Date.now() - cached.fetchedAt < FRESH_MS
  if (cached && fresh && !force) return cached

  for (const base of [PRIMARY, FALLBACK]) {
    try {
      const data = await fetchJson(`${base}/usd.min.json`)
      const rates = data.usd as Record<string, number> | undefined
      if (!rates || typeof rates !== 'object') throw new Error('respuesta inválida')
      const snap: RatesSnapshot = {
        base: 'usd',
        rates,
        date: typeof data.date === 'string' ? data.date : '',
        fetchedAt: Date.now(),
      }
      writeCache(snap)
      return snap
    } catch { /* probar la siguiente fuente */ }
  }
  // sin internet: lo último que se guardó (aunque esté viejo)
  return cached
}

/** Cuántas unidades de `to` equivalen a 1 de `from` */
export function rateBetween(snap: RatesSnapshot | null, from: string, to: string): number | null {
  if (!snap) return null
  const f = from.toLowerCase()
  const t = to.toLowerCase()
  if (f === t) return 1
  const rf = f === 'usd' ? 1 : snap.rates[f]
  const rt = t === 'usd' ? 1 : snap.rates[t]
  if (!rf || !rt) return null
  return rt / rf
}

/** Cuánto vale 1 unidad de `code` en la moneda del usuario */
export function valueOf(snap: RatesSnapshot | null, code: string, userCurrency: string): number | null {
  return rateBetween(snap, code, userCurrency)
}

/** Antigüedad legible de la cotización */
export function ratesAge(snap: RatesSnapshot | null): string {
  if (!snap) return 'sin datos'
  const mins = Math.floor((Date.now() - snap.fetchedAt) / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  return `hace ${Math.floor(hrs / 24)} días`
}
