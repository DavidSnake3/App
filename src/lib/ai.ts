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

export interface GeminiOpts {
  system?: string
  json?: boolean
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
}

export interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

export interface GeminiTurn {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export async function askGemini(prompt: string, opts: GeminiOpts = {}): Promise<string> {
  return geminiChat([{ role: 'user', parts: [{ text: prompt }] }], opts)
}

/** Conversación multi-turno con adjuntos (imágenes/PDF), usada por el chatbot */
export async function geminiChat(turns: GeminiTurn[], opts: GeminiOpts = {}): Promise<string> {
  const key = getGeminiKey()
  if (!key) throw new Error('Sin clave de IA')

  let lastErr: unknown = null
  for (const model of MODELS) {
    try {
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
            generationConfig: {
              temperature: opts.temperature ?? 0.7,
              maxOutputTokens: opts.maxTokens ?? 1024,
              ...(opts.json ? { responseMimeType: 'application/json' } : {}),
            },
          }),
        },
        opts.timeoutMs ?? 15_000,
      )
      // 404 = modelo retirado; 429/503 = saturado → probar el siguiente
      if (res.status === 404 || res.status === 429 || res.status === 503) {
        lastErr = new Error(`Modelo ${model} no disponible (${res.status})`)
        continue
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        const err = new Error(`Gemini ${res.status}: ${txt.slice(0, 200)}`) as Error & { permanent?: boolean }
        // 4xx permanente (clave inválida, petición mal formada…): reintentar
        // con otro modelo no lo arregla — fallar de una vez
        if (res.status >= 400 && res.status < 500) err.permanent = true
        throw err
      }
      const data = await res.json()
      const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? []
      // ignorar las partes de razonamiento interno del modelo
      const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('')
      if (!text) { lastErr = new Error(`Respuesta vacía de ${model}`); continue }
      return text.trim()
    } catch (e) {
      lastErr = e
      if ((e as { permanent?: boolean })?.permanent) throw e
      // error de red o modelo saturado: probar el siguiente
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('IA no disponible')
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

