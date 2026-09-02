import { BarChart3, House, Settings, Wallet, CalendarDays } from 'lucide-react'
import type { TabId } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { playTap } from '../../lib/sound'

const TABS: { id: TabId; label: string; icon: typeof House }[] = [
  { id: 'home', label: 'Inicio', icon: House },
  { id: 'money', label: 'Dinero', icon: Wallet },
  { id: 'month', label: 'Mes', icon: CalendarDays },
  { id: 'reports', label: 'Reportes', icon: BarChart3 },
  { id: 'settings', label: 'Ajustes', icon: Settings },
]

export function BottomNav() {
  const activeTab = useFinanceStore((s) => s.activeTab)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)
  const setSub = useFinanceStore((s) => s.setSub)
  const sounds = useFinanceStore((s) => s.settings.animations.sounds)

  /**
   * Tocar una pestaña lleva SIEMPRE a su menú de cuadros, venga de donde venga:
   * nunca se aterriza en un submenú que quedó abierto de antes.
   */
  const ir = (id: TabId) => {
    if (sounds) playTap()
    setSub(id, '')
    setActiveTab(id)
  }

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
              data-tour={`tab-${id}`}
              onClick={() => ir(id)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="pressable flex-1 flex flex-col items-center gap-1 pt-2.5 pb-2 min-h-[58px] relative"
            >
              {/* indicador superior de la pestaña activa */}
              <span
                className="absolute top-0 h-[2.5px] rounded-full transition-all duration-300"
                style={{
                  width: active ? 26 : 0,
                  opacity: active ? 1 : 0,
                  background: 'var(--app-gradient)',
                }}
              />
              <span
                className="flex items-center justify-center w-11 h-6.5 rounded-full transition-all duration-300"
                style={active
                  ? {
                      background: 'color-mix(in oklab, var(--app-accent) 22%, transparent)',
                      boxShadow: '0 0 18px -2px color-mix(in oklab, var(--app-accent) 55%, transparent)',
                    }
                  : undefined}
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
