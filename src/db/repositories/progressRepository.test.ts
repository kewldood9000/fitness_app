import { describe, expect, it } from 'vitest'
import { markPersonalRecords, movingAverage, type StrengthPoint } from './progressRepository'
import type { WeightLog } from '@/types/models'

function weight(date: string, value: number): WeightLog {
  return { id: date, date, weight: value, unit: 'lb', createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z` }
}

describe('movingAverage', () => {
  it('uses the available trailing entries until the requested window is full', () => {
    expect(movingAverage([weight('2026-08-01', 200), weight('2026-08-02', 198), weight('2026-08-03', 196)], 2).map((item) => item.average)).toEqual([200, 199, 197])
  })
})

describe('markPersonalRecords', () => {
  it('marks strictly improved weight, volume, and valid estimated 1RM records', () => {
    const baseline = (date: string, topWeight: number, topReps: number, volume: number, estimated1RM?: number): StrengthPoint => ({ date, sessionId: date, topWeight, topReps, volume, estimated1RM, isWeightPr: false, isRepPr: false, isVolumePr: false, isEstimated1RMPr: false })
    const records = markPersonalRecords([baseline('2026-08-01', 100, 5, 500, 116.7), baseline('2026-08-08', 105, 5, 525, 122.5), baseline('2026-08-15', 105, 6, 600, 120)])
    expect(records.map(({ isWeightPr, isRepPr, isVolumePr, isEstimated1RMPr }) => ({ isWeightPr, isRepPr, isVolumePr, isEstimated1RMPr }))).toEqual([
      { isWeightPr: false, isRepPr: false, isVolumePr: false, isEstimated1RMPr: false },
      { isWeightPr: true, isRepPr: false, isVolumePr: true, isEstimated1RMPr: true },
      { isWeightPr: false, isRepPr: true, isVolumePr: true, isEstimated1RMPr: false }
    ])
  })
})
