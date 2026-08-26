import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/database'
import { credentialRepository } from '@/db/repositories/credentialRepository'
import { UsdaFoodSourceAdapter } from './UsdaFoodSourceAdapter'

beforeEach(async () => {
  await db.open()
  await db.credentials.clear()
  await credentialRepository.set('usda-api-key', 'test-key')
  vi.stubGlobal('navigator', { onLine: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('USDA barcode lookup', () => {
  it('maps the matching search result without a second food-details request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      foods: [{
        fdcId: 42,
        description: 'Diced chicken breast',
        brandName: 'Example Brand',
        gtinUpc: '023700016270',
        servingSize: 85,
        servingSizeUnit: 'g',
        householdServingFullText: '3 oz',
        foodNutrients: [
          { nutrientId: 1008, nutrientName: 'Energy', value: 141 },
          { nutrientId: 1003, nutrientName: 'Protein', value: 25.8 }
        ]
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new UsdaFoodSourceAdapter().lookupBarcode('023700016270')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ source: 'USDA', sourceFoodId: '42', name: 'Diced chicken breast', brand: 'Example Brand', servingGrams: 85 })
    expect(result?.nutrients).toMatchObject({ ENERGY_KCAL: 141, PROTEIN: 25.8 })
  })
})
