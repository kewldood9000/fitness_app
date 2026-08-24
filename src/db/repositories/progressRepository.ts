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

export interface WeightTrendPoint {
  date: string
  weight: number
}

export interface WeightHistoryRow extends WeightLog {
  dailyLoss: number
  dailyNet?: number
  weekAverage?: number
  averageNet?: number
}

function average(values: number[]): number | undefined {
  if (!values.length) return undefined
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function movingAverage(items: WeightLog[], days = 7): Array<WeightLog & { average: number | undefined }> {
  return items.map((item, index) => ({ ...item, average: average(items.slice(Math.max(0, index - days + 1), index + 1).map((entry) => entry.weight)) }))
}

export function weeklyAverage(items: WeightLog[]): WeightTrendPoint[] {
  const weeks = new Map<string, number[]>()
  items.forEach((item) => {
    const date = new Date(`${item.date}T12:00:00`)
    date.setDate(date.getDate() - date.getDay())
    const week = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    weeks.set(week, [...(weeks.get(week) ?? []), item.weight])
  })
  return [...weeks.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([date, values]) => ({ date, weight: average(values) ?? 0 }))
}

function mondayFor(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function weightHistory(items: WeightLog[]): WeightHistoryRow[] {
  const ordered = [...items].sort((first, second) => first.date.localeCompare(second.date))
  const weeks = new Map<string, WeightLog[]>()
  ordered.forEach((item) => {
    const week = mondayFor(item.date)
    weeks.set(week, [...(weeks.get(week) ?? []), item])
  })

  const summaries = new Map<string, { dailyNet: number; weekAverage: number; averageNet: number }>()
  let previousAverage: number | undefined
  weeks.forEach((entries, week) => {
    const weekAverage = average(entries.map((entry) => entry.weight)) ?? 0
    summaries.set(week, {
      dailyNet: round(entries.at(-1)!.weight - entries[0].weight),
      weekAverage: round(weekAverage),
      averageNet: previousAverage == null ? 0 : round(weekAverage - previousAverage)
    })
    previousAverage = weekAverage
  })

  return ordered.map((item, index) => {
    const week = mondayFor(item.date)
    const entries = weeks.get(week) ?? []
    const summary = entries[0]?.id === item.id ? summaries.get(week) : undefined
    return {
      ...item,
      dailyLoss: index === 0 ? 0 : round(item.weight - ordered[index - 1].weight),
      ...summary
    }
  })
}

export function latestPreviousDayChange(items: WeightLog[]): number | undefined {
  const ordered = [...items].sort((first, second) => first.date.localeCompare(second.date))
  const latest = ordered.at(-1)
  if (!latest) return undefined
  const previousDate = new Date(`${latest.date}T12:00:00`)
  previousDate.setDate(previousDate.getDate() - 1)
  const previousDateKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}-${String(previousDate.getDate()).padStart(2, '0')}`
  const previous = ordered.find((item) => item.date === previousDateKey)
  return previous ? round(latest.weight - previous.weight) : undefined
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
