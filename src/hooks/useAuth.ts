import { useEffect, useRef, useState } from 'react'
import type { AppUser } from '../lib/firebase'
import { firebaseReady, loadCloud, rememberEmail, saveCloud, watchAuth, watchCloud } from '../lib/firebase'
import { exportState, useFinanceStore } from '../store/useFinanceStore'

const SKIP_KEY = 'snb-skip-auth'
const LAST_UID_KEY = 'snb-last-uid'

export interface AuthState {
  user: AppUser | null
  loading: boolean
  /** false mientras se leen los datos de la nube de esta cuenta */
  hydrated: boolean
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
  // hasta que la nube responde no sabemos si el usuario ya tiene datos:
  // sin esto se veía el onboarding un instante y luego saltaba al inicio
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(firebaseReady)
  const [skipped, setSkipped] = useState(() => {
    try { return localStorage.getItem(SKIP_KEY) === '1' } catch { return false }
  })
  const syncing = useRef(false)
  // Solo subimos cambios cuando ya leímos la nube con éxito: si la lectura
  // falló (red/permiso) subir podría PISAR los datos reales de esa cuenta
  const cloudReady = useRef(false)

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
      cloudReady.current = false
      setHydrated(false)
      // Aislamiento por cuenta (mejora 10): si entra un uid DISTINTO al último,
      // los datos locales del anterior se descartan (viven en SU nube) y esta
      // cuenta arranca desde su propia nube o desde cero. Nunca se mezclan.
      let lastUid: string | null = null
      try { lastUid = localStorage.getItem(LAST_UID_KEY) } catch { /* nada */ }
      const isDifferentAccount = Boolean(lastUid && lastUid !== user.uid)
      if (isDifferentAccount) {
        syncing.current = true
        useFinanceStore.getState().resetAll()
        syncing.current = false
        // El historial del chat también es por cuenta: no dejar residuos
        try {
          for (const k of Object.keys(localStorage)) {
            if (k.startsWith('snb-chat-')) localStorage.removeItem(k)
          }
        } catch { /* nada */ }
      }
      try { localStorage.setItem(LAST_UID_KEY, user.uid) } catch { /* nada */ }

      // Leer la nube con reintentos: null = "no hay documento" (cuenta nueva),
      // un error de red/permiso NO debe tratarse como cuenta vacía
      let remote: Awaited<ReturnType<typeof loadCloud>> = null
      let readOk = false
      for (let i = 0; i < 3 && !cancelled; i++) {
        try {
          remote = await loadCloud(user.uid)
          readOk = true
          break
        } catch {
          await new Promise((r) => setTimeout(r, 800 * (i + 1)))
        }
      }
      if (cancelled) return
      cloudReady.current = readOk

      const local = exportState()
      if (remote && (isDifferentAccount || remote.updatedAt > local.updatedAt)) {
        syncing.current = true
        useFinanceStore.getState().hydrateFrom(remote)
        syncing.current = false
      } else if (readOk && !isDifferentAccount && local.updatedAt > 0) {
        await saveCloud(user.uid, local).catch(() => {})
      }

      setHydrated(true)

      // Completar datos del perfil con la cuenta (y recordar el último acceso)
      rememberEmail(user.email)
      const p = useFinanceStore.getState().profile
      if (!p.email && user.email) useFinanceStore.getState().setProfile({ email: user.email })
      if (!p.name && user.name) useFinanceStore.getState().setProfile({ name: user.name })
      if (user.photo && p.photoUrl !== user.photo) {
        useFinanceStore.getState().setProfile({ photoUrl: user.photo })
      }

      unsub = await watchCloud(user.uid, (remoteData) => {
        // Un snapshot entregado equivale a una lectura exitosa de la nube
        cloudReady.current = true
        const localNow = useFinanceStore.getState().updatedAt
        if (remoteData.updatedAt > localNow) {
          syncing.current = true
          useFinanceStore.getState().hydrateFrom(remoteData)
          syncing.current = false
        }
      })
      if (cancelled) unsub()
    }
    void run().catch(() => setHydrated(true))
    return () => { cancelled = true; unsub?.() }
  }, [user])

  // Subir cambios locales (con debounce)
  useEffect(() => {
    if (!user) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = useFinanceStore.subscribe((s, prev) => {
      if (syncing.current || !cloudReady.current) return
      if (s.updatedAt === prev.updatedAt) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (cloudReady.current) void saveCloud(user.uid, exportState()).catch(() => {})
      }, 1500)
    })
    return () => { if (timer) clearTimeout(timer); unsub() }
  }, [user])

  return {
    user,
    loading,
    hydrated: user ? hydrated : true,
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
