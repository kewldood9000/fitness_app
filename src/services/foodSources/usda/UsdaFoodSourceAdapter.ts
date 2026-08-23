import { credentialRepository } from '@/db/repositories/credentialRepository'
import type { MacroValues } from '@/db/repositories/nutritionRepository'
import type { ExternalFood, FoodSearchResult, FoodSourceAdapter } from '../FoodSourceAdapter'

const API_BASE = 'https://api.nal.usda.gov/fdc/v1'
const API_KEY_NAME = 'usda-api-key'

interface UsdaSearchFood {
  fdcId: number
  description: string
  brandOwner?: string
  brandName?: string
  gtinUpc?: string
  ingredients?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: Array<Record<string, unknown>>
}

interface UsdaFoodDetails extends UsdaSearchFood {
  foodNutrients?: Array<Record<string, unknown>>
  foodPortions?: Array<{ portionDescription?: string; gramWeight?: number; amount?: number }>
  publishedDate?: string
}

export interface UsdaExternalFood extends ExternalFood {
  barcode?: string
  brandOwner?: string
  brandName?: string
  ingredients?: string
  servingName?: string
  servingGrams?: number
  publicationDate?: string
  macroValues: MacroValues
}

function emptyMacros(): MacroValues {
  return { ENERGY_KCAL: 0, PROTEIN: 0, CARBOHYDRATE: 0, TOTAL_FAT: 0, FIBER: 0, TOTAL_SUGAR: 0, SODIUM: 0 }
}

function nutrientField(nutrient: Record<string, unknown>, field: string): unknown {
  const nested = nutrient.nutrient
  if (nested && typeof nested === 'object') return (nested as Record<string, unknown>)[field] ?? nutrient[field]
  return nutrient[field]
}

function mapNutrient(nutrient: Record<string, unknown>): keyof MacroValues | undefined {
  const id = Number(nutrientField(nutrient, 'id') ?? nutrient.nutrientId)
  const name = String(nutrientField(nutrient, 'name') ?? nutrient.nutrientName ?? '').toLowerCase()
  if (id === 1008 || name.includes('energy')) return 'ENERGY_KCAL'
  if (id === 1003 || name === 'protein') return 'PROTEIN'
  if (id === 1005 || name.includes('carbohydrate')) return 'CARBOHYDRATE'
  if (id === 1004 || name.includes('total lipid') || name === 'total fat') return 'TOTAL_FAT'
  if (id === 1079 || name.includes('fiber')) return 'FIBER'
  if (id === 2000 || name.includes('sugars')) return 'TOTAL_SUGAR'
  if (id === 1093 || name === 'sodium, na' || name === 'sodium') return 'SODIUM'
  return undefined
}

function extractMacros(nutrients?: Array<Record<string, unknown>>): MacroValues {
  return (nutrients ?? []).reduce<MacroValues>((macros, nutrient) => {
    const key = mapNutrient(nutrient)
    const amount = Number(nutrient.amount ?? nutrient.value ?? 0)
    if (key && Number.isFinite(amount)) macros[key] = amount
    return macros
  }, emptyMacros())
}

function toSearchResult(food: UsdaSearchFood): FoodSearchResult {
  return { source: 'USDA', sourceFoodId: String(food.fdcId), name: food.description, brand: food.brandName || food.brandOwner }
}

function toExternalFood(food: UsdaFoodDetails): UsdaExternalFood {
  const foodPortion = food.foodPortions?.find((portion) => portion.gramWeight)
  const servingGrams = foodPortion?.gramWeight ?? food.servingSize
  const servingName = foodPortion?.portionDescription ?? food.householdServingFullText ?? (food.servingSize ? `${food.servingSize} ${food.servingSizeUnit ?? 'g'}` : undefined)
  const macroValues = extractMacros(food.foodNutrients)
  return {
    ...toSearchResult(food),
    barcode: food.gtinUpc,
    brandOwner: food.brandOwner,
    brandName: food.brandName,
    ingredients: food.ingredients,
    nutrients: macroValues,
    macroValues,
    servingGrams,
    servingName,
    publicationDate: food.publishedDate
  }
}

export class UsdaFoodSourceAdapter implements FoodSourceAdapter {
  private async request<T>(path: string, query: Record<string, string>): Promise<T> {
    if (!navigator.onLine) throw new Error('You are offline. Local foods are still available.')
    const credential = await credentialRepository.get(API_KEY_NAME)
    if (!credential?.value) throw new Error('Add your USDA API key in Settings to search FoodData Central.')
    const url = new URL(`${API_BASE}${path}`)
    url.searchParams.set('api_key', credential.value)
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (response.status === 401 || response.status === 403) throw new Error('Your USDA API key was rejected. Check it in Settings.')
      if (response.status === 429) throw new Error('USDA rate limit reached. Try again in about an hour.')
      if (!response.ok) throw new Error('USDA search is unavailable right now. Try again later.')
      return await response.json() as T
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new Error('USDA search timed out. Try again.')
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
  }

  async search(query: string): Promise<FoodSearchResult[]> {
    const data = await this.request<{ foods?: UsdaSearchFood[] }>('/foods/search', { query, pageSize: '10' })
    return (data.foods ?? []).map(toSearchResult)
  }

  async getFood(id: string): Promise<UsdaExternalFood> {
    const food = await this.request<UsdaFoodDetails>(`/food/${encodeURIComponent(id)}`, {})
    return toExternalFood(food)
  }

  async lookupBarcode(barcode: string): Promise<UsdaExternalFood | null> {
    const data = await this.request<{ foods?: UsdaSearchFood[] }>('/foods/search', { query: barcode, pageSize: '10', dataType: 'Branded' })
    const match = (data.foods ?? []).find((food) => food.gtinUpc?.replace(/\D/g, '') === barcode.replace(/\D/g, '')) ?? data.foods?.[0]
    return match ? this.getFood(String(match.fdcId)) : null
  }
}

export const usdaAdapter = new UsdaFoodSourceAdapter()
