// Resumen mensual como imagen para compartir (nueva funcionalidad 6)
import type { AppSettings, Debt, MonthData } from '../types/finance'
import { buildPayables, getMonthSummary } from './finance'
import { hormigasTotal, realBalance } from './fund'
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
  const hormigas = hormigasTotal(month)
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
  ctx.fillText('SNBusiness · Resumen del mes', 72, 84)

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
    ['Gastos hormiga', formatMoney(Math.round(hormigas)), hormigas > 0 ? '#f5a524' : '#8b93a7'],
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
  ctx.fillText('Hecho con SNBusiness · mis finanzas bajo control', 150, H - 102)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png')
  })
}
