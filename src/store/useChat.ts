import { create } from 'zustand'

/**
 * Intención con la que se abre el chat:
 * - 'welcome': Snake saluda y ofrece armar el plan (fin del onboarding)
 * - 'attach': igual, y abre directo el selector para subir el comprobante
 */
export type ChatIntent = 'none' | 'welcome' | 'attach'

interface ChatUI {
  open: boolean
  prefill: string
  intent: ChatIntent
  openChat(prefill?: string, intent?: ChatIntent): void
  closeChat(): void
}

/** Estado de apertura del chatbot Snake (cualquier pantalla puede abrirlo) */
export const useChat = create<ChatUI>((set) => ({
  open: false,
  prefill: '',
  intent: 'none',
  openChat: (prefill = '', intent = 'none') => set({ open: true, prefill, intent }),
  closeChat: () => set({ open: false, prefill: '', intent: 'none' }),
}))
