import { describe, expect, it } from 'vitest'
import { toOpenFoodFactsFood } from './OpenFoodFactsAdapter'

describe('Open Food Facts barcode mapping', () => {
  it('maps per-100g nutrition and converts sodium grams to milligrams', () => {
    const food = toOpenFoodFactsFood({
      status: 1,
      code: '0737628064502',
      product: {
        code: '0737628064502',
        product_name: 'Thai peanut noodles',
        brands: 'Simply Asia',
        serving_size: '0.333 PACKAGE (52 g)',
        serving_quantity: 52,
        nutriments: {
          'energy-kcal_100g': 385,
          proteins_100g: 9.62,
          carbohydrates_100g: 71.15,
          fat_100g: 7.69,
          fiber_100g: 1.9,
          sugars_100g: 13.46,
          sodium_100g: 0.288,
          sodium_unit: 'g'
        }
      }
    }, '737628064502')

    expect(food).toMatchObject({ source: 'OPEN_FOOD_FACTS', sourceFoodId: '0737628064502', name: 'Thai peanut noodles', brand: 'Simply Asia', servingGrams: 52 })
    expect(food?.nutrients).toMatchObject({ ENERGY_KCAL: 385, PROTEIN: 9.62, CARBOHYDRATE: 71.15, TOTAL_FAT: 7.69, SODIUM: 288 })
  })

  it('returns no match for a missing product', () => {
    expect(toOpenFoodFactsFood({ status: 0 }, '0000000000000')).toBeNull()
  })
})
