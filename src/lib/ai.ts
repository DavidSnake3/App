// Integración con Google Gemini (punto 26) — con fallbacks sin conexión
const ENV_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? ''
const ENV_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? ''

let runtimeKey = ''
export function setRuntimeGeminiKey(k: string) { runtimeKey = k?.trim() ?? '' }
export function getGeminiKey(): string { return runtimeKey || ENV_KEY }
export function aiAvailable(): boolean { return getGeminiKey().length > 10 }

const MODELS = [
  ENV_MODEL || 'gemini-flash-latest',
  'gemini-flash-latest',
  'gemini-3.7-flash',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
].filter((m, i, a) => m && a.indexOf(m) === i)

/** fetch con tiempo límite: si un modelo está saturado pasamos al siguiente */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Declaración de una función que el modelo puede "llamar" (function calling).
 * Es el subconjunto OpenAPI que acepta Gemini: type, properties, required…
 */
export interface GeminiFunctionDecl {
  name: string
  description: string
  parameters?: Record<string, unknown>
}

export interface GeminiOpts {
  system?: string
  json?: boolean
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  /** modelo preferido (según el plan del usuario) */
  model?: string
  /** presupuesto de razonamiento: 0 = rápido, más = respuestas más pensadas */
  thinking?: number
  /** funciones que el modelo puede llamar (acciones de Snake) */
  tools?: GeminiFunctionDecl[]
}

/** Una llamada a función que devolvió el modelo, con sus argumentos ya como objeto */
export interface GeminiCall {
  name: string
  args: Record<string, unknown>
}

export interface GeminiResult {
  text: string
  calls: GeminiCall[]
}

/** Tokens REALES que reportó Gemini en la respuesta */
export interface GeminiUsage {
  prompt: number
  output: number
  total: number
}

let lastUsage: GeminiUsage = { prompt: 0, output: 0, total: 0 }

/** Consumo del último mensaje enviado a Gemini */
export function getLastUsage(): GeminiUsage {
  return lastUsage
}

export interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
  /** el modelo pidió ejecutar una función (turno 'model') */
  functionCall?: { name: string; args: Record<string, unknown> }
  /** lo que la app le responde a esa llamada (turno 'user') */
  functionResponse?: { name: string; response: Record<string, unknown> }
}

export interface GeminiTurn {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export async function askGemini(prompt: string, opts: GeminiOpts = {}): Promise<string> {
  return geminiChat([{ role: 'user', parts: [{ text: prompt }] }], opts)
}

type ApiError = Error & { status?: number }

/** Un intento contra un modelo. `fast` apaga el razonamiento interno (mucho más rápido). */
async function requestOnce(model: string, turns: GeminiTurn[], opts: GeminiOpts, fast: boolean): Promise<GeminiResult> {
  const key = getGeminiKey()
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: turns,
        ...(opts.system
          ? { systemInstruction: { parts: [{ text: opts.system }] } }
          : {}),
        // acciones de Snake como funciones: el modelo decide cuándo llamarlas
        ...(opts.tools?.length
          ? {
              tools: [{ functionDeclarations: opts.tools }],
              toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
            }
          : {}),
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxTokens ?? 1024,
          ...(opts.json ? { responseMimeType: 'application/json' } : {}),
          // Sin "pensar" el modelo responde en segundos en lugar de decenas.
          // Los planes pagos suben el presupuesto de razonamiento.
          ...(fast ? { thinkingConfig: { thinkingBudget: opts.thinking ?? 0 } } : {}),
        },
      }),
    },
    opts.timeoutMs ?? 15_000,
  )
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    const err = new Error(`Gemini ${res.status}: ${txt.slice(0, 200)}`) as ApiError
    err.status = res.status
    throw err
  }
  const data = await res.json()
  // consumo real reportado por la API (para los planes y la barra de uso)
  const meta = data?.usageMetadata ?? {}
  lastUsage = {
    prompt: Number(meta.promptTokenCount) || 0,
    output: Number(meta.candidatesTokenCount) || 0,
    total: Number(meta.totalTokenCount)
      || (Number(meta.promptTokenCount) || 0) + (Number(meta.candidatesTokenCount) || 0),
  }
  const parts: {
    text?: string
    thought?: boolean
    functionCall?: { name?: string; args?: Record<string, unknown> }
  }[] = data?.candidates?.[0]?.content?.parts ?? []
  // ignorar las partes de razonamiento interno del modelo
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim()
  const calls: GeminiCall[] = parts
    .filter((p) => p.functionCall?.name)
    .map((p) => ({ name: String(p.functionCall!.name), args: p.functionCall!.args ?? {} }))
  // sin texto y sin llamadas es una respuesta vacía de verdad
  if (!text && !calls.length) throw new Error(`Respuesta vacía de ${model}`)
  return { text, calls }
}

/** 4xx que ningún reintento arregla (clave inválida, petición mal formada…) */
function isPermanent(e: unknown): boolean {
  const s = (e as ApiError)?.status
  return typeof s === 'number' && s >= 400 && s < 500 && s !== 404 && s !== 429
}

/**
 * Conversación multi-turno con adjuntos y funciones, usada por el chatbot.
 * Devuelve el texto Y las llamadas a función que pidió el modelo.
 */
export async function geminiChatFull(turns: GeminiTurn[], opts: GeminiOpts = {}): Promise<GeminiResult> {
  if (!getGeminiKey()) throw new Error('Sin clave de IA')

  let lastErr: unknown = null
  const models = opts.model
    ? [opts.model, ...MODELS.filter((m) => m !== opts.model)]
    : MODELS
  for (const model of models) {
    // 1º en modo rápido (sin razonamiento). Si el modelo rechaza la opción
    // (400), un único reintento en modo normal; si tampoco acepta las
    // funciones, un último intento sin ellas; otros errores → siguiente modelo.
    try {
      return await requestOnce(model, turns, opts, true)
    } catch (e) {
      lastErr = e
      if (isPermanent(e)) {
        try {
          return await requestOnce(model, turns, opts, false)
        } catch (e2) {
          if (isPermanent(e2) && opts.tools?.length) {
            try {
              return await requestOnce(model, turns, { ...opts, tools: undefined }, false)
            } catch (e3) {
              if (isPermanent(e3)) throw e3
              lastErr = e3
              continue
            }
          }
          if (isPermanent(e2)) throw e2 // sí era permanente (p. ej. clave inválida)
          lastErr = e2
        }
      }
      // 404 retirado / 429 y 503 saturado / red o vacía: probar el siguiente
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('IA no disponible')
}

/** Versión que solo devuelve el texto (consejo del día, resúmenes…) */
export async function geminiChat(turns: GeminiTurn[], opts: GeminiOpts = {}): Promise<string> {
  const r = await geminiChatFull(turns, opts)
  return r.text
}

// ─── Consejo financiero diario (punto 16) ────────────────────────────────────

const STATIC_TIPS = [
  'Paga primero los servicios obligatorios: evitan recargos y cortes.',
  'La regla 50/30/20: 50% necesidades, 30% gustos, 20% ahorro o deuda.',
  'Anota cada gasto pequeño: los "hormiga" suman más de lo que crees.',
  'Si una deuda cobra intereses, abónale antes que a cualquier gusto.',
  'Programa tus pagos el mismo día que recibes el salario.',
  'Antes de comprar algo grande, espera 24 horas y decide en frío.',
  'Revisa tus suscripciones: cancela la que no usaste este mes.',
  'Un fondo de emergencia empieza con un 5% de cada salario.',
  'Compara precios en 3 lugares antes de compras mayores a un día de salario.',
  'Celebra cada deuda liquidada: la motivación también es finanzas.',
  'Divide el salario por quincenas para no quedarte corto al final.',
  'Deja el efectivo de la semana contado: lo que no ves no se gasta.',
  'Negocia tus deudas: una llamada puede bajar tu cuota o interés.',
  'Cocinar en casa 2 días más por semana libera dinero para tu deuda.',
  'Apunta la fecha de corte de cada servicio y págalo un día antes.',
  'El mejor mes para empezar a ahorrar siempre es este.',
  'Evita pagar el mínimo de la tarjeta: alarga la deuda por años.',
  'Un presupuesto no te limita: te dice a dónde SÍ puede ir tu dinero.',
  'Revisa tu progreso cada domingo: 5 minutos evitan sorpresas.',
  'Si te sobró dinero este mes, asígnalo antes de que "desaparezca".',
]

const TIP_CACHE_KEY = 'snb-daily-tip'

export async function getDailyTip(context: string, aiOn: boolean): Promise<{ tip: string; fromAI: boolean }> {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const cached = JSON.parse(localStorage.getItem(TIP_CACHE_KEY) ?? 'null') as
      | { date: string; tip: string; fromAI: boolean } | null
    if (cached?.date === today && cached.tip) return { tip: cached.tip, fromAI: cached.fromAI }
  } catch { /* caché corrupta */ }

  let tip = ''
  let fromAI = false
  if (aiOn && aiAvailable()) {
    try {
      tip = await askGemini(
        `Situación financiera del usuario:\n${context}\n\nDame UN consejo financiero breve (máximo 220 caracteres), práctico y específico para su situación de hoy. Español neutro, tono cercano y motivador, sin emojis, sin comillas.`,
        { system: 'Eres un asesor de finanzas personales conciso y práctico.', temperature: 0.9, maxTokens: 1024 },
      )
      if (tip.length < 25) tip = '' // respuesta degenerada → usar el consejo local
      fromAI = tip.length > 0
    } catch { /* sin conexión o cuota: usar estático */ }
  }
  if (!tip) {
    const day = Math.floor(Date.now() / 86_400_000)
    tip = STATIC_TIPS[day % STATIC_TIPS.length]
  }
  try { localStorage.setItem(TIP_CACHE_KEY, JSON.stringify({ date: today, tip, fromAI })) } catch { /* llena */ }
  return { tip, fromAI }
}

