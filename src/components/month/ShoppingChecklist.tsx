// El checklist de una lista de compras. El nombre del producto se lee entero
// y el precio nunca se corta: en el súper hay que ver qué es y cuánto cuesta
// de un vistazo.
//
// Dos formas de usarla:
//  · Lista planeada: la armás antes y vas marcando lo que echás al carrito.
//  · Compra en vivo: la armás EN el súper con el lector; todo lo que agregás
//    ya está en el carrito, así que no lleva checks.
import { useState } from 'react'
import {
  AlertTriangle, Check, Minus, Pencil, Plus, Receipt, ScanLine, ShoppingCart, Target, Trash2, Undo2,
} from 'lucide-react'
import type { Budget, Expense, ShoppingProduct } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { budgetStatus, periodLabel } from '../../lib/budgets'
import { lineTotal, shoppingCart, shoppingPlanned } from '../../lib/shopping'
import { scannerDisponible } from '../../lib/scanner'
import { taxTotal } from '../../lib/tax'
import { formatMoney, money2 } from '../../lib/format'
import { CurrencyInput } from '../ui/CurrencyInput'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { playPop, playTick } from '../../lib/sound'
import { vibrate } from '../../lib/fx'
import { ScanShopping } from './ScanShopping'
import { PurchaseCloseSheet } from './PurchaseCloseSheet'

export function ShoppingChecklist({ monthId, expense, onEdit, onDeleted }: {
  monthId: string
  expense: Expense
  /** abre la hoja para cambiar nombre, tienda, cuenta o color */
  onEdit?: () => void
  /** se llama después de eliminar la lista, para cerrar lo que la mostraba */
  onDeleted?: () => void
}) {
  const addProduct = useFinanceStore((s) => s.addShoppingProduct)
  const toggleProduct = useFinanceStore((s) => s.toggleShoppingProduct)
  const toggleDone = useFinanceStore((s) => s.toggleShoppingDone)
  const deleteExpense = useFinanceStore((s) => s.deleteExpense)
  const anims = useFinanceStore((s) => s.settings.animations)
  const budget = useFinanceStore((s) => s.budgets.find((b) => b.id === expense.budgetId))

  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [escaneando, setEscaneando] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [confirmBorrar, setConfirmBorrar] = useState(false)

  const lista = expense.shopping
  if (!lista) return null

  const enVivo = lista.mode === 'live'
  const llevo = shoppingCart(lista)
  const planeado = shoppingPlanned(lista)
  const marcados = lista.items.filter((p) => p.checked).length
  const pct = planeado > 0 ? Math.min(1, llevo / planeado) : 0
  const cerrada = lista.done

  // marcar suena a "pop" y vibra; desmarcar hace un tic seco
  const marcar = (productId: string, estabaMarcado: boolean) => {
    toggleProduct(monthId, expense.id, productId)
    if (anims.sounds) (estabaMarcado ? playTick : playPop)()
    if (!estabaMarcado) vibrate(10, anims)
  }

  const agregar = () => {
    if (!name.trim() || price <= 0) return
    addProduct(monthId, expense.id, { name: name.trim(), price: money2(price), qty: 1 })
    if (anims.sounds) playPop()
    setName('')
    setPrice(0)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Marcador: lo que llevo */}
      <div className="card-soft p-4 relative overflow-hidden">
        <span className="orb -right-8 -top-10 w-24 h-24" style={{ background: 'var(--app-gradient)' }} />
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <ShoppingCart size={12} /> {cerrada ? 'Compraste' : enVivo ? 'Llevás' : 'Llevo en el carrito'}
            </p>
            <p
              className="display-money text-[28px] font-bold leading-tight mt-1 anim-money"
              style={{ color: cerrada ? 'var(--c-income)' : 'var(--c-text)' }}
            >
              {formatMoney(cerrada ? expense.amount : llevo)}
            </p>
          </div>
          <div className="text-right shrink-0">
            {!enVivo && !cerrada && (
              <>
                <p className="text-[11px] text-muted">de</p>
                <p className="num text-[15px] font-semibold text-ink">{formatMoney(planeado)}</p>
              </>
            )}
            <p className="text-[10.5px] text-muted">
              {enVivo
                ? `${lista.items.length} ${lista.items.length === 1 ? 'producto' : 'productos'}`
                : `${marcados} de ${lista.items.length}`}
            </p>
          </div>
        </div>

        {!enVivo && !cerrada && (
          <div className="h-2 rounded-full bg-elevated overflow-hidden mt-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.round(pct * 100)}%`, background: 'var(--app-gradient)' }}
            />
          </div>
        )}


      </div>

      {/* Cuánto llevás del presupuesto al que está enlazada */}
      {budget && (
        <BudgetBar budget={budget} expense={expense} enCurso={cerrada ? 0 : llevo} />
      )}

      {/* Escanear: solo mientras la compra sigue abierta */}
      {!cerrada && scannerDisponible() && (
        <button
          onClick={() => setEscaneando(true)}
          className="pressable rounded-2xl py-3 flex items-center justify-center gap-2 font-semibold text-[13.5px] text-white"
          style={{ background: 'var(--app-gradient)' }}
        >
          <ScanLine size={17} /> Escanear productos
        </button>
      )}

      {/* Productos */}
      {lista.items.length === 0 ? (
        enVivo ? null : (
          <p className="text-[12.5px] text-muted text-center py-3 leading-snug">
            Agregá lo que vas a comprar y su precio. Después marcás lo que vas echando.
          </p>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {lista.items.map((p) => (
            <ProductRow
              key={p.id}
              monthId={monthId}
              expenseId={expense.id}
              product={p}
              enVivo={enVivo}
              cerrada={cerrada}
              onToggle={() => marcar(p.id, p.checked)}
            />
          ))}
        </div>
      )}

      {/* Agregar a mano */}
      {!cerrada && (
        <div className="flex gap-2">
          <input
            className="input-base flex-1 min-w-0"
            placeholder="Ej. Arroz, leche, jabón…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') agregar() }}
          />
          <CurrencyInput value={price} onChange={setPrice} className="w-28 shrink-0" />
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
            className="rounded-xl px-3.5 py-2.5 flex items-start gap-2.5"
            style={{ background: 'color-mix(in oklab, var(--c-income) 12%, transparent)' }}
          >
            <Check size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--c-income)' }} />
            <p className="text-[11.5px] text-ink leading-snug">
              Compra cerrada por <span className="num font-bold">{formatMoney(expense.amount)}</span>. Ya salió
              de tu cuenta y quedó en Movimientos.
            </p>
          </div>
          {lista.totals && <FacturaGuardada totals={lista.totals} />}
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
            onClick={() => setCerrando(true)}
            disabled={llevo <= 0}
            className="pressable btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={16} /> Finalizar compra · {formatMoney(llevo)}
          </button>
          <p className="text-[11px] text-muted text-center leading-snug">
            Mientras no la finalices no se mueve un colón.
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

      <ScanShopping
        monthId={monthId}
        expense={expense}
        open={escaneando}
        onClose={() => setEscaneando(false)}
      />

      <PurchaseCloseSheet
        monthId={monthId}
        expense={expense}
        open={cerrando}
        onClose={() => setCerrando(false)}
        onDone={() => setCerrando(false)}
      />

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
    </div>
  )
}

/* ─── Una línea de producto ─────────────────────────────────────────────── */

function ProductRow({ monthId, expenseId, product: p, enVivo, cerrada, onToggle }: {
  monthId: string
  expenseId: string
  product: ShoppingProduct
  enVivo: boolean
  cerrada: boolean
  onToggle: () => void
}) {
  const updateProduct = useFinanceStore((s) => s.updateShoppingProduct)
  const deleteProduct = useFinanceStore((s) => s.deleteShoppingProduct)
  const marcado = enVivo || p.checked

  return (
    <div
      className="card-soft px-3 py-2.5"
      style={marcado && !enVivo && !cerrada
        ? { borderColor: 'color-mix(in oklab, var(--c-income) 32%, var(--c-border))' }
        : undefined}
    >
      {/* Nombre: entero, en dos líneas si hace falta */}
      <div className="flex items-start gap-2.5">
        {!enVivo && (
          <button
            onClick={() => !cerrada && onToggle()}
            disabled={cerrada}
            aria-label={p.checked ? `Desmarcar ${p.name}` : `Marcar ${p.name}`}
            className="pressable w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 disabled:opacity-60"
            style={{
              borderColor: p.checked ? 'var(--c-income)' : 'var(--c-border)',
              background: p.checked ? 'var(--c-income)' : 'transparent',
              color: p.checked ? '#08281c' : 'var(--c-muted)',
            }}
          >
            <Check size={14} strokeWidth={3} style={{ opacity: p.checked ? 1 : 0.3 }} />
          </button>
        )}

        <p
          className={`flex-1 min-w-0 text-[13.5px] font-semibold leading-snug break-words ${p.checked && !enVivo ? 'line-through' : ''}`}
          style={{ color: p.checked && !enVivo ? 'var(--c-muted)' : 'var(--c-text)' }}
        >
          {p.name}
        </p>

        <span className="display-money text-[14.5px] font-bold text-ink shrink-0 tabular-nums">
          {formatMoney(lineTotal(p))}
        </span>
      </div>

      {/* Precio unitario y cantidad */}
      <div className={`flex items-center gap-2 mt-1.5 ${enVivo ? '' : 'pl-[38px]'}`}>
        <span className="num text-[11.5px] text-muted flex-1 min-w-0 truncate">
          {formatMoney(money2(p.price))} c/u
          {p.barcode && <span className="opacity-60"> · {p.barcode}</span>}
        </span>

        {!cerrada && (
          <span className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => (p.qty > 1
                ? updateProduct(monthId, expenseId, p.id, { qty: p.qty - 1 })
                : deleteProduct(monthId, expenseId, p.id))}
              aria-label={p.qty > 1 ? `Menos ${p.name}` : `Eliminar ${p.name}`}
              className="pressable w-7 h-7 rounded-lg bg-elevated border border-edge flex items-center justify-center text-muted"
            >
              {p.qty > 1 ? <Minus size={12} /> : <Trash2 size={11} />}
            </button>
            <span className="num text-[13px] font-bold text-ink w-6 text-center">{p.qty}</span>
            <button
              onClick={() => updateProduct(monthId, expenseId, p.id, { qty: p.qty + 1 })}
              aria-label={`Más ${p.name}`}
              className="pressable w-7 h-7 rounded-lg bg-elevated border border-edge flex items-center justify-center text-muted"
            >
              <Plus size={12} />
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── La factura que se guardó al cerrar ────────────────────────────────── */

function FacturaGuardada({ totals }: { totals: NonNullable<Expense['shopping']>['totals'] }) {
  if (!totals) return null
  const iva = taxTotal(totals)
  return (
    <div className="card p-3.5">
      <p className="text-[12px] font-semibold text-ink flex items-center gap-1.5 mb-2">
        <Receipt size={13} style={{ color: 'var(--app-accent-soft)' }} /> Tu factura
        {totals.reference && <span className="text-[10.5px] text-muted font-normal">· {totals.reference}</span>}
      </p>
      <div className="flex flex-col gap-1">
        <Linea label="Subtotal" value={totals.subtotal} />
        {Boolean(totals.discount) && <Linea label="Descuento" value={-(totals.discount ?? 0)} />}
        {Boolean(totals.exonerated) && <Linea label="Exonerado" value={-(totals.exonerated ?? 0)} />}
        {Boolean(totals.exempt) && <Linea label="Exento" value={totals.exempt ?? 0} apagado />}
        {(totals.taxes ?? []).map((t) => (
          <Linea key={t.rate} label={`Impuesto ${t.rate}%`} value={t.amount} />
        ))}
        {iva > 0 && <Linea label="Total de impuesto" value={iva} apagado />}
        <div className="flex items-center justify-between pt-1.5 mt-1 border-t" style={{ borderColor: 'var(--c-border)' }}>
          <span className="text-[12.5px] font-bold text-ink">Total</span>
          <span className="num text-[15px] font-bold text-ink">
            {formatMoney(money2(totals.total ?? totals.subtotal))}
          </span>
        </div>
      </div>
    </div>
  )
}

function Linea({ label, value, apagado }: { label: string; value: number; apagado?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-muted">{label}</span>
      <span
        className="num text-[12.5px] font-semibold"
        style={{ color: apagado ? 'var(--c-muted)' : value < 0 ? 'var(--c-danger)' : 'var(--c-text)' }}
      >
        {value < 0 ? '−' : ''}{formatMoney(Math.abs(money2(value)))}
      </span>
    </div>
  )
}

/* ─── Cuánto llevás del presupuesto enlazado ────────────────────────────── */

/**
 * La barra del presupuesto dentro de la lista.
 *
 * Mientras la compra está abierta suma lo que llevás en el carrito a lo que ya
 * gastaste del período: así ves si te vas a pasar ANTES de llegar a la caja.
 * Una vez cerrada, la compra ya está contada en el presupuesto y no se suma
 * dos veces.
 */
function BudgetBar({ budget, expense, enCurso }: {
  budget: Budget
  expense: Expense
  enCurso: number
}) {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const months = useFinanceStore((s) => s.months)

  const st = budgetStatus(budget, months[monthId], new Date(), months)
  const total = money2(st.spent + enCurso)
  const queda = money2(st.limit - total)
  const ratio = st.limit > 0 ? total / st.limit : 0
  const nivel = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok'
  const tono = nivel === 'over' ? 'var(--c-danger)' : nivel === 'warn' ? 'var(--c-warning)' : 'var(--c-income)'
  const pct = Math.min(100, Math.round(ratio * 100))

  return (
    <div
      className="rounded-2xl p-3.5"
      style={{ background: `color-mix(in oklab, ${tono} 10%, transparent)` }}
    >
      <div className="flex items-center gap-2">
        <Target size={13} style={{ color: tono }} className="shrink-0" />
        <span className="text-[12.5px] font-semibold text-ink flex-1 min-w-0 truncate">
          {budget.name}
        </span>
        <span className="num text-[12.5px] font-bold shrink-0" style={{ color: tono }}>
          {formatMoney(total)}
          <span className="text-[10.5px] text-muted font-normal"> de {formatMoney(st.limit)}</span>
        </span>
      </div>

      <div className="h-2 rounded-full bg-elevated overflow-hidden mt-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: tono }}
        />
      </div>

      <p className="text-[11px] mt-1.5 leading-snug" style={{ color: nivel === 'ok' ? 'var(--c-muted)' : tono }}>
        {nivel === 'over' ? (
          <><AlertTriangle size={10} className="inline mb-0.5" /> Te pasaste del presupuesto por{' '}
            <span className="num font-semibold">{formatMoney(Math.abs(queda))}</span>.</>
        ) : nivel === 'warn' ? (
          <><AlertTriangle size={10} className="inline mb-0.5" /> Vas al {pct}%: te quedan{' '}
            <span className="num font-semibold">{formatMoney(queda)}</span> {periodLabel(budget)}.</>
        ) : (
          <>Te quedan <span className="num font-semibold text-ink">{formatMoney(queda)}</span> {periodLabel(budget)}
            {enCurso > 0 && !expense.paid && ' contando lo del carrito'}.</>
        )}
      </p>
    </div>
  )
}
