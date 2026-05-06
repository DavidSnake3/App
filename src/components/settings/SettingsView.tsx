import { Bell, BellOff, Wallet, Info } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { CurrencyInput } from '../ui/CurrencyInput'
import { useNotifications } from '../../hooks/useNotifications'

export function SettingsView() {
  const settings = useFinanceStore((s) => s.settings)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const { permission, notificationsEnabled, enableNotifications, disableNotifications } = useNotifications()

  async function handleToggleNotifications() {
    if (notificationsEnabled) {
      disableNotifications()
    } else {
      await enableNotifications()
    }
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pt-4 pb-8 space-y-4">

        <Section title="Salario por defecto">
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Se usa para meses nuevos y proyecciones futuras.</p>
            <CurrencyInput
              value={settings.defaultSalary}
              onChange={(v) => updateSettings({ defaultSalary: v })}
            />
          </div>
        </Section>

        <Section title="Notificaciones">
          <div className="space-y-4">
            {permission === 'unsupported' ? (
              <p className="text-xs text-expense">Tu navegador no soporta notificaciones.</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {notificationsEnabled ? (
                      <Bell size={18} className="text-brand-400" />
                    ) : (
                      <BellOff size={18} className="text-gray-500" />
                    )}
                    <span className="text-sm text-white">
                      {notificationsEnabled ? 'Activadas' : 'Desactivadas'}
                    </span>
                  </div>
                  <button
                    onClick={handleToggleNotifications}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      notificationsEnabled ? 'bg-brand-500' : 'bg-surface-border'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {permission === 'denied' && (
                  <p className="text-xs text-pending">
                    Permiso denegado. Actívalas en ajustes del navegador.
                  </p>
                )}

                {notificationsEnabled && (
                  <div>
                    <p className="text-xs text-gray-500 mb-3">Avisar con anticipación:</p>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 1, 3, 5, 7].map((d) => {
                        const active = settings.notificationDays.includes(d)
                        return (
                          <button
                            key={d}
                            onClick={() => {
                              const days = active
                                ? settings.notificationDays.filter((x) => x !== d)
                                : [...settings.notificationDays, d].sort((a, b) => a - b)
                              updateSettings({ notificationDays: days })
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              active
                                ? 'bg-brand-500 text-white'
                                : 'bg-surface-border text-gray-400'
                            }`}
                          >
                            {d === 0 ? 'El día' : `${d} día${d > 1 ? 's' : ''} antes`}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Section>

        <Section title="Acerca de">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-gray-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">
              Finanzas Personales — app local, todos los datos se guardan en tu dispositivo.
              Funciona sin conexión a internet.
              Inicia en Mayo {settings.startYear}.
            </p>
          </div>
        </Section>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-card border border-surface-border p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <Wallet size={14} className="text-brand-400" />
        {title}
      </h3>
      {children}
    </div>
  )
}
