import { describe, expect, it } from 'vitest'
import { calculateDayTotals } from './nutritionRepository'
import type { FoodLogEntry } from '@/types/models'

function entry(values: Pick<FoodLogEntry, 'calories' | 'protein' | 'carbs' | 'fat'>): FoodLogEntry {
  return {
    id: crypto.randomUUID(), date: '2026-08-22', meal: 'breakfast', foodId: 'food', foodSnapshot: {}, servingQuantity: 1, servingUnit: 'serving',
    createdAt: '2026-08-22T12:00:00.000Z', updatedAt: '2026-08-22T12:00:00.000Z', ...values
  }
}

describe('calculateDayTotals', () => {
  it('adds the logged energy and macro snapshots without rounding away decimals', () => {
    expect(calculateDayTotals([entry({ calories: 210, protein: 22.4, carbs: 10.2, fat: 7.5 }), entry({ calories: 95, protein: 3.1, carbs: 14.8, fat: 2.2 })])).toMatchObject({
      ENERGY_KCAL: 305, PROTEIN: 25.5, CARBOHYDRATE: 25, TOTAL_FAT: 9.7, FIBER: 0, TOTAL_SUGAR: 0, SODIUM: 0
    })
  })
})
