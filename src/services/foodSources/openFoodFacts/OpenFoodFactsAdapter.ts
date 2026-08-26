import { GRAMS_PER_OUNCE, type MacroValues } from '@/db/repositories/nutritionRepository'
import type { BarcodeFoodSourceAdapter, ExternalFood } from '../FoodSourceAdapter'
import { createTimedRequest } from '../timedRequest'

const API_BASE = 'https://world.openfoodfacts.org/api/v2/product'
const PRODUCT_FIELDS = ['code', 'product_name', 'generic_name', 'brands', 'ingredients_text', 'serving_size', 'serving_quantity', 'serving_quantity_unit', 'nutriments'].join(',')

interface OpenFoodFactsProduct {
  code?: string
  product_name?: string
  generic_name?: string
  brands?: string
  ingredients_text?: string
  serving_size?: string
  serving_quantity?: number | string
  serving_quantity_unit?: string
  nutriments?: Record<string, number | string | undefined>
}

interface OpenFoodFactsResponse {
  code?: string
  status?: number
  product?: OpenFoodFactsProduct
}

const number = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function servingGrams(product: OpenFoodFactsProduct): number | undefined {
  const text = product.serving_size?.toLocaleLowerCase() ?? ''
  const match = text.match(/([\d.]+)\s*(g|gram|grams|oz|ounce|ounces|ml)\b/)
  if (match) {
    const amount = number(match[1])
    return match[2].startsWith('oz') || match[2].startsWith('ounce') ? amount * GRAMS_PER_OUNCE : amount
  }
  const amount = number(product.serving_quantity)
  if (!amount) return undefined
  const unit = product.serving_quantity_unit?.toLocaleLowerCase()
  return unit?.startsWith('oz') ? amount * GRAMS_PER_OUNCE : amount
}

export function toOpenFoodFactsFood(payload: OpenFoodFactsResponse, scannedBarcode: string): ExternalFood | null {
  const product = payload.product
  const name = product?.product_name?.trim() || product?.generic_name?.trim()
  if (payload.status !== 1 || !product || !name) return null
  const nutrients = product.nutriments ?? {}
  const energyKcal = number(nutrients['energy-kcal_100g']) || number(nutrients.energy_100g) / 4.184
  const sodium = number(nutrients.sodium_100g)
  const sodiumUnit = String(nutrients.sodium_unit ?? 'g').toLocaleLowerCase()
  const macroValues: MacroValues = {
    ENERGY_KCAL: energyKcal,
    PROTEIN: number(nutrients.proteins_100g),
    CARBOHYDRATE: number(nutrients.carbohydrates_100g),
    TOTAL_FAT: number(nutrients.fat_100g),
    FIBER: number(nutrients.fiber_100g),
    TOTAL_SUGAR: number(nutrients.sugars_100g),
    SODIUM: sodiumUnit === 'mg' ? sodium : sodium * 1000
  }
  return {
    source: 'OPEN_FOOD_FACTS',
    sourceFoodId: product.code || payload.code || scannedBarcode,
    name,
    brand: product.brands?.trim() || undefined,
    barcode: product.code || payload.code || scannedBarcode,
    ingredients: product.ingredients_text?.trim() || undefined,
    servingName: product.serving_size?.trim() || '100 g',
    servingGrams: servingGrams(product),
    nutrients: macroValues
  }
}

export class OpenFoodFactsAdapter implements BarcodeFoodSourceAdapter {
  readonly source = 'OPEN_FOOD_FACTS' as const
  readonly label = 'Open Food Facts'

  async lookupBarcode(barcode: string, signal?: AbortSignal): Promise<ExternalFood | null> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('You are offline. Local foods are still available.')
    const digits = barcode.replace(/\D/g, '')
    const url = new URL(`${API_BASE}/${encodeURIComponent(digits)}.json`)
    url.searchParams.set('fields', PRODUCT_FIELDS)
    const request = createTimedRequest(signal)
    try {
      const response = await fetch(url, { signal: request.signal })
      if (response.status === 429) throw new Error('Open Food Facts rate limit reached. Try again shortly.')
      if (!response.ok) throw new Error('Open Food Facts is unavailable right now.')
      return toOpenFoodFactsFood(await response.json() as OpenFoodFactsResponse, digits)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError' && request.didTimeout()) throw new Error('Open Food Facts timed out. Try again.')
      throw error
    } finally {
      request.cleanup()
    }
  }
}

export const openFoodFactsAdapter = new OpenFoodFactsAdapter()
