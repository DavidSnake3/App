import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, ChartGantt, ChevronLeft, ChevronRight, CreditCard, LayoutGrid,
  List, PiggyBank, Plus, Receipt, Share2, Table2, Target, Trash2,
} from 'lucide-react'
import type { Expense, ExpenseKind, MonthSub, PayableItem, ViewMode } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { buildPayables, getMonthSummary, recurringCandidates } from '../../lib/finance'
import { addMonthsToId, isCurrentMonth, monthLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { celebrate } from '../../lib/fx'
import { Segmented } from '../ui/Segmented'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { AddExpenseSheet } from './AddExpenseSheet'
import { ExpenseDetailSheet } from './ExpenseDetailSheet'
import { MovementsCard } from './FundCards'
import { BalanceCard } from './BalanceCard'
import { PlanCard } from './PlanCard'
import { BudgetsCard } from './BudgetsCard'
import { buildMonthCardBlob } from '../../lib/shareCard'
import { downloadWorkbook } from '../../lib/excel'
import { withLoading } from '../../store/useLoading'
import { HubHeader, HubMenu, HubTitle, type HubItem } from '../layout/HubMenu'
import { Fab } from '../ui/Fab'
import { DebtsView } from '../debts/DebtsView'
import { CardsView } from './views/CardsView'
import { ListView } from './views/ListView'
import { TableView } from './views/TableView'
import { MonthCalendarView } from './views/MonthCalendarView'
import { GanttView } from './views/GanttView'

const VIEW_OPTIONS: { value: ViewMode; label: React.ReactNode; ariaLabel: string }[] = [
  { value: 'cards', label: <LayoutGrid size={16} />, ariaLabel: 'Tarjetas' },
  { value: 'list', label: <List size={16} />, ariaLabel: 'Lista' },
  { value: 'table', label: <Table2 size={16} />, ariaLabel: 'Tabla' },
  { value: 'calendar', label: <CalendarDays size={16} />, ariaLabel: 'Calendario' },
  { value: 'gantt', label: <ChartGantt size={16} />, ariaLabel: 'Gantt' },
]

const TITULOS: Record<MonthSub, { title: string; subtitle: string }> = {
  pagos: { title: 'Pagos del mes', subtitle: 'Servicios, gastos, personales y cuotas' },
  deudas: { title: 'Deudas', subtitle: 'Tus cuotas y el camino a cero' },
  presupuestos: { title: 'Presupuestos', subtitle: 'Límites por categoría y avisos' },
  plan: { title: 'Mi plan del mes', subtitle: 'Balance, reparto y sobrante' },
}

export function MonthView() {
  const sub = (useFinanceStore((s) => s.subs.month) ?? '') as MonthSub | ''
  const setSub = useFinanceStore((s) => s.setSub)
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const debts = useFinanceStore((s) => s.debts)
  const viewMode = useFinanceStore((s) => s.settings.viewMode)
  const setViewMode = useFinanceStore((s) => s.setViewMode)
  const setActiveMonth = useFinanceStore((s) => s.setActiveMonth)
  const ensureMonthExists = useFinanceStore((s) => s.ensureMonthExists)
  const deleteMonth = useFinanceStore((s) => s.deleteMonth)
  const markCelebrated = useFinanceStore((s) => s.markCelebrated)
  const animPrefs = useFinanceStore((s) => s.settings.animations)
  const importRecurring = useFinanceStore((s) => s.importRecurring)
  const markCarryAsked = useFinanceStore((s) => s.markCarryAsked)
  const prevMonth = useFinanceStore((s) => s.months[addMonthsToId(s.activeMonthId, -1)])

  const [addOpen, setAddOpen] = useState(false)
  const [addKind] = useState<ExpenseKind>('gasto')
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [detail, setDetail] = useState<PayableItem | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showCongrats, setShowCongrats] = useState(false)

  useEffect(() => { ensureMonthExists(monthId) }, [monthId, ensureMonthExists])

  // Mes nuevo: preguntar si copiar los recurrentes del anterior (mejora 12)
  const carryCandidates = useMemo(
    () => (prevMonth ? recurringCandidates(prevMonth, monthId).length : 0),
    [prevMonth, monthId],
  )
  const showCarryPrompt = Boolean(
    month && month.expenses.length === 0 && !month.carryAsked && prevMonth && carryCandidates > 0,
  )

  const budgets = useFinanceStore((s) => s.budgets)
  const items = useMemo(() => (month ? buildPayables(month, debts) : []), [month, debts])
  const summary = useMemo(
    () => (month ? getMonthSummary(month, debts) : null),
    [month, debts],
  )

  // Felicitación al completar todos los pagos (punto 22)
  useEffect(() => {
    if (!month || !summary) return
    if (!summary.allPaid || month.celebrated) return
    markCelebrated(monthId)
    const show = setTimeout(() => {
      celebrate(animPrefs)
      setShowCongrats(true)
    }, 60)
    const hide = setTimeout(() => setShowCongrats(false), 3600)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [summary, month, monthId, markCelebrated, animPrefs])

  if (!month || !summary) return null

  const servicios = items.filter((i) => i.kind === 'servicio')
  const gastos = items.filter((i) => i.kind === 'gasto')
  const personales = items.filter((i) => i.kind === 'personal')
  const deudas = items.filter((i) => i.kind === 'deuda')

  const openDetail = (it: PayableItem) => setDetail(it)
  const groupedView = viewMode === 'cards' || viewMode === 'list'
  const ViewComp = viewMode === 'cards' ? CardsView : ListView

  const pendientes = items.filter((i) => !i.paid).length
  const deudasActivas = debts.filter((d) => !d.viaPlanilla)
  const subItems: HubItem<MonthSub>[] = [
    {
      id: 'pagos',
      title: 'Pagos',
      desc: 'Servicios, gastos y cuotas del mes',
      icon: <Receipt size={19} />,
      stat: items.length ? (pendientes ? `${pendientes} sin pagar` : 'Todo pagado') : 'Agregar el primero',
      tone: pendientes ? 'warning' : 'income',
      badge: pendientes || undefined,
    },
    {
      id: 'deudas',
      title: 'Deudas',
      desc: 'Cuotas, abonos y camino a cero',
      icon: <CreditCard size={19} />,
      stat: deudasActivas.length ? formatMoney(Math.round(deudasActivas.reduce((t, d) => t + d.monthlyPayment, 0))) : 'Sin deudas',
      tone: 'danger',
      badge: deudasActivas.length || undefined,
    },
    {
      id: 'presupuestos',
      title: 'Presupuestos',
      desc: 'Límites por categoría con avisos',
      icon: <Target size={19} />,
      stat: budgets.length ? `${budgets.length} ${budgets.length === 1 ? 'activo' : 'activos'}` : 'Crear uno',
      tone: 'accent',
      badge: budgets.length || undefined,
    },
    {
      id: 'plan',
      title: 'Mi plan',
      desc: 'Balance, reparto y sobrante',
      icon: <PiggyBank size={19} />,
      stat: summary ? formatMoney(Math.round(summary.savings)) : undefined,
      tone: 'income',
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain" style={{ scrollbarGutter: 'stable' }}>
      <div className="px-4 pb-32 pt-2 flex flex-col gap-4">
        {sub
          ? (
            <HubHeader
              title={TITULOS[sub].title}
              subtitle={TITULOS[sub].subtitle}
              onBack={() => setSub('month', '')}
            />
          )
          : <HubTitle title="Mi mes" subtitle="Todo lo que pagas, debes y presupuestas" />}

        {/* Navegación de mes + borrar mes (punto 1) */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveMonth(addMonthsToId(monthId, -1))}
            aria-label="Mes anterior"
            className="pressable w-10 h-10 rounded-full bg-card border border-edge flex items-center justify-center text-muted"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <h2 className="font-display text-[19px] font-bold text-ink leading-tight">{monthLabel(monthId)}</h2>
            <span className="inline-flex items-center gap-2">
              {isCurrentMonth(monthId)
                ? <span className="text-[11px] font-semibold" style={{ color: 'var(--app-accent-soft)' }}>Mes actual</span>
                : (
                  <button onClick={() => setConfirmDelete(true)} className="pressable text-[11px] text-muted inline-flex items-center gap-1">
                    <Trash2 size={11} /> Borrar este mes
                  </button>
                )}
              <button
                onClick={() => void withLoading('Generando tu resumen…', async () => {
                  const s = useFinanceStore.getState()
                  const blob = await buildMonthCardBlob(month, debts, s.settings, s.months, s.profile.name)
                  await downloadWorkbook(blob, `Resumen-${monthId}.png`)
                }).catch(() => {})}
                className="pressable text-[11px] text-muted inline-flex items-center gap-1"
              >
                <Share2 size={11} /> Compartir
              </button>
            </span>
          </div>
          <button
            onClick={() => setActiveMonth(addMonthsToId(monthId, 1))}
            aria-label="Mes siguiente"
            className="pressable w-10 h-10 rounded-full bg-card border border-edge flex items-center justify-center text-muted"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {!sub && (
          <div className="flex flex-col gap-4 anim-page">
            <BalanceCard compact />
            <HubMenu items={subItems} onPick={(id) => setSub('month', id)} />
          </div>
        )}

        {sub === 'plan' && (
          <div className="flex flex-col gap-4 anim-page">
            <BalanceCard />
            <PlanCard />
          </div>
        )}

        {sub === 'presupuestos' && (
          <div className="flex flex-col gap-4 anim-page">
            <BudgetsCard />
            <MovementsCard />
          </div>
        )}

        {sub === 'deudas' && (
          <div className="flex flex-col gap-4 anim-page">
            <DebtsView embedded />
          </div>
        )}

        {sub === 'pagos' && (
        <div className="flex flex-col gap-4 anim-page">
        {/* Selector de vista (punto 10) */}
        <Segmented value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS} />

        {/* Contenido según vista */}
        {items.length === 0 ? (
          <div className="card p-8 text-center anim-pop">
            <p className="text-[15px] font-semibold text-ink">Aún no hay pagos este mes</p>
            <p className="text-[13px] text-muted mt-1.5">Agrega tus gastos, servicios y deudas con el botón +</p>
          </div>
        ) : groupedView ? (
          <div className="flex flex-col gap-5">
            {servicios.length > 0 && (
              <section>
                <SectionTitle label="Servicios obligatorios" count={servicios.length} accent />
                <ViewComp items={servicios} monthId={monthId} onOpen={openDetail} />
              </section>
            )}
            {deudas.length > 0 && (
              <section>
                <SectionTitle label="Cuotas de deudas" count={deudas.length} />
                <ViewComp items={deudas} monthId={monthId} onOpen={openDetail} />
              </section>
            )}
            {gastos.length > 0 && (
              <section>
                <SectionTitle label="Gastos" count={gastos.length} />
                <ViewComp items={gastos} monthId={monthId} onOpen={openDetail} />
              </section>
            )}
            {personales.length > 0 && (
              <section>
                <SectionTitle label="Personales" count={personales.length} />
                <ViewComp items={personales} monthId={monthId} onOpen={openDetail} />
              </section>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <TableView items={items} monthId={monthId} onOpen={openDetail} />
        ) : viewMode === 'calendar' ? (
          <MonthCalendarView items={items} monthId={monthId} onOpen={openDetail} />
        ) : (
          <GanttView items={items} monthId={monthId} onOpen={openDetail} />
        )}
        </div>
        )}
      </div>

      {/* FAB agregar (el tipo gasto/servicio/personal se elige dentro) */}
      {sub === 'pagos' && (
        <Fab onClick={() => { setEditingExpense(null); setAddOpen(true) }} label="Agregar pago">
          <Plus size={26} />
        </Fab>
      )}

      {/* Felicitación pequeña (punto 22) */}
      {showCongrats && (
        <div className="absolute inset-x-6 top-16 z-40 anim-pop">
          <div className="card p-4 text-center" style={{ borderColor: 'color-mix(in oklab, var(--c-income) 55%, var(--c-border))' }}>
            <p className="font-display text-[17px] font-bold text-ink">¡Mes completado! 🎉</p>
            <p className="text-[13px] text-muted mt-1">Pagaste todo lo de {monthLabel(monthId)}. Excelente disciplina.</p>
          </div>
        </div>
      )}

      <AddExpenseSheet
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditingExpense(null) }}
        monthId={monthId}
        editing={editingExpense}
        defaultKind={addKind}
      />
      <ExpenseDetailSheet
        item={detail}
        monthId={monthId}
        onClose={() => setDetail(null)}
        onEdit={(expenseId) => {
          const e = month.expenses.find((x) => x.id === expenseId)
          if (e) { setDetail(null); setEditingExpense(e); setAddOpen(true) }
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`¿Borrar ${monthLabel(monthId)}?`}
        message="Se eliminarán todos los gastos y servicios de este mes. Las deudas no se tocan."
        confirmLabel="Borrar mes"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); deleteMonth(monthId) }}
      />

      {/* Mes nuevo: ¿copiar lo del mes anterior? (mejora 12) */}
      <ConfirmDialog
        open={showCarryPrompt}
        title={`${monthLabel(monthId)} está vacío`}
        message={`¿Quieres copiar los ${carryCandidates} gastos y servicios recurrentes de ${prevMonth ? monthLabel(prevMonth.id) : 'el mes anterior'}? Las deudas siguen solas para mantener su trazabilidad.`}
        confirmLabel="Sí, copiarlos"
        onCancel={() => markCarryAsked(monthId)}
        onConfirm={() => { if (prevMonth) importRecurring(monthId, prevMonth.id) }}
      />
    </div>
  )
}

function SectionTitle({ label, count, accent }: { label: string; count: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <h3
        className="text-[12.5px] font-bold uppercase tracking-wider"
        style={{ color: accent ? 'var(--app-accent-soft)' : 'var(--c-muted)' }}
      >
        {label}
      </h3>
      <span className="text-[11px] num text-muted bg-elevated border border-edge rounded-full px-1.5 py-px">{count}</span>
    </div>
  )
}
