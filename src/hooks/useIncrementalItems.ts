import { useState } from 'react'

export function useIncrementalItems<T>(items: T[], batchSize: number, resetKey = '') {
  const [page, setPage] = useState({ key: resetKey, limit: batchSize })
  const limit = page.key === resetKey ? page.limit : batchSize
  const visibleItems = items.slice(0, limit)
  return {
    visibleItems,
    shown: visibleItems.length,
    total: items.length,
    hasMore: limit < items.length,
    showMore: () => setPage({ key: resetKey, limit: limit + batchSize })
  }
}
