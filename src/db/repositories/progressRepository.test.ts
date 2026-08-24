import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { settingsRepository } from '@/db/repositories/settingsRepository'
import { latestPreviousDayChange, lastCompletedWeekAverage, markPersonalRecords, movingAverage, progressRepository, weeklyAverage, weightHistory, type StrengthPoint } from './progressRepository'
import type { WeightLog } from '@/types/models'

function weight(date: string, value: number): WeightLog {
  return { id: date, date, weight: value, unit: 'lb', createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z` }
}

beforeEach(async () => {
  await db.open()
  await db.weightLogs.clear()
  await db.settings.clear()
})

describe('weight log management', () => {
  it('deletes only the selected weigh-in', async () => {
    await progressRepository.logWeight('2026-08-22', 190, 'lb')
    await progressRepository.logWeight('2026-08-23', 189, 'lb')
    const selected = (await progressRepository.getWeightLogs())[0]

    await progressRepository.deleteWeightLog(selected.id)

    expect(await progressRepository.getWeightLogs()).toMatchObject([{ date: '2026-08-23', weight: 189, unit: 'lb' }])
  })
})

describe('movingAverage', () => {
  it('uses the available trailing entries until the requested window is full', () => {
    expect(movingAverage([weight('2026-08-01', 200), weight('2026-08-02', 198), weight('2026-08-03', 196)], 2).map((item) => item.average)).toEqual([200, 199, 197])
  })
})

describe('weeklyAverage', () => {
  it('collapses daily weigh-ins into calendar-week averages', () => {
    expect(weeklyAverage([
      weight('2026-08-23', 200),
      weight('2026-08-24', 198),
      weight('2026-08-29', 196),
      weight('2026-08-30', 194)
    ])).toEqual([
      { date: '2026-08-23', weight: 198 },
      { date: '2026-08-30', weight: 194 }
    ])
  })
})

describe('weightHistory', () => {
  it('adds daily changes and Monday-to-Sunday summaries to the first row of each week', () => {
    const rows = weightHistory([
      weight('2026-07-06', 279),
      weight('2026-07-07', 276.6),
      weight('2026-07-12', 272),
      weight('2026-07-13', 272.4),
      weight('2026-07-14', 271.1),
      weight('2026-07-19', 267.9)
    ])

    expect(rows.map(({ date, dailyLoss, dailyNet, weekAverage, averageNet }) => ({ date, dailyLoss, dailyNet, weekAverage, averageNet }))).toEqual([
      { date: '2026-07-06', dailyLoss: 0, dailyNet: -7, weekAverage: 275.8667, averageNet: 0 },
      { date: '2026-07-07', dailyLoss: -2.4, dailyNet: undefined, weekAverage: undefined, averageNet: undefined },
      { date: '2026-07-12', dailyLoss: -4.6, dailyNet: undefined, weekAverage: undefined, averageNet: undefined },
      { date: '2026-07-13', dailyLoss: 0.4, dailyNet: -4.5, weekAverage: 270.4667, averageNet: -5.4 },
      { date: '2026-07-14', dailyLoss: -1.3, dailyNet: undefined, weekAverage: undefined, averageNet: undefined },
      { date: '2026-07-19', dailyLoss: -3.2, dailyNet: undefined, weekAverage: undefined, averageNet: undefined }
    ])
  })
})

describe('latestPreviousDayChange', () => {
  it('compares the latest weigh-in with the exact previous calendar day', () => {
    expect(latestPreviousDayChange([
      weight('2026-08-21', 255.4),
      weight('2026-08-22', 258),
      weight('2026-08-23', 257.2)
    ])).toBe(-0.8)
  })

  it('does not treat an older weigh-in as yesterday', () => {
    expect(latestPreviousDayChange([
      weight('2026-08-20', 256.6),
      weight('2026-08-23', 258)
    ])).toBeUndefined()
  })
})

describe('automatic TDEE calculation weight', () => {
  const completedWeek = [
    weight('2026-08-17', 257.4), weight('2026-08-18', 257.3), weight('2026-08-19', 258.2),
    weight('2026-08-20', 256.6), weight('2026-08-21', 255.4), weight('2026-08-22', 258), weight('2026-08-23', 258)
  ]

  it('uses the previous completed Monday-to-Sunday average', () => {
    expect(lastCompletedWeekAverage([...completedWeek, weight('2026-08-24', 250)], '2026-08-24', 'lb')).toEqual({
      startDate: '2026-08-17', endDate: '2026-08-23', weight: 257.2714, unit: 'lb', entries: 7
    })
  })

  it('refreshes the saved calorie target after completed-week logs change', async () => {
    await settingsRepository.set('body-profile', { sex: 'male', age: 30, heightCm: 180, weightKg: 120, activityFactor: 1.55 })
    await settingsRepository.set('progress-goals', { weeklyLossMode: 'fixed', weeklyLossValue: 1, weightUnit: 'lb' })
    await settingsRepository.set('nutrition-goals', { protein: 180 })
    await db.weightLogs.bulkPut(completedWeek.slice(0, -1))

    await progressRepository.logWeight('2026-08-23', 258, 'lb', undefined, '2026-08-24')

    expect((await settingsRepository.get('nutrition-goals'))?.value).toMatchObject({
      protein: 180,
      automaticTdee: { source: 'last-completed-week-average', weekStart: '2026-08-17', weekEnd: '2026-08-23', weight: 257.2714, unit: 'lb', entries: 7 }
    })
    const logged = await db.weightLogs.where('date').equals('2026-08-23').first()
    await progressRepository.deleteWeightLog(logged!.id, '2026-08-24')
    expect((await settingsRepository.get('nutrition-goals'))?.value).toMatchObject({ automaticTdee: { entries: 6 } })
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
