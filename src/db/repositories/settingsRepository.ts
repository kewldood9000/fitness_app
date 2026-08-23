import { db } from '@/db/database'
import type { AppSetting } from '@/types/models'

export const settingsRepository = {
  get: (key: string) => db.settings.where('key').equals(key).first(),
  async set(key: string, value: unknown): Promise<void> {
    const current = await this.get(key)
    const now = new Date().toISOString()
    const record: AppSetting = current
      ? { ...current, value, updatedAt: now }
      : { id: crypto.randomUUID(), key, value, createdAt: now, updatedAt: now }
    await db.settings.put(record)
  }
}
