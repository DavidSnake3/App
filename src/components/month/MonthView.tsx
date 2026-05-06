import { IncomeCard } from './IncomeCard'
import { ExpenseSection } from './ExpenseSection'
import { SummaryBar } from './SummaryBar'

interface Props {
  monthId: string
}

export function MonthView({ monthId }: Props) {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain pb-4">
      <IncomeCard monthId={monthId} />
      <ExpenseSection monthId={monthId} section="quincena" />
      <ExpenseSection monthId={monthId} section="fin_de_mes" />
      <SummaryBar monthId={monthId} />
    </div>
  )
}
