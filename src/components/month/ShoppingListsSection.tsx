// Submenú "Lista de compras" del mes: tus listas, con su avance en vivo.
// Cada lista es también un pago del mes, así que aparece en Pagos del mes.
import { useState } from 'react'
import { Check, Plus, ShoppingCart, Store } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { shoppingChecked, shoppingPlanned } from '../../lib/shopping'
import { formatMoney } from '../../lib/format'
import { Fab } from '../ui/Fab'
import { NewShoppingListSheet } from './NewShoppingListSheet'
import { ShoppingListSheet } from './ShoppingListSheet'

export function ShoppingListsSection({ monthId }: { monthId: string }) {
  const month = useFinanceStore((s) => s.months[monthId])
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [abiertaId, setAbiertaId] = useState<string | null>(null)

  const listas = (month?.expenses ?? []).filter((e) => e.shopping)
  const abiertas = listas.filter((e) => !e.shopping!.done)
  const cerradas = listas.filter((e) => e.shopping!.done)

  const tarjeta = (id: string) => {
    const e = listas.find((x) => x.id === id)!
    const l = e.shopping!
    const llevo = shoppingChecked(l)
    const planeado = shoppingPlanned(l)
    const pct = planeado > 0 ? Math.min(1, llevo / planeado) : 0
    const marcados = l.items.filter((p) => p.checked).length

    return (
      <button
        key={e.id}
        onClick={() => setAbiertaId(e.id)}
        className="pressable tile p-3.5 flex flex-col gap-2.5 text-left anim-rise w-full"
        style={{
          background: l.done
            ? 'linear-gradient(155deg, color-mix(in oklab, var(--c-income) 10%, var(--c-card)) 0%, var(--c-card) 62%)'
            : 'linear-gradient(155deg, color-mix(in oklab, var(--app-accent) 10%, var(--c-card)) 0%, var(--c-card) 62%)',
          borderColor: l.done
            ? 'color-mix(in oklab, var(--c-income) 26%, var(--c-border))'
            : 'color-mix(in oklab, var(--app-accent) 24%, var(--c-border))',
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: l.done
                ? 'linear-gradient(145deg, var(--c-income), color-mix(in oklab, var(--c-income) 55%, #000))'
                : 'var(--app-gradient)',
              color: '#fff',
            }}
          >
            {l.done ? <Check size={17} strokeWidth={3} /> : <ShoppingCart size={17} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-semibold text-ink truncate">{e.name}</span>
            <span className="block text-[11px] text-muted">
              {l.done
                ? `Comprado · ${marcados} producto${marcados === 1 ? '' : 's'}`
                : `${marcados} de ${l.items.length} marcados`}
              {l.store ? ` · ${l.store}` : ''}
            </span>
          </span>
          <span className="text-right shrink-0">
            <span
              className="num block text-[15.5px] font-bold"
              style={{ color: l.done ? 'var(--c-income)' : 'var(--c-text)' }}
            >
              {formatMoney(llevo)}
            </span>
            {!l.done && planeado > 0 && (
              <span className="num block text-[10.5px] text-muted">de {formatMoney(planeado)}</span>
            )}
          </span>
        </div>

        {!l.done && l.items.length > 0 && (
          <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.round(pct * 100)}%`, background: 'var(--app-gradient)' }}
            />
          </div>
        )}
      </button>
    )
  }

  return (
    <>
      {listas.length === 0 ? (
        <div className="card p-8 text-center anim-pop">
          <ShoppingCart size={26} className="mx-auto mb-2" style={{ color: 'var(--app-accent-soft)' }} />
          <p className="text-[15px] font-semibold text-ink">Todavía no tenés listas</p>
          <p className="text-[13px] text-muted mt-1.5 leading-relaxed">
            Armá tu lista del diario con los precios, y cuando estés en el súper vas marcando
            lo que echás al carrito. Al finalizar, sale de tu cuenta solo lo que compraste.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {abiertas.map((e) => tarjeta(e.id))}
          {cerradas.length > 0 && (
            <>
              <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted mt-1">
                Compras cerradas ({cerradas.length})
              </p>
              {cerradas.map((e) => tarjeta(e.id))}
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setNuevaOpen(true)}
        className="pressable rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 py-4 text-[13.5px] font-semibold"
        style={{
          borderColor: 'color-mix(in oklab, var(--app-accent) 50%, var(--c-border))',
          color: 'var(--app-accent-soft)',
        }}
      >
        <Plus size={17} /> Nueva lista de compras
      </button>

      <p className="text-[11px] text-muted leading-snug">
        Cada lista aparece también en Pagos del mes. Mientras no la finalices no mueve plata.
      </p>

      <Fab onClick={() => setNuevaOpen(true)} label="Nueva lista de compras">
        <Plus size={22} />
      </Fab>

      <NewShoppingListSheet
        open={nuevaOpen}
        monthId={monthId}
        onClose={() => setNuevaOpen(false)}
        onCreated={(id) => { setNuevaOpen(false); setAbiertaId(id) }}
      />

      <ShoppingListSheet
        open={Boolean(abiertaId)}
        monthId={monthId}
        expenseId={abiertaId}
        onClose={() => setAbiertaId(null)}
      />
    </>
  )
}

/** Se reexporta para que MonthView pinte el ícono del hub sin importar de más */
export { Store as ShoppingStoreIcon }
