// Cerrar una compra copiando la factura: subtotal, descuento, exonerado,
// exento, el impuesto por tarifa y el total.
//
// Todo es opcional. Si no querés anotar nada, el total es lo que sumó el
// carrito y se cierra igual. Si sí lo anotás, el movimiento sale por el total
// de la factura, que es la plata que de verdad se fue.
import { useMemo, useState } from 'react'
import { Check, ChevronDown, Plus, Receipt, Trash2 } from 'lucide-react'
import type { Expense, PurchaseTotals, TaxLineData } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { shoppingCart } from '../../lib/shopping'
import { computedTotal, suggestTax, taxProfile, taxTotal } from '../../lib/tax'
import { formatMoney, getCurrency, money2 } from '../../lib/format'
import { BottomSheet } from '../ui/BottomSheet'
import { CurrencyInput } from '../ui/CurrencyInput'

export function PurchaseCloseSheet({ monthId, expense, open, onClose, onDone }: {
  monthId: string
  expense: Expense
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Finalizar la compra"
      subtitle="Copiá los datos de la factura, o cerrá sin anotar nada"
    >
      {open && <Formulario monthId={monthId} expense={expense} onClose={onClose} onDone={onDone} />}
    </BottomSheet>
  )
}

function Formulario({ monthId, expense, onClose, onDone }: {
  monthId: string
  expense: Expense
  onClose: () => void
  onDone: () => void
}) {
  const closeShoppingWithTotals = useFinanceStore((s) => s.closeShoppingWithTotals)
  const perfil = useMemo(() => taxProfile(getCurrency()), [])

  const carrito = expense.shopping ? shoppingCart(expense.shopping) : 0
  const [detalle, setDetalle] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [exonerated, setExonerated] = useState(0)
  const [exempt, setExempt] = useState(0)
  const [taxes, setTaxes] = useState<TaxLineData[]>([])
  const [total, setTotal] = useState(0)
  const [reference, setReference] = useState('')

  const datos: PurchaseTotals = {
    subtotal: carrito,
    discount: discount || undefined,
    exonerated: exonerated || undefined,
    exempt: exempt || undefined,
    taxes: taxes.length ? taxes : undefined,
    total: total || undefined,
    reference: reference.trim() || undefined,
  }

  const calculado = computedTotal(datos)
  const aCobrar = total > 0 ? money2(total) : calculado
  const descuadre = total > 0 ? money2(total - calculado) : 0

  const tarifasLibres = perfil.rates.filter((r) => r.rate > 0 && !taxes.some((t) => t.rate === r.rate))

  const agregarTarifa = (rate: number) => {
    setTaxes((prev) => [...prev, { rate, amount: suggestTax({ ...datos, taxes: prev }, rate) }]
      .sort((a, b) => b.rate - a.rate))
  }

  const cerrar = () => {
    closeShoppingWithTotals(monthId, expense.id, detalle ? datos : undefined)
    onDone()
  }

  return (
    <div className="flex flex-col gap-3 pb-1">
      {/* Lo que sumó el carrito */}
      <div
        className="rounded-2xl p-4 text-center"
        style={{ background: 'color-mix(in oklab, var(--app-accent) 11%, transparent)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Lo que llevás</p>
        <p className="display-money text-[28px] font-bold leading-tight mt-1 text-ink">
          {formatMoney(carrito)}
        </p>
        <p className="text-[11.5px] text-muted mt-1">
          {expense.shopping?.mode === 'live'
            ? `${expense.shopping.items.length} productos`
            : `${expense.shopping?.items.filter((p) => p.checked).length ?? 0} de ${expense.shopping?.items.length ?? 0} productos`}
        </p>
      </div>

      {/* ¿Querés copiar la factura? */}
      <button
        onClick={() => setDetalle(!detalle)}
        className="pressable card px-3.5 py-3 flex items-center gap-2.5 text-left"
      >
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in oklab, var(--app-accent) 14%, transparent)', color: 'var(--app-accent-soft)' }}
        >
          <Receipt size={15} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-ink">Anotar los datos de la factura</span>
          <span className="block text-[11px] text-muted leading-snug">
            Descuento, exonerado, exento, {perfil.name} y total. Todo opcional.
          </span>
        </span>
        <ChevronDown
          size={16}
          className="text-muted shrink-0 transition-transform"
          style={detalle ? { transform: 'rotate(180deg)' } : undefined}
        />
      </button>

      {detalle && (
        <div className="flex flex-col gap-2.5 anim-fade">
          <Campo label="Subtotal" hint="lo que sumaron los productos">
            <p className="num text-[15px] font-bold text-ink text-right py-2">{formatMoney(carrito)}</p>
          </Campo>

          <Campo label="Descuento" hint="la rebaja que te hizo la tienda">
            <CurrencyInput value={discount} onChange={setDiscount} />
          </Campo>

          <Campo label="Monto exonerado" hint="lo que no paga impuesto por exoneración">
            <CurrencyInput value={exonerated} onChange={setExonerated} />
          </Campo>

          <Campo label="Monto exento" hint="lo que la ley deja fuera del impuesto">
            <CurrencyInput value={exempt} onChange={setExempt} />
          </Campo>

          {/* Impuesto por tarifa */}
          <div className="card p-3.5">
            <p className="text-[12.5px] font-semibold text-ink mb-0.5">{perfil.name} por tarifa</p>
            <p className="text-[11px] text-muted leading-snug mb-2">
              La factura del súper trae varias. Agregá las que aparezcan.
            </p>

            {taxes.map((t, i) => (
              <div key={t.rate} className="flex items-center gap-2 mb-2">
                <span
                  className="num text-[12.5px] font-bold px-2.5 py-1.5 rounded-lg shrink-0"
                  style={{ background: 'color-mix(in oklab, var(--app-accent) 14%, transparent)', color: 'var(--app-accent-soft)' }}
                >
                  {t.rate}%
                </span>
                <CurrencyInput
                  value={t.amount}
                  onChange={(v) => setTaxes((prev) => prev.map((x, j) => (j === i ? { ...x, amount: v } : x)))}
                  className="flex-1 [&_input]:!py-2 [&_input]:!text-[13px]"
                />
                <button
                  onClick={() => setTaxes((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Quitar ${perfil.name} ${t.rate}%`}
                  className="pressable w-8 h-8 rounded-full bg-elevated border border-edge flex items-center justify-center shrink-0"
                  style={{ color: 'var(--c-danger)' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {tarifasLibres.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {tarifasLibres.map((r) => (
                  <button
                    key={r.rate}
                    onClick={() => agregarTarifa(r.rate)}
                    className="pressable chip"
                    title={r.label}
                  >
                    <Plus size={11} /> {perfil.name} {r.rate}%
                  </button>
                ))}
              </div>
            )}

            {taxes.length > 0 && (
              <p className="text-[11.5px] text-muted num mt-2 text-right">
                Total de {perfil.name}: <span className="font-bold text-ink">{formatMoney(taxTotal(datos))}</span>
              </p>
            )}
          </div>

          <Campo label="Total de la factura" hint="si lo anotás, este es el que se cobra">
            <CurrencyInput value={total} onChange={setTotal} />
          </Campo>

          {total > 0 && Math.abs(descuadre) >= 0.01 && (
            <p
              className="text-[11.5px] leading-snug rounded-xl px-3 py-2"
              style={{ background: 'color-mix(in oklab, var(--c-warning) 12%, transparent)', color: 'var(--c-warning)' }}
            >
              Con lo que anotaste da <span className="num font-semibold">{formatMoney(calculado)}</span>,
              y el total dice <span className="num font-semibold">{formatMoney(money2(total))}</span>
              {' '}({descuadre > 0 ? '+' : '−'}{formatMoney(Math.abs(descuadre))} de diferencia).
              Se cobra el total de la factura.
            </p>
          )}

          <input
            className="input-base"
            placeholder="Número de factura (opcional)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      )}

      {/* Lo que se va a cobrar */}
      <div
        className="rounded-xl px-3.5 py-3 flex items-center justify-between gap-2"
        style={{ background: 'color-mix(in oklab, var(--c-income) 12%, transparent)' }}
      >
        <span className="text-[12.5px] text-ink">Sale de tu cuenta</span>
        <span className="display-money text-[19px] font-bold" style={{ color: 'var(--c-income)' }}>
          {formatMoney(detalle ? aCobrar : carrito)}
        </span>
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="pressable btn-ghost px-5">Cancelar</button>
        <button
          onClick={cerrar}
          disabled={carrito <= 0}
          className="pressable btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Check size={16} /> Finalizar compra
        </button>
      </div>
    </div>
  )
}

function Campo({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium text-ink">{label}</p>
        <p className="text-[10.5px] text-muted leading-snug">{hint}</p>
      </div>
      <div className="w-[42%] shrink-0">{children}</div>
    </div>
  )
}
