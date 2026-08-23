import { db } from '@/db/database'
import type { LocalCredential } from '@/types/models'

export const credentialRepository = {
  get: (key: string) => db.credentials.get(key),
  async set(key: string, value: string): Promise<void> {
    const record: LocalCredential = { key, value: value.trim(), updatedAt: new Date().toISOString() }
    await db.credentials.put(record)
  },
  remove: (key: string) => db.credentials.delete(key)
}
