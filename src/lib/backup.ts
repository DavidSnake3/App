// Exportar e importar respaldo completo en JSON (mejora 14)
import { Capacitor } from '@capacitor/core'
import type { PersistedShape } from '../store/useFinanceStore'
import { formatDate } from './format'
import { exportState, useFinanceStore } from '../store/useFinanceStore'

interface BackupFile {
  app: string
  version: 2
  exportedAt: string
  data: PersistedShape
}

export async function exportBackup(): Promise<void> {
  const backup: BackupFile = {
    app: 'SNFinance',
    version: 2,
    exportedAt: new Date().toISOString(),
    data: exportState(),
  }
  const json = JSON.stringify(backup, null, 2)
  const name = `SNFinance-respaldo-${new Date().toISOString().slice(0, 10)}.json`

  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')
      const res = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: name, url: res.uri })
      return
    } catch { /* fallback web */ }
  }
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Lee y valida un respaldo; devuelve un resumen sin aplicarlo todavía */
export async function readBackup(file: File): Promise<{ data: PersistedShape; months: number; debts: number; fecha: string }> {
  const text = await file.text()
  const parsed = JSON.parse(text) as Partial<BackupFile>
  // se aceptan respaldos del nombre anterior (SNBusiness)
  const known = parsed.app === 'SNFinance' || parsed.app === 'SNBusiness'
  const data = (known && parsed.data ? parsed.data : parsed) as PersistedShape
  if (!data || typeof data !== 'object' || !data.months || !data.settings) {
    throw new Error('El archivo no parece un respaldo de SNFinance.')
  }
  return {
    data,
    months: Object.keys(data.months).length,
    debts: (data.debts ?? []).length,
    fecha: parsed.exportedAt ? formatDate(parsed.exportedAt) : 'desconocida',
  }
}

export function applyBackup(data: PersistedShape): void {
  useFinanceStore.getState().hydrateFrom({ ...data, updatedAt: Date.now() })
}
