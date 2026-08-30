// "Snake": el chatbot asistente de SNBusiness (mejoras 1, 2, 8 y 15).
// Único punto de IA de la app: conoce todas las funciones, puede leer los
// datos del usuario para explicar cualquier número, armar planes de pago y
// ahorro a la medida, y registrar deudas desde una factura (imagen o PDF).
import type { Debt } from '../types/finance'
import { geminiChat, type GeminiTurn } from './ai'
import { buildPayables, debtEndMonthId, debtPaidCount, debtRemaining, getMonthSummary } from './finance'
import { carryOver, hormigasTotal, realBalance } from './fund'
import { PERIOD_LABEL, formatPayday, nextPaydays, payrollBreakdown } from './payroll'
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

export interface ChatAction {
  tipo: 'agregar_deuda'
  deuda: {
    name: string
    total: number
    monthlyPayment?: number
    installments?: number
    dueDay?: number
    account?: string
  }
}

// ─── Conocimiento de la app + datos del usuario ──────────────────────────────

const APP_KNOWLEDGE = `
Eres "Snake", el asistente financiero oficial de SNBusiness.
Personalidad: cercano, claro, breve y motivador. SIEMPRE en español. Sin emojis.
Formato: párrafos cortos; usa **negritas** para montos/nombres y listas con "- " cuando ayuden.

CONOCES LA APP COMPLETA (guía para el usuario):
- Pestañas: Inicio (widgets personalizables: mantener presionado ~1s para editar tamaño S/M/L, mover, quitar o agregar), Mes, Deudas, Año, Ajustes. Se puede deslizar entre pestañas.
- Mes: pagos del mes en 5 vistas (tarjetas, lista, tabla, calendario, gantt). Botón + para agregar gasto/servicio/personal con ícono, recurrencia y recordatorio. Los pagos se ponen rojos al acercarse su fecha límite. Al entrar a un mes nuevo la app PREGUNTA si copiar los recurrentes (nunca copia sola); las deudas siguen solas. El salario NO se edita aquí: viene de Ajustes → Ingresos y planilla (los "Adicionales" del mes sí se editan en línea). Botón "Compartir" para generar una imagen-resumen del mes.
- SALDO REAL: el usuario escribe cuánto tiene HOY en el banco (se configura en Ajustes → Ingresos) y desde entonces la app lo lleva en vivo: suma los pagos de salario al llegar y resta cada pago, gasto hormiga y aporte al ahorro. Se muestra junto al Balance en la tarjeta principal de Mes. El sobrante del mes se arrastra solo al siguiente (NO es ahorro, es lo que sobró). El ahorro va aparte.
- GASTOS HORMIGA (en Mes): anotar al instante gastos pequeños (café, uber…); se restan del saldo real y se ve el total del mes y de la semana.
- Deudas: cada deuda tiene estado de cuenta estilo recibo (saldo anterior, aporte capital/intereses, nuevo saldo, cuotas pagadas/pendientes, próximo pago, monto al día), historial de abonos y registro de abono con desglose. Una deuda puede pagarse "por planilla" (se deduce del salario y no aparece en el mes). Arriba hay una gráfica "camino a cero deudas" con la fecha en que quedará libre.
- Ahorro: plan mensual (% o fijo) + APORTES REALES con fecha (botón Apartar en el widget o en Ajustes). El progreso a la meta usa los aportes reales. Hay meta sugerida de FONDO DE EMERGENCIA = 3 meses de gastos promedio.
- Ingresos y planilla (Ajustes): el usuario configura su comprobante REAL como semanal, quincenal o mensual: salario bruto, % CCSS (10.83 por defecto en Costa Rica, calculado automático), deducciones (créditos/embargos) y ADELANTOS (un adelanto es su pago de la 1ª quincena, NO es plata perdida). El neto mensual se usa automáticamente como salario del mes actual y futuros. También configura cuándo le pagan (días, ajuste si cae en fin de semana) y su plan de ahorro (% o monto fijo, con meta).
- Año: calendario anual, proyección de ingresos/ahorro/gastos y gantt de deudas.
- Ajustes: cuenta (correo/Google, sincronización en la nube), tema (claro/oscuro, paletas, fondo propio), animaciones y 3+3 sonidos a elegir con pruebas, notificaciones y alarmas (con pruebas), exportar Excel, respaldo JSON, borrar datos.

REGLAS:
1) Cuando el usuario pregunte "por qué aparece tal monto", usa los DATOS DEL USUARIO de abajo y muestra la cuenta exacta (ej.: 665000 − 72019.50 CCSS − 181014 préstamo = 411966.50). IMPORTANTÍSIMO: un ADELANTO jamás se resta al explicar el ingreso mensual (es parte del pago). Con pago QUINCENAL, cada quincena llega la MITAD del neto mensual (la CCSS y las deducciones se reparten mitad y mitad entre las dos quincenas).
2) Para planes de cancelación de deudas o ahorro: usa su ingreso real, cuotas y fechas de pago; propone pasos concretos con montos y fechas, máximo 6 pasos, y una alternativa. Pregunta preferencias solo si faltan datos clave.
3) Si el usuario adjunta una FACTURA/recibo (imagen o PDF) o te da los datos de una deuda para agregarla: extrae nombre del comercio/banco, saldo TOTAL pendiente, cuota mensual, número de cuotas pendientes, día de pago y cuenta/referencia si aparece. Termina tu respuesta con un bloque EXACTAMENTE así (una sola línea, sin comentar dentro):
[[ACCION]]{"tipo":"agregar_deuda","deuda":{"name":"...","total":123,"monthlyPayment":123,"installments":12,"dueDay":22,"account":"..."}}[[/ACCION]]
Solo incluye el bloque si tienes al menos nombre y total; los demás campos son opcionales. Si el adjunto NO es una factura/recibo, dilo con amabilidad y no incluyas el bloque.
4) No inventes números: si algo no está en los datos, dilo.
5) Respuestas de máximo ~120 palabras salvo que pidan un plan detallado.
`

/** Fotografía completa y compacta del estado del usuario para el contexto */
export function buildUserContext(): string {
  const s = useFinanceStore.getState()
  const { profile, settings, debts, months } = s
  const nowId = currentMonthId()
  const bd = payrollBreakdown(settings.payroll)
  const lines: string[] = []

  lines.push(`Hoy: ${new Date().toLocaleDateString('es-CR')} (día ${todayDay()} del mes ${monthLabel(nowId)}).`)
  lines.push(`Usuario: ${profile.name || 'sin nombre'} · moneda ${profile.currency}.`)

  if (settings.payroll.gross > 0) {
    lines.push(
      `Planilla (${PERIOD_LABEL[settings.payroll.inputPeriod ?? 'monthly']}): bruto ${bd.gross}, CCSS ${settings.payroll.ccssPct}% = ${bd.ccss}, ` +
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
    const ahorrado = settings.savings.deposits.reduce((t, d) => t + d.amount, 0)
    lines.push(`Plan de ahorro: ${settings.savings.mode === 'percent' ? settings.savings.value + '% del neto' : settings.savings.value + ' fijo'} al mes${settings.savings.goal ? `, meta ${settings.savings.goal} (${settings.savings.goalName || 'sin nombre'})` : ''}. Ahorrado real (aportes): ${Math.round(ahorrado)}.`)
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
    const parsed = JSON.parse(m[1]) as ChatAction
    if (parsed?.tipo === 'agregar_deuda' && parsed.deuda?.name && parsed.deuda.total > 0) {
      return { clean, action: parsed }
    }
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

/**
 * Número seguro: la IA a veces devuelve montos como texto ("84,166.50") o
 * NaN — que al guardarse se vuelve null y el monto aparece mal al reabrir.
 */
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/** Convierte la acción del chat en el payload del store */
export function actionToDebt(a: ChatAction): Omit<Debt, 'id' | 'createdAt' | 'payments'> {
  const d = a.deuda
  const total = Math.max(1, Math.round(num(d.total)))
  const rawPago = num(d.monthlyPayment)
  const installments = Math.max(1, Math.round(num(d.installments) || (rawPago > 0 ? Math.ceil(total / rawPago) : 12)))
  const monthlyPayment = Math.max(1, Math.round(rawPago || total / installments))
  return {
    name: String(d.name ?? 'Deuda').slice(0, 60),
    total,
    monthlyPayment,
    installments,
    startMonthId: currentMonthId(),
    dueDay: Math.max(1, Math.min(31, Math.round(num(d.dueDay) || 15))),
    account: d.account ? String(d.account).slice(0, 40) : undefined,
  }
}
