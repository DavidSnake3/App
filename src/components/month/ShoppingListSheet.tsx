// La lista abierta: el checklist a pantalla de hoja, para ir marcando en el súper.
import { useFinanceStore } from '../../store/useFinanceStore'
import { BottomSheet } from '../ui/BottomSheet'
import { ShoppingChecklist } from './ShoppingChecklist'

interface Props {
  open: boolean
  monthId: string
  expenseId: string | null
  onClose: () => void
}

export function ShoppingListSheet({ open, monthId, expenseId, onClose }: Props) {
  const month = useFinanceStore((s) => s.months[monthId])
  const expense = expenseId ? month?.expenses.find((e) => e.id === expenseId) : undefined

  return (
    <BottomSheet
      open={open && Boolean(expense)}
      onClose={onClose}
      title={expense?.name ?? 'Lista de compras'}
      subtitle={expense?.shopping?.done ? 'Compra cerrada' : 'Marcá lo que vas echando al carrito'}
    >
      {open && expense && <ShoppingChecklist monthId={monthId} expense={expense} />}
    </BottomSheet>
  )
}
