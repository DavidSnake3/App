import { useFinanceStore } from './store/useFinanceStore'
import { PageHeader } from './components/layout/PageHeader'
import { BottomNav } from './components/layout/BottomNav'
import { MonthView } from './components/month/MonthView'
import { HistoryView } from './components/history/HistoryView'
import { ProjectionView } from './components/projection/ProjectionView'
import { SettingsView } from './components/settings/SettingsView'
import { useNotifications } from './hooks/useNotifications'

function App() {
  useNotifications()
  const activeTab = useFinanceStore((s) => s.activeTab)
  const activeMonthId = useFinanceStore((s) => s.activeMonthId)

  const tabTitles: Record<string, string> = {
    history:    'Historial',
    projection: 'Proyección anual',
    settings:   'Configuración',
  }

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <PageHeader
        showMonthNav={activeTab === 'month'}
        title={tabTitles[activeTab]}
      />

      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'month'      && <MonthView monthId={activeMonthId} />}
        {activeTab === 'history'    && <HistoryView />}
        {activeTab === 'projection' && <ProjectionView />}
        {activeTab === 'settings'   && <SettingsView />}
      </main>

      <BottomNav />
    </div>
  )
}

export default App
