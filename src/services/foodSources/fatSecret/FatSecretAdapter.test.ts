import { describe, expect, it } from 'vitest'
import { toFatSecretFood, toGtin13 } from './FatSecretAdapter'

describe('FatSecret barcode mapping', () => {
  it('pads UPC-A barcodes to GTIN-13', () => {
    expect(toGtin13('023700016270')).toBe('0023700016270')
  })

  it('converts serving nutrition into the app per-100g model', () => {
    const food = toFatSecretFood({
      food: {
        food_id: '1234',
        food_name: 'Diced chicken breast',
        brand_name: 'Tyson',
        servings: {
          serving: [{
            serving_id: '99',
            serving_description: '3 oz',
            metric_serving_amount: 3,
            metric_serving_unit: 'oz',
            is_default: 1,
            calories: 120,
            protein: 22,
            carbohydrate: 2,
            fat: 2.5,
            sodium: 400
          }]
        }
      }
    }, '0023700016270')

    expect(food).toMatchObject({ source: 'FATSECRET', sourceFoodId: '1234', name: 'Diced chicken breast', brand: 'Tyson', servingName: '3 oz' })
    expect(food?.servingGrams).toBeCloseTo(85.0486, 3)
    expect(food?.nutrients.ENERGY_KCAL).toBeCloseTo(141.0958, 3)
    expect(food?.nutrients.PROTEIN).toBeCloseTo(25.8676, 3)
  })

  it('treats FatSecret error 211 as no barcode match', () => {
    expect(toFatSecretFood({ error: { code: 211, message: 'No food found' } }, '0000000000000')).toBeNull()
  })
})
