import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, ChartGantt, ChevronLeft, ChevronRight, LayoutGrid,
  List, Plus, Sparkles, Table2, Trash2, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import type { Expense, ExpenseKind, PayableItem, ViewMode } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { buildPayables, getMonthSummary, recurringCandidates } from '../../lib/finance'
import { addMonthsToId, isCurrentMonth, monthLabel } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { celebrate } from '../../lib/fx'
import { CurrencyInput } from '../ui/CurrencyInput'
import { Segmented } from '../ui/Segmented'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { AddExpenseSheet } from './AddExpenseSheet'
import { ExpenseDetailSheet } from './ExpenseDetailSheet'
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

export function MonthView() {
  const monthId = useFinanceStore((s) => s.activeMonthId)
  const month = useFinanceStore((s) => s.months[monthId])
  const debts = useFinanceStore((s) => s.debts)
  const viewMode = useFinanceStore((s) => s.settings.viewMode)
  const setViewMode = useFinanceStore((s) => s.setViewMode)
  const setActiveMonth = useFinanceStore((s) => s.setActiveMonth)
  const ensureMonthExists = useFinanceStore((s) => s.ensureMonthExists)
  const deleteMonth = useFinanceStore((s) => s.deleteMonth)
  const updateIncome = useFinanceStore((s) => s.updateIncome)
  const markCelebrated = useFinanceStore((s) => s.markCelebrated)
  const animPrefs = useFinanceStore((s) => s.settings.animations)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)
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

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain" style={{ scrollbarGutter: 'stable' }}>
      <div className="px-4 pb-32 pt-2 flex flex-col gap-4">

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
            {isCurrentMonth(monthId)
              ? <span className="text-[11px] font-semibold" style={{ color: 'var(--app-accent-soft)' }}>Mes actual</span>
              : (
                <button onClick={() => setConfirmDelete(true)} className="pressable text-[11px] text-muted inline-flex items-center gap-1">
                  <Trash2 size={11} /> Borrar este mes
                </button>
              )}
          </div>
          <button
            onClick={() => setActiveMonth(addMonthsToId(monthId, 1))}
            aria-label="Mes siguiente"
            className="pressable w-10 h-10 rounded-full bg-card border border-edge flex items-center justify-center text-muted"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Ingresos */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={16} className="text-accent-soft" />
            <h3 className="text-[13.5px] font-semibold text-muted">Ingresos del mes</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] text-muted block mb-1">Salario</label>
              <CurrencyInput value={month.income.salary} onChange={(v) => updateIncome(monthId, { salary: v })} />
            </div>
            <div>
              <label className="text-[11.5px] text-muted block mb-1">Adicionales</label>
              <CurrencyInput value={month.income.additional} onChange={(v) => updateIncome(monthId, { additional: v })} />
            </div>
          </div>
        </div>

        {/* Resumen + progreso (punto 15) */}
        <div className="card p-4 relative overflow-hidden">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: 'var(--app-gradient)' }}
          />
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[11.5px] text-muted mb-0.5">Balance del mes</p>
              <p className="num text-[26px] font-bold leading-none" style={{ color: summary.savings >= 0 ? 'var(--c-income)' : 'var(--c-danger)' }}>
                {formatMoney(summary.savings)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11.5px] text-muted inline-flex items-center gap-1">
                <TrendingUp size={11} style={{ color: 'var(--c-income)' }} /> {formatMoney(summary.totalIncome)}
              </p>
              <p className="text-[11.5px] text-muted inline-flex items-center gap-1 ml-3">
                <TrendingDown size={11} style={{ color: 'var(--c-danger)' }} /> {formatMoney(summary.totalExpenses)}
              </p>
              <p className="text-[12px] mt-1.5 text-muted">
                <span className="num font-semibold text-ink">{summary.countPaid}/{summary.countTotal}</span> pagados
              </p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-elevated overflow-hidden mt-3">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.round(summary.progress * 100)}%`, background: 'var(--app-gradient)' }}
            />
          </div>
        </div>

        {/* Banner: planes recomendados cuando ya hay datos (punto 14) */}
        {summary.countTotal >= 3 && summary.totalIncome > 0 && (
          <button
            onClick={() => setActiveTab('debts')}
            className="pressable card p-3.5 flex items-center gap-3 text-left"
            style={{ borderColor: 'color-mix(in oklab, var(--app-accent) 45%, var(--c-border))' }}
          >
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in oklab, var(--app-accent) 20%, transparent)' }}
            >
              <Sparkles size={17} style={{ color: 'var(--app-accent-soft)' }} />
            </span>
            <span className="flex-1">
              <span className="block text-[13.5px] font-semibold text-ink">3 formas recomendadas de pagar este mes</span>
              <span className="block text-[11.5px] text-muted mt-0.5">La IA analiza tus gastos, deudas y salario</span>
            </span>
            <ChevronRight size={16} className="text-muted shrink-0" />
          </button>
        )}

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

      {/* FAB agregar (el tipo gasto/servicio/personal se elige dentro) */}
      <button
        onClick={() => { setEditingExpense(null); setAddOpen(true) }}
        aria-label="Agregar pago"
        className="pressable absolute bottom-[72px] right-4 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl z-30"
        style={{ background: 'var(--app-gradient)', boxShadow: '0 10px 30px color-mix(in oklab, var(--app-accent) 45%, transparent)' }}
      >
        <Plus size={26} />
      </button>

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
