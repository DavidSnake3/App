import { useChat } from '../../store/useChat'
import { AppLogo } from '../ui/AppLogo'

/** Botón flotante del asistente (marca SN): abre el chat desde cualquier pestaña */
export function ChatLauncher() {
  const openChat = useChat((s) => s.openChat)
  return (
    <button
      onClick={() => openChat()}
      aria-label="Hablar con Snake, tu asistente"
      className="pressable absolute bottom-[20px] left-4 z-30 w-14 h-14 rounded-full flex items-center justify-center"
      style={{
        background: 'var(--c-card)',
        border: '2px solid color-mix(in oklab, var(--app-accent) 55%, var(--c-border))',
        boxShadow: '0 10px 26px rgb(0 0 0 / 0.35)',
        animation: 'splashFloat 3s ease-in-out infinite',
      }}
    >
      <AppLogo size={19} id="launcher" />
      <span
        className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
        style={{ background: 'var(--c-income)', borderColor: 'var(--c-card)' }}
        aria-hidden="true"
      />
    </button>
  )
}
