// EL MAPA DE LA APP: la única fuente de verdad de qué hay, dónde está y cómo
// lo pediría una persona. De aquí sale lo que Snake sabe de la app (su prompt),
// la búsqueda local de módulos ("¿dónde veo las tarjetas?") y la ayuda.
//
// Regla: si se agrega un módulo, submenú o flujo a la app, se agrega AQUÍ.
// Así Snake nunca se queda atrás.
import type { TabId } from '../types/finance'

export interface AppPlace {
  /** id estable: se usa en el prompt y en la navegación */
  id: string
  tab: TabId
  /** submenú de la pestaña ('' = el menú de cuadros) */
  sub?: string
  titulo: string
  /** qué hace, en una frase */
  queHace: string
  /** cómo lo pediría alguien de Costa Rica (minúsculas, sin tildes también) */
  palabras: string[]
  /** acciones de Snake relacionadas (tipos del catálogo) */
  acciones?: string[]
}

export const TAB_LABEL: Record<TabId, string> = {
  home: 'Inicio',
  money: 'Dinero',
  month: 'Mes',
  reports: 'Reportes',
  settings: 'Ajustes',
}

export const APP_MAP: AppPlace[] = [
  // ── Inicio ──────────────────────────────────────────────────────────────
  {
    id: 'inicio', tab: 'home', titulo: 'Inicio',
    queHace: 'Widgets con tu efectivo real, el estado del mes, tarjetas, deudas y accesos rápidos. Se personalizan manteniendo presionado.',
    palabras: ['inicio', 'home', 'widgets', 'pantalla principal', 'resumen', 'accesos rapidos', 'personalizar inicio'],
  },
  // ── Dinero ──────────────────────────────────────────────────────────────
  {
    id: 'cuentas', tab: 'money', sub: 'cuentas', titulo: 'Cuentas',
    queHace: 'Efectivo, banco, ahorros y tarjetas. La suma de las cuentas (sin las de crédito) es el saldo real. Aquí se transfiere entre cuentas y se retira efectivo con tarjeta.',
    palabras: ['cuenta', 'cuentas', 'banco', 'efectivo', 'saldo', 'saldo real', 'cuanto tengo', 'plata', 'bac', 'bn', 'nacional', 'popular', 'transferencia', 'transferir', 'pasar plata', 'mover plata', 'retiro', 'sinpe'],
    acciones: ['agregar_cuenta', 'transferir', 'retiro_tarjeta', 'editar_cuenta', 'eliminar_cuenta'],
  },
  {
    id: 'movimientos', tab: 'money', sub: 'movimientos', titulo: 'Movimientos',
    queHace: 'Todo lo que entra y sale, con categoría, cuenta y fecha. Es el historial: los pagos, adelantos, compras cerradas y préstamos dejan aquí su movimiento.',
    palabras: ['movimiento', 'movimientos', 'historial', 'gaste', 'gasto', 'ingreso', 'entrada', 'salida', 'anotar', 'apuntar', 'registrar', 'compre', 'pague', 'me pagaron', 'deposito'],
    acciones: ['agregar_movimiento', 'editar_movimiento', 'eliminar_movimiento'],
  },
  {
    id: 'tarjetas', tab: 'money', sub: 'tarjetas', titulo: 'Tarjetas de crédito',
    queHace: 'Fecha de corte, fecha de pago, intereses, pago mínimo y compras a cuotas. Lo que gastás con tarjeta es deuda, no baja el efectivo; pagar la tarjeta baja ambos.',
    palabras: ['tarjeta', 'tarjetas', 'credito', 'visa', 'mastercard', 'corte', 'fecha de pago', 'pago minimo', 'minimo', 'interes', 'intereses', 'mora', 'cuotas', 'a cuotas', 'pagar la tarjeta', 'cuanto debo en la tarjeta'],
    acciones: ['agregar_tarjeta', 'pagar_tarjeta', 'compra_cuotas'],
  },
  {
    id: 'ahorros', tab: 'money', sub: 'ahorros', titulo: 'Ahorros',
    queHace: 'Sobres de ahorro con meta y aportes.',
    palabras: ['ahorro', 'ahorros', 'ahorrar', 'sobre', 'sobres', 'meta', 'guardar plata', 'alcancia'],
    acciones: ['crear_sobre', 'aportar_ahorro'],
  },
  {
    id: 'prestamos', tab: 'money', sub: 'prestamos', titulo: 'Le presté',
    queHace: 'Plata que le prestaste a alguien: cuánto te debe, desde cuándo y cada abono. Podés prestarle más a la misma persona.',
    palabras: ['le preste', 'preste', 'prestamo', 'prestamos', 'me deben', 'me debe', 'fiado', 'plata prestada', 'abono', 'me abono', 'me pago'],
    acciones: ['prestar', 'abono_prestamo', 'prestar_mas'],
  },
  {
    id: 'medebo', tab: 'money', sub: 'medebo', titulo: 'Me prestaron',
    queHace: 'Plata que alguien te prestó, informal y sin fecha: cuánto debés y lo que ya abonaste. Entra a la cuenta al recibirla y sale al abonar.',
    palabras: ['me prestaron', 'me presto', 'debo', 'le debo', 'yo debo', 'prestamo informal', 'me fiaron', 'abonarle', 'pagarle'],
    acciones: ['me_prestaron', 'abono_prestamo'],
  },
  // ── Mes ─────────────────────────────────────────────────────────────────
  {
    id: 'pagos', tab: 'month', sub: 'pagos', titulo: 'Pagos del mes',
    queHace: 'Servicios, gastos y personales del mes con su fecha de vencimiento. Se marcan pagados (y salen de la cuenta), aceptan adelantos parciales y, si son recurrentes, aparecen en todos los meses.',
    palabras: ['pago', 'pagos', 'pagos del mes', 'servicio', 'servicios', 'recibo', 'luz', 'agua', 'internet', 'alquiler', 'renta', 'vence', 'vencimiento', 'pendiente', 'pendientes', 'marcar pagado', 'ya pague', 'recurrente', 'fijo', 'todos los meses', 'adelanto', 'adelantar', 'abonar al recibo'],
    acciones: ['agregar_gasto', 'marcar_pagado', 'adelantar_pago', 'editar_gasto', 'eliminar_gasto', 'copiar_mes'],
  },
  {
    id: 'compras', tab: 'month', sub: 'compras', titulo: 'Lista de compras',
    queHace: 'Listas con productos y precios para ir marcando en el súper. Muestra el subtotal en vivo; al finalizar sale de la cuenta solo lo marcado.',
    palabras: ['lista de compras', 'lista', 'compras', 'super', 'supermercado', 'diario', 'mandado', 'carrito', 'productos', 'automercado', 'pali', 'walmart', 'maxi pali', 'mas x menos', 'pricesmart', 'feria'],
    acciones: ['crear_lista_compras', 'agregar_producto', 'marcar_producto', 'cerrar_lista', 'eliminar_lista'],
  },
  {
    id: 'deudas', tab: 'month', sub: 'deudas', titulo: 'Deudas',
    queHace: 'Préstamos formales con cuota mensual: cuántas cuotas van, cuánto falta y el abono del mes con desglose de capital e intereses.',
    palabras: ['deuda', 'deudas', 'cuota', 'cuotas', 'prestamo del banco', 'credito personal', 'carro', 'moto', 'casa', 'hipoteca', 'cuanto me falta', 'camino a cero'],
    acciones: ['agregar_deuda', 'pagar_cuota', 'editar_deuda', 'eliminar_deuda'],
  },
  {
    id: 'presupuestos', tab: 'month', sub: 'presupuestos', titulo: 'Presupuestos',
    queHace: 'Un límite por categoría o tema, con aviso al acercarse y al pasarse.',
    palabras: ['presupuesto', 'presupuestos', 'limite', 'tope', 'no pasarme', 'cuanto puedo gastar'],
    acciones: ['crear_presupuesto', 'eliminar_presupuesto'],
  },
  {
    id: 'plan', tab: 'month', sub: 'plan', titulo: 'Mi plan del mes',
    queHace: 'Balance del mes, reparto del ingreso (50/30/20 y otros) y cuánto sobra.',
    palabras: ['plan', 'mi plan', 'balance', 'sobrante', 'cuanto me sobra', '50 30 20', 'reparto', 'distribucion'],
  },
  // ── Reportes ────────────────────────────────────────────────────────────
  {
    id: 'ano', tab: 'reports', sub: 'ano', titulo: 'El año',
    queHace: 'Calendario anual, proyección de ingresos y gastos, y la deuda en el tiempo.',
    palabras: ['año', 'anual', 'proyeccion', 'el año', 'calendario anual', 'como va el año'],
  },
  {
    id: 'categorias-reporte', tab: 'reports', sub: 'categorias', titulo: 'Por categoría',
    queHace: 'En qué gastás más: dona y barras por categoría, por mes, por año o el periodo que elijás.',
    palabras: ['categoria', 'categorias', 'en que gasto', 'en que se va', 'dona', 'grafico', 'grafica', 'reporte por categoria', 'donde se va la plata'],
  },
  {
    id: 'reporte', tab: 'reports', sub: 'reporte', titulo: 'Reporte',
    queHace: 'Un reporte del periodo para compartir o exportar.',
    palabras: ['reporte', 'reportes', 'informe', 'resumen del mes', 'compartir', 'exportar', 'excel', 'pdf'],
    acciones: ['exportar_excel'],
  },
  // ── Ajustes ─────────────────────────────────────────────────────────────
  {
    id: 'perfil', tab: 'settings', sub: 'cuenta', titulo: 'Cuenta y perfil',
    queHace: 'Sesión, nombre, foto, moneda y región (formato de números y fechas).',
    palabras: ['perfil', 'mi cuenta', 'sesion', 'cerrar sesion', 'nombre', 'foto', 'moneda', 'colones', 'dolares', 'region', 'idioma'],
  },
  {
    id: 'ingresos', tab: 'settings', sub: 'ingresos', titulo: 'Ingresos y planilla',
    queHace: 'Tu salario, deducciones por ley y otras (por porcentaje o fijas), adelantos de salario, cuándo te pagan y pagos extraordinarios como el aguinaldo.',
    palabras: ['salario', 'sueldo', 'planilla', 'ingreso', 'ingresos', 'deduccion', 'deducciones', 'ccss', 'caja', 'renta', 'impuesto', 'quincena', 'me pagan', 'dia de pago', 'adelanto de salario', 'aguinaldo', 'neto', 'bruto', 'comprobante'],
  },
  {
    id: 'categorias', tab: 'settings', sub: 'categorias', titulo: 'Categorías',
    queHace: 'Crear categorías propias con ícono y color, y cambiar el color de las de la app.',
    palabras: ['categoria nueva', 'crear categoria', 'color de categoria', 'icono', 'iconos', 'personalizar categorias'],
    acciones: ['crear_categoria'],
  },
  {
    id: 'snake', tab: 'settings', sub: 'snake', titulo: 'Snake y planes',
    queHace: 'El plan del asistente (Gratis, Plus, Premium), su consumo y cuánta memoria de conversación tiene.',
    palabras: ['snake', 'asistente', 'plan', 'planes', 'premium', 'plus', 'gratis', 'suscripcion', 'limite de mensajes'],
  },
  {
    id: 'apariencia', tab: 'settings', sub: 'apariencia', titulo: 'Tema y apariencia',
    queHace: 'Modo claro u oscuro, paleta de colores y fondo.',
    palabras: ['tema', 'oscuro', 'claro', 'modo oscuro', 'color', 'colores', 'paleta', 'fondo', 'apariencia', 'diseño'],
    acciones: ['cambiar_tema'],
  },
  {
    id: 'animaciones', tab: 'settings', sub: 'animaciones', titulo: 'Animaciones y sonidos',
    queHace: 'Confeti, sonidos y vibración al pagar y al tocar.',
    palabras: ['animacion', 'animaciones', 'sonido', 'sonidos', 'vibracion', 'vibrar', 'confeti', 'silenciar', 'quitar sonidos'],
  },
  {
    id: 'notificaciones', tab: 'settings', sub: 'notificaciones', titulo: 'Notificaciones',
    queHace: 'Recordatorios antes de cada vencimiento y el modo alarma.',
    palabras: ['notificacion', 'notificaciones', 'recordatorio', 'recordatorios', 'alarma', 'aviso', 'avisos', 'que me avise'],
  },
  {
    id: 'datos', tab: 'settings', sub: 'datos', titulo: 'Datos y respaldo',
    queHace: 'Exportar a Excel, respaldo e importación, y borrar todo.',
    palabras: ['respaldo', 'backup', 'exportar', 'importar', 'excel', 'borrar todo', 'reiniciar', 'mis datos', 'copia'],
    acciones: ['exportar_excel'],
  },
  {
    id: 'ayuda', tab: 'settings', sub: 'ayuda', titulo: 'Ayuda y soporte',
    queHace: 'Repetir el recorrido de bienvenida, escribir a soporte o reportar un error.',
    palabras: ['ayuda', 'soporte', 'recorrido', 'tour', 'tutorial', 'como se usa', 'error', 'bug', 'contacto'],
    acciones: ['ver_recorrido'],
  },
]

/** Sin tildes ni mayúsculas, para comparar lo que escribe la gente */
export function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/**
 * Busca a qué parte de la app se refiere un texto, por palabras clave.
 * Devuelve los lugares ordenados por cuántas palabras coinciden.
 */
export function buscarLugar(texto: string, max = 3): AppPlace[] {
  const t = normalizar(texto)
  if (!t) return []
  const puntuados = APP_MAP.map((p) => {
    let pts = 0
    for (const k of p.palabras) {
      const kk = normalizar(k)
      if (t.includes(kk)) pts += kk.length > 6 ? 3 : kk.length > 3 ? 2 : 1
    }
    if (t.includes(normalizar(p.titulo))) pts += 4
    return { p, pts }
  }).filter((x) => x.pts > 0)
  puntuados.sort((a, b) => b.pts - a.pts)
  return puntuados.slice(0, max).map((x) => x.p)
}

/** "Mes › Lista de compras" */
export function rutaDe(p: AppPlace): string {
  return p.sub ? `${TAB_LABEL[p.tab]} › ${p.titulo}` : TAB_LABEL[p.tab]
}

/** El texto del mapa para el prompt de Snake: compacto y siempre al día */
export function mapaParaPrompt(): string {
  const porTab: Record<string, string[]> = {}
  for (const p of APP_MAP) {
    const linea = `- ${p.titulo}${p.sub ? ` (id: ${p.id})` : ''}: ${p.queHace}`
    ;(porTab[p.tab] ??= []).push(linea)
  }
  return (Object.keys(porTab) as TabId[])
    .map((tab) => `${TAB_LABEL[tab].toUpperCase()}\n${porTab[tab].join('\n')}`)
    .join('\n\n')
}
