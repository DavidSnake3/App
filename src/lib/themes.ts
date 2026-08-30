import type { ThemeSettings } from '../types/finance'

// Paletas seleccionables (punto 17)
export interface Palette {
  id: string
  name: string
  accent: string
  accentSoft: string
  gradient: string // gradiente decorativo del header/fondo default
}

export const PALETTES: Palette[] = [
  { id: 'aurora',    name: 'Aurora',    accent: '#7c5cff', accentSoft: '#a78bfa', gradient: 'linear-gradient(135deg,#7c5cff 0%,#4f46e5 55%,#2563eb 100%)' },
  { id: 'esmeralda', name: 'Esmeralda', accent: '#10b981', accentSoft: '#34d399', gradient: 'linear-gradient(135deg,#10b981 0%,#059669 55%,#0d9488 100%)' },
  { id: 'oceano',    name: 'Océano',    accent: '#0ea5e9', accentSoft: '#38bdf8', gradient: 'linear-gradient(135deg,#0ea5e9 0%,#2563eb 60%,#4338ca 100%)' },
  { id: 'atardecer', name: 'Atardecer', accent: '#f43f5e', accentSoft: '#fb7185', gradient: 'linear-gradient(135deg,#f43f5e 0%,#e11d48 50%,#9333ea 100%)' },
  { id: 'oro',       name: 'Oro',       accent: '#d97706', accentSoft: '#f59e0b', gradient: 'linear-gradient(135deg,#f59e0b 0%,#d97706 55%,#b45309 100%)' },
  { id: 'cereza',    name: 'Cereza',    accent: '#ec4899', accentSoft: '#f472b6', gradient: 'linear-gradient(135deg,#ec4899 0%,#db2777 55%,#7c3aed 100%)' },
]

export const BG_PRESETS: { id: string; name: string; value: string }[] = [
  { id: 'noche',   name: 'Noche',   value: 'radial-gradient(1200px 800px at 85% -10%, color-mix(in oklab, var(--app-accent) 22%, transparent), transparent 60%), var(--c-bg-base)' },
  { id: 'plano',   name: 'Plano',   value: 'var(--c-bg-base)' },
  { id: 'aurora',  name: 'Aurora',  value: 'radial-gradient(900px 600px at 10% -5%, color-mix(in oklab, var(--app-accent) 26%, transparent), transparent 55%), radial-gradient(800px 700px at 100% 30%, color-mix(in oklab, #2dd4a0 14%, transparent), transparent 60%), var(--c-bg-base)' },
  { id: 'malla',   name: 'Malla',   value: 'radial-gradient(700px 500px at 0% 100%, color-mix(in oklab, var(--app-accent) 18%, transparent), transparent 55%), radial-gradient(700px 500px at 100% 0%, color-mix(in oklab, var(--app-accent) 24%, transparent), transparent 55%), var(--c-bg-base)' },
]

// Colores de series de gráficas — validados con el skill dataviz (CVD-safe)
export const CHART_SERIES = {
  dark:  { income: '#199e70', savings: '#9085e9', expense: '#d55181' },
  light: { income: '#128a60', savings: '#4a3aa7', expense: '#c4356b' },
}

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

/** Aplica el tema como variables CSS en <html> (punto 17) */
export function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement
  const palette = getPalette(theme.paletteId)
  const accent = theme.accent || palette.accent
  const dark = theme.mode === 'dark'

  root.style.setProperty('--app-accent', accent)
  root.style.setProperty('--app-accent-soft', palette.accentSoft)
  root.style.setProperty('--app-gradient', palette.gradient)
  root.dataset.mode = theme.mode
  root.style.colorScheme = theme.mode

  // Superficies
  if (dark) {
    root.style.setProperty('--c-bg-base', '#0b0d14')
    root.style.setProperty('--c-card', '#141826')
    root.style.setProperty('--c-elevated', '#1b2130')
    root.style.setProperty('--c-border', '#232a3d')
    root.style.setProperty('--c-text', '#e8eaf2')
    root.style.setProperty('--c-muted', '#98a0b3')
    root.style.setProperty('--c-income', '#2dd4a0')
    root.style.setProperty('--c-danger', '#ff5c7a')
    root.style.setProperty('--c-warning', '#ffb84d')
    root.style.setProperty('--c-safe', '#2dd4a0')
    root.style.setProperty('--c-overdue', '#ff3358')
    root.style.setProperty('--chart-income', CHART_SERIES.dark.income)
    root.style.setProperty('--chart-savings', CHART_SERIES.dark.savings)
    root.style.setProperty('--chart-expense', CHART_SERIES.dark.expense)
  } else {
    root.style.setProperty('--c-bg-base', '#f2f4fa')
    root.style.setProperty('--c-card', '#ffffff')
    root.style.setProperty('--c-elevated', '#f6f7fb')
    root.style.setProperty('--c-border', '#e2e6f0')
    root.style.setProperty('--c-text', '#12141c')
    root.style.setProperty('--c-muted', '#5a6172')
    root.style.setProperty('--c-income', '#0f9d6a')
    root.style.setProperty('--c-danger', '#dc2f55')
    root.style.setProperty('--c-warning', '#b45309')
    root.style.setProperty('--c-safe', '#0f9d6a')
    root.style.setProperty('--c-overdue', '#c11f45')
    root.style.setProperty('--chart-income', CHART_SERIES.light.income)
    root.style.setProperty('--chart-savings', CHART_SERIES.light.savings)
    root.style.setProperty('--chart-expense', CHART_SERIES.light.expense)
  }

  // Fondo personalizable (punto 17)
  const bg = theme.background
  let bgValue = BG_PRESETS[0].value
  if (bg.type === 'color') bgValue = bg.value
  else if (bg.type === 'gradient') bgValue = bg.value
  else if (bg.type === 'image' && bg.value) bgValue = `url("${bg.value}") center / cover no-repeat fixed, var(--c-bg-base)`
  else if (bg.type === 'default') {
    const preset = BG_PRESETS.find((p) => p.id === bg.value)
    if (preset) bgValue = preset.value
  }
  root.style.setProperty('--app-bg', bgValue)
  root.style.setProperty('--bg-dim', bg.type === 'image' ? (dark ? '0.55' : '0.25') : '0')
  // aplicar directamente para ganar a los estilos de arranque de index.html
  document.body.style.background = bgValue
  document.body.style.backgroundAttachment = 'fixed'
  root.style.background = dark ? '#0b0d14' : '#f2f4fa'

  // Color de la barra del sistema
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0b0d14' : '#f2f4fa')
}

/** Reduce un dataURL de imagen a JPEG del tamaño/calidad indicados */
export async function recompressDataUrl(dataUrl: string, maxSide = 720, quality = 0.62): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Imagen inválida'))
    i.src = dataUrl
  })
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Comprime una imagen a JPEG (fondos: usar 720/0.62 para que quepan en la nube) */
export async function compressImage(file: File, maxSide = 1080, quality = 0.78): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('No se pudo leer la imagen'))
    r.readAsDataURL(file)
  })
  return recompressDataUrl(dataUrl, maxSide, quality)
}
