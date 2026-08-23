import Dexie, { type EntityTable } from 'dexie'
import { migrateToV1, migrateToV2 } from './migrations'
import { schemaV1, schemaV2 } from './schema'
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
    this.version(1).stores(schemaV1).upgrade(migrateToV1)
    this.version(2).stores(schemaV2).upgrade(migrateToV2)
  }
}

export const db = new FitnessDatabase()
