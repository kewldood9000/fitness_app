import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, BACKUP_VERSION, type FitnessBackup } from './backupTypes'
import { summarizeBackup, validateBackup } from './backupService'

const backup: FitnessBackup = {
  format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: '2026-08-22T12:00:00.000Z', appVersion: '0.2.0',
  data: { foods: [{ id: 'food' }], workoutSessions: [{ id: 'session' }], workoutTemplates: [{ id: 'template' }], workoutSets: [{ id: 'set' }], weightLogs: [{ id: 'weight' }] }
}

describe('backup validation', () => {
  it('accepts versioned personal-fitness backups and summarizes their important records', () => {
    expect(summarizeBackup(validateBackup(backup))).toMatchObject({ foodEntries: 1, workoutSessions: 1, workoutTemplates: 1, workoutSets: 1, weightLogs: 1 })
  })

  it('rejects unsupported formats and malformed store data', () => {
    expect(() => validateBackup({ ...backup, format: 'another-app' })).toThrow('different application')
    expect(() => validateBackup({ ...backup, data: { foods: {} } })).toThrow('foods backup section')
  })
})
