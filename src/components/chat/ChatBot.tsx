import { useEffect, useRef, useState } from 'react'
import { Check, Paperclip, RotateCcw, Send, X } from 'lucide-react'
import type { AuthState } from '../../hooks/useAuth'
import { useChat } from '../../store/useChat'
import { useFinanceStore } from '../../store/useFinanceStore'
import {
  actionToDebt, clearChat, loadChat, saveChat, sendToFin,
  type ChatAttachment, type ChatMsg,
} from '../../lib/chatbot'
import { aiAvailable } from '../../lib/ai'
import { withLoading } from '../../store/useLoading'
import { uid as newId } from '../../lib/finance'
import { formatMoney } from '../../lib/format'
import { compressImage } from '../../lib/themes'
import { AppLogo } from '../ui/AppLogo'
import { LoaderDots } from '../ui/Loader'

/** Avatar circular con la marca SN (sin mascota, a pedido del usuario) */
function SnAvatar({ size = 28, id }: { size?: number; id: string }) {
  return (
    <span
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        background: 'var(--c-elevated)',
        border: '1.5px solid color-mix(in oklab, var(--app-accent) 45%, var(--c-border))',
      }}
    >
      <AppLogo size={Math.round(size * 0.34)} id={id} />
    </span>
  )
}

const SUGERENCIAS = [
  '¿Cómo voy este mes?',
  'Hazme un plan para salir de mis deudas más rápido',
  '¿Por qué mi balance es ese monto?',
  'Quiero un plan de ahorro a mi medida',
]

/** Mensajes que rotan mientras Snake piensa (mejora del usuario) */
const THINKING_MSGS = [
  'Snake está pensando…',
  'Espera un momento…',
  'Verificando tus datos…',
  'Analizando tus números…',
  'La IA piensa más para darte una mejor respuesta financiera',
  'Puede que tome un tiempo…',
  'Pronto tendrás tu respuesta…',
]

/** Chatbot "Snake": único punto de IA de la app (mejoras 1, 2, 8, 15) */
export function ChatBot({ auth }: { auth: AuthState }) {
  const open = useChat((s) => s.open)
  const uidKey = auth.user?.uid ?? null
  if (!open) return null
  // remontar por sesión abierta: el estado inicial se lee en los useState
  return <ChatSession key={uidKey ?? 'local'} uidKey={uidKey} />
}

function ChatSession({ uidKey }: { uidKey: string | null }) {
  const prefill = useChat((s) => s.prefill)
  const closeChat = useChat((s) => s.closeChat)
  const addDebt = useFinanceStore((s) => s.addDebt)

  const [msgs, setMsgs] = useState<ChatMsg[]>(() => loadChat(uidKey))
  const [input, setInput] = useState(() => prefill)
  const [busy, setBusy] = useState(false)
  const [attach, setAttach] = useState<ChatAttachment | null>(null)
  const [attachMsg, setAttachMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  // último envío, para poder "Intentar de nuevo" si la IA falla
  const lastSend = useRef<{ text: string; attach: ChatAttachment | null }>({ text: '', attach: null })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs, busy])

  const persist = (list: ChatMsg[]) => { setMsgs(list); saveChat(uidKey, list) }

  /** Pregunta a Snake con el CARGANDO GLOBAL de la marca (bloquea la app) */
  const doAsk = async (base: ChatMsg[], history: ChatMsg[], text: string, att: ChatAttachment | null) => {
    setBusy(true)
    try {
      const res = await withLoading(THINKING_MSGS, () => sendToFin(history, text, att ?? undefined))
      persist([...base, { id: newId(), role: 'model', text: res.text, action: res.action }])
    } catch {
      persist([...base, {
        id: newId(), role: 'model', failed: true,
        text: aiAvailable()
          ? 'No pude conectarme ahora mismo (la IA está saturada o no hay internet).'
          : 'Necesito que el administrador configure la clave de IA en Ajustes para poder ayudarte.',
      }])
    } finally {
      setBusy(false)
    }
  }

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if ((!text && !attach) || busy) return
    const userMsg: ChatMsg = { id: newId(), role: 'user', text, attachment: attach?.name }
    const base = [...msgs, userMsg]
    persist(base)
    setInput('')
    setAttachMsg('')
    const att = attach
    setAttach(null)
    lastSend.current = { text, attach: att }
    await doAsk(base, msgs, text, att)
  }

  /** Reintenta el último envío fallido sin duplicar el mensaje del usuario */
  const retry = async () => {
    if (busy) return
    const cleaned = msgs.filter((m) => !m.failed)
    await doAsk(cleaned, cleaned.slice(0, -1), lastSend.current.text, lastSend.current.attach)
  }

  const pickFile = async (f: File | undefined) => {
    if (!f) return
    setAttachMsg('')
    try {
      if (f.type === 'application/pdf') {
        if (f.size > 7 * 1024 * 1024) { setAttachMsg('Ese PDF pesa más de 7 MB. Prueba con una foto de la factura.'); return }
        const b64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
          r.onerror = () => reject(new Error('lectura'))
          r.readAsDataURL(f)
        })
        setAttach({ mimeType: 'application/pdf', data: b64, name: f.name })
      } else if (f.type.startsWith('image/')) {
        const dataUrl = await withLoading('Preparando tu imagen…', () => compressImage(f))
        setAttach({ mimeType: 'image/jpeg', data: dataUrl.split(',')[1] ?? '', name: f.name })
      } else {
        setAttachMsg('Solo puedo leer imágenes o PDF.')
      }
    } catch {
      setAttachMsg('No pude leer ese archivo. Prueba con otra foto o PDF.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmDebt = (m: ChatMsg) => {
    if (!m.action) return
    addDebt(actionToDebt(m.action))
    persist(msgs.map((x) => x.id === m.id ? { ...x, actionDone: true } : x))
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col max-w-[520px] mx-auto bg-surface anim-fade">
      {/* Encabezado: logo SN estático (sin animación, a pedido del usuario) */}
      <header
        className="flex items-center gap-3 px-4 pb-3 border-b border-edge shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', background: 'var(--c-card)' }}
      >
        <SnAvatar size={40} id="chat-h" />
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-[16.5px] font-bold text-ink leading-tight">Snake</h2>
          <p className="text-[11.5px]" style={{ color: 'var(--c-income)' }}>
            {busy ? 'escribiendo…' : 'Tu asistente financiero'}
          </p>
        </div>
        {msgs.length > 0 && (
          <button
            onClick={() => { clearChat(uidKey); setMsgs([]) }}
            aria-label="Nueva conversación"
            className="pressable w-9 h-9 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted"
          >
            <RotateCcw size={14} />
          </button>
        )}
        <button
          onClick={closeChat}
          aria-label="Cerrar chat"
          className="pressable w-9 h-9 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted"
        >
          <X size={16} />
        </button>
      </header>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center text-center pt-6 anim-pop">
            <span style={{ animation: 'splashFloat 2.6s ease-in-out infinite' }}>
              <AppLogo size={72} id="chat-hero" />
            </span>
            <h3 className="font-display text-[19px] font-bold text-ink mt-3">¡Hola! Soy Snake</h3>
            <p className="text-[13px] text-muted mt-1.5 max-w-[280px] leading-relaxed">
              Conozco toda tu app y tus números. Pregúntame lo que sea, pídeme planes
              o adjúntame una factura para registrar una deuda.
            </p>
            <div className="flex flex-col gap-2 w-full mt-5">
              {SUGERENCIAS.map((s) => (
                <button key={s} onClick={() => void send(s)} className="pressable card px-4 py-3 text-[13.5px] text-ink text-left">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'model' && <span className="shrink-0 mt-1"><SnAvatar size={26} id={`b-${m.id}`} /></span>}
            <div
              className="max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed"
              style={m.role === 'user'
                ? { background: 'var(--app-gradient)', color: '#fff', borderBottomRightRadius: 6 }
                : { background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-text)', borderBottomLeftRadius: 6 }}
            >
              {m.attachment && (
                <p className="text-[11px] opacity-80 mb-1 flex items-center gap-1">
                  <Paperclip size={10} /> {m.attachment}
                </p>
              )}
              <RichText text={m.text} />
              {m.action && (
                <div className="mt-2.5 rounded-xl border border-edge bg-elevated/60 p-3">
                  <p className="text-[12px] font-bold text-ink mb-1">Nueva deuda detectada</p>
                  <p className="text-[12px] text-muted">
                    <span className="font-semibold text-ink">{m.action.deuda.name}</span>
                    {' · total '}<span className="num font-semibold text-ink">{formatMoney(m.action.deuda.total)}</span>
                    {m.action.deuda.monthlyPayment ? <> · cuota <span className="num">{formatMoney(m.action.deuda.monthlyPayment)}</span></> : null}
                    {m.action.deuda.installments ? ` · ${m.action.deuda.installments} cuotas` : ''}
                    {m.action.deuda.dueDay ? ` · vence d${m.action.deuda.dueDay}` : ''}
                  </p>
                  {m.actionDone ? (
                    <p className="text-[12px] font-semibold mt-2 flex items-center gap-1" style={{ color: 'var(--c-income)' }}>
                      <Check size={13} /> Deuda agregada: la ves en la pestaña Deudas
                    </p>
                  ) : (
                    <button
                      onClick={() => confirmDebt(m)}
                      className="pressable mt-2 w-full rounded-xl py-2 text-[13px] font-semibold text-white"
                      style={{ background: 'var(--app-accent)' }}
                    >
                      Agregar esta deuda
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex gap-2 justify-start">
            <span className="shrink-0 mt-1"><SnAvatar size={26} id="typing" /></span>
            <div className="rounded-2xl px-4 py-3 text-muted" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderBottomLeftRadius: 6 }}>
              <LoaderDots />
            </div>
          </div>
        )}

        {/* Reintentar el último envío fallido */}
        {!busy && msgs[msgs.length - 1]?.failed && (
          <button
            onClick={() => void retry()}
            className="pressable self-center chip chip-active !py-2 !px-4 text-[13px] font-semibold"
          >
            <RotateCcw size={13} /> Intentar de nuevo
          </button>
        )}
        <div ref={endRef} />
      </div>

      {/* Adjunto pendiente / avisos de adjunto */}
      {attach && (
        <div className="px-4 pb-1 shrink-0">
          <span className="chip chip-active">
            <Paperclip size={11} /> {attach.name}
            <button onClick={() => setAttach(null)} aria-label="Quitar adjunto" className="pressable ml-1"><X size={11} /></button>
          </span>
        </div>
      )}
      {attachMsg && (
        <p className="px-4 pb-1 shrink-0 text-[12px]" style={{ color: 'var(--c-danger)' }}>{attachMsg}</p>
      )}

      {/* Barra de entrada */}
      <div
        className="flex items-end gap-2 px-3 pt-2 border-t border-edge shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)', background: 'var(--c-card)' }}
      >
        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Adjuntar factura (imagen o PDF)"
          className="pressable w-11 h-11 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted shrink-0"
        >
          <Paperclip size={17} />
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          placeholder="Escríbele a Snake…"
          rows={1}
          className="input-base flex-1 resize-none max-h-28 !rounded-3xl"
          style={{ minHeight: 44 }}
        />
        <button
          onClick={() => void send()}
          disabled={busy || (!input.trim() && !attach)}
          aria-label="Enviar"
          className="pressable w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40"
          style={{ background: 'var(--app-gradient)' }}
        >
          <Send size={17} />
        </button>
      </div>
    </div>
  )
}

/** Render mínimo: **negritas**, saltos de línea y viñetas "- " */
function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, i) => {
        const bullet = line.startsWith('- ') || line.startsWith('• ')
        const content = bullet ? line.slice(2) : line
        const parts = content.split(/\*\*(.+?)\*\*/g)
        return (
          <p key={i} className={bullet ? 'pl-3 relative' : ''}>
            {bullet && <span className="absolute left-0" style={{ color: 'var(--app-accent-soft)' }}>•</span>}
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="font-bold">{p}</strong> : <span key={j}>{p}</span>)}
          </p>
        )
      })}
    </div>
  )
}
