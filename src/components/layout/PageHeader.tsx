import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { useFinanceStore } from '../../store/useFinanceStore'

interface Props {
  title?: string
  showMonthNav?: boolean
}

export function PageHeader({ title, showMonthNav = false }: Props) {
  const activeMonthId = useFinanceStore((s) => s.activeMonthId)
  const setActiveMonth = useFinanceStore((s) => s.setActiveMonth)
  const settings = useFinanceStore((s) => s.settings)

  const [year, month] = activeMonthId.split('-').map(Number)
  const current = new Date(year, month - 1)
  const prevId = format(addMonths(current, -1), 'yyyy-MM')
  const nextId = format(addMonths(current, 1), 'yyyy-MM')
  const monthLabel = format(current, 'MMMM yyyy', { locale: es })
    .replace(/^\w/, (c) => c.toUpperCase())

  const startDate = new Date(settings.startYear, settings.startMonth - 1)
  const canGoPrev = current > startDate

  if (!showMonthNav) {
    return (
      <header className="px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 bg-surface-card border-b border-surface-border">
        <h1 className="text-lg font-bold text-white">{title}</h1>
      </header>
    )
  }

  return (
    <header className="px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 bg-surface-card border-b border-surface-border">
      <div className="flex items-center justify-between">
        <button
          onClick={() => canGoPrev && setActiveMonth(prevId)}
          disabled={!canGoPrev}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 ${
            canGoPrev
              ? 'bg-surface-border/60 text-white'
              : 'bg-transparent text-gray-700 cursor-not-allowed'
          }`}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white capitalize">{monthLabel}</h1>
        <button
          onClick={() => setActiveMonth(nextId)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-border/60 text-white transition-all active:scale-90"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </header>
  )
}
