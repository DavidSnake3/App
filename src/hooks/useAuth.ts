import { useEffect, useRef, useState } from 'react'
import type { AppUser } from '../lib/firebase'
import { firebaseReady, loadCloud, rememberEmail, saveCloud, watchAuth, watchCloud } from '../lib/firebase'
import { exportState, useFinanceStore } from '../store/useFinanceStore'

const SKIP_KEY = 'snb-skip-auth'

export interface AuthState {
  user: AppUser | null
  loading: boolean
  skipped: boolean
  skip(): void
  unskip(): void
}

/**
 * Estado de sesión + sincronización bidireccional con Firestore.
 * Local primero: la app siempre funciona sin conexión; al iniciar sesión se
 * fusiona con la nube (gana el más reciente por updatedAt).
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(firebaseReady)
  const [skipped, setSkipped] = useState(() => {
    try { return localStorage.getItem(SKIP_KEY) === '1' } catch { return false }
  })
  const syncing = useRef(false)

  // Sesión
  useEffect(() => {
    if (!firebaseReady) return
    let unsub: (() => void) | undefined
    watchAuth((u) => {
      setUser(u)
      setLoading(false)
    }).then((fn) => { unsub = fn })
    return () => unsub?.()
  }, [])

  // Al iniciar sesión: fusionar con la nube y escuchar cambios remotos
  useEffect(() => {
    if (!user) return
    let unsub: (() => void) | undefined
    let cancelled = false

    const run = async () => {
      const local = exportState()
      const remote = await loadCloud(user.uid).catch(() => null)
      if (cancelled) return

      if (remote && remote.updatedAt > local.updatedAt) {
        syncing.current = true
        useFinanceStore.getState().hydrateFrom(remote)
        syncing.current = false
      } else if (local.updatedAt > 0) {
        await saveCloud(user.uid, local).catch(() => {})
      }

      // Completar datos del perfil con la cuenta (y recordar el último acceso)
      rememberEmail(user.email)
      const p = useFinanceStore.getState().profile
      if (!p.email && user.email) useFinanceStore.getState().setProfile({ email: user.email })
      if (!p.name && user.name) useFinanceStore.getState().setProfile({ name: user.name })
      if (user.photo && p.photoUrl !== user.photo) {
        useFinanceStore.getState().setProfile({ photoUrl: user.photo })
      }

      unsub = await watchCloud(user.uid, (remoteData) => {
        const localNow = useFinanceStore.getState().updatedAt
        if (remoteData.updatedAt > localNow) {
          syncing.current = true
          useFinanceStore.getState().hydrateFrom(remoteData)
          syncing.current = false
        }
      })
    }
    void run()
    return () => { cancelled = true; unsub?.() }
  }, [user])

  // Subir cambios locales (con debounce)
  useEffect(() => {
    if (!user) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = useFinanceStore.subscribe((s, prev) => {
      if (syncing.current) return
      if (s.updatedAt === prev.updatedAt) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void saveCloud(user.uid, exportState()).catch(() => {})
      }, 1500)
    })
    return () => { if (timer) clearTimeout(timer); unsub() }
  }, [user])

  return {
    user,
    loading,
    skipped,
    skip: () => {
      setSkipped(true)
      try { localStorage.setItem(SKIP_KEY, '1') } catch { /* nada */ }
    },
    unskip: () => {
      setSkipped(false)
      try { localStorage.removeItem(SKIP_KEY) } catch { /* nada */ }
    },
  }
}
