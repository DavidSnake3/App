import { CalendarRange, CreditCard, House, Settings, Wallet } from 'lucide-react'
import type { TabId } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { playTap } from '../../lib/sound'

const TABS: { id: TabId; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Inicio', icon: House },
  { id: 'month', label: 'Mes', icon: Wallet },
  { id: 'debts', label: 'Deudas', icon: CreditCard },
  { id: 'year', label: 'Año', icon: CalendarRange },
  { id: 'settings', label: 'Ajustes', icon: Settings },
]

export function BottomNav() {
  const activeTab = useFinanceStore((s) => s.activeTab)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)
  const sounds = useFinanceStore((s) => s.settings.animations.sounds)

  return (
    <nav
      className="shrink-0 border-t border-edge bg-card/90 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="flex">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = id === activeTab
          return (
            <button
              key={id}
              onClick={() => { if (sounds) playTap(); setActiveTab(id) }}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="pressable flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 min-h-[58px]"
            >
              <span
                className="flex items-center justify-center w-11 h-6.5 rounded-full transition-all duration-200"
                style={active ? { background: 'color-mix(in oklab, var(--app-accent) 22%, transparent)' } : undefined}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.4 : 2}
                  style={{ color: active ? 'var(--app-accent-soft)' : 'var(--c-muted)' }}
                />
              </span>
              <span
                className="text-[10.5px] font-medium transition-colors"
                style={{ color: active ? 'var(--c-text)' : 'var(--c-muted)' }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
