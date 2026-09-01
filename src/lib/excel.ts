// Exportación a Excel con plantilla preconfigurada (punto 23)
import { Capacitor } from '@capacitor/core'
import type { Debt, MonthData, UserProfile } from '../types/finance'
import { buildPayables, debtPaidCount, debtRemaining, getMonthSummary } from './finance'
import { monthLabel } from './dates'
import type * as ExcelNS from 'exceljs'

const HEADER_FILL = 'FF4F46E5'
const HEADER_FILL_2 = 'FF1E293B'
const OK_FILL = 'FFD1FAE5'
const PEND_FILL = 'FFFEE2E2'

function moneyFmt(currency: string): string {
  const sym: Record<string, string> = { CRC: '₡', USD: '$', EUR: '€' }
  return `"${sym[currency] ?? ''}"#,##0`
}

type Sheet = ExcelNS.Worksheet

function styleHeader(row: ExcelNS.Row, fill = HEADER_FILL) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } }
  })
  row.height = 22
}

function addTitle(ws: Sheet, text: string, span: number) {
  ws.mergeCells(1, 1, 1, span)
  const c = ws.getCell(1, 1)
  c.value = text
  c.font = { bold: true, size: 16, color: { argb: 'FF312E81' } }
  ws.getRow(1).height = 28
}

function monthSheet(ws: Sheet, month: MonthData, debts: Debt[], profile: UserProfile) {
  const fmt = moneyFmt(profile.currency)
  addTitle(ws, `SNFinance — ${monthLabel(month.id)}`, 6)

  const s = getMonthSummary(month, debts)
  ws.addRow([])
  const resumen = ws.addRow(['Ingresos', s.totalIncome, 'Gastos', s.totalExpenses, 'Balance', s.savings])
  resumen.font = { bold: true }
  ;[2, 4, 6].forEach((i) => { resumen.getCell(i).numFmt = fmt })
  resumen.getCell(6).font = { bold: true, color: { argb: s.savings >= 0 ? 'FF047857' : 'FFB91C1C' } }

  ws.addRow([])
  const head = ws.addRow(['Nombre', 'Tipo', 'Monto', 'Vence (día)', 'Frecuencia', 'Estado'])
  styleHeader(head)

  const items = buildPayables(month, debts)
  for (const it of items) {
    const row = ws.addRow([
      it.name,
      it.kind === 'deuda' ? `Deuda (cuota ${it.debtProgress?.current}/${it.debtProgress?.total})` : it.kind === 'servicio' ? 'Servicio' : 'Gasto',
      it.amount,
      it.dueDay ?? '—',
      it.recurrence === 'once' ? 'Único' : 'Recurrente',
      it.paid ? 'PAGADO' : 'Pendiente',
    ])
    row.getCell(3).numFmt = fmt
    const st = row.getCell(6)
    st.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: it.paid ? OK_FILL : PEND_FILL } }
    st.font = { bold: true, color: { argb: it.paid ? 'FF047857' : 'FFB91C1C' } }
    st.alignment = { horizontal: 'center' }
    // sub-hijos (punto 3)
  }

  ws.columns = [
    { width: 32 }, { width: 22 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 14 },
  ]
}

export async function buildWorkbook(
  months: Record<string, MonthData>,
  debts: Debt[],
  profile: UserProfile,
  activeMonthId: string,
): Promise<Blob> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SNFinance'
  wb.created = new Date()
  const fmt = moneyFmt(profile.currency)

  // ── Hoja resumen anual ──
  const res = wb.addWorksheet('Resumen')
  addTitle(res, `SNFinance — Resumen de ${profile.name || 'usuario'}`, 5)
  res.addRow([])
  const rh = res.addRow(['Mes', 'Ingresos', 'Gastos', 'Balance', 'Pagado'])
  styleHeader(rh, HEADER_FILL_2)
  const ids = Object.keys(months).sort()
  for (const id of ids) {
    const s = getMonthSummary(months[id], debts)
    const row = res.addRow([
      monthLabel(id), s.totalIncome, s.totalExpenses, s.savings,
      `${s.countPaid}/${s.countTotal}`,
    ])
    ;[2, 3, 4].forEach((i) => { row.getCell(i).numFmt = fmt })
    row.getCell(4).font = { color: { argb: s.savings >= 0 ? 'FF047857' : 'FFB91C1C' }, bold: true }
  }
  res.columns = [{ width: 22 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }]

  // ── Hoja del mes activo ──
  const active = months[activeMonthId]
  if (active) monthSheet(wb.addWorksheet(monthLabel(activeMonthId, true)), active, debts, profile)

  // ── Hoja de deudas ──
  const dws = wb.addWorksheet('Deudas')
  addTitle(dws, 'Deudas', 6)
  dws.addRow([])
  const dh = dws.addRow(['Deuda', 'Total', 'Cuota mensual', 'Cuotas pagadas', 'Saldo restante', 'Vence (día)'])
  styleHeader(dh)
  for (const d of debts) {
    const row = dws.addRow([
      d.name, d.total, d.monthlyPayment, `${debtPaidCount(d)}/${d.installments}`, debtRemaining(d), d.dueDay,
    ])
    ;[2, 3, 5].forEach((i) => { row.getCell(i).numFmt = fmt })
  }
  dws.columns = [{ width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 12 }]

  // ── Plantilla lista para llenar (punto 23) ──
  const tpl = wb.addWorksheet('Plantilla')
  addTitle(tpl, 'Plantilla mensual — llénala a tu gusto', 6)
  tpl.addRow([])
  const th = tpl.addRow(['Nombre', 'Tipo', 'Monto', 'Vence (día)', 'Frecuencia', 'Estado'])
  styleHeader(th)
  for (let i = 0; i < 18; i++) {
    const r = tpl.addRow(['', '', 0, '', '', 'Pendiente'])
    r.getCell(3).numFmt = fmt
  }
  tpl.addRow([])
  const totalRow = tpl.addRow(['TOTAL', '', { formula: 'SUM(C4:C21)' }, '', '', ''])
  totalRow.font = { bold: true }
  totalRow.getCell(3).numFmt = fmt
  tpl.columns = [{ width: 32 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 14 }]

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(new Error('No se pudo leer el archivo'))
    r.readAsDataURL(blob)
  })
}

/** Descarga (web) o guarda y comparte (Android) el Excel */
export async function downloadWorkbook(blob: Blob, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')
      const data = await blobToBase64(blob)
      const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
      await Share.share({ title: filename, url: res.uri })
      return
    } catch { /* seguir con el fallback web */ }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
