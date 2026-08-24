import type { WeightUnit } from '@/types/models'

export type EquationSex = 'male' | 'female'
export type WeeklyLossMode = 'fixed' | 'percent'

export interface BodyProfile {
  sex: EquationSex
  age: number
  heightCm: number
  weightKg: number
  activityFactor: number
}

export interface WeeklyLossGoal {
  mode: WeeklyLossMode
  value: number
  unit: WeightUnit
}

export interface CalorieEstimate {
  bmr: number
  tdee: number
  weeklyLossLb: number
  dailyDeficit: number
  calorieTarget: number
}

export interface ProgressGoalSettings {
  startingWeight?: number
  goalWeight?: number
  weeklyChange?: number
  weeklyLossMode?: WeeklyLossMode
  weeklyLossValue?: number
  trendStartDate?: string
  trendStartWeight?: number
  weightUnit?: WeightUnit
}

export interface WeightGoalProgress {
  startWeight: number
  goalWeight: number
  lost: number
  remaining: number
  percentComplete: number
}

export const activityLevels = [
  { value: 1.2, label: 'Sedentary', detail: 'Little structured exercise' },
  { value: 1.375, label: 'Lightly active', detail: 'Exercise 1–3 days/week' },
  { value: 1.55, label: 'Moderately active', detail: 'Exercise 3–5 days/week' },
  { value: 1.725, label: 'Very active', detail: 'Hard exercise 6–7 days/week' },
  { value: 1.9, label: 'Extra active', detail: 'Very hard training or physical job' }
] as const

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value
  return from === 'lb' ? value * 0.45359237 : value / 0.45359237
}

export function mifflinStJeor(profile: Pick<BodyProfile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const sexConstant = profile.sex === 'male' ? 5 : -161
  return 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexConstant
}

export function estimateCalories(profile: BodyProfile, goal: WeeklyLossGoal): CalorieEstimate {
  const bmr = mifflinStJeor(profile)
  const tdee = bmr * profile.activityFactor
  const currentWeightLb = convertWeight(profile.weightKg, 'kg', 'lb')
  const weeklyLossLb = goal.mode === 'percent'
    ? currentWeightLb * goal.value / 100
    : convertWeight(goal.value, goal.unit, 'lb')
  const dailyDeficit = weeklyLossLb * 3500 / 7
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    weeklyLossLb,
    dailyDeficit: Math.round(dailyDeficit),
    calorieTarget: Math.round(tdee - dailyDeficit)
  }
}

function dayDifference(from: string, to: string): number {
  return (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000
}

export function plannedWeightForDate(goal: ProgressGoalSettings, date: string): number | undefined {
  const startWeight = goal.trendStartWeight ?? goal.startingWeight
  const startDate = goal.trendStartDate
  if (startWeight == null || !startDate || date < startDate) return undefined
  const weeks = Math.max(0, dayDifference(startDate, date) / 7)
  let planned: number | undefined
  if (goal.weeklyLossMode === 'percent' && goal.weeklyLossValue != null) {
    planned = startWeight * Math.pow(1 - goal.weeklyLossValue / 100, weeks)
  } else if (goal.weeklyLossMode === 'fixed' && goal.weeklyLossValue != null) {
    planned = startWeight - goal.weeklyLossValue * weeks
  } else if (goal.weeklyChange != null) {
    planned = startWeight + goal.weeklyChange * weeks
  }
  if (planned == null) return undefined
  if (goal.goalWeight != null) planned = Math.max(goal.goalWeight, planned)
  return Math.round(planned * 10) / 10
}

export function calculateWeightGoalProgress(goal: ProgressGoalSettings, currentWeight: number, currentUnit: WeightUnit): WeightGoalProgress | undefined {
  const goalUnit = goal.weightUnit ?? currentUnit
  const storedStart = goal.trendStartWeight ?? goal.startingWeight
  if (storedStart == null || goal.goalWeight == null) return undefined
  const startWeight = convertWeight(storedStart, goalUnit, currentUnit)
  const goalWeight = convertWeight(goal.goalWeight, goalUnit, currentUnit)
  const total = startWeight - goalWeight
  if (total <= 0) return undefined
  const lost = startWeight - currentWeight
  const remaining = Math.max(0, currentWeight - goalWeight)
  return {
    startWeight,
    goalWeight,
    lost,
    remaining,
    percentComplete: Math.min(100, Math.max(0, lost / total * 100))
  }
}
