import { useEffect, useRef, useState } from 'react'
import { useFinanceStore } from './store/useFinanceStore'
import { useTheme } from './hooks/useTheme'
import { useAuth } from './hooks/useAuth'
import { useReminders } from './hooks/useReminders'
import { TAB_ORDER, useSwipeTabs } from './hooks/useSwipeTabs'
import { firebaseReady } from './lib/firebase'
import { currentMonthId } from './lib/dates'
import { BottomNav } from './components/layout/BottomNav'
import { HomeView } from './components/home/HomeView'
import { MonthView } from './components/month/MonthView'
import { DebtsView } from './components/debts/DebtsView'
import { YearView } from './components/year/YearView'
import { SettingsView } from './components/settings/SettingsView'
import { Onboarding } from './components/onboarding/Onboarding'
import { AuthScreen } from './components/auth/AuthScreen'
import { AlarmOverlay } from './components/overlays/AlarmOverlay'
import { SplashIntro } from './components/overlays/SplashIntro'
import { Loader } from './components/ui/Loader'

function App() {
  useTheme()
  const auth = useAuth()
  const { alarm, dismissAlarm } = useReminders()
  const swipe = useSwipeTabs()

  const onboarded = useFinanceStore((s) => s.profile.onboarded)
  const activeTab = useFinanceStore((s) => s.activeTab)
  const ensureMonthExists = useFinanceStore((s) => s.ensureMonthExists)
  const setActiveMonth = useFinanceStore((s) => s.setActiveMonth)

  // Splash de arranque premium
  const [showSplash, setShowSplash] = useState(true)

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
        <AuthScreen onSkip={auth.skip} />
      </div>
    )
  } else if (!onboarded) {
    content = (
      <div className="h-full flex flex-col overflow-hidden">
        <Onboarding />
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
          {activeTab === 'month' && <MonthView />}
          {activeTab === 'debts' && <DebtsView />}
          {activeTab === 'year' && <YearView />}
          {activeTab === 'settings' && <SettingsView auth={auth} />}
        </main>

        <BottomNav />

        {alarm && <AlarmOverlay alarm={alarm} onDismiss={dismissAlarm} />}
      </div>
    )
  }

  return (
    <>
      {showSplash && <SplashIntro onDone={() => setShowSplash(false)} />}
      {content}
    </>
  )
}

export default App
