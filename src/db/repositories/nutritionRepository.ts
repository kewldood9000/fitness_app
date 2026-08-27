import { db } from '@/db/database'
import type { Food, FoodLogEntry, FoodNutrient, FoodReference, FoodSource, Meal, Serving } from '@/types/models'

export const nutrientCodes = ['ENERGY_KCAL', 'PROTEIN', 'CARBOHYDRATE', 'TOTAL_FAT', 'FIBER', 'TOTAL_SUGAR', 'SODIUM'] as const
export type NutrientCode = (typeof nutrientCodes)[number]
export type MacroValues = Record<NutrientCode, number>

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()
const zeroMacros = (): MacroValues => ({ ENERGY_KCAL: 0, PROTEIN: 0, CARBOHYDRATE: 0, TOTAL_FAT: 0, FIBER: 0, TOTAL_SUGAR: 0, SODIUM: 0 })

export interface FoodDetails {
  food: Food
  servings: Serving[]
  nutrients: MacroValues
  favorite: boolean
}

export interface ExternalFoodInput {
  source: Exclude<FoodSource, 'CUSTOM'>
  sourceFoodId: string
  name: string
  brand?: string
  brandOwner?: string
  brandName?: string
  barcode?: string
  ingredients?: string
  publicationDate?: string
  servingName?: string
  servingGrams?: number
  nutrients: MacroValues
}

export interface CustomFoodInput {
  name: string
  brand?: string
  barcode?: string
  servingName: string
  servingQuantity: number
  servingGrams: number
  macros: MacroValues
  ingredients?: string
  notes?: string
}

export interface DayNutrition {
  entries: FoodLogEntry[]
  totals: MacroValues
}

export type FoodAmountUnit = 'serving' | 'g' | 'oz'

export interface FoodLogInput {
  date: string
  meal: Meal
  foodId: string
  servingId?: string
  quantity: number
  amountUnit?: FoodAmountUnit
}

export const GRAMS_PER_OUNCE = 28.349523125

function normalized(name: string) {
  return name.trim().toLocaleLowerCase()
}

function buildFoodLogEntry(details: FoodDetails, input: FoodLogInput, id: string, createdAt: string, updatedAt: string): FoodLogEntry {
  const serving = details.servings.find((item) => item.id === input.servingId) ?? details.servings.find((item) => item.id === details.food.defaultServingId) ?? details.servings[0]
  const quantity = Math.max(0.01, input.quantity)
  const amountUnit = input.amountUnit ?? 'serving'
  const grams = amountUnit === 'g'
    ? quantity
    : amountUnit === 'oz'
      ? quantity * GRAMS_PER_OUNCE
      : serving?.grams ? serving.grams * quantity : 100 * quantity
  const displayQuantity = amountUnit === 'serving' ? quantity * Math.max(serving?.quantity ?? 1, 0.01) : quantity
  const servingUnit = amountUnit === 'g' ? 'g' : amountUnit === 'oz' ? 'oz' : serving?.name ?? '100 g'
  const factor = grams / 100
  return {
    id, date: input.date, meal: input.meal, foodId: details.food.id,
    foodSnapshot: { name: details.food.name, brand: details.food.brand, source: details.food.source, servingName: serving?.name ?? '100 g' },
    servingQuantity: displayQuantity, servingUnit, grams,
    calories: Math.round(details.nutrients.ENERGY_KCAL * factor), protein: Math.round(details.nutrients.PROTEIN * factor * 10) / 10,
    carbs: Math.round(details.nutrients.CARBOHYDRATE * factor * 10) / 10, fat: Math.round(details.nutrients.TOTAL_FAT * factor * 10) / 10,
    createdAt, updatedAt
  }
}

export function calculateDayTotals(entries: FoodLogEntry[]): MacroValues {
  return entries.reduce((total, entry) => ({
    ENERGY_KCAL: total.ENERGY_KCAL + entry.calories,
    PROTEIN: total.PROTEIN + entry.protein,
    CARBOHYDRATE: total.CARBOHYDRATE + entry.carbs,
    TOTAL_FAT: total.TOTAL_FAT + entry.fat,
    FIBER: total.FIBER,
    TOTAL_SUGAR: total.TOTAL_SUGAR,
    SODIUM: total.SODIUM
  }), zeroMacros())
}

export const nutritionRepository = {
  async getFoodDetails(foodId: string): Promise<FoodDetails | undefined> {
    const food = await db.foods.get(foodId)
    if (!food) return undefined
    const [servings, foodNutrients, favorite] = await Promise.all([
      db.servings.where('foodId').equals(foodId).toArray(),
      db.foodNutrients.where('foodId').equals(foodId).toArray(),
      db.favorites.where('foodId').equals(foodId).count()
    ])
    const nutrients = foodNutrients.reduce<MacroValues>((total, nutrient) => {
      if (nutrient.nutrientCode in total) total[nutrient.nutrientCode as NutrientCode] = nutrient.amountPer100g
      return total
    }, zeroMacros())
    return { food, servings: servings.sort((a, b) => a.name.localeCompare(b.name)), nutrients, favorite: favorite > 0 }
  },

  async searchLocal(query: string, limit = 12): Promise<FoodDetails[]> {
    const safeQuery = normalized(query)
    const foods = safeQuery
      ? await db.foods.where('normalizedName').startsWithIgnoreCase(safeQuery).limit(limit * 3).toArray()
      : []
    const [favorites, recents] = await Promise.all([db.favorites.toArray(), db.recentFoods.orderBy('updatedAt').reverse().limit(limit).toArray()])
    const favoriteIds = new Set(favorites.map((item) => item.foodId))
    const recentIds = new Set(recents.map((item) => item.foodId))
    const candidates = [...foods].sort((first, second) => {
      const firstScore = (favoriteIds.has(first.id) ? 4 : 0) + (recentIds.has(first.id) ? 2 : 0) + (first.normalizedName === safeQuery ? 8 : 0)
      const secondScore = (favoriteIds.has(second.id) ? 4 : 0) + (recentIds.has(second.id) ? 2 : 0) + (second.normalizedName === safeQuery ? 8 : 0)
      return secondScore - firstScore || first.name.localeCompare(second.name)
    })
    return Promise.all(candidates.slice(0, limit).map((food) => nutritionRepository.getFoodDetails(food.id))).then((items) => items.filter((item): item is FoodDetails => Boolean(item)))
  },

  async getFavorites(): Promise<FoodDetails[]> {
    const refs = await db.favorites.toArray()
    const items = await Promise.all(refs.map((ref) => nutritionRepository.getFoodDetails(ref.foodId)))
    return items
      .filter((item): item is FoodDetails => Boolean(item))
      .sort((first, second) => first.food.name.localeCompare(second.food.name, undefined, { sensitivity: 'base' }))
  },

  async getRecents(limit = 10): Promise<FoodDetails[]> {
    const refs = await db.recentFoods.orderBy('updatedAt').reverse().limit(limit).toArray()
    const items = await Promise.all(refs.map((ref) => nutritionRepository.getFoodDetails(ref.foodId)))
    return items.filter((item): item is FoodDetails => Boolean(item))
  },

  async getCustomFoods(): Promise<FoodDetails[]> {
    const foods = await db.foods.where('source').equals('CUSTOM').toArray()
    const items = await Promise.all(foods.map((food) => nutritionRepository.getFoodDetails(food.id)))
    return items
      .filter((item): item is FoodDetails => Boolean(item))
      .sort((first, second) => first.food.name.localeCompare(second.food.name, undefined, { sensitivity: 'base' }))
  },

  async setFavorite(foodId: string, favorite: boolean): Promise<void> {
    const timestamp = now()
    if (!favorite) {
      await db.favorites.delete(foodId)
      return
    }
    const existing = await db.favorites.get(foodId)
    const reference: FoodReference = existing
      ? { ...existing, updatedAt: timestamp }
      : { id: foodId, foodId, createdAt: timestamp, updatedAt: timestamp }
    await db.favorites.put(reference)
  },

  async createCustomFood(input: CustomFoodInput): Promise<string> {
    const timestamp = now()
    const foodId = newId()
    const servingId = newId()
    const grams = Math.max(0.1, input.servingGrams)
    const food: Food = {
      id: foodId,
      source: 'CUSTOM',
      name: input.name.trim(),
      normalizedName: normalized(input.name),
      brand: input.brand?.trim() || undefined,
      barcode: input.barcode?.trim() || undefined,
      ingredients: input.ingredients?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      defaultServingId: servingId,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    const serving: Serving = { id: servingId, foodId, name: input.servingName.trim() || 'serving', grams, quantity: input.servingQuantity || 1, createdAt: timestamp, updatedAt: timestamp }
    const foodNutrients: FoodNutrient[] = nutrientCodes.map((code) => ({
      id: newId(), foodId, nutrientCode: code, amountPer100g: (input.macros[code] / grams) * 100, createdAt: timestamp, updatedAt: timestamp
    }))
    await db.transaction('rw', db.foods, db.servings, db.foodNutrients, db.barcodeMappings, async () => {
      await db.foods.add(food)
      await db.servings.add(serving)
      await db.foodNutrients.bulkAdd(foodNutrients)
      if (food.barcode) await db.barcodeMappings.put({ id: food.barcode, barcode: food.barcode, foodId, createdAt: timestamp, updatedAt: timestamp })
    })
    return foodId
  },

  async updateCustomFood(foodId: string, input: CustomFoodInput): Promise<void> {
    const existing = await db.foods.get(foodId)
    if (!existing || existing.source !== 'CUSTOM') throw new Error('Only custom foods can be edited.')
    const timestamp = now()
    const servingId = existing.defaultServingId ?? newId()
    const grams = Math.max(0.1, input.servingGrams)
    const food: Food = {
      ...existing,
      name: input.name.trim(),
      normalizedName: normalized(input.name),
      brand: input.brand?.trim() || undefined,
      barcode: input.barcode?.trim() || undefined,
      ingredients: input.ingredients?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      defaultServingId: servingId,
      updatedAt: timestamp
    }
    const serving: Serving = { id: servingId, foodId, name: input.servingName.trim() || 'serving', grams, quantity: input.servingQuantity || 1, createdAt: existing.createdAt, updatedAt: timestamp }
    const nutrients: FoodNutrient[] = nutrientCodes.map((code) => ({ id: `${foodId}:${code}`, foodId, nutrientCode: code, amountPer100g: (input.macros[code] / grams) * 100, createdAt: timestamp, updatedAt: timestamp }))
    await db.transaction('rw', db.foods, db.servings, db.foodNutrients, db.barcodeMappings, async () => {
      const mappings = await db.barcodeMappings.where('foodId').equals(foodId).toArray()
      await Promise.all(mappings.map((mapping) => db.barcodeMappings.delete(mapping.id)))
      await db.foods.put(food)
      await db.servings.put(serving)
      await db.foodNutrients.where('foodId').equals(foodId).delete()
      await db.foodNutrients.bulkPut(nutrients)
      if (food.barcode) await db.barcodeMappings.put({ id: food.barcode, barcode: food.barcode, foodId, createdAt: timestamp, updatedAt: timestamp })
    })
  },

  async deleteCustomFood(foodId: string): Promise<void> {
    const food = await db.foods.get(foodId)
    if (!food || food.source !== 'CUSTOM') throw new Error('Only custom foods can be deleted.')
    await db.transaction('rw', [db.foods, db.servings, db.foodNutrients, db.barcodeMappings, db.favorites, db.recentFoods], async () => {
      const mappings = await db.barcodeMappings.where('foodId').equals(foodId).toArray()
      await Promise.all([
        db.foods.delete(foodId),
        db.servings.where('foodId').equals(foodId).delete(),
        db.foodNutrients.where('foodId').equals(foodId).delete(),
        db.favorites.delete(foodId),
        db.recentFoods.delete(foodId),
        ...mappings.map((mapping) => db.barcodeMappings.delete(mapping.id))
      ])
    })
  },

  async cacheExternalFood(input: ExternalFoodInput): Promise<string> {
    const existing = await db.foods.where('sourceFoodId').equals(input.sourceFoodId).and((food) => food.source === input.source).first()
    const timestamp = now()
    const foodId = existing?.id ?? newId()
    const servingId = existing?.defaultServingId ?? newId()
    const grams = input.servingGrams && input.servingGrams > 0 ? input.servingGrams : 100
    const food: Food = {
      id: foodId, source: input.source, sourceFoodId: input.sourceFoodId, name: input.name, normalizedName: normalized(input.name), brand: input.brand, brandOwner: input.brandOwner, brandName: input.brandName,
      barcode: input.barcode, ingredients: input.ingredients, publicationDate: input.publicationDate, lastFetchedAt: timestamp, defaultServingId: servingId, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp
    }
    const serving: Serving = { id: servingId, foodId, name: input.servingName || '100 g', grams, quantity: 1, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp }
    const nutrients: FoodNutrient[] = nutrientCodes.map((code) => ({ id: `${foodId}:${code}`, foodId, nutrientCode: code, amountPer100g: input.nutrients[code], createdAt: timestamp, updatedAt: timestamp }))
    await db.transaction('rw', db.foods, db.servings, db.foodNutrients, db.barcodeMappings, async () => {
      await db.foods.put(food)
      await db.servings.put(serving)
      await db.foodNutrients.where('foodId').equals(foodId).delete()
      await db.foodNutrients.bulkPut(nutrients)
      if (input.barcode) await db.barcodeMappings.put({ id: input.barcode, barcode: input.barcode, foodId, createdAt: timestamp, updatedAt: timestamp })
    })
    return foodId
  },

  async cacheUsdaFood(input: Omit<ExternalFoodInput, 'source'>): Promise<string> {
    return nutritionRepository.cacheExternalFood({ ...input, source: 'USDA' })
  },

  async findByBarcode(barcode: string): Promise<FoodDetails | undefined> {
    const mapping = await db.barcodeMappings.where('barcode').equals(barcode).first()
    return mapping ? nutritionRepository.getFoodDetails(mapping.foodId) : undefined
  },

  async logFood(input: FoodLogInput): Promise<void> {
    const details = await nutritionRepository.getFoodDetails(input.foodId)
    if (!details) throw new Error('This food is no longer available.')
    const timestamp = now()
    const entry = buildFoodLogEntry(details, input, newId(), timestamp, timestamp)
    const existingRecent = await db.recentFoods.get(details.food.id)
    const recent: FoodReference = existingRecent ? { ...existingRecent, updatedAt: timestamp } : { id: details.food.id, foodId: details.food.id, createdAt: timestamp, updatedAt: timestamp }
    await db.transaction('rw', db.foodLogs, db.recentFoods, async () => { await db.foodLogs.add(entry); await db.recentFoods.put(recent) })
  },

  async updateFoodLog(id: string, input: FoodLogInput): Promise<void> {
    const [existing, details] = await Promise.all([db.foodLogs.get(id), nutritionRepository.getFoodDetails(input.foodId)])
    if (!existing) throw new Error('This food log entry no longer exists.')
    if (!details) throw new Error('This food is no longer available.')
    await db.foodLogs.put(buildFoodLogEntry(details, input, existing.id, existing.createdAt, now()))
  },

  async getDayNutrition(date: string): Promise<DayNutrition> {
    const entries = await db.foodLogs.where('date').equals(date).sortBy('createdAt')
    return { entries, totals: calculateDayTotals(entries) }
  },

  async getLastFoodLog(foodId: string): Promise<FoodLogEntry | undefined> {
    const entries = await db.foodLogs.where('foodId').equals(foodId).toArray()
    return entries.sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0]
  },

  getDateRangeLogs: (start: string, end: string) => db.foodLogs.where('date').between(start, end, true, true).toArray(),
  deleteFoodLog: (id: string) => db.foodLogs.delete(id)
}
