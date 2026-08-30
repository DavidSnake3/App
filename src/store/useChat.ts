import { create } from 'zustand'

interface ChatUI {
  open: boolean
  prefill: string
  openChat(prefill?: string): void
  closeChat(): void
}

/** Estado de apertura del chatbot Snake (cualquier pantalla puede abrirlo) */
export const useChat = create<ChatUI>((set) => ({
  open: false,
  prefill: '',
  openChat: (prefill = '') => set({ open: true, prefill }),
  closeChat: () => set({ open: false, prefill: '' }),
}))
