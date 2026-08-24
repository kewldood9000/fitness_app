import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { calculateDayTotals, nutritionRepository, type MacroValues } from './nutritionRepository'
import type { FoodLogEntry } from '@/types/models'

const macros: MacroValues = { ENERGY_KCAL: 100, PROTEIN: 10, CARBOHYDRATE: 10, TOTAL_FAT: 2, FIBER: 1, TOTAL_SUGAR: 1, SODIUM: 50 }

beforeEach(async () => {
  await db.open()
  await Promise.all([db.foods.clear(), db.servings.clear(), db.foodNutrients.clear(), db.favorites.clear(), db.recentFoods.clear()])
})

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

describe('food picker lists', () => {
  it('sorts favorites and custom foods alphabetically', async () => {
    const ziti = await nutritionRepository.createCustomFood({ name: 'Ziti', servingName: 'serving', servingQuantity: 1, servingGrams: 100, macros })
    const apple = await nutritionRepository.createCustomFood({ name: 'apple', servingName: 'serving', servingQuantity: 1, servingGrams: 100, macros })
    await nutritionRepository.setFavorite(ziti, true)
    await nutritionRepository.setFavorite(apple, true)

    expect((await nutritionRepository.getFavorites()).map((item) => item.food.name)).toEqual(['apple', 'Ziti'])
    expect((await nutritionRepository.getCustomFoods()).map((item) => item.food.name)).toEqual(['apple', 'Ziti'])
  })
})
