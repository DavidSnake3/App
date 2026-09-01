// Resumen mensual como imagen para compartir (nueva funcionalidad 6)
import type { AppSettings, Debt, MonthData } from '../types/finance'
import { buildPayables, getMonthSummary } from './finance'
import { hormigasTotal, realBalance } from './fund'
import { movementsExpense } from './accounts'
import { monthLabel } from './dates'
import { formatMoney } from './format'
import { SN_GRADIENT } from './logo'

const W = 1080
const H = 1400

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Dibuja la tarjeta-resumen del mes y la devuelve como PNG */
export async function buildMonthCardBlob(
  month: MonthData,
  debts: Debt[],
  settings: AppSettings,
  months: Record<string, MonthData>,
  userName: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  const s = getMonthSummary(month, debts)
  const movimientos = movementsExpense(month) + hormigasTotal(month)
  const saldo = realBalance(months, debts, settings)
  const top = buildPayables(month, debts).slice().sort((a, b) => b.amount - a.amount).slice(0, 3)

  // Fondo
  ctx.fillStyle = '#0b0f1a'
  ctx.fillRect(0, 0, W, H)

  // Encabezado con gradiente de la marca
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, SN_GRADIENT[0])
  grad.addColorStop(1, SN_GRADIENT[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, 14)

  ctx.textBaseline = 'top'
  ctx.fillStyle = '#8b93a7'
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.fillText('SNFinance · Resumen del mes', 72, 84)

  ctx.fillStyle = '#f4f6fb'
  ctx.font = '800 84px system-ui, sans-serif'
  ctx.fillText(monthLabel(month.id), 72, 138)

  if (userName) {
    ctx.fillStyle = '#8b93a7'
    ctx.font = '500 34px system-ui, sans-serif'
    ctx.fillText(userName, 72, 244)
  }

  // Balance grande
  roundRect(ctx, 72, 320, W - 144, 210, 28)
  ctx.fillStyle = '#131a2b'
  ctx.fill()
  ctx.fillStyle = '#8b93a7'
  ctx.font = '600 32px system-ui, sans-serif'
  ctx.fillText('Balance del mes (ingresos − pagos)', 108, 356)
  ctx.fillStyle = s.savings >= 0 ? '#3fc3ae' : '#f4587a'
  ctx.font = '800 92px system-ui, sans-serif'
  ctx.fillText(formatMoney(s.savings), 108, 402)

  // Filas de datos
  const rows: [string, string, string][] = [
    ['Ingresos', formatMoney(s.totalIncome), '#3fc3ae'],
    ['Pagado', `${formatMoney(s.paidAmount)}  (${s.countPaid}/${s.countTotal})`, '#f4f6fb'],
    ['Pendiente', formatMoney(s.pendingAmount), s.pendingAmount > 0 ? '#f5a524' : '#8b93a7'],
    ['Movimientos', formatMoney(Math.round(movimientos)), movimientos > 0 ? '#f5a524' : '#8b93a7'],
  ]
  if (saldo != null) rows.push(['Saldo real (banco)', formatMoney(Math.round(saldo)), saldo >= 0 ? '#3fc3ae' : '#f4587a'])

  let y = 590
  for (const [label, value, color] of rows) {
    ctx.fillStyle = '#8b93a7'
    ctx.font = '600 38px system-ui, sans-serif'
    ctx.fillText(label, 72, y)
    ctx.fillStyle = color
    ctx.font = '700 40px system-ui, sans-serif'
    const tw = ctx.measureText(value).width
    ctx.fillText(value, W - 72 - tw, y)
    ctx.strokeStyle = 'rgba(139,147,167,0.18)'
    ctx.beginPath()
    ctx.moveTo(72, y + 62)
    ctx.lineTo(W - 72, y + 62)
    ctx.stroke()
    y += 86
  }

  // Top pagos del mes
  if (top.length) {
    y += 34
    ctx.fillStyle = '#8b93a7'
    ctx.font = '700 34px system-ui, sans-serif'
    ctx.fillText('LOS MÁS GRANDES DEL MES', 72, y)
    y += 62
    for (const it of top) {
      ctx.fillStyle = it.paid ? '#3fc3ae' : '#f5a524'
      ctx.font = '700 36px system-ui, sans-serif'
      ctx.fillText(it.paid ? '✓' : '•', 72, y)
      ctx.fillStyle = '#f4f6fb'
      ctx.font = '600 38px system-ui, sans-serif'
      ctx.fillText(it.name.slice(0, 26), 130, y)
      const v = formatMoney(it.amount)
      const tw = ctx.measureText(v).width
      ctx.fillStyle = '#8b93a7'
      ctx.fillText(v, W - 72 - tw, y)
      y += 66
    }
  }

  // Pie
  ctx.fillStyle = grad
  ctx.font = '800 40px system-ui, sans-serif'
  ctx.fillText('SN', 72, H - 110)
  ctx.fillStyle = '#8b93a7'
  ctx.font = '500 30px system-ui, sans-serif'
  ctx.fillText('Hecho con SNFinance · mis finanzas bajo control', 150, H - 102)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png')
  })
}

/* ─── Reporte financiero como imagen (mejora 16) ───────────────────────────── */

export interface StatementSection {
  title: string
  rows: [string, number][]
  total: [string, number]
  /** las filas son porcentajes, no dinero */
  percentRows?: boolean
}

export async function buildStatementBlob(opts: {
  title: string
  subtitle: string
  owner?: string
  sections: StatementSection[]
}): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const width = 1080
  const rowsCount = opts.sections.reduce((n, s) => n + s.rows.filter(([, v]) => v !== 0).length + 2, 0)
  const height = Math.max(1000, 320 + rowsCount * 56 + opts.sections.length * 40)
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  ctx.fillStyle = '#0b0f1a'
  ctx.fillRect(0, 0, width, height)
  const grad = ctx.createLinearGradient(0, 0, width, 0)
  grad.addColorStop(0, SN_GRADIENT[0])
  grad.addColorStop(1, SN_GRADIENT[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, 14)

  ctx.textBaseline = 'top'
  ctx.fillStyle = '#8b93a7'
  ctx.font = '600 32px system-ui, sans-serif'
  ctx.fillText('SNFinance', 72, 76)
  ctx.fillStyle = '#f4f6fb'
  ctx.font = '800 62px system-ui, sans-serif'
  ctx.fillText(opts.title, 72, 118)
  ctx.fillStyle = '#8b93a7'
  ctx.font = '500 32px system-ui, sans-serif'
  ctx.fillText(opts.subtitle, 72, 196)
  if (opts.owner) ctx.fillText(opts.owner, 72, 238)

  let y = opts.owner ? 310 : 275
  for (const sec of opts.sections) {
    ctx.fillStyle = SN_GRADIENT[1]
    ctx.font = '800 30px system-ui, sans-serif'
    ctx.fillText(sec.title, 72, y)
    y += 52
    for (const [label, value] of sec.rows) {
      if (value === 0) continue
      ctx.fillStyle = '#8b93a7'
      ctx.font = '500 34px system-ui, sans-serif'
      ctx.fillText(label, 96, y)
      const txt = sec.percentRows ? `${Math.round(value)}%` : formatMoney(Math.round(Math.abs(value)))
      const sign = !sec.percentRows && value < 0 ? '-' : ''
      ctx.fillStyle = value < 0 && !sec.percentRows ? '#f4587a' : '#e8eaf2'
      ctx.font = '600 34px system-ui, sans-serif'
      const w = ctx.measureText(sign + txt).width
      ctx.fillText(sign + txt, width - 72 - w, y)
      y += 52
    }
    // total de la sección
    ctx.strokeStyle = 'rgba(139,147,167,0.3)'
    ctx.beginPath()
    ctx.moveTo(96, y + 4)
    ctx.lineTo(width - 72, y + 4)
    ctx.stroke()
    y += 20
    ctx.fillStyle = '#f4f6fb'
    ctx.font = '800 36px system-ui, sans-serif'
    ctx.fillText(sec.total[0], 96, y)
    const tv = formatMoney(Math.round(sec.total[1]))
    ctx.fillStyle = sec.total[1] >= 0 ? '#3fc3ae' : '#f4587a'
    const tw = ctx.measureText(tv).width
    ctx.fillText(tv, width - 72 - tw, y)
    y += 74
  }

  ctx.fillStyle = '#8b93a7'
  ctx.font = '500 26px system-ui, sans-serif'
  ctx.fillText('Estado de flujo de efectivo personal y balance de patrimonio · SNFinance', 72, height - 70)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png')
  })
}
