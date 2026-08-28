import { useEffect } from 'react'
import { useFinanceStore } from './store/useFinanceStore'
import { useTheme } from './hooks/useTheme'
import { useAuth } from './hooks/useAuth'
import { useReminders } from './hooks/useReminders'
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
import { AppLogo } from './components/ui/AppLogo'

function App() {
  useTheme()
  const auth = useAuth()
  const { alarm, dismissAlarm } = useReminders()

  const onboarded = useFinanceStore((s) => s.profile.onboarded)
  const activeTab = useFinanceStore((s) => s.activeTab)
  const ensureMonthExists = useFinanceStore((s) => s.ensureMonthExists)
  const setActiveMonth = useFinanceStore((s) => s.setActiveMonth)

  // Mes actual siempre disponible (configuración automática mes a mes, punto 1)
  useEffect(() => {
    if (!onboarded) return
    const nowId = currentMonthId()
    ensureMonthExists(nowId)
    const { activeMonthId, months } = useFinanceStore.getState()
    if (!months[activeMonthId]) setActiveMonth(nowId)
  }, [onboarded, ensureMonthExists, setActiveMonth])

  // Splash mientras Firebase resuelve la sesión
  if (auth.loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <span style={{ animation: 'pulseSoft 1.4s ease-in-out infinite' }}><AppLogo size={80} /></span>
        <p className="font-display font-bold text-[19px] text-ink">SNBusiness</p>
      </div>
    )
  }

  // Autenticación (correo + Google) cuando Firebase está configurado
  if (firebaseReady && !auth.user && !auth.skipped) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <AuthScreen onSkip={auth.skip} />
      </div>
    )
  }

  // Onboarding obligatorio la primera vez (punto 24)
  if (!onboarded) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <Onboarding />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <main
        key={activeTab}
        className="flex-1 flex flex-col min-h-0 relative anim-page"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {activeTab === 'home' && <HomeView />}
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

export default App
