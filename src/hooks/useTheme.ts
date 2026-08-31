import { useEffect } from 'react'
import { useFinanceStore } from '../store/useFinanceStore'
import { applyTheme } from '../lib/themes'
import { setCurrency, setLocale, setSecondCurrency } from '../lib/format'
import { setRuntimeGeminiKey } from '../lib/ai'

/** Aplica tema, moneda y preferencias globales al documento */
export function useTheme() {
  const theme = useFinanceStore((s) => s.settings.theme)
  const transitions = useFinanceStore((s) => s.settings.animations.transitions)
  const currency = useFinanceStore((s) => s.profile.currency)
  const locale = useFinanceStore((s) => s.profile.locale)
  const secondCurrency = useFinanceStore((s) => s.profile.secondCurrency)
  const exchangeRate = useFinanceStore((s) => s.profile.exchangeRate)
  const geminiKey = useFinanceStore((s) => s.settings.geminiKey)

  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('no-anim', !transitions)
  }, [transitions])

  useEffect(() => { setCurrency(currency) }, [currency])

  useEffect(() => { setLocale(locale ?? 'es-CR') }, [locale])

  useEffect(() => {
    setSecondCurrency(secondCurrency ?? '', exchangeRate ?? 0)
  }, [secondCurrency, exchangeRate])

  useEffect(() => { setRuntimeGeminiKey(geminiKey) }, [geminiKey])
}
