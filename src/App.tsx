import { useEffect, useRef, useState } from 'react'
import { useFinanceStore } from './store/useFinanceStore'
import { useChat } from './store/useChat'
import { useTheme } from './hooks/useTheme'
import { useAuth } from './hooks/useAuth'
import { useReminders } from './hooks/useReminders'
import { TAB_ORDER, useSwipeTabs } from './hooks/useSwipeTabs'
import { firebaseReady, logout } from './lib/firebase'
import { currentMonthId } from './lib/dates'
import { recompressDataUrl } from './lib/themes'
import { initBackStack, refreshBackStack } from './lib/backStack'
import { BottomNav } from './components/layout/BottomNav'
import { HomeView } from './components/home/HomeView'
import { MoneyView } from './components/money/MoneyView'
import { MonthView } from './components/month/MonthView'
import { ReportsView } from './components/reports/ReportsView'
import { SettingsView } from './components/settings/SettingsView'
import { Onboarding } from './components/onboarding/Onboarding'
import { AuthScreen } from './components/auth/AuthScreen'
import { AlarmOverlay } from './components/overlays/AlarmOverlay'
import { WidgetsTip } from './components/overlays/WidgetsTip'
import { SplashIntro } from './components/overlays/SplashIntro'
import { ChatBot } from './components/chat/ChatBot'
import { ChatLauncher } from './components/chat/ChatLauncher'
import { Loader } from './components/ui/Loader'
import { LoadingOverlay } from './components/ui/LoadingOverlay'

function App() {
  useTheme()
  const auth = useAuth()
  const { alarm, dismissAlarm } = useReminders()
  const swipe = useSwipeTabs()

  const onboarded = useFinanceStore((s) => s.profile.onboarded)
  const snakeIntro = useFinanceStore((s) => s.profile.snakeIntro)
  const widgetsTip = useFinanceStore((s) => s.profile.widgetsTip)
  const chatOpen = useChat((s) => s.open)
  const activeTab = useFinanceStore((s) => s.activeTab)
  const subs = useFinanceStore((s) => s.subs)
  const ensureMonthExists = useFinanceStore((s) => s.ensureMonthExists)
  const setActiveMonth = useFinanceStore((s) => s.setActiveMonth)

  // Splash de arranque premium
  const [showSplash, setShowSplash] = useState(true)

  // Atrás del celular: cierra lo que esté abierto, sale del submenú, vuelve a
  // Inicio y solo entonces (tocando otra vez) se sale de la app
  const [avisoSalir, setAvisoSalir] = useState(false)
  useEffect(() => initBackStack({
    nav: {
      can: () => {
        const s = useFinanceStore.getState()
        return Boolean(s.subs[s.activeTab]) || s.activeTab !== 'home'
      },
      back: () => {
        const s = useFinanceStore.getState()
        if (s.subs[s.activeTab]) s.setSub(s.activeTab, '')
        else if (s.activeTab !== 'home') s.setActiveTab('home')
      },
    },
    onExitHint: () => setAvisoSalir(true),
  }), [])

  // al cambiar de pestaña o entrar a un submenú hay algo nuevo a lo que volver
  useEffect(() => { refreshBackStack() }, [activeTab, subs])

  useEffect(() => {
    if (!avisoSalir) return
    const t = setTimeout(() => setAvisoSalir(false), 2200)
    return () => clearTimeout(t)
  }, [avisoSalir])

  // Al salir del chat de bienvenida: explicar que el inicio se personaliza
  const [showTip, setShowTip] = useState(false)
  const chatWasOpen = useRef(false)

  // Dirección de la transición entre pestañas (para el deslizamiento)
  const prevTab = useRef(activeTab)
  const [tabAnim, setTabAnim] = useState('anim-page')
  useEffect(() => {
    if (prevTab.current !== activeTab) {
      const from = TAB_ORDER.indexOf(prevTab.current)
      const to = TAB_ORDER.indexOf(activeTab)
      setTabAnim(to > from ? 'anim-tab-left' : 'anim-tab-right')
      prevTab.current = activeTab
    }
  }, [activeTab])

  // Mes actual siempre disponible (configuración automática mes a mes, punto 1)
  useEffect(() => {
    if (!onboarded) return
    const nowId = currentMonthId()
    ensureMonthExists(nowId)
    const { activeMonthId, months } = useFinanceStore.getState()
    if (!months[activeMonthId]) setActiveMonth(nowId)
  }, [onboarded, ensureMonthExists, setActiveMonth])

  // Si la app arranca con sesión abierta pero el onboarding quedó a medias,
  // se cierra la sesión: el usuario vuelve a la pantalla de inicio de sesión
  // en vez de caer directo en el onboarding a medio llenar.
  const startupChecked = useRef(false)
  useEffect(() => {
    if (auth.loading || startupChecked.current) return
    startupChecked.current = true
    if (firebaseReady && auth.user && !useFinanceStore.getState().profile.onboarded) {
      void logout()
    }
  }, [auth.loading, auth.user])

  // Al abrir la app y al iniciar sesión, aterrizar SIEMPRE en Inicio (mejora 13)
  useEffect(() => {
    useFinanceStore.getState().setActiveTab('home')
  }, [])

  // Al terminar el onboarding, Snake abre solo y da la bienvenida (con la
  // opción elegida: guiarlo o leerle el comprobante). Si la app se cerró
  // antes, queda pendiente y se abre en el siguiente arranque.
  useEffect(() => {
    if (!onboarded || showSplash) return
    if (snakeIntro !== 'plan' && snakeIntro !== 'comprobante') return
    const t = setTimeout(() => {
      useChat.getState().openChat('', snakeIntro === 'comprobante' ? 'attach' : 'welcome')
      useFinanceStore.getState().setProfile({ snakeIntro: 'done' })
    }, 600)
    return () => clearTimeout(t)
  }, [onboarded, snakeIntro, showSplash])

  // Si prefirió configurarlo después (sin chat), el aviso de widgets se
  // muestra igual al entrar al inicio por primera vez
  useEffect(() => {
    if (!onboarded || showSplash || chatOpen) return
    if (snakeIntro !== 'skipped' || widgetsTip !== false) return
    const t = setTimeout(() => setShowTip(true), 900)
    return () => clearTimeout(t)
  }, [onboarded, showSplash, chatOpen, snakeIntro, widgetsTip])

  useEffect(() => {
    if (chatOpen) { chatWasOpen.current = true; return }
    if (!chatWasOpen.current || widgetsTip !== false || !onboarded) return
    chatWasOpen.current = false
    const t = setTimeout(() => setShowTip(true), 500)
    return () => clearTimeout(t)
  }, [chatOpen, widgetsTip, onboarded])

  // Fondos guardados con la compresión vieja (muy pesados para la nube):
  // reducirlos una vez para que sincronicen con la cuenta
  useEffect(() => {
    const bg = useFinanceStore.getState().settings.theme.background
    if (bg.type !== 'image' || !bg.value || bg.value.length <= 400_000) return
    void recompressDataUrl(bg.value, 720, 0.62)
      .then((v) => useFinanceStore.getState().setTheme({ background: { type: 'image', value: v } }))
      .catch(() => { /* imagen inválida: se queda como está */ })
  }, [])
  const userUid = auth.user?.uid ?? null
  useEffect(() => {
    if (userUid) useFinanceStore.getState().setActiveTab('home')
  }, [userUid])

  // El splash vive SIEMPRE en la misma posición del árbol para que React no lo
  // remonte al cambiar de pantalla (antes se reproducía dos veces, mejora 13)
  let content: React.ReactNode
  if (auth.loading) {
    content = (
      <div className="h-full flex flex-col items-center justify-center">
        <Loader size={64} />
      </div>
    )
  } else if (firebaseReady && !auth.user && !auth.skipped) {
    content = (
      <div className="h-full flex flex-col overflow-hidden">
        <AuthScreen />
      </div>
    )
  } else if (auth.user && !auth.hydrated) {
    // esperando los datos de la nube: no mostrar el onboarding por error
    content = (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader size={64} label="Cargando tus finanzas…" />
      </div>
    )
  } else if (!onboarded) {
    content = (
      <div className="h-full flex flex-col overflow-hidden">
        <Onboarding user={auth.user} />
      </div>
    )
  } else {
    content = (
      <div className="h-full flex flex-col overflow-hidden">
        <main
          key={activeTab}
          className={`flex-1 flex flex-col min-h-0 relative ${tabAnim}`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
          onTouchStart={swipe.onTouchStart}
          onTouchMove={swipe.onTouchMove}
          onTouchEnd={swipe.onTouchEnd}
        >
          {activeTab === 'home' && <HomeView auth={auth} />}
          {activeTab === 'money' && <MoneyView />}
          {activeTab === 'month' && <MonthView />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'settings' && <SettingsView auth={auth} />}
          <ChatLauncher />
        </main>

        <BottomNav />

        {alarm && <AlarmOverlay alarm={alarm} onDismiss={dismissAlarm} />}
        <ChatBot auth={auth} />
        {showTip && (
          <WidgetsTip
            onClose={() => {
              setShowTip(false)
              useFinanceStore.getState().setProfile({ widgetsTip: true })
            }}
          />
        )}
      </div>
    )
  }

  return (
    <>
      {showSplash && <SplashIntro onDone={() => setShowSplash(false)} />}
      {content}
      <LoadingOverlay />
      {avisoSalir && (
        <div className="fixed left-0 right-0 z-[95] flex justify-center pointer-events-none anim-fade"
             style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}>
          <span className="card px-4 py-2 text-[12.5px] font-semibold text-ink shadow-lg">
            Toca atrás otra vez para salir
          </span>
        </div>
      )}
    </>
  )
}

export default App
