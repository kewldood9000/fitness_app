import type { BarcodeFoodSourceAdapter, ExternalFood } from './FoodSourceAdapter'
import { fatSecretAdapter } from './fatSecret/FatSecretAdapter'
import { openFoodFactsAdapter } from './openFoodFacts/OpenFoodFactsAdapter'
import { usdaAdapter } from './usda/UsdaFoodSourceAdapter'

export interface BarcodeLookupIssue {
  source: string
  message: string
}

export interface BarcodeLookupResult {
  matches: ExternalFood[]
  issues: BarcodeLookupIssue[]
}

const adapters: BarcodeFoodSourceAdapter[] = [openFoodFactsAdapter, fatSecretAdapter, usdaAdapter]

export async function lookupBarcodeAcrossSources(barcode: string): Promise<BarcodeLookupResult> {
  const availability = await Promise.all(adapters.map(async (adapter) => ({ adapter, available: await adapter.isAvailable?.() ?? true })))
  const enabled = availability.filter((item) => item.available).map((item) => item.adapter)
  const results = await Promise.allSettled(enabled.map((adapter) => adapter.lookupBarcode(barcode)))
  const matches: ExternalFood[] = []
  const issues: BarcodeLookupIssue[] = []
  results.forEach((result, index) => {
    const adapter = enabled[index]
    if (result.status === 'fulfilled') {
      if (result.value) matches.push(result.value)
      return
    }
    issues.push({ source: adapter.label, message: result.reason instanceof Error ? result.reason.message : `${adapter.label} lookup failed.` })
  })
  return { matches, issues }
}
