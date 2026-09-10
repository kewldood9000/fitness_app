import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { calculateDayTotals, foodDisplayName, formatFoodLogAmount, nutritionRepository, type MacroValues } from './nutritionRepository'
import type { FoodLogEntry } from '@/types/models'

const macros: MacroValues = { ENERGY_KCAL: 100, PROTEIN: 10, CARBOHYDRATE: 10, TOTAL_FAT: 2, FIBER: 1, TOTAL_SUGAR: 1, SODIUM: 50 }

beforeEach(async () => {
  await db.open()
  await Promise.all([db.foods.clear(), db.servings.clear(), db.foodNutrients.clear(), db.favorites.clear(), db.recentFoods.clear(), db.foodLogs.clear(), db.barcodeMappings.clear(), db.savedMeals.clear(), db.savedMealItems.clear()])
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

  it('keeps identical source IDs from different external databases separate', async () => {
    const openFoodFactsId = await nutritionRepository.cacheExternalFood({ source: 'OPEN_FOOD_FACTS', sourceFoodId: '123', name: 'Open product', barcode: '00123', nutrients: macros })
    const fatSecretId = await nutritionRepository.cacheExternalFood({ source: 'FATSECRET', sourceFoodId: '123', name: 'FatSecret product', barcode: '00456', nutrients: macros })

    expect(fatSecretId).not.toBe(openFoodFactsId)
    expect((await db.foods.toArray()).map((food) => food.source).sort()).toEqual(['FATSECRET', 'OPEN_FOOD_FACTS'])
  })

  it('keeps a local external-food name and its database identity through refreshes', async () => {
    const foodId = await nutritionRepository.cacheExternalFood({ source: 'OPEN_FOOD_FACTS', sourceFoodId: 'ramen-123', name: 'Artificial Pork Flavor', barcode: '00123', nutrients: macros })
    await nutritionRepository.logFood({ date: '2026-08-25', meal: 'dinner', foodId, quantity: 1, amountUnit: 'serving' })

    await nutritionRepository.setFoodDisplayName(foodId, 'Ramen noodles')
    await nutritionRepository.cacheExternalFood({ source: 'OPEN_FOOD_FACTS', sourceFoodId: 'ramen-123', name: 'Artificial Pork Flavor', barcode: '00123', nutrients: macros })

    const details = await nutritionRepository.getFoodDetails(foodId)
    expect(details?.food).toMatchObject({ source: 'OPEN_FOOD_FACTS', sourceFoodId: 'ramen-123', name: 'Artificial Pork Flavor', displayName: 'Ramen noodles', barcode: '00123' })
    expect(foodDisplayName(details!.food)).toBe('Ramen noodles')
    expect((await db.foodLogs.toArray())[0].foodSnapshot.name).toBe('Ramen noodles')
  })
})

describe('food log amount labels', () => {
  it('removes repeated serving quantities and shows the gram equivalent', () => {
    expect(formatFoodLogAmount({ servingQuantity: 1, servingUnit: '1 slice', grams: 19 })).toBe('1 slice (19 g)')
    expect(formatFoodLogAmount({ servingQuantity: 2, servingUnit: '1 slice', grams: 38 })).toBe('2 slices (38 g)')
    expect(formatFoodLogAmount({ servingQuantity: 82, servingUnit: 'g', grams: 82 })).toBe('82 g')
  })
})

describe('food amount units', () => {
  it('logs arbitrary gram and ounce amounts from the same nutrition data', async () => {
    const foodId = await nutritionRepository.createCustomFood({ name: 'Potato', servingName: 'serving', servingQuantity: 1, servingGrams: 100, macros })

    await nutritionRepository.logFood({ date: '2026-08-24', meal: 'dinner', foodId, quantity: 80, amountUnit: 'g' })
    await nutritionRepository.logFood({ date: '2026-08-24', meal: 'dinner', foodId, quantity: 1, amountUnit: 'oz' })

    const entries = await db.foodLogs.toArray()
    expect(entries.find((item) => item.servingUnit === 'g')).toMatchObject({ servingQuantity: 80, grams: 80, calories: 80, protein: 8 })
    expect(entries.find((item) => item.servingUnit === 'oz')).toMatchObject({ servingQuantity: 1, calories: 28, protein: 2.8 })
    expect(entries.find((item) => item.servingUnit === 'oz')?.grams).toBeCloseTo(28.3495, 4)
  })

  it('treats the entered custom-food label serving as one complete serving', async () => {
    const foodId = await nutritionRepository.createCustomFood({ name: 'Two bars', servingName: 'bar', servingQuantity: 2, servingGrams: 80, macros })
    const servingId = (await nutritionRepository.getFoodDetails(foodId))?.food.defaultServingId

    await nutritionRepository.logFood({ date: '2026-08-24', meal: 'snacks', foodId, servingId, quantity: 1, amountUnit: 'serving' })

    expect((await db.foodLogs.toArray())[0]).toMatchObject({ servingQuantity: 2, servingUnit: 'bar', grams: 80, calories: 100, protein: 10 })
  })

  it('returns the most recently logged amount and unit for a food', async () => {
    const foodId = await nutritionRepository.createCustomFood({ name: 'Rice', servingName: 'cup', servingQuantity: 1, servingGrams: 200, macros })
    await nutritionRepository.logFood({ date: '2026-08-24', meal: 'dinner', foodId, quantity: 1, amountUnit: 'oz' })
    await nutritionRepository.logFood({ date: '2026-08-25', meal: 'lunch', foodId, quantity: 82, amountUnit: 'g' })
    const entries = await db.foodLogs.toArray()
    await db.foodLogs.update(entries.find((item) => item.servingUnit === 'oz')!.id, { createdAt: '2026-08-24T18:00:00.000Z' })
    await db.foodLogs.update(entries.find((item) => item.servingUnit === 'g')!.id, { createdAt: '2026-08-25T12:00:00.000Z' })

    expect(await nutritionRepository.getLastFoodLog(foodId)).toMatchObject({ servingQuantity: 82, servingUnit: 'g', grams: 82 })
  })

  it('edits an existing food log without creating a second entry', async () => {
    const foodId = await nutritionRepository.createCustomFood({ name: 'Rice', servingName: 'cup', servingQuantity: 1, servingGrams: 200, macros })
    await nutritionRepository.logFood({ date: '2026-08-25', meal: 'dinner', foodId, quantity: 100, amountUnit: 'g' })
    const original = (await db.foodLogs.toArray())[0]

    await nutritionRepository.updateFoodLog(original.id, { date: original.date, meal: 'lunch', foodId, quantity: 82, amountUnit: 'g' })

    const entries = await db.foodLogs.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ id: original.id, meal: 'lunch', servingQuantity: 82, servingUnit: 'g', grams: 82, calories: 41, protein: 4.1, createdAt: original.createdAt })
  })
})

describe('saved meals', () => {
  it('keeps suggested component weights separate from the actual logged weights', async () => {
    const rice = await nutritionRepository.createCustomFood({ name: 'Rice', servingName: 'serving', servingQuantity: 1, servingGrams: 100, macros })
    const chicken = await nutritionRepository.createCustomFood({ name: 'Chicken', servingName: 'serving', servingQuantity: 1, servingGrams: 100, macros: { ...macros, ENERGY_KCAL: 200 } })
    const savedMealId = await nutritionRepository.createSavedMeal({ name: 'Burrito bowl', items: [{ foodId: rice, defaultGrams: 200 }, { foodId: chicken, defaultGrams: 150 }] })

    expect((await nutritionRepository.getSavedMealDetails(savedMealId))?.items.map((item) => item.defaultGrams)).toEqual([200, 150])
    await nutritionRepository.logFoods([{ date: '2026-08-25', meal: 'dinner', foodId: rice, quantity: 180, amountUnit: 'g' }, { date: '2026-08-25', meal: 'dinner', foodId: chicken, quantity: 120, amountUnit: 'g' }])

    expect((await db.foodLogs.toArray()).map((item) => item.grams).sort((a, b) => a! - b!)).toEqual([120, 180])
    expect((await nutritionRepository.getSavedMealDetails(savedMealId))?.items.map((item) => item.defaultGrams)).toEqual([200, 150])
  })

  it('updates a saved meal in place', async () => {
    const rice = await nutritionRepository.createCustomFood({ name: 'Rice', servingName: 'serving', servingQuantity: 1, servingGrams: 100, macros })
    const beans = await nutritionRepository.createCustomFood({ name: 'Beans', servingName: 'serving', servingQuantity: 1, servingGrams: 100, macros })
    const savedMealId = await nutritionRepository.createSavedMeal({ name: 'Bowl', items: [{ foodId: rice, defaultGrams: 200 }] })

    await nutritionRepository.updateSavedMeal(savedMealId, { name: 'Burrito bowl', notes: 'Meal prep', items: [{ foodId: rice, defaultGrams: 180 }, { foodId: beans, defaultGrams: 90 }] })

    expect(await nutritionRepository.getSavedMealDetails(savedMealId)).toMatchObject({ meal: { id: savedMealId, name: 'Burrito bowl', notes: 'Meal prep' } })
    expect((await nutritionRepository.getSavedMealDetails(savedMealId))?.items.map((item) => item.defaultGrams)).toEqual([180, 90])
  })

  it('lists only saved meals in most-recently-used order', async () => {
    const rice = await nutritionRepository.createCustomFood({ name: 'Rice', servingName: 'serving', servingQuantity: 1, servingGrams: 100, macros })
    const older = await nutritionRepository.createSavedMeal({ name: 'Older meal', items: [{ foodId: rice, defaultGrams: 100 }] })
    const recent = await nutritionRepository.createSavedMeal({ name: 'Recent meal', items: [{ foodId: rice, defaultGrams: 100 }] })
    await db.savedMeals.update(older, { lastUsedAt: '2026-08-20T12:00:00.000Z' })
    await db.savedMeals.update(recent, { lastUsedAt: '2026-08-25T12:00:00.000Z' })

    expect((await nutritionRepository.getSavedMeals()).map((item) => item.meal.name)).toEqual(['Recent meal', 'Older meal'])
  })
})
