// El checklist de una lista de compras: vas marcando lo que echás al carrito y
// mirás el subtotal en vivo. La plata solo se mueve al finalizar la compra.
import { useState } from 'react'
import { Check, Minus, Pencil, Plus, ShoppingCart, Store, Trash2, Undo2 } from 'lucide-react'
import type { Expense } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { lineTotal, shoppingChecked, shoppingPlanned } from '../../lib/shopping'
import { formatMoney } from '../../lib/format'
import { CurrencyInput } from '../ui/CurrencyInput'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { playPop, playTick } from '../../lib/sound'
import { vibrate } from '../../lib/fx'

export function ShoppingChecklist({ monthId, expense, onEdit, onDeleted }: {
  monthId: string
  expense: Expense
  /** abre la hoja para cambiar nombre, tienda, cuenta o color */
  onEdit?: () => void
  /** se llama después de eliminar la lista, para cerrar lo que la mostraba */
  onDeleted?: () => void
}) {
  const addProduct = useFinanceStore((s) => s.addShoppingProduct)
  const updateProduct = useFinanceStore((s) => s.updateShoppingProduct)
  const deleteProduct = useFinanceStore((s) => s.deleteShoppingProduct)
  const toggleProduct = useFinanceStore((s) => s.toggleShoppingProduct)
  const toggleDone = useFinanceStore((s) => s.toggleShoppingDone)
  const deleteExpense = useFinanceStore((s) => s.deleteExpense)
  const anims = useFinanceStore((s) => s.settings.animations)

  // marcar suena a "pop" y vibra; desmarcar hace un tic seco
  const marcar = (productId: string, estabaMarcado: boolean) => {
    toggleProduct(monthId, expense.id, productId)
    if (anims.sounds) (estabaMarcado ? playTick : playPop)()
    if (!estabaMarcado) vibrate(10, anims)
  }

  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [confirmCerrar, setConfirmCerrar] = useState(false)
  const [confirmBorrar, setConfirmBorrar] = useState(false)

  const lista = expense.shopping
  if (!lista) return null

  const llevo = shoppingChecked(lista)
  const planeado = shoppingPlanned(lista)
  const marcados = lista.items.filter((p) => p.checked).length
  const pct = planeado > 0 ? Math.min(1, llevo / planeado) : 0
  const cerrada = lista.done

  const agregar = () => {
    if (!name.trim() || price <= 0) return
    addProduct(monthId, expense.id, { name: name.trim(), price, qty: 1 })
    if (anims.sounds) playPop()
    setName('')
    setPrice(0)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Marcador: lo que llevo contra lo planeado */}
      <div className="card-soft p-4 relative overflow-hidden">
        <span className="orb -right-8 -top-10 w-24 h-24" style={{ background: 'var(--app-gradient)' }} />
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <ShoppingCart size={12} /> {cerrada ? 'Compraste' : 'Llevo en el carrito'}
            </p>
            <p
              className="display-money text-[28px] font-bold leading-tight mt-1 anim-money"
              style={{ color: cerrada ? 'var(--c-income)' : 'var(--c-text)' }}
            >
              {formatMoney(llevo)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] text-muted">de</p>
            <p className="num text-[15px] font-semibold text-ink">{formatMoney(planeado)}</p>
            <p className="text-[10.5px] text-muted">{marcados} de {lista.items.length}</p>
          </div>
        </div>

        <div className="h-2 rounded-full bg-elevated overflow-hidden mt-3">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.round(pct * 100)}%`, background: 'var(--app-gradient)' }}
          />
        </div>

        {lista.store && (
          <p className="text-[11.5px] text-muted mt-2 flex items-center gap-1.5">
            <Store size={12} /> {lista.store}
          </p>
        )}
      </div>

      {/* Productos */}
      {lista.items.length === 0 ? (
        <p className="text-[12.5px] text-muted text-center py-2">
          Agregá lo que vas a comprar y su precio. Después solo marcás lo que vas echando.
        </p>
      ) : (
        <div className="card overflow-hidden divide-y divide-[var(--c-border)]">
          {lista.items.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 px-3 py-2.5">
              <button
                onClick={() => !cerrada && marcar(p.id, p.checked)}
                disabled={cerrada}
                aria-label={p.checked ? `Desmarcar ${p.name}` : `Marcar ${p.name}`}
                className="pressable w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-60"
                style={{
                  borderColor: p.checked ? 'var(--c-income)' : 'var(--c-border)',
                  background: p.checked ? 'var(--c-income)' : 'transparent',
                  color: p.checked ? '#08281c' : 'var(--c-muted)',
                }}
              >
                <Check size={15} strokeWidth={3} style={{ opacity: p.checked ? 1 : 0.3 }} />
              </button>

              <span className="flex-1 min-w-0">
                <span
                  className={`block text-[13.5px] font-medium truncate ${p.checked ? 'line-through' : ''}`}
                  style={{ color: p.checked ? 'var(--c-muted)' : 'var(--c-text)' }}
                >
                  {p.name}
                </span>
                <span className="block text-[10.5px] text-muted num">
                  {formatMoney(p.price)}{p.qty > 1 ? ` × ${p.qty}` : ''}
                </span>
              </span>

              {!cerrada && (
                <span className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => updateProduct(monthId, expense.id, p.id, { qty: Math.max(1, p.qty - 1) })}
                    aria-label={`Menos ${p.name}`}
                    className="pressable w-7 h-7 rounded-lg bg-elevated border border-edge flex items-center justify-center text-muted"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="num text-[12px] font-semibold text-ink w-5 text-center">{p.qty}</span>
                  <button
                    onClick={() => updateProduct(monthId, expense.id, p.id, { qty: p.qty + 1 })}
                    aria-label={`Más ${p.name}`}
                    className="pressable w-7 h-7 rounded-lg bg-elevated border border-edge flex items-center justify-center text-muted"
                  >
                    <Plus size={12} />
                  </button>
                </span>
              )}

              <span className="num text-[13px] font-semibold text-ink shrink-0 w-[74px] text-right">
                {formatMoney(lineTotal(p))}
              </span>

              {!cerrada && (
                <button
                  onClick={() => deleteProduct(monthId, expense.id, p.id)}
                  aria-label={`Eliminar ${p.name}`}
                  className="pressable w-7 h-7 rounded-full flex items-center justify-center text-muted shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Agregar producto */}
      {!cerrada && (
        <div className="flex gap-2">
          <input
            className="input-base flex-1"
            placeholder="Ej. Arroz, leche, jabón…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') agregar() }}
          />
          <CurrencyInput value={price} onChange={setPrice} className="w-32" />
          <button
            onClick={agregar}
            disabled={!name.trim() || price <= 0}
            aria-label="Agregar producto"
            className="pressable w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-white disabled:opacity-40"
            style={{ background: 'var(--app-accent)' }}
          >
            <Plus size={19} />
          </button>
        </div>
      )}

      {/* Cerrar o reabrir la compra */}
      {cerrada ? (
        <>
          <div
            className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5"
            style={{ background: 'color-mix(in oklab, var(--c-income) 12%, transparent)' }}
          >
            <Check size={15} className="shrink-0" style={{ color: 'var(--c-income)' }} />
            <p className="text-[11.5px] text-ink leading-snug">
              Compra cerrada por <span className="num font-bold">{formatMoney(llevo)}</span>. Ya salió
              de tu cuenta y quedó en Movimientos.
            </p>
          </div>
          <button
            onClick={() => toggleDone(monthId, expense.id)}
            className="pressable btn-ghost w-full flex items-center justify-center gap-2 text-[13px]"
          >
            <Undo2 size={15} /> Reabrir la compra
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => setConfirmCerrar(true)}
            disabled={llevo <= 0}
            className="pressable btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={16} /> Finalizar compra · {formatMoney(llevo)}
          </button>
          <p className="text-[11px] text-muted text-center leading-snug">
            Mientras no la finalices no se mueve un colón. Al cerrarla sale de tu cuenta
            solo lo que marcaste.
          </p>
        </>
      )}

      {/* Editar o eliminar la lista */}
      <div className="flex gap-2.5 pt-1">
        {onEdit && (
          <button
            onClick={onEdit}
            className="pressable btn-ghost flex-1 flex items-center justify-center gap-2 text-[13px]"
          >
            <Pencil size={14} /> Editar lista
          </button>
        )}
        <button
          onClick={() => setConfirmBorrar(true)}
          className="pressable flex-1 rounded-2xl font-semibold py-2.5 text-[13px] flex items-center justify-center gap-2"
          style={{ background: 'color-mix(in oklab, var(--c-danger) 12%, transparent)', color: 'var(--c-danger)' }}
        >
          <Trash2 size={14} /> Eliminar lista
        </button>
      </div>

      <ConfirmDialog
        open={confirmBorrar}
        title="¿Eliminar esta lista?"
        message={cerrada
          ? 'Se borra la lista de este mes. El movimiento de la compra ya cerrada se conserva en Movimientos, porque esa plata sí salió.'
          : 'Se borra la lista con todos sus productos. Como no la habías finalizado, no se mueve plata.'}
        confirmLabel="Eliminar"
        danger
        onCancel={() => setConfirmBorrar(false)}
        onConfirm={() => {
          deleteExpense(monthId, expense.id, 'mes')
          setConfirmBorrar(false)
          onDeleted?.()
        }}
      />

      <ConfirmDialog
        open={confirmCerrar}
        title="¿Finalizar la compra?"
        message={`Van a salir ${formatMoney(llevo)} de tu cuenta y se anota el movimiento. Lo que no marcaste no se cobra.`}
        confirmLabel="Sí, finalizar"
        onCancel={() => setConfirmCerrar(false)}
        onConfirm={() => { toggleDone(monthId, expense.id); setConfirmCerrar(false) }}
      />
    </div>
  )
}
