// Catálogo de categorías de movimientos. Cada una trae su ícono del catálogo
// compartido (lib/icons) y el usuario puede crear las suyas.
import type { Category, Movement } from '../types/finance'

/** Categorías que vienen con la app */
export const DEFAULT_CATEGORIES: Category[] = [
  // gastos del día a día
  { id: 'comida', name: 'Comida', icon: 'comida', kind: 'gasto', builtin: true },
  { id: 'super', name: 'Supermercado', icon: 'super', kind: 'gasto', builtin: true },
  { id: 'cafe', name: 'Café y antojos', icon: 'cafe', kind: 'gasto', builtin: true },
  { id: 'transporte', name: 'Transporte', icon: 'bus', kind: 'gasto', builtin: true },
  { id: 'gasolina', name: 'Gasolina', icon: 'gasolina', kind: 'gasto', builtin: true },
  { id: 'casa', name: 'Casa', icon: 'casa', kind: 'gasto', builtin: true },
  { id: 'servicios', name: 'Servicios', icon: 'recibo', kind: 'gasto', builtin: true },
  { id: 'salud', name: 'Salud', icon: 'salud', kind: 'gasto', builtin: true },
  { id: 'educacion', name: 'Educación', icon: 'educacion', kind: 'gasto', builtin: true },
  { id: 'ropa', name: 'Ropa', icon: 'ropa', kind: 'gasto', builtin: true },
  { id: 'ocio', name: 'Entretenimiento', icon: 'cine', kind: 'gasto', builtin: true },
  { id: 'tecnologia', name: 'Tecnología', icon: 'laptop', kind: 'gasto', builtin: true },
  { id: 'mascotas', name: 'Mascotas', icon: 'mascota', kind: 'gasto', builtin: true },
  { id: 'regalos', name: 'Regalos', icon: 'regalo', kind: 'gasto', builtin: true },
  { id: 'belleza', name: 'Cuidado personal', icon: 'belleza', kind: 'gasto', builtin: true },
  { id: 'deudas', name: 'Pago de deudas', icon: 'prestamo', kind: 'gasto', builtin: true },
  { id: 'preste', name: 'Le presté', icon: 'prestamo', kind: 'gasto', builtin: true },
  { id: 'otros', name: 'Otros', icon: 'efectivo', kind: 'ambos', builtin: true },
  // ingresos
  { id: 'salario', name: 'Salario', icon: 'trabajo', kind: 'ingreso', builtin: true },
  { id: 'extra', name: 'Ingreso extra', icon: 'banco', kind: 'ingreso', builtin: true },
  { id: 'venta', name: 'Venta', icon: 'tienda', kind: 'ingreso', builtin: true },
  { id: 'reembolso', name: 'Reembolso', icon: 'recibo', kind: 'ingreso', builtin: true },
  { id: 'me-pagaron', name: 'Me pagaron', icon: 'banco', kind: 'ingreso', builtin: true },
  // movimientos entre cuentas
  { id: 'transferencia', name: 'Entre cuentas', icon: 'banco', kind: 'ambos', builtin: true },
  { id: 'pago-tarjeta', name: 'Pago de tarjeta', icon: 'tarjeta', kind: 'ambos', builtin: true },
  { id: 'ahorro', name: 'Ahorro', icon: 'ahorro', kind: 'ambos', builtin: true },
]

/** Lista de categorías vigentes (las de la app + las del usuario, sin ocultas) */
export function categoryList(custom: Category[] | undefined, kind?: 'gasto' | 'ingreso'): Category[] {
  const list = mergeCategories(custom)
  return list
    .filter((c) => !c.hidden)
    .filter((c) => !kind || c.kind === kind || c.kind === 'ambos')
}

/** Categoría por id (o la de "Otros" si no existe) */
export function category(custom: Category[] | undefined, id?: string): Category {
  const list = custom?.length ? custom : DEFAULT_CATEGORIES
  return list.find((c) => c.id === id)
    // las categorías que trae la app siempre están disponibles, aunque el
    // usuario guardó su lista antes de que existieran
    ?? DEFAULT_CATEGORIES.find((c) => c.id === id)
    ?? list.find((c) => c.id === 'otros')
    ?? DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1]
}

/** Une las categorías guardadas con las nuevas que traiga la app */
export function mergeCategories(guardadas: Category[] | undefined): Category[] {
  if (!guardadas?.length) return DEFAULT_CATEGORIES
  const ids = new Set(guardadas.map((c) => c.id))
  const nuevas = DEFAULT_CATEGORIES.filter((c) => !ids.has(c.id))
  return nuevas.length ? [...guardadas, ...nuevas] : guardadas
}

/** Ícono que corresponde a un movimiento (el propio o el de su categoría) */
export function movementIcon(m: Movement, custom?: Category[]): string {
  return m.icon || category(custom, m.categoryId).icon
}

/**
 * Adivina la categoría por el nombre, para que registrar sea de un toque
 * (y para que Snake pueda registrar movimientos sin preguntar tanto).
 */
export function guessCategory(name: string, kind: 'gasto' | 'ingreso' = 'gasto'): string {
  const n = name.toLowerCase().trim()
  const reglas: [string, string[]][] = kind === 'ingreso'
    ? [
        ['salario', ['salario', 'sueldo', 'quincena', 'planilla', 'pago']],
        ['venta', ['venta', 'vendí', 'vendi']],
        ['reembolso', ['reembolso', 'devolución', 'devolucion']],
        ['extra', ['extra', 'bono', 'aguinaldo', 'propina', 'regalo']],
      ]
    : [
        ['super', ['super', 'automercado', 'walmart', 'maxi', 'palí', 'pali', 'mercado', 'pricesmart']],
        ['cafe', ['café', 'cafe', 'starbucks', 'antojo', 'dulce', 'snack', 'helado']],
        ['comida', ['comida', 'almuerzo', 'cena', 'desayuno', 'restaurante', 'soda', 'pizza', 'mcdonald', 'kfc', 'burger']],
        ['gasolina', ['gasolina', 'combustible', 'diesel', 'gas ']],
        ['transporte', ['bus', 'uber', 'didi', 'taxi', 'tren', 'pasaje', 'peaje', 'parqueo']],
        ['servicios', ['luz', 'agua', 'electricidad', 'internet', 'cable', 'recibo', 'wifi', 'celular', 'teléfono', 'telefono']],
        ['casa', ['alquiler', 'renta', 'hipoteca', 'casa', 'condominio', 'mueble']],
        ['salud', ['farmacia', 'medicina', 'doctor', 'médic', 'medic', 'dentista', 'clínica', 'clinica', 'consulta']],
        ['educacion', ['universidad', 'colegio', 'escuela', 'curso', 'libro', 'matrícula', 'matricula', 'u ']],
        ['ropa', ['ropa', 'zapato', 'tenis', 'camisa', 'pantalón', 'pantalon']],
        ['ocio', ['cine', 'netflix', 'spotify', 'disney', 'hbo', 'max', 'juego', 'fiesta', 'bar', 'cerveza', 'concierto']],
        ['tecnologia', ['celular', 'laptop', 'computadora', 'audífono', 'audifono', 'cargador', 'tecnología', 'tecnologia']],
        ['mascotas', ['perro', 'gato', 'mascota', 'veterinari', 'zoo']],
        ['belleza', ['barbería', 'barberia', 'corte', 'salón', 'salon', 'uñas', 'unas', 'gym', 'gimnasio']],
        ['regalos', ['regalo', 'cumpleaños', 'cumpleanos', 'navidad']],
        ['deudas', ['tarjeta', 'préstamo', 'prestamo', 'cuota', 'deuda', 'crédito', 'credito']],
      ]
  for (const [id, palabras] of reglas) {
    if (palabras.some((w) => n.includes(w))) return id
  }
  return kind === 'ingreso' ? 'extra' : 'otros'
}
