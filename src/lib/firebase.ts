// Firebase: autenticación (correo + Google) y sincronización en Firestore.
// Todo se importa de forma diferida: si no hay configuración, la app funciona
// 100% en modo local.
import type { FirebaseApp } from 'firebase/app'
import type { Auth, User } from 'firebase/auth'
import type { Firestore, Unsubscribe } from 'firebase/firestore'
import type { PersistedShape } from '../store/useFinanceStore'

// Configuración del proyecto "snbusiness". La config web de Firebase es
// pública por diseño (va dentro de la app); la seguridad la dan las reglas
// de Firestore. Las variables VITE_FIREBASE_* permiten apuntar a otro
// proyecto sin tocar el código.
const cfg = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) || 'AIzaSyCvn_oNdllbnJJs6uyPIW7sHjSspFq0BuY',
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || 'snbusiness.firebaseapp.com',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) || 'snbusiness',
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) || 'snbusiness.firebasestorage.app',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) || '738310182483',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) || '1:738310182483:web:1b462d45406022309d98a6',
}

/** true cuando el proyecto Firebase está configurado en .env */
export const firebaseReady = Boolean(cfg.apiKey && cfg.projectId && cfg.appId)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

async function ensureInit(): Promise<boolean> {
  if (!firebaseReady) return false
  if (app && auth && db) return true
  const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])
  app = initializeApp({
    apiKey: cfg.apiKey!,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId!,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId!,
  })
  auth = getAuth(app)
  db = getFirestore(app)
  return true
}

export interface AppUser {
  uid: string
  email: string
  name: string
  photo?: string
}

function toAppUser(u: User | null): AppUser | null {
  if (!u) return null
  return {
    uid: u.uid,
    email: u.email ?? '',
    name: u.displayName ?? u.email?.split('@')[0] ?? 'Usuario',
    photo: u.photoURL ?? undefined,
  }
}

export async function watchAuth(cb: (user: AppUser | null) => void): Promise<Unsubscribe> {
  if (!(await ensureInit())) { cb(null); return () => {} }
  const { onAuthStateChanged } = await import('firebase/auth')
  return onAuthStateChanged(auth!, (u) => cb(toAppUser(u)))
}

/** Correo del administrador de la app (único que ve la sección de IA) */
export const ADMIN_EMAIL = 'davidjosuevillegassalas@gmail.com'

export function isAdmin(user: AppUser | null): boolean {
  return (user?.email ?? '').trim().toLowerCase() === ADMIN_EMAIL
}

const LAST_EMAIL_KEY = 'snb-last-email'

export function getLastEmail(): string {
  try { return localStorage.getItem(LAST_EMAIL_KEY) ?? '' } catch { return '' }
}

export function rememberEmail(email: string) {
  try { if (email) localStorage.setItem(LAST_EMAIL_KEY, email) } catch { /* lleno */ }
}

export async function loginEmail(email: string, password: string): Promise<AppUser> {
  await ensureInit()
  const { signInWithEmailAndPassword } = await import('firebase/auth')
  const res = await signInWithEmailAndPassword(auth!, email, password)
  return toAppUser(res.user)!
}

export async function registerEmail(name: string, email: string, password: string): Promise<AppUser> {
  await ensureInit()
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth')
  const res = await createUserWithEmailAndPassword(auth!, email, password)
  if (name) await updateProfile(res.user, { displayName: name }).catch(() => {})
  return { ...toAppUser(res.user)!, name: name || toAppUser(res.user)!.name }
}

export async function loginGoogle(): Promise<AppUser | null> {
  await ensureInit()
  const { GoogleAuthProvider, signInWithCredential, signInWithPopup } = await import('firebase/auth')

  // Android (APK): acceso nativo con Credential Manager vía plugin
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
    const result = await FirebaseAuthentication.signInWithGoogle()
    const idToken = result.credential?.idToken
    if (!idToken) throw new Error('Google no devolvió credenciales')
    const cred = GoogleAuthProvider.credential(idToken, result.credential?.nonce)
    const res = await signInWithCredential(auth!, cred)
    return toAppUser(res.user)
  }

  // Web/PWA: SIEMPRE popup. (La redirección está rota con la partición de
  // cookies de Brave/Chrome modernos: deja al usuario varado en el handler.)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const res = await signInWithPopup(auth!, provider)
  return toAppUser(res.user)
}

export async function resetPassword(email: string): Promise<void> {
  await ensureInit()
  const { sendPasswordResetEmail } = await import('firebase/auth')
  await sendPasswordResetEmail(auth!, email)
}

export async function logout(): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
      await FirebaseAuthentication.signOut()
    }
  } catch { /* plugin no disponible */ }
  if (!auth) return
  const { signOut } = await import('firebase/auth')
  await signOut(auth)
}

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-email': 'El correo no es válido.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/cancelled-popup-request': 'Se cerró la ventana de Google antes de terminar.',
    'auth/popup-blocked': 'Tu navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio (ícono junto a la barra de direcciones) e intenta de nuevo.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase. Agrégalo en Authentication → Settings → Dominios autorizados.',
  }
  return map[code] ?? 'No se pudo completar. Intenta de nuevo.'
}

// ─── Sincronización de datos ─────────────────────────────────────────────────

/**
 * La imagen de fondo viaja en su PROPIO campo (`bg`) del documento: así el
 * JSON principal queda liviano y el fondo se conserva por cuenta en la nube.
 */
function stripForCloud(data: PersistedShape): PersistedShape {
  const clone: PersistedShape = JSON.parse(JSON.stringify(data))
  if (clone.settings?.theme?.background?.type === 'image') {
    clone.settings.theme.background = { type: 'image', value: '' }
  }
  return clone
}

// tope para no acercarnos al límite de 1 MiB del documento de Firestore
const BG_MAX_CHARS = 650_000

/** Reconstruye el estado desde el documento (reinyecta el fondo si viene) */
function parseCloudDoc(raw: Record<string, unknown>): PersistedShape | null {
  try {
    const parsed = JSON.parse(raw.data as string) as PersistedShape
    const bg = typeof raw.bg === 'string' ? raw.bg : ''
    const theme = parsed?.settings?.theme
    if (theme?.background?.type === 'image') {
      theme.background = bg
        ? { type: 'image', value: bg }
        : { type: 'default', value: 'noche' }
    }
    return parsed
  } catch {
    return null
  }
}

export async function saveCloud(uid: string, data: PersistedShape): Promise<void> {
  if (!(await ensureInit())) return
  const { doc, setDoc } = await import('firebase/firestore')
  const bgRaw = data.settings?.theme?.background?.type === 'image'
    ? data.settings.theme.background.value
    : ''
  await setDoc(doc(db!, 'users', uid), {
    data: JSON.stringify(stripForCloud(data)),
    bg: bgRaw.length <= BG_MAX_CHARS ? bgRaw : '',
    updatedAt: data.updatedAt,
    email: data.profile?.email ?? '',
  })
}

export async function loadCloud(uid: string): Promise<PersistedShape | null> {
  if (!(await ensureInit())) return null
  const { doc, getDoc } = await import('firebase/firestore')
  const snap = await getDoc(doc(db!, 'users', uid))
  if (!snap.exists()) return null
  return parseCloudDoc(snap.data())
}

export async function watchCloud(
  uid: string,
  cb: (data: PersistedShape) => void,
): Promise<Unsubscribe> {
  if (!(await ensureInit())) return () => {}
  const { doc, onSnapshot } = await import('firebase/firestore')
  return onSnapshot(doc(db!, 'users', uid), (snap) => {
    if (!snap.exists() || snap.metadata.hasPendingWrites) return
    const parsed = parseCloudDoc(snap.data())
    if (parsed) cb(parsed)
  })
}
