// "Snake": el chatbot asistente de SNFinance (mejoras 1, 2, 8 y 15).
// Único punto de IA de la app: conoce todas las funciones, puede leer los
// datos del usuario para explicar cualquier número, armar planes de pago y
// ahorro a la medida, y registrar deudas desde una factura (imagen o PDF).
import type { ActionData } from './chatActions'
import { actionSpec } from './chatActions'
import { geminiChat, type GeminiTurn } from './ai'
import { buildPayables, debtEndMonthId, debtPaidCount, debtRemaining, getMonthSummary } from './finance'
import { carryOver, envelopeTotal, hormigasTotal, realBalance, savingsTotal } from './fund'
import { PERIOD_LABEL, WORKER_LABEL, formatPayday, nextPaydays, payrollBreakdown, statutoryLabel } from './payroll'
import { addMonthsToId, currentMonthId, monthLabel, todayDay } from './dates'
import { useFinanceStore } from '../store/useFinanceStore'

export interface ChatMsg {
  id: string
  role: 'user' | 'model'
  text: string
  /** nombre del archivo adjuntado (solo informativo) */
  attachment?: string
  /** acción propuesta por Snake pendiente de confirmar */
  action?: ChatAction
  actionDone?: boolean
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

const APP_KNOWLEDGE = `
Eres "Snake", el asistente financiero oficial de SNFinance.
Personalidad: cercano, claro, breve y motivador. SIEMPRE en español. Sin emojis.
Formato: párrafos cortos; usa **negritas** para montos/nombres y listas con "- " cuando ayuden.

CONOCES LA APP COMPLETA (guía para el usuario):
- Pestañas: Inicio (widgets personalizables: mantener presionado ~1s para editar tamaño S/M/L, mover, quitar o agregar), Mes, Deudas, Año, Ajustes. Se puede deslizar entre pestañas.
- Mes: pagos del mes en 5 vistas (tarjetas, lista, tabla, calendario, gantt). Botón + para agregar gasto/servicio/personal con ícono, recurrencia y recordatorio. Los pagos se ponen rojos al acercarse su fecha límite. Al entrar a un mes nuevo la app PREGUNTA si copiar los recurrentes (nunca copia sola); las deudas siguen solas. El salario NO se edita aquí: viene de Ajustes → Ingresos y planilla (los "Adicionales" del mes sí se editan en línea). Botón "Compartir" para generar una imagen-resumen del mes.
- SALDO REAL: el usuario escribe cuánto tiene HOY en el banco (se configura en Ajustes → Ingresos) y desde entonces la app lo lleva en vivo: suma los pagos de salario al llegar y resta cada pago, gasto hormiga y aporte al ahorro. Se muestra junto al Balance en la tarjeta principal de Mes. El sobrante del mes se arrastra solo al siguiente (NO es ahorro, es lo que sobró). El ahorro va aparte.
- GASTOS HORMIGA (en Mes): anotar al instante gastos pequeños (café, uber…); se restan del saldo real y se ve el total del mes y de la semana.
- Deudas: cada deuda tiene estado de cuenta estilo recibo (saldo anterior, aporte capital/intereses, nuevo saldo, cuotas pagadas/pendientes, próximo pago, monto al día), historial de abonos y registro de abono con desglose. Una deuda puede pagarse "por planilla" (se deduce del salario y no aparece en el mes). Arriba hay una gráfica "camino a cero deudas" con la fecha en que quedará libre.
- Ahorro por SOBRES: el usuario crea varios ahorros (ej. Emergencias, Viaje), cada uno con su meta, con el dinero que ya tenía guardado y con aportes/retiros con fecha. El progreso usa el dinero real del sobre. Hay meta sugerida de FONDO DE EMERGENCIA = 3 meses de gastos promedio.
- La app es UNIVERSAL: al elegir el país se cargan sus deducciones de ley (una o varias: seguro social, pensión, salud), con techo de cotización opcional, los tramos del impuesto sobre la renta y sus pagos extraordinarios (aguinaldo, 13.º, 14.º, primas). Todo es editable en Ajustes → Ingresos. Nunca asumas Costa Rica: usa los nombres, % y tramos de los datos del usuario. Hay formato de números por región y una segunda moneda opcional con tipo de cambio manual.
- El usuario declara CÓMO recibe su dinero: asalariado, independiente, ambos, pensionado o sin ingreso fijo. Si NO es asalariado la app no resta deducciones de ley: lo que escribe es lo que recibe, y el control es más simple. Nunca le hables de planilla ni de deducciones si es independiente.
- El comprobante puede ser diario, semanal, cada 14 días, quincenal o mensual; la vista del dinero (semanal/quincenal/mensual) se cambia en la tarjeta de Balance.
- Ingresos y planilla (Ajustes): el usuario configura su comprobante REAL como semanal, quincenal o mensual: su país, salario bruto, nombre y % de la deducción de ley (se calcula automático), deducciones (créditos/embargos) y ADELANTOS (un adelanto es su pago de la 1ª quincena, NO es plata perdida). El neto mensual se usa automáticamente como salario del mes actual y futuros. También configura cuándo le pagan (días, ajuste si cae en fin de semana) y su plan de ahorro (% o monto fijo, con meta).
- Año: calendario anual, proyección de ingresos/ahorro/gastos y gantt de deudas.
- Ajustes: cuenta (correo/Google, sincronización en la nube), tema (claro/oscuro, paletas, fondo propio), animaciones y 3+3 sonidos a elegir con pruebas, notificaciones y alarmas (con pruebas), exportar Excel, respaldo JSON, borrar datos.

REGLAS:
1) Cuando el usuario pregunte "por qué aparece tal monto", usa los DATOS DEL USUARIO de abajo y muestra la cuenta exacta (ej.: 665000 − 72019.50 de deducción de ley − 181014 préstamo = 411966.50). IMPORTANTÍSIMO: un ADELANTO jamás se resta al explicar el ingreso mensual (es parte del pago). Con pago QUINCENAL, cada quincena llega la MITAD del neto mensual (la deducción de ley y las demás deducciones se reparten mitad y mitad entre las dos quincenas).
2) Para planes de cancelación de deudas o ahorro: usa su ingreso real, cuotas y fechas de pago; propone pasos concretos con montos y fechas, máximo 6 pasos, y una alternativa. Pregunta preferencias solo si faltan datos clave.
3) PUEDES HACER COSAS EN LA APP. Cuando el usuario te pida registrar, cambiar o configurar algo (o cuando le leas una factura), termina tu respuesta con UN bloque de acción en UNA sola línea, sin comentarios dentro:
[[ACCION]]{"tipo":"<tipo>","datos":{...}}[[/ACCION]]
El usuario ve una tarjeta y decide: nada se guarda sin que él toque el botón. Nunca digas que ya lo guardaste: di que se lo dejas listo para confirmar.
Tipos y datos disponibles:
- agregar_deuda: {name, total, monthlyPayment, installments, dueDay, account}
- agregar_gasto: {name, amount, kind:"gasto|servicio|personal", dueDay, recurrencia:"once|monthly|weekly|biweekly|annual"}
- marcar_pagado: {nombre}
- configurar_planilla: {bruto, periodo:"daily|weekly|fortnightly|biweekly|monthly", paisId:"cr|mx|co|...", deduccionNombre, deduccionPct}
- agregar_deduccion: {name, amount, esAdelanto:true|false}
- crear_sobre: {name, meta, actual}
- aportar_ahorro: {monto, sobre}
- agregar_hormiga: {name, amount}
- fijar_saldo: {monto}
- ingreso_extra: {monto}
Reglas: un solo bloque por respuesta; solo si tienes los datos mínimos (nombre/monto según el tipo); si falta algo pregúntalo antes; si el adjunto NO es una factura, dilo y no incluyas bloque.
4) No inventes números: si algo no está en los datos, dilo.
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

  lines.push(`Hoy: ${new Date().toLocaleDateString('es-CR')} (día ${todayDay()} del mes ${monthLabel(nowId)}).`)
  lines.push(`Usuario: ${profile.name || 'sin nombre'} · moneda ${profile.currency} · ${WORKER_LABEL[profile.workerType ?? 'asalariado']}.`)

  if (settings.payroll.gross > 0) {
    lines.push(
      `Planilla (${PERIOD_LABEL[settings.payroll.inputPeriod ?? 'monthly']}): bruto ${bd.gross}, ${statutoryLabel(settings.payroll)} ${settings.payroll.ccssPct}% = ${bd.ccss}, ` +
      `deducciones reales: ${bd.deductions.map((d) => `${d.name} ${d.amount}`).join(', ') || 'ninguna'}; ` +
      `adelantos (1ª quincena): ${bd.advances.map((d) => `${d.name} ${d.amount}`).join(', ') || 'ninguno'}. ` +
      `Líquido del comprobante: ${bd.net}. Ingreso mensual real: ${bd.monthlyNet}.`,
    )
    const pays = nextPaydays(settings.paySchedule, bd, 3)
    lines.push(`Próximos pagos de salario: ${pays.map((p) => `${formatPayday(p.date)} ${Math.round(p.amount)}${p.label ? ` (${p.label})` : ''}`).join(' · ')}.`)
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

  // Saldo real y gastos hormiga (control total del dinero)
  const saldo = realBalance(months, debts, settings)
  if (saldo != null) {
    const mesNow = months[nowId]
    const horm = mesNow ? hormigasTotal(mesNow) : 0
    lines.push(`SALDO REAL en el banco ahora: ${Math.round(saldo)} (incluye sobrante arrastrado ${Math.round(carryOver(months, debts, settings))}). Gastos hormiga de este mes: ${Math.round(horm)}${mesNow?.hormigas?.length ? ` (${mesNow.hormigas.slice(-8).map((h) => `${h.name} ${h.amount}`).join(', ')})` : ''}.`)
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

export function loadChat(uid: string | null): ChatMsg[] {
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

function parseAction(text: string): { clean: string; action?: ChatAction } {
  const m = text.match(/\[\[ACCION\]\]([\s\S]*?)\[\[\/ACCION\]\]/)
  // Nunca mostrar JSON crudo: quita bloques cerrados y aperturas sin cierre
  const clean = text
    .replace(/\[\[ACCION\]\][\s\S]*?\[\[\/ACCION\]\]/g, '')
    .replace(/\[\[ACCION\]\][\s\S]*$/, '')
    .trim()
  if (!m) return { clean }
  try {
    const raw = JSON.parse(m[1]) as Record<string, unknown>
    const tipo = String(raw?.tipo ?? '')
    const spec = actionSpec(tipo)
    if (!spec) return { clean }
    // se acepta {datos:{}} y también la forma vieja {deuda:{}} / {gasto:{}}…
    const datos = (raw.datos ?? raw.deuda ?? raw.gasto ?? raw.planilla
      ?? raw.sobre ?? raw.aporte ?? raw.hormiga ?? raw) as ActionData
    const action: ChatAction = { tipo, datos }
    if (spec.valid(datos)) return { clean, action }
  } catch { /* JSON inválido: ignorar la acción */ }
  return { clean }
}

export async function sendToFin(
  history: ChatMsg[],
  userText: string,
  attachment?: ChatAttachment,
): Promise<{ text: string; action?: ChatAction }> {
  const turns: GeminiTurn[] = [
    // contexto fresco en cada envío (los datos cambian)
    { role: 'user', parts: [{ text: `DATOS DEL USUARIO (actualizados ahora):\n${buildUserContext()}` }] },
    { role: 'model', parts: [{ text: 'Entendido, tengo los datos del usuario listos.' }] },
    ...history.slice(-12).map((m): GeminiTurn => ({
      role: m.role,
      parts: [{ text: m.text || '(adjunto)' }],
    })),
    {
      role: 'user',
      parts: [
        ...(attachment ? [{ inlineData: { mimeType: attachment.mimeType, data: attachment.data } }] : []),
        { text: userText || (attachment ? 'Te adjunto una factura/recibo. Extrae los datos de la deuda para agregarla.' : '') },
      ],
    },
  ]

  const raw = await geminiChat(turns, {
    system: APP_KNOWLEDGE,
    temperature: 0.6,
    maxTokens: 2048,
    timeoutMs: attachment ? 40_000 : 18_000,
  })
  const { clean, action } = parseAction(raw)
  return { text: clean || 'Listo.', action }
}
