import type { FoodSource } from '@/types/models'

export interface FoodSearchResult {
  source: FoodSource
  sourceFoodId: string
  name: string
  brand?: string
}

export interface ExternalFood extends FoodSearchResult {
  barcode?: string
  ingredients?: string
  nutrients: Record<string, number>
}

export interface FoodSourceAdapter {
  search(query: string): Promise<FoodSearchResult[]>
  getFood(id: string): Promise<ExternalFood>
  lookupBarcode?(barcode: string): Promise<ExternalFood | null>
}
