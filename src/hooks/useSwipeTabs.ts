import { useRef } from 'react'
import type { TabId } from '../types/finance'
import { useFinanceStore } from '../store/useFinanceStore'

export const TAB_ORDER: TabId[] = ['home', 'month', 'debts', 'year', 'settings']

/**
 * Deslizar horizontalmente para cambiar de pestaña (como app premium).
 * Ignora el gesto cuando empieza sobre un elemento con scroll horizontal
 * (tabla, gantt, carruseles) para no robarle el gesto.
 */
export function useSwipeTabs() {
  const activeTab = useFinanceStore((s) => s.activeTab)
  const setActiveTab = useFinanceStore((s) => s.setActiveTab)

  const start = useRef<{ x: number; y: number; blocked: boolean; decided: 'h' | 'v' | null }>({
    x: 0, y: 0, blocked: false, decided: null,
  })

  const onTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const t = e.touches[0]
    let blocked = false
    let el = e.target as HTMLElement | null
    const root = e.currentTarget as HTMLElement
    while (el && el !== root) {
      try {
        const s = getComputedStyle(el)
        if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 4) {
          blocked = true
          break
        }
      } catch { /* elemento desmontado */ }
      el = el.parentElement
    }
    start.current = { x: t.clientX, y: t.clientY, blocked, decided: null }
  }

  const onTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (start.current.blocked || start.current.decided) return
    const t = e.touches[0]
    const dx = Math.abs(t.clientX - start.current.x)
    const dy = Math.abs(t.clientY - start.current.y)
    if (dx > 12 || dy > 12) start.current.decided = dx > dy ? 'h' : 'v'
  }

  const onTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const st = start.current
    if (st.blocked || st.decided === 'v') return
    const t = e.changedTouches[0]
    const dx = t.clientX - st.x
    const dy = t.clientY - st.y
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return
    const idx = TAB_ORDER.indexOf(activeTab)
    const next = dx < 0 ? idx + 1 : idx - 1
    if (next < 0 || next >= TAB_ORDER.length) return
    setActiveTab(TAB_ORDER[next])
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}
