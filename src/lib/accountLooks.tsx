// Cómo se ve cada cuenta: una carita de tarjeta, monedero o billete para
// reconocerla de un vistazo, igual que las reconocés en la billetera.
//
// Los estilos son propios (degradados de la casa), no logos de nadie. Si la
// tarjeta es Visa o Mastercard se escribe el nombre de la red en la esquina,
// que es lo que sirve para identificarla.
import {
  Banknote, Bitcoin, CreditCard, Landmark, PiggyBank, TrendingUp, Wallet,
} from 'lucide-react'
import type { AccountType } from '../types/finance'

export type AccountLookId =
  | 'azul' | 'negra' | 'verde' | 'blanca' | 'roja' | 'oro' | 'morada' | 'aqua'
  | 'efectivo' | 'monedero' | 'banco' | 'ahorro' | 'cripto' | 'inversion'

export interface AccountLook {
  id: AccountLookId
  label: string
  /** familia: las de tarjeta se dibujan con banda y chip */
  familia: 'tarjeta' | 'otro'
  /** degradado de la carita */
  gradient: string
  /** color base de la cuenta (acentos, gráficas, listas) */
  color: string
  /** color del texto encima de la carita */
  ink: string
  Icon: typeof CreditCard
}

export const ACCOUNT_LOOKS: AccountLook[] = [
  // ── Tarjetas ────────────────────────────────────────────────────────────
  {
    id: 'azul', label: 'Tarjeta azul', familia: 'tarjeta',
    gradient: 'linear-gradient(135deg, #4f7cff 0%, #1e40af 100%)',
    color: '#4f7cff', ink: '#ffffff', Icon: CreditCard,
  },
  {
    id: 'negra', label: 'Tarjeta negra', familia: 'tarjeta',
    gradient: 'linear-gradient(135deg, #3a3f4b 0%, #0b0d14 100%)',
    color: '#8b93a7', ink: '#ffffff', Icon: CreditCard,
  },
  {
    id: 'verde', label: 'Tarjeta verde', familia: 'tarjeta',
    gradient: 'linear-gradient(135deg, #34d399 0%, #047857 100%)',
    color: '#2dd4a0', ink: '#ffffff', Icon: CreditCard,
  },
  {
    id: 'blanca', label: 'Tarjeta blanca', familia: 'tarjeta',
    gradient: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
    color: '#94a3b8', ink: '#0b0d14', Icon: CreditCard,
  },
  {
    id: 'roja', label: 'Tarjeta roja', familia: 'tarjeta',
    gradient: 'linear-gradient(135deg, #ff5c7a 0%, #9f1239 100%)',
    color: '#ff5c7a', ink: '#ffffff', Icon: CreditCard,
  },
  {
    id: 'oro', label: 'Tarjeta oro', familia: 'tarjeta',
    gradient: 'linear-gradient(135deg, #fcd34d 0%, #b45309 100%)',
    color: '#fbbf24', ink: '#3b2607', Icon: CreditCard,
  },
  {
    id: 'morada', label: 'Tarjeta morada', familia: 'tarjeta',
    gradient: 'linear-gradient(135deg, #a78bfa 0%, #5b21b6 100%)',
    color: '#a78bfa', ink: '#ffffff', Icon: CreditCard,
  },
  {
    id: 'aqua', label: 'Tarjeta aqua', familia: 'tarjeta',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #0e7490 100%)',
    color: '#38bdf8', ink: '#ffffff', Icon: CreditCard,
  },
  // ── Lo demás ────────────────────────────────────────────────────────────
  {
    id: 'efectivo', label: 'Efectivo', familia: 'otro',
    gradient: 'linear-gradient(135deg, #4ade80 0%, #15803d 100%)',
    color: '#2dd4a0', ink: '#ffffff', Icon: Banknote,
  },
  {
    id: 'monedero', label: 'Monedero', familia: 'otro',
    gradient: 'linear-gradient(135deg, #fb923c 0%, #c2410c 100%)',
    color: '#f97316', ink: '#ffffff', Icon: Wallet,
  },
  {
    id: 'banco', label: 'Banco', familia: 'otro',
    gradient: 'linear-gradient(135deg, #818cf8 0%, #3730a3 100%)',
    color: '#7c5cff', ink: '#ffffff', Icon: Landmark,
  },
  {
    id: 'ahorro', label: 'Ahorros', familia: 'otro',
    gradient: 'linear-gradient(135deg, #f0abfc 0%, #a21caf 100%)',
    color: '#ec4899', ink: '#ffffff', Icon: PiggyBank,
  },
  {
    id: 'cripto', label: 'Criptomoneda', familia: 'otro',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #92400e 100%)',
    color: '#f59e0b', ink: '#ffffff', Icon: Bitcoin,
  },
  {
    id: 'inversion', label: 'Inversión', familia: 'otro',
    gradient: 'linear-gradient(135deg, #2dd4bf 0%, #115e59 100%)',
    color: '#14b8a6', ink: '#ffffff', Icon: TrendingUp,
  },
]

export function accountLook(id?: string): AccountLook | null {
  if (!id) return null
  return ACCOUNT_LOOKS.find((l) => l.id === id) ?? null
}

/** El estilo que se propone según el tipo de cuenta, si el usuario no eligió */
export function defaultLookFor(type: AccountType): AccountLookId {
  switch (type) {
    case 'efectivo': return 'efectivo'
    case 'corriente': return 'banco'
    case 'ahorros': return 'ahorro'
    case 'credito': return 'azul'
    case 'inversion': return 'inversion'
    default: return 'banco'
  }
}

/** Redes de tarjeta: solo el nombre, para reconocerla */
export const CARD_NETWORKS = ['Visa', 'Mastercard', 'Amex', 'Otra'] as const
export type CardNetwork = (typeof CARD_NETWORKS)[number]
