// La matemática de una lista de compras.
//
// Mientras la compra está ABIERTA el gasto vale lo planeado (todos los
// productos), para que el mes reserve esa plata. Al CERRARLA vale solo lo que
// de verdad se marcó, y ese es el monto exacto del movimiento que sale de la
// cuenta. Si nunca se cierra, no mueve un colón.
import type { Expense, ShoppingList, ShoppingProduct } from '../types/finance'

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

/** Lo que cuesta una línea: precio × cantidad (la cantidad nunca baja de 1) */
export function lineTotal(p: ShoppingProduct): number {
  return round2(p.price * Math.max(1, p.qty || 1))
}

/** Lo PLANEADO: todos los productos de la lista */
export function shoppingPlanned(l: ShoppingList): number {
  return round2(l.items.reduce((s, p) => s + lineTotal(p), 0))
}

/** Lo que LLEVO en el carrito: solo lo marcado */
export function shoppingChecked(l: ShoppingList): number {
  return round2(l.items.filter((p) => p.checked).reduce((s, p) => s + lineTotal(p), 0))
}

/**
 * Lo que va en el carrito AHORA, según cómo se usa la lista.
 *
 * En una lista planeada es lo marcado. En una compra en vivo todo lo que
 * agregaste ya está en el carrito: por eso no lleva checks.
 */
export function shoppingCart(l: ShoppingList): number {
  return l.mode === 'live' ? shoppingPlanned(l) : shoppingChecked(l)
}

/**
 * El número que vale el gasto en el mes.
 *
 * Si la compra ya se cerró con la factura, manda el TOTAL de la factura: ese
 * es el que de verdad se cobró (con impuestos y descuentos). Si no, vale lo
 * marcado al cerrar, o todo lo planeado mientras siga abierta.
 */
export function shoppingAmount(l: ShoppingList): number {
  if (!l.done) return shoppingPlanned(l)
  const total = l.totals?.total
  if (typeof total === 'number' && total > 0) return round2(total)
  return shoppingCart(l)
}

/** Deja el monto del gasto al día con su lista. Se llama en CADA cambio. */
export function syncShoppingAmount(e: Expense): Expense {
  if (!e.shopping) return e
  return { ...e, amount: shoppingAmount(e.shopping) }
}

/** Resumen que viaja a la lista de pagos para pintar el avance */
export function shoppingSummary(l: ShoppingList) {
  return {
    count: l.items.length,
    checkedCount: l.items.filter((p) => p.checked).length,
    total: shoppingPlanned(l),
    // ya cerrada, lo que cuenta es lo que se cobró de verdad
    checkedTotal: l.done ? shoppingAmount(l) : shoppingCart(l),
    done: l.done,
    /** la armás en el súper: todo lo agregado ya está en el carrito */
    live: l.mode === 'live',
  }
}

/** Copia limpia para otro mes: nada marcado, nada cerrado, sin factura */
export function resetShoppingForCopy(l: ShoppingList, newId: () => string): ShoppingList {
  return {
    ...l,
    done: false,
    doneAt: undefined,
    totals: undefined,
    items: l.items.map((p) => ({ ...p, id: newId(), checked: false, checkedAt: undefined })),
  }
}
