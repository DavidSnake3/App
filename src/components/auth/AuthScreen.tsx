import { useEffect, useState } from 'react'
import { Eye, EyeOff, Lock, Mail, User as UserIcon } from 'lucide-react'
import { authErrorMessage, getLastEmail, loginEmail, loginGoogle, registerEmail, rememberEmail, resetPassword } from '../../lib/firebase'
import { withLoading } from '../../store/useLoading'
import { AppLogo } from '../ui/AppLogo'

type Mode = 'login' | 'register' | 'reset'

/** Inicio de sesión con correo y Google (autenticación Firebase) */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  // recuerda el último correo usado para no volver a escribirlo
  const [email, setEmail] = useState(() => getLastEmail())
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Fondo neutro mientras no hay sesión: la foto de la cuenta anterior
  // no debe verse al cerrar sesión (mejora 2)
  useEffect(() => {
    const root = document.documentElement
    const prevBg = document.body.style.background
    const prevDim = root.style.getPropertyValue('--bg-dim')
    document.body.style.background = 'radial-gradient(1200px 800px at 85% -10%, color-mix(in oklab, var(--app-accent) 22%, transparent), transparent 60%), var(--c-bg-base)'
    root.style.setProperty('--bg-dim', '0')
    return () => {
      document.body.style.background = prevBg
      root.style.setProperty('--bg-dim', prevDim)
    }
  }, [])

  const submit = async () => {
    setError(''); setInfo('')
    if (!email.trim()) { setError('Escribe tu correo.'); return }
    if (mode !== 'reset' && password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (mode === 'register' && name.trim().length < 2) { setError('Escribe tu nombre.'); return }
    setBusy(true)
    try {
      if (mode === 'login') {
        await withLoading('Entrando…', () => loginEmail(email.trim(), password))
        rememberEmail(email.trim())
      } else if (mode === 'register') {
        await withLoading('Creando tu cuenta…', () => registerEmail(name.trim(), email.trim(), password))
        rememberEmail(email.trim())
      } else {
        await resetPassword(email.trim())
        setInfo('Te enviamos un correo para restablecer tu contraseña.')
      }
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(''); setBusy(true)
    try {
      await withLoading('Conectando con Google…', () => loginGoogle())
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 pt-14 pb-10 flex flex-col items-center anim-page">
        <AppLogo size={76} />
        <h1 className="font-display text-[26px] font-bold text-ink mt-4">SNBusiness</h1>
        <p className="text-[13.5px] text-muted mt-1 text-center">
          {mode === 'login' && 'Entra para sincronizar tus finanzas'}
          {mode === 'register' && 'Crea tu cuenta en segundos'}
          {mode === 'reset' && 'Recupera tu acceso'}
        </p>

        <div className="w-full flex flex-col gap-3 mt-8">
          {mode === 'register' && (
            <InputIcon icon={<UserIcon size={15} />}>
              <input
                className="input-base !pl-10" placeholder="Tu nombre" value={name}
                onChange={(e) => setName(e.target.value)} autoComplete="name"
              />
            </InputIcon>
          )}
          <InputIcon icon={<Mail size={15} />}>
            <input
              className="input-base !pl-10" type="email" placeholder="Correo electrónico" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email"
            />
          </InputIcon>
          {mode !== 'reset' && (
            <InputIcon icon={<Lock size={15} />}>
              <input
                className="input-base !pl-10 !pr-11" type={showPass ? 'text' : 'password'} placeholder="Contraseña"
                value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="pressable absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </InputIcon>
          )}

          {error && <p className="text-[12.5px] anim-shake" style={{ color: 'var(--c-danger)' }}>{error}</p>}
          {info && <p className="text-[12.5px]" style={{ color: 'var(--c-income)' }}>{info}</p>}

          <button onClick={submit} disabled={busy} className="pressable btn-primary w-full disabled:opacity-60">
            {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviar correo'}
          </button>

          {mode !== 'reset' && (
            <>
              <div className="flex items-center gap-3 my-1">
                <span className="h-px flex-1 bg-edge" />
                <span className="text-[11.5px] text-muted">o</span>
                <span className="h-px flex-1 bg-edge" />
              </div>
              <button
                onClick={google}
                disabled={busy}
                className="pressable btn-ghost w-full flex items-center justify-center gap-2.5 disabled:opacity-60"
              >
                <GoogleG />
                Continuar con Google
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 mt-6">
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('register'); setError('') }} className="pressable text-[13px] font-semibold" style={{ color: 'var(--app-accent-soft)' }}>
                ¿No tienes cuenta? Regístrate
              </button>
              <button onClick={() => { setMode('reset'); setError('') }} className="pressable text-[12.5px] text-muted">
                Olvidé mi contraseña
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button onClick={() => { setMode('login'); setError('') }} className="pressable text-[13px] font-semibold" style={{ color: 'var(--app-accent-soft)' }}>
              Ya tengo cuenta: entrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function InputIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted z-10">{icon}</span>
      {children}
    </div>
  )
}

/** G de Google multicolor oficial (SVG, no emoji) */
function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}
