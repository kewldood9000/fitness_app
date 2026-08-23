import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { createBackup, replaceWithBackup } from './backupService'

async function clearFitnessData() {
  const tables = ['settings', 'metadata', 'foods', 'nutrients', 'foodNutrients', 'servings', 'barcodeMappings', 'favorites', 'recentFoods', 'foodLogs', 'exercises', 'workoutTemplates', 'workoutTemplateExercises', 'workoutSchedules', 'workoutSessions', 'workoutSessionExercises', 'workoutSets', 'weightLogs']
  await db.transaction('rw', tables.map((table) => db.table(table)), async () => Promise.all(tables.map((table) => db.table(table).clear())))
}

beforeEach(async () => {
  await db.open()
  await clearFitnessData()
})

describe('backup round trip', () => {
  it('restores records and relationships after the local fitness stores are replaced', async () => {
    const createdAt = '2026-08-22T12:00:00.000Z'
    await db.foods.add({ id: 'food-1', source: 'CUSTOM', name: 'Test oats', normalizedName: 'test oats', defaultServingId: 'serving-1', createdAt, updatedAt: createdAt })
    await db.servings.add({ id: 'serving-1', foodId: 'food-1', name: 'bowl', grams: 80, quantity: 1, createdAt, updatedAt: createdAt })
    await db.foodLogs.add({ id: 'log-1', date: '2026-08-22', meal: 'breakfast', foodId: 'food-1', foodSnapshot: { name: 'Test oats' }, servingQuantity: 1, servingUnit: 'bowl', grams: 80, calories: 300, protein: 10, carbs: 54, fat: 6, createdAt, updatedAt: createdAt })
    await db.exercises.add({ id: 'exercise-1', name: 'Test press', primaryMuscle: 'Chest', secondaryMuscles: [], equipment: 'Dumbbell', category: 'Strength', isCustom: true, createdAt, updatedAt: createdAt })
    await db.workoutSessions.add({ id: 'session-1', date: '2026-08-22', name: 'Test session', startedAt: createdAt, completedAt: createdAt, status: 'completed', createdAt, updatedAt: createdAt })
    await db.workoutSessionExercises.add({ id: 'session-exercise-1', sessionId: 'session-1', exerciseId: 'exercise-1', exerciseSnapshot: { name: 'Test press' }, order: 0, createdAt, updatedAt: createdAt })
    await db.workoutSets.add({ id: 'set-1', sessionExerciseId: 'session-exercise-1', order: 0, weight: 50, reps: 10, type: 'working', completed: true, createdAt, updatedAt: createdAt })
    await db.weightLogs.add({ id: 'weight-1', date: '2026-08-22', weight: 180, unit: 'lb', createdAt, updatedAt: createdAt })

    const backup = await createBackup()
    await clearFitnessData()
    await replaceWithBackup(backup)

    expect(await db.foodLogs.get('log-1')).toMatchObject({ foodId: 'food-1', calories: 300 })
    expect(await db.workoutSets.get('set-1')).toMatchObject({ sessionExerciseId: 'session-exercise-1', weight: 50, reps: 10 })
    expect(await db.weightLogs.get('weight-1')).toMatchObject({ weight: 180, unit: 'lb' })
  })
})
