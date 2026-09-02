// "Snake": el chatbot asistente de SNFinance (mejoras 1, 2, 8 y 15).
// Único punto de IA de la app: conoce todas las funciones, puede leer los
// datos del usuario para explicar cualquier número, armar planes de pago y
// ahorro a la medida, y registrar deudas desde una factura (imagen o PDF).
import type { ActionData } from './chatActions'
import { actionSpec, catalogPrompt, toolDeclarations } from './chatActions'
import { geminiChatFull, getLastUsage, type GeminiTurn } from './ai'
import { BASIC_ACTIONS, planLimits } from './plans'
import { buildPayables, debtEndMonthId, debtPaidCount, debtRemaining, getMonthSummary } from './finance'
import { carryOver, envelopeTotal, realBalance, savingsTotal } from './fund'
import { PERIOD_LABEL, WORKER_LABEL, formatPayday, nextPaydays, payrollBreakdown, statutoryLabel } from './payroll'
import { addMonthsToId, currentMonthId, monthLabel, todayDay } from './dates'
import { formatDate, money2 } from './format'
import { useFinanceStore } from '../store/useFinanceStore'
import { makeLedger } from '../hooks/useLedger'
import {
  accountBalance, activeAccounts, cardStatement, installmentIsDone, installmentPaidCount,
  installmentRemaining, isCredit, monthMovements, movementsExpense, movementsIncome, totalCash,
} from './accounts'
import { mapaParaPrompt } from './appMap'

export interface ChatMsg {
  id: string
  role: 'user' | 'model'
  text: string
  /** nombre del archivo adjuntado (solo informativo) */
  attachment?: string
  /** acción propuesta por Snake pendiente de confirmar (formato viejo, un solo bloque) */
  action?: ChatAction
  actionDone?: boolean
  /** acciones propuestas en este mensaje (puede ser más de una) */
  actions?: ChatAction[]
  /** índices de `actions` ya ejecutadas o rechazadas */
  actionsDone?: Record<number, 'ok' | 'no'>
  /** el envío falló: se ofrece "Intentar de nuevo" */
  failed?: boolean
}

/**
 * Acción que Snake propone y el usuario confirma con un botón. El catálogo
 * vive en chatActions.ts (qué hace cada tipo y cómo se resume).
 */
export interface ChatAction {
  tipo: string
  datos: ActionData
}

// ─── Conocimiento de la app + datos del usuario ──────────────────────────────

const APP_KNOWLEDGE = () => `
Eres "Snake", el asistente financiero oficial de SNFinance.
Personalidad: cercano, claro, breve y motivador. SIEMPRE en español. Sin emojis.
Formato: párrafos cortos; usa **negritas** para montos/nombres y listas con "- " cuando ayuden.

CONOCES LA APP COMPLETA (guía para el usuario):
- Pestañas (5, cada una con un menú de cuadros): Inicio (widgets personalizables: mantener presionado ~1s para editar tamaño S/M/L, mover, quitar o agregar) · DINERO (Cuentas, Movimientos, Tarjetas, Ahorros, Le presté, Me prestaron) · MES (Pagos, Deudas, Lista de compras, Presupuestos, Mi plan) · REPORTES (El año, Categorías, Reporte) · AJUSTES (Cuenta y perfil, Ingresos y planilla, Categorías, Snake y planes, Tema, Animaciones y sonidos, Notificaciones, Datos y respaldo, Ayuda). Tocar una pestaña lleva siempre a su menú de cuadros; el atrás del celular cierra lo abierto, sale del submenú y vuelve a Inicio. El detalle de cada módulo está en el MAPA DE LA APP de abajo: úsalo para decir dónde está cada cosa.
- Mes: pagos del mes en 5 vistas (tarjetas, lista, tabla, calendario, gantt). Botón + para agregar gasto/servicio/personal con categoría, ícono, color, recurrencia y recordatorio. Los pagos se ponen rojos al acercarse su fecha límite. Un pago marcado como RECURRENTE aparece solo en TODOS los meses de ahí en adelante (al quitarlo se pregunta: solo este mes o dejar de repetirlo). Marcar un pago como PAGADO crea su movimiento y sale de la cuenta asignada. ADELANTOS: a un pago se le puede abonar una parte antes (ej. 15 000 de un recibo de 30 000): sale plata real con su movimiento y al marcarlo pagado solo se cobra lo que falta. "Copiar de otro mes" trae pagos de un mes anterior. El salario NO se edita aquí: viene de Ajustes → Ingresos y planilla.
- LISTA DE COMPRAS (Mes → Lista de compras): listas con título, tienda, productos con precio y cantidad, y checklist para ir marcando en el súper. Muestra el subtotal en vivo contra lo planeado. La lista aparece también en Pagos del mes; NO mueve plata hasta que se FINALIZA, y entonces sale de la cuenta SOLO lo marcado. Se puede reabrir, editar y eliminar. Snake puede crear una lista con varios productos de una vez (por ejemplo, a partir de una factura o de compras anteriores).
- CUENTAS (Dinero → Cuentas): el usuario registra sus cuentas contables: efectivo, cuenta corriente, cuenta de ahorros, inversión y TARJETAS DE CRÉDITO. La suma de las cuentas que no son de crédito es su EFECTIVO REAL (lo que de verdad tiene hoy). Cada cuenta tiene su saldo, se puede marcar como principal (ahí cae el salario y de ahí salen los pagos sin cuenta asignada) y se puede excluir del total.
- TARJETAS DE CRÉDITO (Dinero → Tarjetas): cada tarjeta tiene límite, día de CORTE, día de PAGO e interés (anual o mensual).
  La app calcula y explica: PAGO DE CONTADO (todo el saldo del corte; es el único que evita intereses), PAGO MÍNIMO y su desglose, mora y cargos.
  PAGO MÍNIMO: en Costa Rica NO es un % del saldo, es una cuota de plazo (Decreto 35867-MEIC): saldo del principal ÷ plazo de financiamiento (los bancos usan 48-66 meses, normalmente 60) + intereses del período + cuotas de compras a plazos + lo que esté en mora. En otros países sí es un % del saldo (México, Chile, Perú); el modo se configura por tarjeta.
  MORA: si no paga al menos el mínimo en la fecha límite. La tasa de mora es el interés corriente MÁS unos puntos (en Costa Rica normalmente 2) y se cobra SOLO sobre la parte de capital que quedó sin pagar, nunca sobre todo el saldo. Además suele haber un cargo por gestión de cobranza (en CR un 5% de lo que está en mora) a partir de unos días de atraso.
  Los intereses NO se capitalizan (no hay intereses sobre intereses).
  La app simula qué pasa pagando solo el mínimo (cuánto se paga y cuánto se sigue debiendo al final del plazo) y cuánto habría que pagar al mes para salir en 2 años.
  UTILIZACIÓN: el % del límite usado se mide el día del CORTE (lo recomendado es mantenerlo bajo 30%), así que para bajarlo hay que abonar ANTES del corte.
  RETIRO DE EFECTIVO con tarjeta: no tiene período de gracia, cobra comisión y genera intereses desde el mismo día. Es la forma más cara de usarla. REGLA CLAVE: lo que se gasta con tarjeta NO baja el efectivo, sube la deuda de la tarjeta; pagar la tarjeta baja el efectivo y baja la deuda. Si paga el saldo del corte antes de la fecha de pago no hay intereses; si se pasa, la app calcula el interés por los días de atraso y lo suma a lo que debe. También hay COMPRAS A CUOTAS: nombre, monto total, mensualidad, número de cuotas y día de pago; cada cuota se suma a la deuda de la tarjeta en su mes y se marca como pagada.
- MOVIMIENTOS (Dinero → Movimientos; antes "gastos hormiga"): cada entrada o salida real con CATEGORÍA (con ícono), CUENTA usada y FECHA. Tipos: gasto, ingreso y transferencia entre cuentas (así se paga la tarjeta). Se agrupan por día y se pueden buscar y filtrar.
- EFECTIVO REAL: sale de las cuentas. El salario suma al llegar y se restan los pagos, los movimientos en efectivo y los aportes al ahorro. El sobrante del mes se arrastra solo al siguiente (NO es ahorro, es lo que sobró). El ahorro va aparte.
- REPORTES → Categorías: dashboard de movimientos por tipo con rango mensual, anual o a la medida (fecha inicio y fecha fin), con dona por categoría, detalle, totales por cuenta y barras mes a mes.
- Deudas (Mes → Deudas): cada deuda tiene estado de cuenta estilo recibo (saldo anterior, aporte capital/intereses, nuevo saldo, cuotas pagadas/pendientes, próximo pago, monto al día), historial de abonos y registro de abono con desglose. Una deuda puede pagarse "por planilla" (se deduce del salario y no aparece en el mes). Arriba hay una gráfica "camino a cero deudas" con la fecha en que quedará libre.
- PRÉSTAMOS INFORMALES en dos direcciones. "LE PRESTÉ" (Dinero → Le presté): plata que el usuario le prestó a alguien, con cuánto, desde cuándo, préstamos adicionales a la misma persona y los abonos recibidos; lo prestado sale de la cuenta y cada abono vuelve. "ME PRESTARON" (Dinero → Me prestaron): plata que alguien le prestó al usuario, sin fecha ni papeles; entra a la cuenta al recibirla y cada abono que él hace sale de ella. Todo deja su movimiento.
- CATEGORÍAS (Ajustes → Categorías): cada categoría tiene ícono y color; el usuario puede crear las suyas y cambiar el color de las de la app. Cuentas y pagos también tienen color propio, y las cuentas tienen un estilo visual (tarjeta azul, negra, oro…, efectivo, monedero, banco, cripto).
- PRESUPUESTOS (Mes → Presupuestos): límites por categoría (ej. "Comida de la U: 30 000 al mes"), con avisos al llegar al 80% y al pasarse.
- PLAN FINANCIERO (Mes → Mi plan): reglas 50/30/20, 40/30/20/10, 60/20/20, 70/20/10 y 80/20. La app compara el reparto real del mes contra la regla elegida.
- Ahorro por SOBRES: el usuario crea varios ahorros (ej. Emergencias, Viaje), cada uno con su meta, con el dinero que ya tenía guardado y con aportes/retiros con fecha. El progreso usa el dinero real del sobre. Hay meta sugerida de FONDO DE EMERGENCIA = 3 meses de gastos promedio.
- La app es UNIVERSAL: al elegir el país se cargan sus deducciones de ley (una o varias: seguro social, pensión, salud), con techo de cotización opcional, los tramos del impuesto sobre la renta y sus pagos extraordinarios (aguinaldo, 13.º, 14.º, primas). Todo es editable en Ajustes → Ingresos. Nunca asumas Costa Rica: usa los nombres, % y tramos de los datos del usuario. Hay formato de números por región y una segunda moneda opcional con tipo de cambio manual.
- El usuario declara CÓMO recibe su dinero: asalariado, independiente, ambos, pensionado o sin ingreso fijo. Si NO es asalariado la app no resta deducciones de ley: lo que escribe es lo que recibe, y el control es más simple. Nunca le hables de planilla ni de deducciones si es independiente.
- El comprobante puede ser diario, semanal, cada 14 días, quincenal o mensual; la vista del dinero (semanal/quincenal/mensual) se cambia en la tarjeta de Balance.
- DEDUCCIONES: cada deducción del comprobante puede ser un MONTO FIJO o un PORCENTAJE (del bruto o del neto). Las deducciones de ley también pueden ser monto fijo. Si una deducción es un ADELANTO de salario, el usuario indica el DÍA en que se lo depositan y si pagan antes, después o el día exacto cuando cae fin de semana. Ejemplo real: pago mensual con un adelanto del 45,11% del bruto cada día 15. En ese caso la app sabe que el día 15 ya entró el adelanto y el resto (la liquidación) llega el día de pago; el calendario de pagos muestra los dos eventos.
- Ingresos y planilla (Ajustes): el usuario configura su comprobante REAL como semanal, quincenal o mensual: su país, salario bruto, nombre y % de la deducción de ley (se calcula automático), deducciones (créditos/embargos) y ADELANTOS (un adelanto es su pago de la 1ª quincena, NO es plata perdida). El neto mensual se usa automáticamente como salario del mes actual y futuros. También configura cuándo le pagan (días, ajuste si cae en fin de semana) y su plan de ahorro (% o monto fijo, con meta).
- Reportes → El año: calendario anual, proyección de ingresos/ahorro/gastos y gantt de deudas. Reportes → Reporte: reporte financiero del período.
- Ajustes → Snake y planes: plan del asistente (Gratis/Plus/Premium) con su consumo de mensajes y tokens del día.
- Ajustes: cuenta (correo/Google, sincronización en la nube), tema (claro/oscuro, paletas, fondo propio), animaciones y 3+3 sonidos a elegir con pruebas, notificaciones y alarmas (con pruebas), exportar Excel, respaldo JSON, borrar datos.

REGLAS:
1) Cuando el usuario pregunte "por qué aparece tal monto", usa los DATOS DEL USUARIO de abajo y muestra la cuenta exacta (ej.: 665000 − 72019.50 de deducción de ley − 181014 préstamo = 411966.50). IMPORTANTÍSIMO: un ADELANTO jamás se resta al explicar el ingreso mensual (es parte del pago). Con pago QUINCENAL, cada quincena llega la MITAD del neto mensual (la deducción de ley y las demás deducciones se reparten mitad y mitad entre las dos quincenas).
2) Para planes de cancelación de deudas o ahorro: usa su ingreso real, cuotas y fechas de pago; propone pasos concretos con montos y fechas, máximo 6 pasos, y una alternativa. Pregunta preferencias solo si faltan datos clave.
3) PUEDES HACER COSAS EN LA APP: crear, editar, borrar, mover plata y llevar al usuario a cualquier pantalla. Tienes FUNCIONES declaradas (una por acción): cuando el usuario pida registrar, cambiar, quitar o configurar algo, o te lea una factura, LLAMA a la función correspondiente con sus datos. Puedes llamar VARIAS en una misma respuesta (por ejemplo, tres movimientos de una factura) y acciones compuestas van en UNA sola llamada (una lista de compras con todos sus productos). El usuario ve una tarjeta por cada acción y decide: nada se guarda sin que confirme. Nunca digas que ya lo guardaste: di que se lo dejas listo para confirmar. Las de navegación (ir_a) y lectura (buscar_en_la_app) sí se ejecutan de inmediato.
Antes de proponer, VERIFICA con los DATOS DEL USUARIO: nombres de cuentas y pagos tal como existen, montos reales; si falta un dato clave pregúntalo en vez de inventarlo. Si hay un pago o lista que coincide, úsalo en vez de crear otro.
"Crea la lista del súper con lo de la factura de agosto" → busca en los datos los movimientos o listas de ese mes y llama crear_lista_compras con todos los productos y precios.
Si preguntan "¿dónde está…?" o "¿cómo hago…?", responde con la ruta (Pestaña › Módulo) del MAPA DE LA APP y ofrece llevarlo con ir_a.
Si por alguna razón no puedes llamar funciones, escribe al final UN bloque por acción, en una sola línea: [[ACCION]]{"tipo":"<tipo>","datos":{...}}[[/ACCION]]
Catálogo de acciones (tipo: qué hace y datos):
${catalogPrompt()}
Reglas: solo propón acciones con los datos mínimos; si el adjunto NO es una factura, dilo y no propongas nada.
4) No inventes números: si algo no está en los datos, dilo. Con tarjetas de crédito: NUNCA recomiendes pagar solo el mínimo; siempre da primero el pago de contado y, si no alcanza, la cuota para salir en 24 o 36 meses. Y explica el costo del mínimo con los números de la app.
5) Respuestas de máximo ~120 palabras salvo que pidan un plan detallado.
6) USUARIO NUEVO (sin planilla, sin gastos y sin deudas): acabas de darle la bienvenida. Guíalo paso a paso pidiéndole UNA cosa a la vez, empezando por su salario bruto y cada cuánto le pagan. Si te sube el comprobante, extrae el bruto, la deducción de ley y las demás deducciones, y dile los montos exactos. TÚ NO PUEDES escribir la planilla: dile dónde ponerlo (Ajustes → Ingresos y planilla) con los valores ya calculados, y ofrécele registrar sus deudas desde una factura. Nunca lo abrumes con todo de una vez.
`

/** Fotografía completa y compacta del estado del usuario para el contexto */
export function buildUserContext(): string {
  const s = useFinanceStore.getState()
  const { profile, settings, debts, months } = s
  const nowId = currentMonthId()
  const bd = payrollBreakdown(settings.payroll)
  const lines: string[] = []

  lines.push(`Hoy: ${formatDate(new Date().toISOString())} (día ${todayDay()} del mes ${monthLabel(nowId)}).`)
  lines.push(`Usuario: ${profile.name || 'sin nombre'} · moneda ${profile.currency} · ${WORKER_LABEL[profile.workerType ?? 'asalariado']}.`)

  if (settings.payroll.gross > 0) {
    lines.push(
      `Planilla (${PERIOD_LABEL[settings.payroll.inputPeriod ?? 'monthly']}): bruto ${bd.gross}, ${statutoryLabel(settings.payroll)} ${settings.payroll.ccssPct}% = ${bd.ccss}, ` +
      `deducciones reales: ${bd.deductions.map((d) => `${d.name} ${d.amount}`).join(', ') || 'ninguna'}; ` +
      `adelantos (1ª quincena): ${bd.advances.map((d) => `${d.name} ${d.amount}`).join(', ') || 'ninguno'}. ` +
      `Líquido del comprobante: ${bd.net}. Ingreso mensual real: ${bd.monthlyNet}.`,
    )
    const pays = nextPaydays(settings.paySchedule, bd, 3)
    lines.push(`Próximos pagos de salario: ${pays.map((p) => `${formatPayday(p.date)} ${money2(p.amount)}${p.label ? ` (${p.label})` : ''}`).join(' · ')}.`)
  } else {
    lines.push(`Sin planilla configurada. Salario neto mensual configurado: ${settings.defaultSalary}.`)
  }

  if (settings.savings.enabled) {
    const env = settings.savings.envelopes ?? []
    lines.push(
      `Plan de ahorro: ${settings.savings.mode === 'percent' ? settings.savings.value + '% del neto' : settings.savings.value + ' fijo'} al mes. ` +
      `Ahorrado total real: ${Math.round(savingsTotal(settings))}.` +
      (env.length ? ` Sobres: ${env.map((e) => `${e.name} ${Math.round(envelopeTotal(e))}${e.goal > 0 ? `/${e.goal}` : ''}`).join(', ')}.` : ''),
    )
  }

  // Cuentas, efectivo real y tarjetas de crédito
  const { accounts, installments, loans } = s
  const ledger = makeLedger({ months, accounts, installments, debts, loans, settings })
  const cuentasEfectivo = activeAccounts(accounts).filter((a) => !isCredit(a))
  if (cuentasEfectivo.length) {
    lines.push(
      `CUENTAS: ${cuentasEfectivo.map((a) => `${a.name} (${a.type}${a.isMain ? ', principal' : ''}) ${Math.round(accountBalance(a, ledger))}`).join(' · ')}. ` +
      `EFECTIVO REAL total: ${Math.round(totalCash(ledger))}.`,
    )
  }
  const tarjetas = activeAccounts(accounts).filter(isCredit)
  for (const t of tarjetas) {
    const st = cardStatement(t, ledger)
    lines.push(
      `TARJETA ${t.name}: debe ${money2(st.debt)}${t.credit?.limit ? ` de un límite de ${t.credit.limit} (${Math.round(st.usage * 100)}% usado, disponible ${Math.round(st.available)})` : ''}. ` +
      `Corte ${st.cutoffISO || '—'}, pago ${st.dueISO || '—'} (${st.overdue ? `VENCIDO hace ${Math.abs(st.daysToDue)} días` : `en ${st.daysToDue} días`}). ` +
      `Del corte hay que pagar ${Math.round(st.statementBalance)}, ya abonó ${Math.round(st.paidAfterCutoff)}, falta ${money2(st.pending)}. ` +
      `Interés ${st.monthlyRate.toFixed(2)}% mensual${st.interest > 0 ? `, interés acumulado por atraso ${Math.round(st.interest)}` : ''}.`,
    )
  }
  const cuotasActivas = installments.filter((i) => !installmentIsDone(i))
  if (cuotasActivas.length) {
    lines.push(
      `COMPRAS A CUOTAS: ${cuotasActivas.map((i) => {
        const tarjeta = accounts.find((a) => a.id === i.accountId)?.name ?? 'tarjeta'
        return `${i.name} en ${tarjeta}: ${i.monthly} x ${i.count} cuotas (día ${i.dueDay}), pagadas ${installmentPaidCount(i)}, falta ${Math.round(installmentRemaining(i))}`
      }).join(' · ')}.`,
    )
  }

  // Efectivo real y movimientos del mes
  const saldo = realBalance(months, debts, settings, new Date(), loans, accounts, installments)
  if (saldo != null) {
    const mesNow = months[nowId]
    const movs = mesNow ? monthMovements(mesNow) : []
    lines.push(
      `EFECTIVO REAL ahora: ${money2(saldo)} (incluye sobrante arrastrado ${Math.round(carryOver(months, debts, settings, loans, accounts))}). ` +
      `Movimientos de este mes: salió ${Math.round(movementsExpense(mesNow))}, entró ${Math.round(movementsIncome(mesNow))}` +
      (movs.length ? ` (últimos: ${movs.slice(0, 8).map((m) => `${m.name} ${m.kind === 'ingreso' ? '+' : '-'}${m.amount} [${m.categoryId}]`).join(', ')})` : '') + '.',
    )
  }

  // Mes activo + anterior (detalle) y totales del año
  for (const id of [s.activeMonthId, addMonthsToId(s.activeMonthId, -1)]) {
    const m = months[id]
    if (!m) continue
    const sum = getMonthSummary(m, debts)
    const items = buildPayables(m, debts)
    lines.push(
      `Mes ${monthLabel(id)}: ingresos ${sum.totalIncome} (salario ${m.income.salary} + adicionales ${m.income.additional}), ` +
      `pagos ${sum.totalExpenses}, balance ${sum.savings}, pagados ${sum.countPaid}/${sum.countTotal}. ` +
      `Detalle: ${items.map((i) => `${i.name}(${i.kind}) ${i.amount}${i.dueDay ? ` vence d${i.dueDay}` : ''} ${i.paid ? 'PAGADO' : 'pendiente'}`).join('; ') || 'sin pagos'}.`,
    )
  }

  if (debts.length) {
    lines.push('Deudas: ' + debts.map((d) => {
      const paid = debtPaidCount(d)
      return `${d.name}: total ${d.total}, saldo ${debtRemaining(d)}, cuota ${d.monthlyPayment}, ` +
        `cuotas ${paid}/${d.installments}, vence d${d.dueDay}, termina ${monthLabel(debtEndMonthId(d), true)}` +
        `${d.viaPlanilla ? ' (se paga por planilla)' : ''}`
    }).join(' | '))
  } else {
    lines.push('Sin deudas registradas.')
  }

  return lines.join('\n')
}

/**
 * Bienvenida local (sin gastar IA): Snake saluda y dice exactamente qué
 * necesita para armar el plan. Se muestra al terminar el onboarding.
 */
export function welcomeMessage(name?: string): string {
  const hola = name ? `¡Hola, ${name.split(' ')[0]}!` : '¡Hola!'
  return [
    `${hola} Soy **Snake**, tu asistente financiero. Ya tienes tu app lista, así que armemos tu plan.`,
    '',
    'Para hacerte un plan a tu medida necesito saber:',
    '- Tu salario **bruto** y cada cuánto te pagan (semanal, quincenal o mensual)',
    '- Tus deducciones: la **de ley** de tu país, créditos o adelantos que te rebajan',
    '- Tus **gastos fijos** y servicios del mes',
    '- Tus **deudas**: saldo, cuota y día de pago',
    '',
    'Tienes dos caminos:',
    '- **Súbeme tu comprobante salarial** (foto o PDF) con el clip de abajo y saco los datos por ti.',
    '- O **cuéntamelo por aquí** y te voy guiando paso a paso.',
    '',
    '¿Con cuál empezamos?',
  ].join('\n')
}

// ─── Historial (local, por cuenta) ───────────────────────────────────────────

function chatKey(uid: string | null): string {
  return `snb-chat-${uid ?? 'local'}`
}

/**
 * Marca de "la app sigue viva". sessionStorage sobrevive a minimizar la app y
 * volver (pause/resume del WebView), pero se pierde cuando el sistema la mata
 * o el usuario la cierra del todo. Así el chat se conserva mientras la app
 * esté abierta y arranca de cero en cada arranque en frío, sin acumular caché.
 */
const SESION_KEY = 'snb-chat-sesion'

function sesionViva(): boolean {
  try { return sessionStorage.getItem(SESION_KEY) === '1' } catch { return true }
}

function marcarSesion() {
  try { sessionStorage.setItem(SESION_KEY, '1') } catch { /* nada */ }
}

export function loadChat(uid: string | null): ChatMsg[] {
  // arranque en frío: la conversación anterior se descarta
  if (!sesionViva()) {
    clearChat(uid)
    marcarSesion()
    return []
  }
  try {
    return JSON.parse(localStorage.getItem(chatKey(uid)) ?? '[]') as ChatMsg[]
  } catch {
    return []
  }
}

export function saveChat(uid: string | null, msgs: ChatMsg[]) {
  try {
    localStorage.setItem(chatKey(uid), JSON.stringify(msgs.slice(-40)))
  } catch { /* lleno */ }
}

export function clearChat(uid: string | null) {
  try { localStorage.removeItem(chatKey(uid)) } catch { /* nada */ }
}

// ─── Enviar mensaje ──────────────────────────────────────────────────────────

export interface ChatAttachment {
  mimeType: string
  data: string // base64 sin prefijo
  name: string
}

/** Valida una acción cruda (de una función o de un bloque de texto) contra el catálogo */
function toAction(tipo: string, raw: unknown): ChatAction | null {
  const spec = actionSpec(tipo)
  if (!spec) return null
  const datos = (raw && typeof raw === 'object' ? raw : {}) as ActionData
  try {
    return spec.valid(datos) ? { tipo, datos } : null
  } catch {
    return null
  }
}

/**
 * Acciones escritas como texto (respaldo cuando el modelo no llama funciones).
 * Se aceptan TODOS los bloques del mensaje y nunca se muestra JSON crudo.
 */
function parseTextActions(text: string): { clean: string; actions: ChatAction[] } {
  const actions: ChatAction[] = []
  for (const m of text.matchAll(/\[\[ACCION\]\]([\s\S]*?)\[\[\/ACCION\]\]/g)) {
    try {
      const raw = JSON.parse(m[1]) as Record<string, unknown>
      const tipo = String(raw?.tipo ?? '')
      // se acepta {datos:{}} y también la forma vieja {deuda:{}} / {gasto:{}}…
      const datos = raw.datos ?? raw.deuda ?? raw.gasto ?? raw.planilla
        ?? raw.sobre ?? raw.aporte ?? raw.hormiga ?? raw.movimiento ?? raw
      const a = toAction(tipo, datos)
      if (a) actions.push(a)
    } catch { /* JSON inválido: se ignora ese bloque */ }
  }
  const clean = text
    .replace(/\[\[ACCION\]\][\s\S]*?\[\[\/ACCION\]\]/g, '')
    .replace(/\[\[ACCION\]\][\s\S]*$/, '')
    .trim()
  return { clean, actions }
}

/**
 * Snake recuerda TODA la conversación de la sesión, no solo los últimos
 * mensajes: los recientes van completos (según el plan) y los anteriores se
 * condensan en un resumen hecho aquí mismo, sin gastar IA. Así, si la persona
 * cambia de tema y vuelve, el hilo no se pierde.
 */
function recortarHistorial(history: ChatMsg[], recientes: number): GeminiTurn[] {
  const completos = history.slice(-recientes)
  const viejos = history.slice(0, Math.max(0, history.length - recientes))
  const turnos: GeminiTurn[] = []
  if (viejos.length) {
    const lineas = viejos
      .filter((m) => m.text)
      .map((m) => `${m.role === 'user' ? 'Usuario' : 'Snake'}: ${m.text.replace(/\s+/g, ' ').slice(0, 160)}`)
      .slice(-30)
    turnos.push(
      { role: 'user', parts: [{ text: `RESUMEN DE LO QUE YA HABLAMOS EN ESTA SESIÓN (antes de los mensajes siguientes):\n${lineas.join('\n')}` }] },
      { role: 'model', parts: [{ text: 'Perfecto, tengo presente todo lo anterior.' }] },
    )
  }
  for (const m of completos) {
    turnos.push({ role: m.role, parts: [{ text: m.text || '(adjunto)' }] })
  }
  return turnos
}

export async function sendToFin(
  history: ChatMsg[],
  userText: string,
  attachment?: ChatAttachment,
): Promise<{ text: string; actions: ChatAction[]; usage: number }> {
  const limits = planLimits(useFinanceStore.getState().profile.snakePlan)
  // en el plan gratis solo se ofrecen las acciones básicas
  const permitida = (tipo: string) => limits.allActions || BASIC_ACTIONS.has(tipo)
  const turns: GeminiTurn[] = [
    // contexto fresco en cada envío (los datos cambian)
    { role: 'user', parts: [{ text: `DATOS DEL USUARIO (actualizados ahora):\n${buildUserContext()}` }] },
    { role: 'model', parts: [{ text: 'Entendido, tengo los datos del usuario listos.' }] },
    ...recortarHistorial(history, limits.context),
    {
      role: 'user',
      parts: [
        ...(attachment ? [{ inlineData: { mimeType: attachment.mimeType, data: attachment.data } }] : []),
        { text: userText || (attachment ? 'Te adjunto una factura/recibo. Extrae los datos de la deuda para agregarla.' : '') },
      ],
    },
  ]

  const res = await geminiChatFull(turns, {
    tools: toolDeclarations(permitida),
    // el mapa de la app sale de appMap.ts: si la app cambia, Snake se entera solo
    system: `${APP_KNOWLEDGE()}\n\nMAPA DE LA APP (dónde está cada cosa; usa la ruta "Pestaña › Módulo" al indicar dónde ir):\n${mapaParaPrompt()}`,
    temperature: 0.6,
    maxTokens: limits.maxTokens,
    model: limits.model,
    thinking: limits.thinking,
    timeoutMs: attachment ? 40_000 : 18_000,
  })
  // primero las llamadas nativas; después, por si acaso, los bloques en texto
  const nativas = res.calls
    .map((c) => toAction(c.name, c.args))
    .filter((a): a is ChatAction => Boolean(a))
  const { clean, actions: enTexto } = parseTextActions(res.text)
  const actions = [...nativas, ...enTexto].filter((a) => permitida(a.tipo))

  // si el modelo solo llamó funciones y no escribió nada, se arma un texto corto
  const text = clean || (actions.length
    ? `Te dejo ${actions.length === 1 ? 'esto listo' : `${actions.length} acciones listas`} para confirmar.`
    : 'Listo.')
  return { text, actions, usage: getLastUsage().total }
}
