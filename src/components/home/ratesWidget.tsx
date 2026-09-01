// Widget de tipo de cambio: cuánto vale el dólar, el euro y otras monedas
// en la moneda del usuario, en tiempo real (con caché para funcionar sin red).
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import type { WidgetSize } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { getRates, ratesAge, valueOf, type RatesSnapshot } from '../../lib/rates'
import { formatMoney } from '../../lib/format'

/** Monedas de referencia que se muestran (se omite la propia del usuario) */
const REFS: { code: string; label: string }[] = [
  { code: 'USD', label: 'Dólar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'MXN', label: 'Peso mexicano' },
  { code: 'COP', label: 'Peso colombiano' },
  { code: 'CRC', label: 'Colón' },
]

export function DivisasWidget({ size }: { size: WidgetSize }) {
  const currency = useFinanceStore((s) => s.profile.currency)
  const [snap, setSnap] = useState<RatesSnapshot | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (force: boolean) => {
    setBusy(true)
    try {
      setSnap(await getRates(force))
    } catch { /* sin red: queda la caché */ }
    setBusy(false)
  }, [])

  // se consulta fuera del render (microtarea) para no encadenar renders
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => { if (alive) void load(false) }, 0)
    return () => { alive = false; clearTimeout(t) }
  }, [load])

  const list = REFS
    .filter((r) => r.code !== currency)
    .map((r) => ({ ...r, value: valueOf(snap, r.code, currency) }))
    .filter((r) => r.value != null)
    .slice(0, size === 'sm' ? 2 : 4)

  return (
    <div className="widget p-4 h-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11.5px] font-semibold text-muted flex items-center gap-1.5">
          <TrendingUp size={12} style={{ color: 'var(--c-income)' }} /> Tipo de cambio
        </p>
        <button
          onClick={() => void load(true)}
          aria-label="Actualizar tipo de cambio"
          className="pressable text-muted"
        >
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-[12px] text-muted">
          {busy ? 'Consultando…' : 'Sin conexión y sin cotización guardada.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((r) => {
            // monedas muy pequeñas (COP, PYG) se muestran por 100 unidades
            const chico = (r.value ?? 0) < 1
            const unidades = chico ? 100 : 1
            const valor = (r.value ?? 0) * unidades
            return (
              <div key={r.code} className="flex items-center justify-between">
                <span className="text-[12.5px] text-ink">
                  {unidades} {r.code} <span className="text-[11px] text-muted">· {r.label}</span>
                </span>
                <span className="num text-[13px] font-bold text-ink">
                  {formatMoney(Number(valor.toFixed(2)), currency)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {snap && size !== 'sm' && (
        <p className="text-[10px] text-muted mt-2">
          Actualizado {ratesAge(snap)}{snap.date ? ` · fuente del ${snap.date}` : ''}
        </p>
      )}
    </div>
  )
}
