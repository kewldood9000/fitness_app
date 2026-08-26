import { describe, expect, it, vi } from 'vitest'
import type { BarcodeFoodSourceAdapter, ExternalFood } from './FoodSourceAdapter'
import { lookupBarcodeWithAdapters } from './barcodeLookupService'

const nutrients = { ENERGY_KCAL: 100, PROTEIN: 5, CARBOHYDRATE: 12, TOTAL_FAT: 3, FIBER: 1, TOTAL_SUGAR: 2, SODIUM: 50 }

function food(source: ExternalFood['source'], sourceFoodId: string): ExternalFood {
  return { source, sourceFoodId, name: `${source} food`, nutrients }
}

function adapter(label: string, lookupBarcode: BarcodeFoodSourceAdapter['lookupBarcode']): BarcodeFoodSourceAdapter {
  return { source: label === 'USDA' ? 'USDA' : 'OPEN_FOOD_FACTS', label, lookupBarcode }
}

describe('progressive barcode lookup', () => {
  it('publishes a fast match before slower databases finish', async () => {
    let finishSlow!: (value: ExternalFood | null) => void
    const slowResult = new Promise<ExternalFood | null>((resolve) => { finishSlow = resolve })
    const onMatch = vi.fn()
    const lookup = lookupBarcodeWithAdapters('123', [
      adapter('Open Food Facts', async () => food('OPEN_FOOD_FACTS', 'fast')),
      adapter('USDA', () => slowResult)
    ], { onMatch })

    await vi.waitFor(() => expect(onMatch).toHaveBeenCalledWith(expect.objectContaining({ sourceFoodId: 'fast' })))
    finishSlow(food('USDA', 'slow'))

    const result = await lookup
    expect(result.matches.map((item) => item.sourceFoodId)).toEqual(['fast', 'slow'])
    expect(result.timedOut).toBe(false)
  })

  it('aborts unfinished databases when the overall budget expires', async () => {
    vi.useFakeTimers()
    const slow = adapter('Open Food Facts', (_barcode, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const lookup = lookupBarcodeWithAdapters('123', [slow], { timeoutMs: 100 })

    await vi.advanceTimersByTimeAsync(100)

    await expect(lookup).resolves.toMatchObject({ matches: [], issues: [], timedOut: true })
    vi.useRealTimers()
  })
})
