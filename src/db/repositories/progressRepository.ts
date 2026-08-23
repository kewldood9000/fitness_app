import { db } from '@/db/database'
import type { WeightLog, WorkoutSession, WorkoutSessionExercise, WorkoutSet } from '@/types/models'

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

export interface StrengthPoint {
  date: string
  sessionId: string
  topWeight: number
  topReps: number
  volume: number
  estimated1RM?: number
  isWeightPr: boolean
  isRepPr: boolean
  isVolumePr: boolean
  isEstimated1RMPr: boolean
}

function average(values: number[]): number | undefined {
  if (!values.length) return undefined
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function movingAverage(items: WeightLog[], days = 7): Array<WeightLog & { average: number | undefined }> {
  return items.map((item, index) => ({ ...item, average: average(items.slice(Math.max(0, index - days + 1), index + 1).map((entry) => entry.weight)) }))
}

export function markPersonalRecords(points: StrengthPoint[]): StrengthPoint[] {
  let maxWeight = 0; let maxVolume = 0; let maxOneRm = 0
  const bestRepsByWeight = new Map<number, number>()
  return points.map((point) => {
    const bestReps = bestRepsByWeight.get(point.topWeight) ?? 0
    const marked = { ...point, isWeightPr: point.topWeight > maxWeight && maxWeight > 0, isRepPr: point.topReps > bestReps && bestReps > 0, isVolumePr: point.volume > maxVolume && maxVolume > 0, isEstimated1RMPr: Boolean(point.estimated1RM && point.estimated1RM > maxOneRm && maxOneRm > 0) }
    maxWeight = Math.max(maxWeight, point.topWeight); maxVolume = Math.max(maxVolume, point.volume); maxOneRm = Math.max(maxOneRm, point.estimated1RM ?? 0)
    bestRepsByWeight.set(point.topWeight, Math.max(bestReps, point.topReps))
    return marked
  })
}

export const progressRepository = {
  getWeightLogs: () => db.weightLogs.orderBy('date').toArray(),

  async logWeight(date: string, weight: number, unit: WeightLog['unit'], note?: string): Promise<void> {
    const timestamp = now()
    const existing = await db.weightLogs.where('date').equals(date).first()
    const record: WeightLog = existing
      ? { ...existing, weight, unit, note: note?.trim() || undefined, updatedAt: timestamp }
      : { id: newId(), date, weight, unit, note: note?.trim() || undefined, createdAt: timestamp, updatedAt: timestamp }
    await db.weightLogs.put(record)
  },

  deleteWeightLog: (id: string) => db.weightLogs.delete(id),

  async getStrengthProgress(exerciseId: string): Promise<StrengthPoint[]> {
    const matchingExercises = await db.workoutSessionExercises.where('exerciseId').equals(exerciseId).toArray()
    const records = await Promise.all(matchingExercises.map(async (sessionExercise) => {
      const session = await db.workoutSessions.get(sessionExercise.sessionId)
      if (!session || session.status !== 'completed') return undefined
      const sets = await db.workoutSets.where('sessionExerciseId').equals(sessionExercise.id).toArray()
      return { session, sessionExercise, sets }
    }))
    const points = records.filter((record): record is { session: WorkoutSession; sessionExercise: WorkoutSessionExercise; sets: WorkoutSet[] } => Boolean(record)).map(({ session, sets }) => {
      const workingSets = sets.filter((set) => set.completed && set.type === 'working' && set.weight != null && set.reps != null)
      const top = [...workingSets].sort((first, second) => (second.weight ?? 0) - (first.weight ?? 0) || (second.reps ?? 0) - (first.reps ?? 0))[0]
      const topWeight = top?.weight ?? 0
      const topReps = top?.reps ?? 0
      const volume = workingSets.reduce((total, set) => total + (set.weight ?? 0) * (set.reps ?? 0), 0)
      const estimated1RM = topWeight > 0 && topReps > 1 && topReps <= 12 ? Math.round(topWeight * (1 + topReps / 30) * 10) / 10 : undefined
      return { date: session.date, sessionId: session.id, topWeight, topReps, volume, estimated1RM, isWeightPr: false, isRepPr: false, isVolumePr: false, isEstimated1RMPr: false }
    }).sort((first, second) => first.date.localeCompare(second.date))
    return markPersonalRecords(points)
  }
}
