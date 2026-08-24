import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { dashboardRepository } from './dashboardRepository'
import { settingsRepository } from './settingsRepository'
import { workoutRepository } from './workoutRepository'
import { toDateKey } from '@/utils/dates'

const workoutTables = [
  db.settings,
  db.exercises,
  db.workoutTemplates,
  db.workoutTemplateExercises,
  db.workoutSchedules,
  db.workoutSessions,
  db.workoutSessionExercises,
  db.workoutSets
]

beforeEach(async () => {
  await db.open()
  await db.transaction('rw', workoutTables, async () => Promise.all(workoutTables.map((table) => table.clear())))
})

async function addExercise(name = 'Shoulder Press') {
  const timestamp = new Date().toISOString()
  const id = crypto.randomUUID()
  await db.exercises.add({
    id,
    name,
    primaryMuscle: 'Shoulders',
    secondaryMuscles: ['Triceps'],
    equipment: 'Dumbbell',
    category: 'Strength',
    isCustom: true,
    createdAt: timestamp,
    updatedAt: timestamp
  })
  return id
}

describe('workout planning', () => {
  it('copies each planned set into the workout session', async () => {
    const exerciseId = await addExercise()
    const templateId = await workoutRepository.createTemplate('Push')
    await workoutRepository.addExerciseToTemplate(templateId, exerciseId)
    const item = (await workoutRepository.getTemplateDetails(templateId))!.exercises[0]

    await workoutRepository.updateTemplateExercise(item.id, {
      plannedSets: [
        { type: 'warmup', reps: 12, weight: 20 },
        { type: 'working', reps: 10, weight: 50, rir: 2 },
        { type: 'working', reps: 8, weight: 55, rir: 1 }
      ],
      targetSets: 3
    })

    const sessionId = await workoutRepository.startWorkout(templateId)
    const session = await workoutRepository.getSessionDetails(sessionId)

    expect(session?.session.name).toBe('Push')
    expect(session?.exercises[0].sets).toMatchObject([
      { order: 0, type: 'warmup', reps: 12, weight: 20, completed: false },
      { order: 1, type: 'working', reps: 10, weight: 50, rir: 2, completed: false },
      { order: 2, type: 'working', reps: 8, weight: 55, rir: 1, completed: false }
    ])
  })

  it('uses Quick Workout on an unscheduled Today and gives the schedule priority', async () => {
    const quickTemplateId = await workoutRepository.createTemplate('Quick Push')
    const scheduledTemplateId = await workoutRepository.createTemplate('Monday Strength')
    const today = new Date()
    const date = toDateKey(today)

    await settingsRepository.set('quick-workout-template', quickTemplateId)
    expect(await dashboardRepository.getDay(date, today.getDay())).toMatchObject({
      scheduledTemplateId: quickTemplateId,
      scheduledTemplateName: 'Quick Push',
      workoutSource: 'quick'
    })

    await workoutRepository.setScheduledTemplate(today.getDay(), scheduledTemplateId)
    expect(await dashboardRepository.getDay(date, today.getDay())).toMatchObject({
      scheduledTemplateId,
      scheduledTemplateName: 'Monday Strength',
      workoutSource: 'scheduled'
    })
  })
})
