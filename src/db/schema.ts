/**
 * Centralized IndexedDB table map. Schema v1 intentionally creates the core
 * stores up front; future versions must add migration steps, never reset data.
 */
export const schemaV1 = {
  settings: '&id, &key, updatedAt',
  metadata: '&key, updatedAt',
  foods: '&id, source, sourceFoodId, barcode, normalizedName, updatedAt',
  nutrients: '&id, &code, updatedAt',
  foodNutrients: '&id, foodId, nutrientCode, [foodId+nutrientCode]',
  servings: '&id, foodId, updatedAt',
  barcodeMappings: '&id, &barcode, foodId, updatedAt',
  favorites: '&id, &foodId, position, updatedAt',
  recentFoods: '&id, &foodId, position, updatedAt',
  foodLogs: '&id, date, meal, foodId, [date+meal], updatedAt',
  exercises: '&id, name, primaryMuscle, equipment, isCustom, updatedAt',
  workoutTemplates: '&id, name, updatedAt',
  workoutTemplateExercises: '&id, templateId, exerciseId, [templateId+order]',
  workoutSchedules: '&id, weekday, templateId, updatedAt',
  workoutSessions: '&id, date, templateId, status, completedAt, updatedAt',
  workoutSessionExercises: '&id, sessionId, exerciseId, [sessionId+order]',
  workoutSets: '&id, sessionExerciseId, [sessionExerciseId+order], completedAt',
  weightLogs: '&id, &date, updatedAt'
} as const

export const schemaV2 = {
  ...schemaV1,
  credentials: '&key, updatedAt'
} as const

export type TableName = keyof typeof schemaV2
