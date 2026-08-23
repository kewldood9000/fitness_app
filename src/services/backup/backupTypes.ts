import type { TableName } from '@/db/schema'

export const BACKUP_FORMAT = 'personal-fitness-backup'
export const BACKUP_VERSION = 1
export type BackupDataStore = Exclude<TableName, 'credentials'>

export interface FitnessBackup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  appVersion: string
  /** Credentials are deliberately excluded from the standard backup. */
  data: Partial<Record<BackupDataStore, unknown[]>>
}
