import { db } from '@/db/database'
import { settingsRepository } from './settingsRepository'
import type {
  Exercise,
  WorkoutSchedule,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  WorkoutTemplate,
  WorkoutTemplateExercise,
  PlannedWorkoutSet
} from '@/types/models'
import { toDateKey } from '@/utils/dates'

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()
const defaultRestSeconds = 120

async function preferredRestSeconds(): Promise<number> {
  const setting = await settingsRepository.get('workout-preferences')
  const value = setting?.value as { defaultRest?: unknown } | undefined
  const seconds = Number(value?.defaultRest)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : defaultRestSeconds
}

export interface TemplateDetails {
  template: WorkoutTemplate
  exercises: WorkoutTemplateExercise[]
}

export interface SessionExerciseDetails {
  sessionExercise: WorkoutSessionExercise
  sets: WorkoutSet[]
}

export interface SessionDetails {
  session: WorkoutSession
  exercises: SessionExerciseDetails[]
}

export interface PreviousPerformance {
  date: string
  workoutName: string
  sets: WorkoutSet[]
}

export interface WorkoutHistoryItem {
  session: WorkoutSession
  workingSetCount: number
  durationMinutes: number
}

function sessionExerciseSnapshot(exercise: Exercise): Record<string, unknown> {
  return {
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    equipment: exercise.equipment,
    category: exercise.category
  }
}

function swapOrders<T extends { id: string; order: number }>(items: T[], id: string, direction: -1 | 1): [T, T] | undefined {
  const currentIndex = items.findIndex((item) => item.id === id)
  const neighbor = items[currentIndex + direction]
  const current = items[currentIndex]
  return current && neighbor ? [current, neighbor] : undefined
}

export const workoutRepository = {
  getExercises: () => db.exercises.orderBy('name').toArray(),
  getExercise: (id: string) => db.exercises.get(id),

  async createExercise(input: Pick<Exercise, 'name' | 'primaryMuscle' | 'secondaryMuscles' | 'equipment' | 'category' | 'notes'>): Promise<string> {
    const timestamp = now()
    const exercise: Exercise = {
      id: newId(),
      ...input,
      name: input.name.trim(),
      isCustom: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    await db.exercises.add(exercise)
    return exercise.id
  },

  async updateExercise(id: string, input: Partial<Pick<Exercise, 'name' | 'primaryMuscle' | 'secondaryMuscles' | 'equipment' | 'category' | 'notes'>>): Promise<void> {
    await db.exercises.update(id, { ...input, name: input.name?.trim(), updatedAt: now() })
  },

  async deleteExercise(id: string): Promise<void> {
    const [templateUse, sessionUse] = await Promise.all([
      db.workoutTemplateExercises.where('exerciseId').equals(id).count(),
      db.workoutSessionExercises.where('exerciseId').equals(id).count()
    ])
    if (templateUse || sessionUse) {
      throw new Error('This exercise is used by a template or workout history and cannot be deleted.')
    }
    await db.exercises.delete(id)
  },

  getTemplates: () => db.workoutTemplates.orderBy('updatedAt').reverse().toArray(),

  async getTemplateDetails(templateId: string): Promise<TemplateDetails | undefined> {
    const template = await db.workoutTemplates.get(templateId)
    if (!template) return undefined
    const exercises = await db.workoutTemplateExercises.where('templateId').equals(templateId).sortBy('order')
    return { template, exercises }
  },

  async createTemplate(name: string): Promise<string> {
    const timestamp = now()
    const template: WorkoutTemplate = {
      id: newId(),
      name: name.trim(),
      createdAt: timestamp,
      updatedAt: timestamp
    }
    await db.workoutTemplates.add(template)
    return template.id
  },

  async updateTemplate(templateId: string, input: Pick<WorkoutTemplate, 'name' | 'notes'>): Promise<void> {
    await db.workoutTemplates.update(templateId, { name: input.name.trim(), notes: input.notes, updatedAt: now() })
  },

  async deleteTemplate(templateId: string): Promise<void> {
    await db.transaction('rw', db.workoutTemplates, db.workoutTemplateExercises, db.workoutSchedules, async () => {
      await db.workoutTemplateExercises.where('templateId').equals(templateId).delete()
      await db.workoutSchedules.where('templateId').equals(templateId).delete()
      await db.workoutTemplates.delete(templateId)
    })
    const quickTemplate = await settingsRepository.get('quick-workout-template')
    if (quickTemplate?.value === templateId) await settingsRepository.set('quick-workout-template', undefined)
  },

  async addExerciseToTemplate(templateId: string, exerciseId: string): Promise<void> {
    const exercises = await db.workoutTemplateExercises.where('templateId').equals(templateId).sortBy('order')
    const timestamp = now()
    await db.workoutTemplateExercises.add({
      id: newId(),
      templateId,
      exerciseId,
      order: exercises.length,
      targetSets: 3,
      minReps: 8,
      maxReps: 12,
      targetRir: 2,
      restSeconds: defaultRestSeconds,
      plannedSets: Array.from({ length: 3 }, () => ({ type: 'working' as const })),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    await db.workoutTemplates.update(templateId, { updatedAt: timestamp })
  },

  async updateTemplateExercise(id: string, input: Partial<Pick<WorkoutTemplateExercise, 'targetSets' | 'minReps' | 'maxReps' | 'targetRir' | 'restSeconds' | 'notes' | 'plannedSets'>>): Promise<void> {
    const item = await db.workoutTemplateExercises.get(id)
    if (!item) return
    await db.workoutTemplateExercises.update(id, { ...input, updatedAt: now() })
    await db.workoutTemplates.update(item.templateId, { updatedAt: now() })
  },

  async removeTemplateExercise(id: string): Promise<void> {
    const item = await db.workoutTemplateExercises.get(id)
    if (!item) return
    await db.transaction('rw', db.workoutTemplateExercises, db.workoutTemplates, async () => {
      await db.workoutTemplateExercises.delete(id)
      const remaining = await db.workoutTemplateExercises.where('templateId').equals(item.templateId).sortBy('order')
      await Promise.all(remaining.map((exercise, order) => db.workoutTemplateExercises.update(exercise.id, { order, updatedAt: now() })))
      await db.workoutTemplates.update(item.templateId, { updatedAt: now() })
    })
  },

  async moveTemplateExercise(id: string, direction: -1 | 1): Promise<void> {
    const item = await db.workoutTemplateExercises.get(id)
    if (!item) return
    await db.transaction('rw', db.workoutTemplateExercises, async () => {
      const items = await db.workoutTemplateExercises.where('templateId').equals(item.templateId).sortBy('order')
      const pair = swapOrders(items, id, direction)
      if (!pair) return
      const [current, neighbor] = pair
      await db.workoutTemplateExercises.update(current.id, { order: neighbor.order, updatedAt: now() })
      await db.workoutTemplateExercises.update(neighbor.id, { order: current.order, updatedAt: now() })
    })
  },

  getSchedule: () => db.workoutSchedules.orderBy('weekday').toArray(),

  async setScheduledTemplate(weekday: number, templateId?: string): Promise<void> {
    const existing = await db.workoutSchedules.where('weekday').equals(weekday).first()
    const timestamp = now()
    if (!templateId) {
      if (existing) await db.workoutSchedules.delete(existing.id)
      return
    }
    const record: WorkoutSchedule = existing
      ? { ...existing, templateId, updatedAt: timestamp }
      : { id: newId(), weekday, templateId, createdAt: timestamp, updatedAt: timestamp }
    await db.workoutSchedules.put(record)
  },

  getActiveSession: () => db.workoutSessions.where('status').equals('active').first(),

  async startWorkout(templateId?: string, manualName = 'Quick workout'): Promise<string> {
    const existingActive = await this.getActiveSession()
    if (existingActive) return existingActive.id

    const timestamp = now()
    const defaultRest = await preferredRestSeconds()
    let template: WorkoutTemplate | undefined
    let templateExercises: WorkoutTemplateExercise[] = []
    if (templateId) {
      const templateDetails = await this.getTemplateDetails(templateId)
      if (!templateDetails) throw new Error('That workout template no longer exists.')
      template = templateDetails.template
      templateExercises = templateDetails.exercises
    }

    const session: WorkoutSession = {
      id: newId(),
      date: toDateKey(new Date()),
      templateId: template?.id,
      templateSnapshot: template ? { name: template.name, notes: template.notes, exercises: templateExercises } : undefined,
      name: template?.name ?? (manualName.trim() || 'Quick workout'),
      startedAt: timestamp,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    }

    await db.transaction('rw', db.workoutSessions, db.workoutSessionExercises, db.workoutSets, db.exercises, async () => {
      await db.workoutSessions.add(session)
      for (const item of templateExercises) {
        const exercise = await db.exercises.get(item.exerciseId)
        if (!exercise) continue
        const sessionExercise: WorkoutSessionExercise = {
          id: newId(),
          sessionId: session.id,
          exerciseId: exercise.id,
          exerciseSnapshot: sessionExerciseSnapshot(exercise),
          order: item.order,
          restSeconds: item.restSeconds ?? defaultRest,
          notes: item.notes,
          createdAt: timestamp,
          updatedAt: timestamp
        }
        await db.workoutSessionExercises.add(sessionExercise)
        const plan: PlannedWorkoutSet[] = item.plannedSets?.length
          ? item.plannedSets
          : Array.from({ length: item.targetSets }, () => ({ type: 'working' as const }))
        const sets: WorkoutSet[] = plan.map((planned, order) => ({
          id: newId(), sessionExerciseId: sessionExercise.id, order, type: planned.type, weight: planned.weight,
          reps: planned.reps, rir: planned.rir, completed: false, createdAt: timestamp, updatedAt: timestamp
        }))
        await db.workoutSets.bulkAdd(sets)
      }
    })
    return session.id
  },

  async getSessionDetails(sessionId: string): Promise<SessionDetails | undefined> {
    const session = await db.workoutSessions.get(sessionId)
    if (!session) return undefined
    const exercises = await db.workoutSessionExercises.where('sessionId').equals(sessionId).sortBy('order')
    const details = await Promise.all(exercises.map(async (sessionExercise) => ({
      sessionExercise,
      sets: await db.workoutSets.where('sessionExerciseId').equals(sessionExercise.id).sortBy('order')
    })))
    return { session, exercises: details }
  },

  async updateWorkoutSession(id: string, input: Partial<Pick<WorkoutSession, 'notes' | 'name'>>): Promise<void> {
    const changes: Partial<WorkoutSession> = { ...input, updatedAt: now() }
    if (input.name !== undefined) changes.name = input.name.trim()
    await db.workoutSessions.update(id, changes)
  },

  async addExerciseToSession(sessionId: string, exerciseId: string): Promise<void> {
    const exercise = await db.exercises.get(exerciseId)
    if (!exercise) throw new Error('That exercise is unavailable.')
    const [existing, defaultRest] = await Promise.all([db.workoutSessionExercises.where('sessionId').equals(sessionId).sortBy('order'), preferredRestSeconds()])
    const timestamp = now()
    const sessionExercise: WorkoutSessionExercise = {
      id: newId(),
      sessionId,
      exerciseId,
      exerciseSnapshot: sessionExerciseSnapshot(exercise),
      order: existing.length,
      restSeconds: defaultRest,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    await db.transaction('rw', db.workoutSessionExercises, db.workoutSets, async () => {
      await db.workoutSessionExercises.add(sessionExercise)
      await db.workoutSets.bulkAdd(Array.from({ length: 3 }, (_, order) => ({
        id: newId(),
        sessionExerciseId: sessionExercise.id,
        order,
        type: 'working' as const,
        completed: false,
        createdAt: timestamp,
        updatedAt: timestamp
      })))
    })
  },

  async removeSessionExercise(id: string): Promise<void> {
    const item = await db.workoutSessionExercises.get(id)
    if (!item) return
    await db.transaction('rw', db.workoutSessionExercises, db.workoutSets, async () => {
      await db.workoutSets.where('sessionExerciseId').equals(id).delete()
      await db.workoutSessionExercises.delete(id)
      const remaining = await db.workoutSessionExercises.where('sessionId').equals(item.sessionId).sortBy('order')
      await Promise.all(remaining.map((exercise, order) => db.workoutSessionExercises.update(exercise.id, { order, updatedAt: now() })))
    })
  },

  async moveSessionExercise(id: string, direction: -1 | 1): Promise<void> {
    const item = await db.workoutSessionExercises.get(id)
    if (!item) return
    await db.transaction('rw', db.workoutSessionExercises, async () => {
      const items = await db.workoutSessionExercises.where('sessionId').equals(item.sessionId).sortBy('order')
      const pair = swapOrders(items, id, direction)
      if (!pair) return
      const [current, neighbor] = pair
      await db.workoutSessionExercises.update(current.id, { order: neighbor.order, updatedAt: now() })
      await db.workoutSessionExercises.update(neighbor.id, { order: current.order, updatedAt: now() })
    })
  },

  async updateSessionExercise(id: string, input: Partial<Pick<WorkoutSessionExercise, 'restSeconds' | 'notes'>>): Promise<void> {
    await db.workoutSessionExercises.update(id, { ...input, updatedAt: now() })
  },

  async addSet(sessionExerciseId: string, type: WorkoutSet['type'] = 'working'): Promise<void> {
    const existing = await db.workoutSets.where('sessionExerciseId').equals(sessionExerciseId).sortBy('order')
    const timestamp = now()
    await db.workoutSets.add({
      id: newId(),
      sessionExerciseId,
      order: existing.length,
      type,
      completed: false,
      createdAt: timestamp,
      updatedAt: timestamp
    })
  },

  async updateSet(id: string, input: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rir' | 'type'>>): Promise<void> {
    await db.workoutSets.update(id, { ...input, updatedAt: now() })
  },

  async deleteSet(id: string): Promise<void> {
    const item = await db.workoutSets.get(id)
    if (!item) return
    await db.transaction('rw', db.workoutSets, async () => {
      await db.workoutSets.delete(id)
      const remaining = await db.workoutSets.where('sessionExerciseId').equals(item.sessionExerciseId).sortBy('order')
      await Promise.all(remaining.map((set, order) => db.workoutSets.update(set.id, { order, updatedAt: now() })))
    })
  },

  async completeSet(id: string): Promise<void> {
    const set = await db.workoutSets.get(id)
    if (!set) return
    const timestamp = now()
    await db.workoutSets.update(id, { completed: true, completedAt: timestamp, updatedAt: timestamp })
    const sessionExercise = await db.workoutSessionExercises.get(set.sessionExerciseId)
    if (sessionExercise) await this.startRestTimer(sessionExercise.sessionId, sessionExercise.restSeconds ?? defaultRestSeconds)
  },

  async toggleSetCompleted(id: string, completed: boolean): Promise<void> {
    const timestamp = now()
    await db.workoutSets.update(id, { completed, completedAt: completed ? timestamp : undefined, updatedAt: timestamp })
  },

  async startRestTimer(sessionId: string, seconds: number): Promise<void> {
    const timestamp = now()
    await db.workoutSessions.update(sessionId, {
      restTimerEndsAt: new Date(Date.now() + seconds * 1000).toISOString(),
      restTimerRemainingSeconds: seconds,
      restTimerPaused: false,
      updatedAt: timestamp
    })
  },

  async pauseRestTimer(sessionId: string): Promise<void> {
    const session = await db.workoutSessions.get(sessionId)
    if (!session?.restTimerEndsAt) return
    const remaining = Math.max(0, Math.ceil((new Date(session.restTimerEndsAt).getTime() - Date.now()) / 1000))
    await db.workoutSessions.update(sessionId, { restTimerEndsAt: undefined, restTimerRemainingSeconds: remaining, restTimerPaused: true, updatedAt: now() })
  },

  async resumeRestTimer(sessionId: string): Promise<void> {
    const session = await db.workoutSessions.get(sessionId)
    const remaining = session?.restTimerRemainingSeconds ?? defaultRestSeconds
    await this.startRestTimer(sessionId, remaining)
  },

  async resetRestTimer(sessionId: string, seconds?: number): Promise<void> {
    const session = await db.workoutSessions.get(sessionId)
    await this.startRestTimer(sessionId, seconds ?? session?.restTimerRemainingSeconds ?? defaultRestSeconds)
  },

  async addRestTime(sessionId: string, seconds = 30): Promise<void> {
    const session = await db.workoutSessions.get(sessionId)
    if (!session) return
    const current = session.restTimerEndsAt
      ? Math.max(0, Math.ceil((new Date(session.restTimerEndsAt).getTime() - Date.now()) / 1000))
      : session.restTimerRemainingSeconds ?? 0
    await this.startRestTimer(sessionId, current + seconds)
  },

  async dismissRestTimer(sessionId: string): Promise<void> {
    await db.workoutSessions.update(sessionId, { restTimerEndsAt: undefined, restTimerRemainingSeconds: undefined, restTimerPaused: false, updatedAt: now() })
  },

  async finishWorkout(sessionId: string): Promise<void> {
    const timestamp = now()
    await db.workoutSessions.update(sessionId, {
      status: 'completed',
      completedAt: timestamp,
      restTimerEndsAt: undefined,
      restTimerRemainingSeconds: undefined,
      restTimerPaused: false,
      updatedAt: timestamp
    })
  },

  async cancelWorkout(sessionId: string): Promise<void> {
    await db.workoutSessions.update(sessionId, {
      status: 'cancelled',
      restTimerEndsAt: undefined,
      restTimerRemainingSeconds: undefined,
      restTimerPaused: false,
      updatedAt: now()
    })
  },

  async getPreviousPerformance(exerciseId: string, currentSessionId: string): Promise<PreviousPerformance | undefined> {
    const candidates = await db.workoutSessionExercises.where('exerciseId').equals(exerciseId).toArray()
    const sessions = await Promise.all(candidates.map(async (sessionExercise) => ({
      sessionExercise,
      session: await db.workoutSessions.get(sessionExercise.sessionId)
    })))
    const previous = sessions
      .filter((entry): entry is { sessionExercise: WorkoutSessionExercise; session: WorkoutSession } => Boolean(entry.session && entry.session.status === 'completed' && entry.session.id !== currentSessionId))
      .sort((first, second) => (second.session.completedAt ?? '').localeCompare(first.session.completedAt ?? ''))[0]
    if (!previous) return undefined
    const sets = await db.workoutSets.where('sessionExerciseId').equals(previous.sessionExercise.id).sortBy('order')
    return { date: previous.session.date, workoutName: previous.session.name, sets: sets.filter((set) => set.completed) }
  },

  async getWorkoutHistory(limit = 100): Promise<WorkoutHistoryItem[]> {
    const sessions = await db.workoutSessions.where('status').equals('completed').reverse().sortBy('completedAt')
    const latest = sessions.slice(0, limit).reverse()
    return Promise.all(latest.map(async (session) => {
      const sessionExercises = await db.workoutSessionExercises.where('sessionId').equals(session.id).toArray()
      const sets = await Promise.all(sessionExercises.map((exercise) => db.workoutSets.where('sessionExerciseId').equals(exercise.id).toArray()))
      const workingSetCount = sets.flat().filter((set) => set.completed && set.type === 'working').length
      const durationMinutes = Math.max(1, Math.round((new Date(session.completedAt ?? session.updatedAt).getTime() - new Date(session.startedAt).getTime()) / 60000))
      return { session, workingSetCount, durationMinutes }
    }))
  }
}
