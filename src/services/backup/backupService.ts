import { db } from '@/db/database'
import type { TableName } from '@/db/schema'
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupDataStore, type FitnessBackup } from './backupTypes'

const exportStores: BackupDataStore[] = [
  'settings', 'metadata', 'foods', 'nutrients', 'foodNutrients', 'servings', 'barcodeMappings', 'favorites', 'recentFoods', 'foodLogs',
  'exercises', 'workoutTemplates', 'workoutTemplateExercises', 'workoutSchedules', 'workoutSessions', 'workoutSessionExercises', 'workoutSets', 'weightLogs'
]

export interface BackupSummary {
  exportedAt: string
  foodEntries: number
  workoutSessions: number
  workoutTemplates: number
  weightLogs: number
  workoutSets: number
}

export function validateBackup(value: unknown): FitnessBackup {
  if (!value || typeof value !== 'object') throw new Error('That file is not a valid fitness backup.')
  const candidate = value as Partial<FitnessBackup>
  if (candidate.format !== BACKUP_FORMAT) throw new Error('This backup was created by a different application.')
  if (candidate.version !== BACKUP_VERSION) throw new Error(`Backup version ${String(candidate.version)} is not supported yet.`)
  if (!candidate.data || typeof candidate.data !== 'object' || Array.isArray(candidate.data)) throw new Error('The backup data section is invalid.')
  for (const store of exportStores) {
    const records = candidate.data[store]
    if (records !== undefined && !Array.isArray(records)) throw new Error(`The ${store} backup section is invalid.`)
  }
  return candidate as FitnessBackup
}

export function summarizeBackup(backup: FitnessBackup): BackupSummary {
  const count = (store: BackupDataStore) => backup.data[store]?.length ?? 0
  return {
    exportedAt: backup.exportedAt,
    foodEntries: count('foods'),
    workoutSessions: count('workoutSessions'),
    workoutTemplates: count('workoutTemplates'),
    weightLogs: count('weightLogs'),
    workoutSets: count('workoutSets')
  }
}

export async function createBackup(): Promise<FitnessBackup> {
  await db.open()
  const data = Object.fromEntries(await Promise.all(exportStores.map(async (store) => [store, await db.table(store).toArray()]))) as FitnessBackup['data']
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), appVersion: '0.2.0', data }
}

export function downloadBackup(backup: FitnessBackup): void {
  const date = backup.exportedAt.slice(0, 10)
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `fitness-backup-${date}.json`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function replaceWithBackup(backup: FitnessBackup): Promise<void> {
  const safeBackup = validateBackup(backup)
  const tables = exportStores.map((store) => db.table(store))
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((table) => table.clear()))
    await Promise.all(exportStores.map(async (store) => {
      const records = safeBackup.data[store] ?? []
      if (records.length) await db.table(store).bulkPut(records)
    }))
  })
}

export function backupStoreNames(): readonly TableName[] {
  return exportStores
}
