import type { Transaction } from 'dexie'

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
