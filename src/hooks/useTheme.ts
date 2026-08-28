import { useEffect } from 'react'
import { useFinanceStore } from '../store/useFinanceStore'
import { applyTheme } from '../lib/themes'
import { setCurrency } from '../lib/format'
import { setRuntimeGeminiKey } from '../lib/ai'

/** Aplica tema, moneda y preferencias globales al documento */
export function useTheme() {
  const theme = useFinanceStore((s) => s.settings.theme)
  const transitions = useFinanceStore((s) => s.settings.animations.transitions)
  const currency = useFinanceStore((s) => s.profile.currency)
  const geminiKey = useFinanceStore((s) => s.settings.geminiKey)

  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('no-anim', !transitions)
  }, [transitions])

  useEffect(() => { setCurrency(currency) }, [currency])

  useEffect(() => { setRuntimeGeminiKey(geminiKey) }, [geminiKey])
}
