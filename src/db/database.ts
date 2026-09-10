import Dexie, { type EntityTable } from 'dexie'
import { migrateToV1, migrateToV2, migrateToV3, migrateToV4 } from './migrations'
import { schemaV1, schemaV2, schemaV3, schemaV4 } from './schema'
import { createBuiltinExercises } from './seed/exerciseCatalog'
import type {
  AppMetadata,
  AppSetting,
  BarcodeMapping,
  Exercise,
  Food,
  FoodLogEntry,
  FoodNutrient,
  FoodReference,
  LocalCredential,
  Nutrient,
  Serving,
  SavedMeal,
  SavedMealItem,
  WeightLog,
  WorkoutSchedule,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  WorkoutTemplate,
  WorkoutTemplateExercise
} from '@/types/models'

class FitnessDatabase extends Dexie {
  settings!: EntityTable<AppSetting, 'id'>
  metadata!: EntityTable<AppMetadata, 'key'>
  credentials!: EntityTable<LocalCredential, 'key'>
  foods!: EntityTable<Food, 'id'>
  nutrients!: EntityTable<Nutrient, 'id'>
  foodNutrients!: EntityTable<FoodNutrient, 'id'>
  servings!: EntityTable<Serving, 'id'>
  barcodeMappings!: EntityTable<BarcodeMapping, 'id'>
  favorites!: EntityTable<FoodReference, 'id'>
  recentFoods!: EntityTable<FoodReference, 'id'>
  foodLogs!: EntityTable<FoodLogEntry, 'id'>
  savedMeals!: EntityTable<SavedMeal, 'id'>
  savedMealItems!: EntityTable<SavedMealItem, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>
  workoutTemplateExercises!: EntityTable<WorkoutTemplateExercise, 'id'>
  workoutSchedules!: EntityTable<WorkoutSchedule, 'id'>
  workoutSessions!: EntityTable<WorkoutSession, 'id'>
  workoutSessionExercises!: EntityTable<WorkoutSessionExercise, 'id'>
  workoutSets!: EntityTable<WorkoutSet, 'id'>
  weightLogs!: EntityTable<WeightLog, 'id'>

  constructor() {
    super('pocket-pace')
    this.on('populate', (transaction) => transaction.table('exercises').bulkAdd(createBuiltinExercises(new Date().toISOString())))
    this.version(1).stores(schemaV1).upgrade(migrateToV1)
    this.version(2).stores(schemaV2).upgrade(migrateToV2)
    this.version(3).stores(schemaV3).upgrade(migrateToV3)
    this.version(4).stores(schemaV4).upgrade(migrateToV4)
  }
}

export const db = new FitnessDatabase()
