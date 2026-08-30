import { create } from 'zustand'

interface LoadingState {
  visible: boolean
  label: string
  show(label?: string): void
  hide(): void
}

/** Cargando global de la app (mejora 4): fondo oscuro + marca SN al centro */
export const useLoading = create<LoadingState>((set) => ({
  visible: false,
  label: '',
  show: (label = 'Cargando…') => set({ visible: true, label }),
  hide: () => set({ visible: false }),
}))

/** Envuelve una promesa mostrando el cargando global mientras corre */
export async function withLoading<T>(label: string, fn: () => Promise<T>): Promise<T> {
  useLoading.getState().show(label)
  try {
    return await fn()
  } finally {
    useLoading.getState().hide()
  }
}
