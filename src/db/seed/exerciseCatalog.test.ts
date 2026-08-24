import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { builtinExerciseCatalog, createBuiltinExercises } from './exerciseCatalog'

describe('built-in exercise catalog', () => {
  it('contains a broad, uniquely identified starter library', () => {
    const exercises = createBuiltinExercises('2026-08-23T12:00:00.000Z')
    expect(exercises).toHaveLength(105)
    expect(new Set(exercises.map((exercise) => exercise.id)).size).toBe(exercises.length)
    expect(new Set(exercises.map((exercise) => exercise.name)).size).toBe(exercises.length)
    expect([...new Set(builtinExerciseCatalog.map((exercise) => exercise.primaryMuscle))]).toEqual(expect.arrayContaining(['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Abs']))
  })

  it('is installed by the database upgrade', async () => {
    await db.open()
    const builtIns = (await db.exercises.toArray()).filter((exercise) => !exercise.isCustom)
    expect(builtIns).toHaveLength(105)
    expect(builtIns.find((exercise) => exercise.name === 'Barbell Bench Press')).toMatchObject({ primaryMuscle: 'Chest', equipment: 'Barbell' })
  })
})
