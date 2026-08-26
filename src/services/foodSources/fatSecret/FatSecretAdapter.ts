import { credentialRepository } from '@/db/repositories/credentialRepository'
import { GRAMS_PER_OUNCE, type MacroValues } from '@/db/repositories/nutritionRepository'
import type { BarcodeFoodSourceAdapter, ExternalFood } from '../FoodSourceAdapter'
import { createTimedRequest } from '../timedRequest'

export const FATSECRET_PROXY_URL_KEY = 'fatsecret-proxy-url'

interface FatSecretServing {
  serving_id?: string | number
  serving_description?: string
  metric_serving_amount?: string | number
  metric_serving_unit?: string
  is_default?: string | number
  calories?: string | number
  carbohydrate?: string | number
  protein?: string | number
  fat?: string | number
  fiber?: string | number
  sugar?: string | number
  sodium?: string | number
}

interface FatSecretFood {
  food_id?: string | number
  food_name?: string
  brand_name?: string
  servings?: { serving?: FatSecretServing | FatSecretServing[] }
}

interface FatSecretResponse {
  food?: FatSecretFood
  error?: { code?: number | string; message?: string }
}

const number = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function toGtin13(barcode: string): string {
  const digits = barcode.replace(/\D/g, '')
  return digits.length < 13 ? digits.padStart(13, '0') : digits
}

function gramsForServing(serving: FatSecretServing): number {
  const amount = number(serving.metric_serving_amount)
  const unit = serving.metric_serving_unit?.toLocaleLowerCase()
  if (amount > 0 && unit === 'oz') return amount * GRAMS_PER_OUNCE
  if (amount > 0 && (unit === 'g' || unit === 'ml')) return amount
  const described = serving.serving_description?.match(/([\d.]+)\s*(g|gram|grams|oz|ounce|ounces|ml)\b/i)
  if (described) return number(described[1]) * (described[2].toLocaleLowerCase().startsWith('o') ? GRAMS_PER_OUNCE : 1)
  return 100
}

export function toFatSecretFood(payload: FatSecretResponse, barcode: string): ExternalFood | null {
  if (String(payload.error?.code ?? '') === '211') return null
  if (payload.error) throw new Error(payload.error.message || 'FatSecret could not look up this barcode.')
  const food = payload.food
  if (!food?.food_id || !food.food_name) return null
  const rawServings = food.servings?.serving
  const servings = Array.isArray(rawServings) ? rawServings : rawServings ? [rawServings] : []
  const serving = servings.find((item) => Number(item.is_default) === 1) ?? servings.find((item) => number(item.metric_serving_amount) > 0) ?? servings[0]
  if (!serving) return null
  const grams = gramsForServing(serving)
  const per100g = 100 / grams
  const macroValues: MacroValues = {
    ENERGY_KCAL: number(serving.calories) * per100g,
    PROTEIN: number(serving.protein) * per100g,
    CARBOHYDRATE: number(serving.carbohydrate) * per100g,
    TOTAL_FAT: number(serving.fat) * per100g,
    FIBER: number(serving.fiber) * per100g,
    TOTAL_SUGAR: number(serving.sugar) * per100g,
    SODIUM: number(serving.sodium) * per100g
  }
  return {
    source: 'FATSECRET',
    sourceFoodId: String(food.food_id),
    name: food.food_name,
    brand: food.brand_name?.trim() || undefined,
    barcode,
    servingName: serving.serving_description?.trim() || 'serving',
    servingGrams: grams,
    nutrients: macroValues
  }
}

export class FatSecretAdapter implements BarcodeFoodSourceAdapter {
  readonly source = 'FATSECRET' as const
  readonly label = 'FatSecret'

  async isAvailable(): Promise<boolean> {
    return Boolean((await credentialRepository.get(FATSECRET_PROXY_URL_KEY))?.value)
  }

  async lookupBarcode(barcode: string, signal?: AbortSignal): Promise<ExternalFood | null> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('You are offline. Local foods are still available.')
    const proxy = (await credentialRepository.get(FATSECRET_PROXY_URL_KEY))?.value
    if (!proxy) return null
    let url: URL
    try {
      url = new URL(proxy)
    } catch {
      throw new Error('The FatSecret proxy URL in Settings is invalid.')
    }
    url.searchParams.set('barcode', toGtin13(barcode))
    const request = createTimedRequest(signal)
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: request.signal })
      if (response.status === 404) return null
      if (response.status === 401 || response.status === 403) throw new Error('The FatSecret proxy rejected this app. Check its allowed origin and credentials.')
      if (response.status === 429) throw new Error('FatSecret rate limit reached. Try again shortly.')
      if (!response.ok) throw new Error('FatSecret is unavailable right now.')
      return toFatSecretFood(await response.json() as FatSecretResponse, toGtin13(barcode))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError' && request.didTimeout()) throw new Error('FatSecret timed out. Try again.')
      throw error
    } finally {
      request.cleanup()
    }
  }
}

export const fatSecretAdapter = new FatSecretAdapter()
