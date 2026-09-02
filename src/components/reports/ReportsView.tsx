import { useMemo, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, FileText, PieChart } from 'lucide-react'
import type { ReportsSub } from '../../types/finance'
import { useFinanceStore } from '../../store/useFinanceStore'
import { categoryTotals } from '../../lib/accounts'
import { currentMonthId, daysInMonth, parseMonthId } from '../../lib/dates'
import { formatMoney } from '../../lib/format'
import { HubHeader, HubMenu, HubTitle, type HubItem } from '../layout/HubMenu'
import { YearView } from '../year/YearView'
import { FinancialReport } from '../year/YearInsights'
import { CategoryReport } from './CategoryReport'

const TITULOS: Record<ReportsSub, { title: string; subtitle: string }> = {
  ano: { title: 'El año', subtitle: 'Calendario, proyección y deudas' },
  categorias: { title: 'En qué se va tu plata', subtitle: 'Movimientos por categoría y cuenta' },
  reporte: { title: 'Reporte financiero', subtitle: 'Ingresos, gastos, ahorro y balance' },
}

/** Hub "Reportes": el año, los movimientos por tipo y el reporte financiero */
export function ReportsView() {
  const guardado = useFinanceStore((s) => s.subs.reports) ?? ''
  // si una version vieja dejo guardado un submenu que ya no existe, abrimos el menu
  const sub = (guardado in TITULOS ? guardado : '') as ReportsSub | ''
  const setSub = useFinanceStore((s) => s.setSub)
  const activeMonthId = useFinanceStore((s) => s.activeMonthId)
  const months = useFinanceStore((s) => s.months)
  const [year, setYear] = useState(() => parseMonthId(activeMonthId).year)

  // gasto del mes en curso, para el dato del cuadro de categorías
  const gastoMes = useMemo(() => {
    const mid = currentMonthId()
    const cats = categoryTotals(months, `${mid}-01`, `${mid}-${String(daysInMonth(mid)).padStart(2, '0')}`, 'gasto')
    return cats.reduce((s, c) => s + c.total, 0)
  }, [months])

  const items: HubItem<ReportsSub>[] = [
    {
      id: 'ano',
      title: 'El año',
      desc: 'Calendario anual, proyección y deudas',
      icon: <CalendarRange size={19} />,
      stat: `${parseMonthId(activeMonthId).year}`,
      tone: 'accent',
    },
    {
      id: 'categorias',
      title: 'Categorías',
      desc: 'Mensual, anual o a tu medida',
      icon: <PieChart size={19} />,
      stat: gastoMes > 0 ? formatMoney(Math.round(gastoMes)) : 'Sin movimientos',
      tone: 'warning',
    },
    {
      id: 'reporte',
      title: 'Reporte',
      desc: 'Ingresos, gastos, ahorro y balance',
      icon: <FileText size={19} />,
      stat: 'Ver el período',
      tone: 'income',
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain" style={{ scrollbarGutter: 'stable' }}>
      <div className="px-4 pb-32 pt-2 flex flex-col gap-4">
        {!sub ? (
          <div className="flex flex-col gap-4 anim-page">
            <HubTitle title="Reportes" subtitle="Tus números claros, en el período que quieras" />
            <HubMenu items={items} onPick={(id) => setSub('reports', id)} />
          </div>
        ) : (
          <div key={sub} className="flex flex-col gap-4 anim-page">
            <HubHeader
              title={TITULOS[sub].title}
              subtitle={TITULOS[sub].subtitle}
              onBack={() => setSub('reports', '')}
            />
            {sub === 'ano' && <YearView embedded showReport={false} />}
            {sub === 'categorias' && <CategoryReport />}
            {sub === 'reporte' && (
              <>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setYear((y) => y - 1)}
                    aria-label="Año anterior"
                    className="pressable w-9 h-9 rounded-full bg-card border border-edge flex items-center justify-center text-muted"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <p className="num font-display text-[18px] font-bold text-ink">{year}</p>
                  <button
                    onClick={() => setYear((y) => y + 1)}
                    aria-label="Año siguiente"
                    className="pressable w-9 h-9 rounded-full bg-card border border-edge flex items-center justify-center text-muted"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
                <FinancialReport year={year} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
