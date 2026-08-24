import { describe, expect, it } from 'vitest'
import { calculateWeightGoalProgress, estimateCalories, mifflinStJeor, plannedGoalDate, plannedWeightForDate } from './calorieEstimator'

describe('Mifflin–St Jeor calorie estimate', () => {
  it('calculates the published male and female equations', () => {
    expect(mifflinStJeor({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780)
    expect(mifflinStJeor({ sex: 'female', age: 30, heightCm: 180, weightKg: 80 })).toBe(1614)
  })

  it('applies activity and a fixed weekly calorie deficit', () => {
    expect(estimateCalories({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activityFactor: 1.55 }, { mode: 'fixed', value: 1, unit: 'lb' })).toMatchObject({ bmr: 1780, tdee: 2759, dailyDeficit: 500, calorieTarget: 2259 })
  })
})

describe('planned bodyweight trend', () => {
  it('supports fixed loss and stops at the goal weight', () => {
    const goal = { trendStartDate: '2026-08-01', trendStartWeight: 200, goalWeight: 197, weeklyLossMode: 'fixed' as const, weeklyLossValue: 2 }
    expect(plannedWeightForDate(goal, '2026-08-08')).toBe(198)
    expect(plannedWeightForDate(goal, '2026-08-22')).toBe(197)
  })

  it('compounds percentage-based weekly loss', () => {
    const goal = { trendStartDate: '2026-08-01', trendStartWeight: 200, weeklyLossMode: 'percent' as const, weeklyLossValue: 1 }
    expect(plannedWeightForDate(goal, '2026-08-15')).toBe(196)
  })

  it('calculates the date the planned trend reaches its goal', () => {
    expect(plannedGoalDate({ trendStartDate: '2026-08-01', trendStartWeight: 200, goalWeight: 180, weeklyLossMode: 'fixed', weeklyLossValue: 2 })).toBe('2026-10-10')
    expect(plannedGoalDate({ trendStartDate: '2026-08-01', trendStartWeight: 200, goalWeight: 180, weeklyLossMode: 'percent', weeklyLossValue: 1 })).toBe('2026-10-14')
  })
})

describe('weight-goal progress', () => {
  it('reports weight lost, weight remaining, and percentage complete', () => {
    expect(calculateWeightGoalProgress({ trendStartWeight: 200, goalWeight: 180, weightUnit: 'lb' }, 188, 'lb')).toEqual({
      startWeight: 200,
      goalWeight: 180,
      lost: 12,
      remaining: 8,
      percentComplete: 60
    })
  })
})
