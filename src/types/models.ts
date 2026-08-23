export type FoodSource = 'USDA' | 'CUSTOM'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks'
export type WeightUnit = 'lb' | 'kg'

export interface Timestamped {
  id: string
  createdAt: string
  updatedAt: string
}

export interface AppSetting extends Timestamped {
  key: string
  value: unknown
}

export interface AppMetadata {
  key: string
  value: unknown
  updatedAt: string
}

/** Stored locally, but deliberately isolated from normal fitness backups. */
export interface LocalCredential {
  key: string
  value: string
  updatedAt: string
}

export interface Food extends Timestamped {
  source: FoodSource
  sourceFoodId?: string
  name: string
  normalizedName?: string
  brand?: string
  brandOwner?: string
  brandName?: string
  barcode?: string
  ingredients?: string
  notes?: string
  publicationDate?: string
  lastFetchedAt?: string
  defaultServingId?: string
}

export interface Nutrient extends Timestamped {
  code: string
  name: string
  unit: string
}

export interface FoodNutrient extends Timestamped {
  foodId: string
  nutrientCode: string
  amountPer100g: number
}

export interface Serving extends Timestamped {
  foodId: string
  name: string
  grams?: number
  quantity: number
}

export interface BarcodeMapping extends Timestamped {
  barcode: string
  foodId: string
}

export interface FoodReference extends Timestamped {
  foodId: string
  position?: number
}

export interface FoodLogEntry extends Timestamped {
  date: string
  meal: Meal
  foodId: string
  foodSnapshot: Record<string, unknown>
  servingQuantity: number
  servingUnit: string
  grams?: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface Exercise extends Timestamped {
  name: string
  primaryMuscle: string
  secondaryMuscles: string[]
  equipment: string
  category: string
  notes?: string
  isCustom: boolean
}

export interface WorkoutTemplate extends Timestamped {
  name: string
  notes?: string
}

export interface WorkoutTemplateExercise extends Timestamped {
  templateId: string
  exerciseId: string
  order: number
  targetSets: number
  minReps?: number
  maxReps?: number
  targetRir?: number
  restSeconds?: number
  notes?: string
}

export interface WorkoutSchedule extends Timestamped {
  weekday: number
  templateId?: string
}

export interface WorkoutSession extends Timestamped {
  date: string
  templateId?: string
  templateSnapshot?: Record<string, unknown>
  name: string
  startedAt: string
  completedAt?: string
  notes?: string
  status: 'active' | 'completed' | 'cancelled'
  restTimerEndsAt?: string
  restTimerRemainingSeconds?: number
  restTimerPaused?: boolean
}

export interface WorkoutSessionExercise extends Timestamped {
  sessionId: string
  exerciseId: string
  exerciseSnapshot: Record<string, unknown>
  order: number
  restSeconds?: number
  notes?: string
}

export interface WorkoutSet extends Timestamped {
  sessionExerciseId: string
  order: number
  weight?: number
  reps?: number
  rir?: number
  type: 'warmup' | 'working' | 'drop' | 'failure'
  completed: boolean
  completedAt?: string
}

export interface WeightLog extends Timestamped {
  date: string
  weight: number
  unit: WeightUnit
  note?: string
}
