import type { FoodSource } from '@/types/models'

export interface FoodSearchResult {
  source: Exclude<FoodSource, 'CUSTOM'>
  sourceFoodId: string
  name: string
  brand?: string
}

export interface ExternalFood extends FoodSearchResult {
  barcode?: string
  ingredients?: string
  nutrients: Record<string, number>
  brandOwner?: string
  brandName?: string
  servingName?: string
  servingGrams?: number
  publicationDate?: string
}

export interface FoodSourceAdapter {
  readonly source: Exclude<FoodSource, 'CUSTOM'>
  readonly label: string
  isAvailable?(): Promise<boolean>
  search(query: string): Promise<FoodSearchResult[]>
  getFood(id: string): Promise<ExternalFood>
  lookupBarcode?(barcode: string, signal?: AbortSignal): Promise<ExternalFood | null>
}

export interface BarcodeFoodSourceAdapter {
  readonly source: Exclude<FoodSource, 'CUSTOM'>
  readonly label: string
  isAvailable?(): Promise<boolean>
  lookupBarcode(barcode: string, signal?: AbortSignal): Promise<ExternalFood | null>
}

export const foodSourceLabels: Record<FoodSource, string> = {
  USDA: 'USDA FoodData Central',
  OPEN_FOOD_FACTS: 'Open Food Facts',
  FATSECRET: 'FatSecret',
  CUSTOM: 'Custom food'
}
