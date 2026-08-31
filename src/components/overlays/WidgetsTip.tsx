// Aviso de bienvenida: explica que el Inicio se personaliza, con un ejemplo
// REAL en vivo (el mini calendario) que se puede agregar con un toque.
import { useState } from 'react'
import { Check, LayoutGrid, Plus, Proportions, X } from 'lucide-react'
import { useFinanceStore } from '../../store/useFinanceStore'
import { RenderWidget } from '../home/widgets'
import type { WidgetCtx } from '../home/widgetMeta'

export function WidgetsTip({ onClose }: { onClose: () => void }) {
  const homeWidgets = useFinanceStore((s) => s.settings.homeWidgets)
  const setSettings = useFinanceStore((s) => s.setSettings)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)
  const [added, setAdded] = useState(false)

  const widgets = homeWidgets ?? []
  const yaEsta = widgets.some((w) => w.id === 'calendario')

  const ctx: WidgetCtx = { setActiveTab, exporting: false, exportExcel: () => {} }

  const agregar = () => {
    if (!yaEsta) setSettings({ homeWidgets: [...widgets, { id: 'calendario', size: 'lg' }] })
    setAdded(true)
  }

  return (
    <div className="fixed inset-0 z-[92] flex flex-col justify-end max-w-[520px] mx-auto">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
        style={{ animation: 'fadeIn 0.2s ease both' }}
        onClick={onClose}
      />
      <div
        className="relative bg-card border-t border-edge rounded-t-3xl max-h-[92dvh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s cubic-bezier(0.2, 0.8, 0.3, 1) both' }}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-edge" />
        <div className="px-5 pt-3 pb-[calc(1.4rem+env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--app-accent-soft)' }}>
                Tu inicio, a tu gusto
              </p>
              <h2 className="font-display text-[21px] font-bold text-ink leading-tight mt-1">
                Arma tu pantalla de inicio
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar aviso"
              className="pressable w-9 h-9 rounded-full bg-elevated border border-edge flex items-center justify-center text-muted shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-[13px] text-muted mt-2 leading-relaxed">
            El Inicio está hecho de <span className="font-semibold text-ink">widgets</span>: los podés
            mover, cambiar de tamaño, quitar o agregar los que quieras.
          </p>

          <div className="flex flex-col gap-2 mt-3">
            <Paso
              icon={<LayoutGrid size={14} />}
              text="Mantené presionado un widget ~1 segundo para entrar al modo edición"
            />
            <Paso
              icon={<Proportions size={14} />}
              text="Ahí podés moverlo (↑↓), cambiar su tamaño (S · M · L) o quitarlo (✕)"
            />
            <Paso
              icon={<Plus size={14} />}
              text="Con «Agregar widget» elegís entre comprobante, saldo real, gráficas, calendario y más"
            />
          </div>

          {/* Ejemplo REAL en vivo */}
          <p className="text-[11.5px] font-semibold text-muted mt-4 mb-2">
            Ejemplo en vivo: mini calendario
          </p>
          <div
            className="rounded-2xl p-3"
            style={{
              background: 'color-mix(in oklab, var(--app-accent) 7%, transparent)',
              outline: '1.5px dashed color-mix(in oklab, var(--app-accent) 55%, transparent)',
              outlineOffset: 2,
            }}
          >
            <div className="max-w-[210px]">
              <RenderWidget id="calendario" size="lg" ctx={ctx} />
            </div>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Marca con un punto los días en que tenés que pagar y te dice qué toca hoy.
          </p>

          <button
            onClick={added || yaEsta ? onClose : agregar}
            className="pressable btn-primary w-full mt-4 flex items-center justify-center gap-2"
          >
            {added || yaEsta
              ? <><Check size={16} /> Listo, entendido</>
              : <><Plus size={16} /> Agregarlo a mi inicio</>}
          </button>
          {(added || yaEsta) && (
            <p className="text-[11.5px] text-center mt-2" style={{ color: 'var(--c-income)' }}>
              {yaEsta && !added ? 'Ya lo tenés en tu inicio.' : 'Agregado a tu inicio.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Paso({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'color-mix(in oklab, var(--app-accent) 16%, transparent)', color: 'var(--app-accent-soft)' }}
      >
        {icon}
      </span>
      <p className="text-[12.5px] text-ink leading-snug flex-1">{text}</p>
    </div>
  )
}
