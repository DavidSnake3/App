// Color de cada pago: el que el usuario eligió manda; si no, el de su tipo.
import type { AccountType, PayableItem } from '../types/finance'
import { accountLook } from './accountLooks'

/** Color por tipo de pago cuando el usuario no eligió uno */
export const KIND_COLORS: Record<PayableItem['kind'], string> = {
  gasto: 'var(--app-accent)',
  servicio: '#38bdf8',
  deuda: 'var(--c-warning)',
  personal: 'var(--c-income)',
}

/** Color con el que se pinta un pago en las listas y tarjetas */
export function itemColor(it: { color?: string; kind: PayableItem['kind'] }): string {
  return it.color || KIND_COLORS[it.kind]
}

/** Color por tipo de cuenta cuando el usuario no eligió uno */
export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  efectivo: 'var(--c-income)',
  corriente: 'var(--app-accent)',
  ahorros: '#38bdf8',
  credito: 'var(--c-danger)',
  inversion: 'var(--c-warning)',
}

/**
 * Color con el que se pinta una cuenta en toda la app: manda el que eligió el
 * usuario, si no el de su estilo (tarjeta azul, monedero…) y si no, el de su tipo.
 */
export function accountColor(
  a?: { color?: string; look?: string; type: AccountType } | null,
): string {
  if (!a) return 'var(--app-accent)'
  return a.color || accountLook(a.look)?.color || ACCOUNT_TYPE_COLORS[a.type]
}
