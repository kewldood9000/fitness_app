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
  timedOut: boolean
}

const adapters: BarcodeFoodSourceAdapter[] = [openFoodFactsAdapter, fatSecretAdapter, usdaAdapter]

export interface BarcodeLookupOptions {
  timeoutMs?: number
  signal?: AbortSignal
  onMatch?: (food: ExternalFood) => void
}

const DEFAULT_LOOKUP_BUDGET_MS = 3_000

export async function lookupBarcodeWithAdapters(
  barcode: string,
  sourceAdapters: BarcodeFoodSourceAdapter[],
  options: BarcodeLookupOptions = {}
): Promise<BarcodeLookupResult> {
  const controller = new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller.abort()
  if (options.signal?.aborted) abortFromCaller()
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? DEFAULT_LOOKUP_BUDGET_MS)

  const matches: ExternalFood[] = []
  const issues: BarcodeLookupIssue[] = []
  const seen = new Set<string>()

  try {
    const availability = await Promise.all(sourceAdapters.map(async (adapter) => ({ adapter, available: await adapter.isAvailable?.() ?? true })))
    const enabled = availability.filter((item) => item.available).map((item) => item.adapter)
    const lookups = enabled.map(async (adapter) => {
      try {
        const food = await adapter.lookupBarcode(barcode, controller.signal)
        if (!food || controller.signal.aborted) return
        const key = `${food.source}:${food.sourceFoodId}`
        if (seen.has(key)) return
        seen.add(key)
        matches.push(food)
        options.onMatch?.(food)
      } catch (error) {
        if (controller.signal.aborted) return
        issues.push({ source: adapter.label, message: error instanceof Error ? error.message : `${adapter.label} lookup failed.` })
      }
    })
    await Promise.allSettled(lookups)
    return { matches, issues, timedOut }
  } finally {
    globalThis.clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

export async function lookupBarcodeAcrossSources(barcode: string, options?: BarcodeLookupOptions): Promise<BarcodeLookupResult> {
  return lookupBarcodeWithAdapters(barcode, adapters, options)
}
