import { create } from 'zustand'

interface LoadingState {
  visible: boolean
  /** uno o varios mensajes: con varios, el overlay los va rotando */
  labels: string[]
  show(label?: string | string[]): void
  hide(): void
}

/** Cargando global de la app (mejora 4): fondo oscuro + marca SN al centro */
export const useLoading = create<LoadingState>((set) => ({
  visible: false,
  labels: [],
  show: (label = 'Cargando…') => set({ visible: true, labels: Array.isArray(label) ? label : [label] }),
  hide: () => set({ visible: false }),
}))

/** Envuelve una promesa mostrando el cargando global mientras corre */
export async function withLoading<T>(label: string | string[], fn: () => Promise<T>): Promise<T> {
  useLoading.getState().show(label)
  try {
    return await fn()
  } finally {
    useLoading.getState().hide()
  }
}
