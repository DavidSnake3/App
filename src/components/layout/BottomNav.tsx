import { CalendarDays, History, TrendingUp, Settings } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import type { TabId } from '../../types/finance'

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: 'month',      label: 'Mes',        Icon: CalendarDays },
  { id: 'history',    label: 'Historial',  Icon: History      },
  { id: 'projection', label: 'Proyección', Icon: TrendingUp   },
  { id: 'settings',   label: 'Config',     Icon: Settings     },
]

export function BottomNav() {
  const activeTab = useFinanceStore((s) => s.activeTab)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)

  return (
    <nav
      className="flex-shrink-0 bg-surface-card border-t border-surface-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                active ? 'text-brand-400' : 'text-gray-500'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-medium ${active ? 'text-brand-400' : 'text-gray-500'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
