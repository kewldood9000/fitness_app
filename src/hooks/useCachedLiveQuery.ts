import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'

const queryCache = new Map<string, unknown>()
const pendingResult = Symbol('pending-live-query')

export function useCachedLiveQueryState<T>(cacheKey: string, query: () => T | Promise<T>, dependencies: unknown[]) {
  const cached = queryCache.has(cacheKey) ? queryCache.get(cacheKey) as T : pendingResult
  const result = useLiveQuery(query, dependencies, cached)
  const loading = result === pendingResult

  useEffect(() => {
    if (!loading) queryCache.set(cacheKey, result)
  }, [cacheKey, loading, result])

  return { value: loading ? undefined : result as T, loading }
}

export function useCachedLiveQuery<T>(cacheKey: string, query: () => T | Promise<T>, dependencies: unknown[]): T | undefined {
  return useCachedLiveQueryState(cacheKey, query, dependencies).value
}
