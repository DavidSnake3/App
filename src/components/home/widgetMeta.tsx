import {
  CalendarClock, CalendarDays, ChartLine, ChartSpline, CreditCard,
  FileText, LayoutGrid, Lightbulb, ListChecks, PiggyBank, Wallet,
} from 'lucide-react'
import type { TabId, WidgetId, WidgetSize } from '../../types/finance'

export interface WidgetCtx {
  setActiveTab(t: TabId): void
  openPlans(): void
  exportExcel(): void
  exporting: boolean
}

export const WIDGET_META: Record<WidgetId, { name: string; desc: string; icon: React.ReactNode; defaultSize: WidgetSize }> = {
  estado: { name: 'Estado del mes', desc: 'Progreso de pagos y balance', icon: <Wallet size={16} />, defaultSize: 'lg' },
  comprobante: { name: 'Comprobante salarial', desc: 'Tu planilla: bruto, deducciones y neto', icon: <FileText size={16} />, defaultSize: 'lg' },
  ahorro: { name: 'Ahorro', desc: 'Plan de ahorro y progreso a tu meta', icon: <PiggyBank size={16} />, defaultSize: 'lg' },
  resumen: { name: 'Tu día en pagos', desc: 'Qué vence hoy y qué viene', icon: <CalendarClock size={16} />, defaultSize: 'lg' },
  consejo: { name: 'Consejo del día', desc: 'Tip financiero con IA', icon: <Lightbulb size={16} />, defaultSize: 'lg' },
  acciones: { name: 'Accesos rápidos', desc: 'Gasto, deudas, planes y Excel', icon: <LayoutGrid size={16} />, defaultSize: 'lg' },
  pendientes: { name: 'Pagos pendientes', desc: 'Próximos vencimientos', icon: <ListChecks size={16} />, defaultSize: 'lg' },
  proyeccion: { name: 'Proyección anual', desc: 'Ingresos, ahorro y gastos del año', icon: <ChartLine size={16} />, defaultSize: 'lg' },
  flujo: { name: 'Flujo del mes', desc: 'Balance acumulado día a día', icon: <ChartSpline size={16} />, defaultSize: 'lg' },
  deudas: { name: 'Deudas', desc: 'Saldo pendiente y cuota del mes', icon: <CreditCard size={16} />, defaultSize: 'sm' },
  calendario: { name: 'Mini calendario', desc: 'Los pagos del mes de un vistazo', icon: <CalendarDays size={16} />, defaultSize: 'sm' },
}
