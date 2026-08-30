/* eslint-disable react-refresh/only-export-components -- catálogo compartido, no es una vista */
// Catálogo de íconos para gastos, servicios y deudas (mejora 10)
import {
  Baby, Banknote, Bike, BookOpen, Briefcase, Building2, Bus, Camera, Car,
  Cat, Coffee, CreditCard, Dog, Droplets, Dumbbell, Film, Flower2, Fuel,
  Gamepad2, Gift, GraduationCap, HandCoins, Headphones, Heart, House,
  Landmark, Laptop, Lightbulb, Music, PartyPopper, PawPrint, Phone,
  PiggyBank, Pill, Pizza, Plane, Receipt, Scissors, Shirt, ShoppingBag,
  ShoppingCart, Smartphone, Sofa, Sparkles, Stethoscope, Store, Trophy,
  Tv, Umbrella, Utensils, Wifi, Wrench,
} from 'lucide-react'

export const ITEM_ICONS: Record<string, { label: string; Icon: typeof House }> = {
  casa: { label: 'Casa / alquiler', Icon: House },
  luz: { label: 'Electricidad', Icon: Lightbulb },
  agua: { label: 'Agua', Icon: Droplets },
  wifi: { label: 'Internet', Icon: Wifi },
  celular: { label: 'Celular', Icon: Smartphone },
  telefono: { label: 'Teléfono', Icon: Phone },
  tv: { label: 'Streaming / TV', Icon: Tv },
  musica: { label: 'Música', Icon: Music },
  super: { label: 'Supermercado', Icon: ShoppingCart },
  comida: { label: 'Comidas', Icon: Utensils },
  pizza: { label: 'Antojos', Icon: Pizza },
  cafe: { label: 'Café', Icon: Coffee },
  carro: { label: 'Carro', Icon: Car },
  gasolina: { label: 'Gasolina', Icon: Fuel },
  bus: { label: 'Transporte', Icon: Bus },
  moto: { label: 'Moto / bici', Icon: Bike },
  viaje: { label: 'Viajes', Icon: Plane },
  salud: { label: 'Salud', Icon: Stethoscope },
  corazon: { label: 'Bienestar', Icon: Heart },
  gym: { label: 'Gimnasio', Icon: Dumbbell },
  ropa: { label: 'Ropa', Icon: Shirt },
  cine: { label: 'Entretenimiento', Icon: Film },
  juegos: { label: 'Videojuegos', Icon: Gamepad2 },
  regalo: { label: 'Regalos', Icon: Gift },
  bebe: { label: 'Bebé / niños', Icon: Baby },
  mascota: { label: 'Mascotas', Icon: PawPrint },
  educacion: { label: 'Educación', Icon: GraduationCap },
  banco: { label: 'Banco', Icon: Landmark },
  tarjeta: { label: 'Tarjeta', Icon: CreditCard },
  prestamo: { label: 'Préstamo', Icon: HandCoins },
  efectivo: { label: 'Efectivo', Icon: Banknote },
  belleza: { label: 'Belleza', Icon: Sparkles },
  reparacion: { label: 'Reparaciones', Icon: Wrench },
  recibo: { label: 'Recibo', Icon: Receipt },
  farmacia: { label: 'Farmacia', Icon: Pill },
  barberia: { label: 'Barbería', Icon: Scissors },
  libros: { label: 'Libros', Icon: BookOpen },
  trabajo: { label: 'Trabajo', Icon: Briefcase },
  oficina: { label: 'Oficina', Icon: Building2 },
  seguro: { label: 'Seguros', Icon: Umbrella },
  perro: { label: 'Perro', Icon: Dog },
  gato: { label: 'Gato', Icon: Cat },
  jardin: { label: 'Jardín', Icon: Flower2 },
  laptop: { label: 'Tecnología', Icon: Laptop },
  audio: { label: 'Audio', Icon: Headphones },
  foto: { label: 'Fotografía', Icon: Camera },
  muebles: { label: 'Muebles', Icon: Sofa },
  compras: { label: 'Compras', Icon: ShoppingBag },
  tienda: { label: 'Tienda', Icon: Store },
  fiesta: { label: 'Fiestas', Icon: PartyPopper },
  deporte: { label: 'Deportes', Icon: Trophy },
  ahorro: { label: 'Ahorro', Icon: PiggyBank },
}

export const ICON_IDS = Object.keys(ITEM_ICONS)

/** Ícono de un ítem: el elegido por el usuario o uno adivinado por el nombre */
export function ItemIcon({ icon, name, kind, size = 16 }: {
  icon?: string
  name?: string
  kind?: 'gasto' | 'servicio' | 'personal' | 'deuda'
  size?: number
}) {
  let key = icon && ITEM_ICONS[icon] ? icon : ''
  if (!key && name) {
    const n = name.toLowerCase()
    const guess: [string, string[]][] = [
      ['luz', ['luz', 'elect']], ['agua', ['agua']], ['wifi', ['internet', 'wifi']],
      ['celular', ['celular', 'móvil', 'movil']], ['tv', ['netflix', 'stream', 'tv', 'disney', 'hbo', 'max']],
      ['super', ['super', 'mercado', 'compra']], ['comida', ['comida', 'almuerzo', 'cena']],
      ['carro', ['carro', 'auto']], ['gasolina', ['gasolina', 'combust']], ['bus', ['pase', 'bus', 'transporte']],
      ['casa', ['alquiler', 'renta', 'casa', 'hipoteca']], ['gym', ['gym', 'gimnasio']],
      ['salud', ['salud', 'médic', 'medic', 'dentista', 'seguro']], ['educacion', ['escuela', 'colegio', 'universidad', 'curso']],
      ['mascota', ['mascota', 'perro', 'gato', 'veterinari']], ['prestamo', ['préstamo', 'prestamo', 'crédito', 'credito']],
      ['tarjeta', ['tarjeta']], ['moto', ['moto', 'bici']], ['regalo', ['regalo', 'cumple']],
    ]
    for (const [k, words] of guess) {
      if (words.some((w) => n.includes(w))) { key = k; break }
    }
  }
  if (!key) key = kind === 'deuda' ? 'prestamo' : kind === 'servicio' ? 'recibo' : kind === 'personal' ? 'corazon' : 'efectivo'
  const { Icon } = ITEM_ICONS[key]
  return <Icon size={size} />
}
