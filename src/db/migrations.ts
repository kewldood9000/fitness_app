import type { Transaction } from 'dexie'
import { createBuiltinExercises } from './seed/exerciseCatalog'

/**
 * Add data migrations here as the schema evolves. Each migration runs inside
 * Dexie's upgrade transaction, preserving existing local data.
 */
export async function migrateToV1(transaction: Transaction): Promise<void> {
  void transaction
  // Schema-only initial release. No records exist before v1.
}

/** Adds local-only credential isolation without changing any user records. */
export async function migrateToV2(transaction: Transaction): Promise<void> {
  void transaction
}

/** Installs the starter exercise library while preserving custom exercises. */
export async function migrateToV3(transaction: Transaction): Promise<void> {
  await transaction.table('exercises').bulkPut(createBuiltinExercises(new Date().toISOString()))
}
