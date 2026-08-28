import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useFinanceStore } from './store/useFinanceStore'

// Los service workers no funcionan en el WebView nativo de Capacitor
const isNative = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } })
  .Capacitor?.isNativePlatform?.()

if (!isNative && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: false })
  }).catch(() => {})
}

// Acceso al store en desarrollo (depuración/pruebas)
if (import.meta.env.DEV) {
  ;(window as unknown as { __store?: typeof useFinanceStore }).__store = useFinanceStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
