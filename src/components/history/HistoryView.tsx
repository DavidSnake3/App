import { useFinanceStore } from '../../store/useFinanceStore'
import { MonthCard } from './MonthCard'

export function HistoryView() {
  const months = useFinanceStore((s) => s.months)
  const setActiveMonth = useFinanceStore((s) => s.setActiveMonth)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)

  const sortedIds = Object.keys(months).sort((a, b) => b.localeCompare(a))

  function handleSelect(monthId: string) {
    setActiveMonth(monthId)
    setActiveTab('month')
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="px-4 pt-4 pb-6 space-y-3">
        {sortedIds.length === 0 ? (
          <p className="text-center text-gray-500 text-sm pt-12">Sin historial todavía</p>
        ) : (
          sortedIds.map((id) => (
            <MonthCard key={id} monthId={id} onSelect={handleSelect} />
          ))
        )}
      </div>
    </div>
  )
}
