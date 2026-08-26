import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, BarChart3, ChevronDown, Minus, Plus, Scale, Trash2, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { latestPreviousDayChange, progressRepository, weeklyAverage, weightHistory } from '@/db/repositories/progressRepository'
import { settingsRepository } from '@/db/repositories/settingsRepository'
import { workoutRepository } from '@/db/repositories/workoutRepository'
import { useIncrementalItems } from '@/hooks/useIncrementalItems'
import { calculateWeightGoalProgress, convertWeight, plannedGoalDate, plannedWeightForDate, type ProgressGoalSettings } from '@/utils/calorieEstimator'
import { addDays, toDateKey } from '@/utils/dates'

type Range = '1m' | '3m' | '6m' | 'all'
type TrendMode = 'daily' | 'weekly'

function Sheet({ onClose, defaultUnit = 'lb' }: { onClose: () => void; defaultUnit?: 'lb' | 'kg' }) {
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(toDateKey(new Date()))
  const [note, setNote] = useState('')
  const [unit, setUnit] = useState<'lb' | 'kg'>(defaultUnit)
  const titleId = useId()

  async function save() {
    const value = Number(weight)
    if (!value) return
    await progressRepository.logWeight(date, value, unit, note)
    onClose()
  }

  return <div aria-labelledby={titleId} aria-modal="true" className="modal-backdrop" role="dialog"><div className="modal-panel">
    <div className="modal-header flex items-center justify-between px-5 pb-4 pt-5"><h2 className="text-lg font-semibold text-slate-50" id={titleId}>Log bodyweight</h2><button aria-label="Close" className="workout-icon-button" onClick={onClose}><X className="size-4" /></button></div>
    <div className="modal-scroll space-y-3 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-[1fr_5rem] gap-3"><label className="field-label">Weight<input autoFocus className="field-input" inputMode="decimal" min="0.1" onChange={(event) => setWeight(event.target.value)} placeholder="0.0" step="0.1" type="number" value={weight} /></label><label className="field-label">Unit<select className="field-input" onChange={(event) => setUnit(event.target.value as 'lb' | 'kg')} value={unit}><option value="lb">lb</option><option value="kg">kg</option></select></label></div>
      <label className="field-label">Date<input className="field-input" onChange={(event) => setDate(event.target.value)} type="date" value={date} /></label>
      <label className="field-label">Note <span className="font-normal text-slate-600">(optional)</span><input className="field-input" onChange={(event) => setNote(event.target.value)} placeholder="Optional note" value={note} /></label>
      <button className="button-primary mt-2 w-full" disabled={!Number(weight)} onClick={() => void save()}>Save weigh-in</button>
    </div>
  </div></div>
}

function number(value?: number, digits = 1) { return value == null ? '—' : Number(value.toFixed(digits)).toString() }
function change(current?: number, past?: number) { return current == null || past == null ? undefined : current - past }

export function ProgressPage() {
  const [range, setRange] = useState<Range>('3m')
  const [trendMode, setTrendMode] = useState<TrendMode>('weekly')
  const [logging, setLogging] = useState(false)
  const [showWeightHistory, setShowWeightHistory] = useState(false)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const logs = useLiveQuery(() => progressRepository.getWeightLogs(), [])
  const goalsSetting = useLiveQuery(() => settingsRepository.get('progress-goals'), [])
  const workoutSetting = useLiveQuery(() => settingsRepository.get('workout-preferences'), [])
  const exercises = useLiveQuery(() => workoutRepository.getExercises(), [])
  const strength = useLiveQuery(() => selectedExerciseId ? progressRepository.getStrengthProgress(selectedExerciseId) : Promise.resolve([]), [selectedExerciseId])
  const goals = (goalsSetting?.value as ProgressGoalSettings | undefined) ?? {}
  const preferredUnit = (workoutSetting?.value as { unit?: 'lb' | 'kg' } | undefined)?.unit ?? 'lb'
  const current = logs?.at(-1)
  const unit = current?.unit ?? preferredUnit
  const normalizedLogs = useMemo(() => (logs ?? []).map((item) => ({ ...item, weight: convertWeight(item.weight, item.unit, unit), unit })), [logs, unit])
  const goalWeightDisplay = goals.goalWeight == null ? undefined : convertWeight(goals.goalWeight, goals.weightUnit ?? unit, unit)
  const todayKey = toDateKey(new Date())
  const todayDate = new Date(`${todayKey}T12:00:00`)
  const daysInRange = range === '1m' ? 31 : range === '3m' ? 92 : range === '6m' ? 184 : undefined
  const rangeStartKey = daysInRange == null ? undefined : toDateKey(addDays(todayDate, -daysInRange))
  const trackingStartKey = normalizedLogs[0]?.date ?? goals.trendStartDate ?? todayKey
  const axisStartKey = rangeStartKey && rangeStartKey > trackingStartKey ? rangeStartKey : trackingStartKey
  const calculatedGoalDate = plannedGoalDate(goals)
  const axisEndKey = range === 'all' && calculatedGoalDate && calculatedGoalDate > todayKey ? calculatedGoalDate : todayKey
  const axisDomain: [number, number] = [new Date(`${axisStartKey}T12:00:00`).getTime(), new Date(`${axisEndKey}T12:00:00`).getTime()]
  const axisTickCount = range === '1m' ? 4 : range === '3m' ? 5 : 6
  const axisTicks = Array.from({ length: axisTickCount }, (_, index) => axisDomain[0] + (axisDomain[1] - axisDomain[0]) * index / (axisTickCount - 1))
  const visibleWeights = useMemo(() => {
    return normalizedLogs.filter((item) => item.date >= axisStartKey && item.date <= axisEndKey)
  }, [normalizedLogs, axisStartKey, axisEndKey])
  const actualPoints = (trendMode === 'weekly' ? weeklyAverage(visibleWeights) : visibleWeights.map((item) => ({ date: item.date, weight: item.weight })))
    .map((item, index) => index === 0 && item.date < axisStartKey ? { ...item, date: axisStartKey } : item)
  const chartPoints = new Map<string, { dateKey: string; date: string; timestamp: number; weight?: number; goal?: number }>()
  const labelFor = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
  const timestampFor = (date: string) => new Date(`${date}T12:00:00`).getTime()
  actualPoints.forEach((item) => chartPoints.set(item.date, { dateKey: item.date, date: labelFor(item.date), timestamp: timestampFor(item.date), weight: Math.round(item.weight * 10) / 10 }))
  if (goals.trendStartDate) {
    const goalDates = new Set(actualPoints.map((item) => item.date))
    let start = new Date(`${goals.trendStartDate}T12:00:00`)
    const cutoff = new Date(`${axisStartKey}T12:00:00`)
    if (start < cutoff) start = cutoff
    const end = new Date(`${axisEndKey}T12:00:00`)
    for (let date = start; date <= end; date = addDays(date, 7)) goalDates.add(toDateKey(date))
    goalDates.add(todayKey)
    goalDates.add(axisEndKey)
    goalDates.forEach((date) => {
      const planned = plannedWeightForDate(goals, date)
      if (planned == null) return
      const goal = convertWeight(planned, goals.weightUnit ?? unit, unit)
      chartPoints.set(date, { ...(chartPoints.get(date) ?? { dateKey: date, date: labelFor(date), timestamp: timestampFor(date) }), goal })
    })
  }
  const chartData = [...chartPoints.values()].sort((firstPoint, secondPoint) => firstPoint.timestamp - secondPoint.timestamp)
  const chartWeights = chartData.flatMap((item) => [item.weight, item.goal].filter((value): value is number => value != null))
  const dataFloor = chartWeights.length ? Math.min(...chartWeights) : 0
  const dataCeiling = chartWeights.length ? Math.max(...chartWeights) : 1
  const yAxisFloor = goalWeightDisplay != null && goalWeightDisplay < dataCeiling ? goalWeightDisplay : Math.floor(dataFloor - 1)
  const yAxisCeiling = Math.max(yAxisFloor + 1, Math.ceil(dataCeiling + 1))
  const yAxisDomain: [number, number] = [yAxisFloor, yAxisCeiling]
  const yAxisTicks = Array.from({ length: 4 }, (_, index) => Math.round((yAxisFloor + (yAxisCeiling - yAxisFloor) * index / 3) * 10) / 10)
  const currentDisplay = normalizedLogs.at(-1)
  const previousDayChange = latestPreviousDayChange(normalizedLogs)
  const previousDayStatus = previousDayChange == null
    ? { label: 'No weigh-in from the previous day', className: 'bg-slate-800/70 text-slate-400', Icon: Minus }
    : previousDayChange < 0
      ? { label: `${Math.abs(previousDayChange).toFixed(1)} ${unit} lost since yesterday`, className: 'bg-emerald-400/10 text-emerald-300', Icon: ArrowDown }
      : previousDayChange > 0
        ? { label: `${previousDayChange.toFixed(1)} ${unit} gained since yesterday`, className: 'bg-rose-400/10 text-rose-300', Icon: ArrowUp }
        : { label: `No change since yesterday`, className: 'bg-slate-800/70 text-slate-300', Icon: Minus }
  const first = normalizedLogs[0]
  const lookback = (days: number) => currentDisplay ? normalizedLogs.filter((item) => new Date(`${item.date}T12:00:00`) <= new Date(new Date(`${currentDisplay.date}T12:00:00`).getTime() - days * 86_400_000)).at(-1) : undefined
  const sevenPast = lookback(7)
  const thirtyPast = lookback(30)
  const strengthChart = (strength ?? []).map((item) => ({ date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${item.date}T12:00:00`)), top: item.topWeight, volume: item.volume, oneRm: item.estimated1RM }))
  const latestStrength = strength?.at(-1)
  const firstStrength = strength?.[0]
  const latestPrs = latestStrength ? [latestStrength.isWeightPr && 'Weight PR', latestStrength.isRepPr && 'Rep PR', latestStrength.isVolumePr && 'Volume PR', latestStrength.isEstimated1RMPr && '1RM PR'].filter(Boolean) : []
  const goalProgress = currentDisplay ? calculateWeightGoalProgress(goals, currentDisplay.weight, unit) : undefined
  const historyRows = useMemo(() => weightHistory(normalizedLogs), [normalizedLogs])
  const pagedHistory = useIncrementalItems(historyRows, 30)
  const historyDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
  const historyNumber = (value: number | undefined, digits: number) => value == null ? '' : value.toFixed(digits)

  return <div className="space-y-5 pb-3 pt-2">
    <section><p className="eyebrow">Progress</p><h1 className="page-title">Trends, not noise</h1><p className="mt-1.5 text-sm text-slate-400">Bodyweight and strength remain private on this device.</p></section>
    <button className="settings-row w-full rounded-[1.25rem] border border-white/[0.07]" onClick={() => setLogging(true)}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Scale className="size-[18px]" /></span><span className="min-w-0 flex-1 text-left"><strong>Log bodyweight</strong><small>Add today’s weigh-in and track your trend</small></span><Plus className="size-5 shrink-0 text-sky-300" /></button>
    <section className="dashboard-card">
      <div className="flex items-start justify-between"><div><p className="eyebrow">Current bodyweight</p><p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-slate-50">{currentDisplay ? `${number(currentDisplay.weight)} ${unit}` : '—'}</p><p className="mt-1 text-sm text-slate-500">{logs?.length ? `${logs.length} weigh-ins logged` : 'Log your first weigh-in'}</p>{currentDisplay && <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${previousDayStatus.className}`}><previousDayStatus.Icon className="size-3.5" />{previousDayStatus.label}</span>}</div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300"><Scale className="size-5" /></span></div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-4">{([['7-day', change(currentDisplay?.weight, sevenPast?.weight)], ['30-day', change(currentDisplay?.weight, thirtyPast?.weight)], ['Total', change(currentDisplay?.weight, first?.weight)], ['Goal', goalWeightDisplay == null || currentDisplay == null ? undefined : goalWeightDisplay - currentDisplay.weight]] as const).map(([label, value]) => <div key={label}><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-200">{value === undefined ? '—' : `${Number(value).toFixed(1)} ${unit}`}</p></div>)}</div>
      {goalProgress && <div className="goal-progress-card"><div className="flex items-start justify-between gap-3"><div><p>Weight-loss goal</p><strong>{goalProgress.remaining <= 0 ? 'Goal reached!' : goalProgress.lost >= 0 ? `${number(goalProgress.lost)} ${unit} lost · ${number(goalProgress.remaining)} ${unit} left!` : `${number(Math.abs(goalProgress.lost))} ${unit} above start · ${number(goalProgress.remaining)} ${unit} left`}</strong></div><span>{Math.round(goalProgress.percentComplete)}%</span></div><div aria-label={`${Math.round(goalProgress.percentComplete)} percent of weight goal complete`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(goalProgress.percentComplete)} className="goal-progress-track" role="progressbar"><i style={{ width: `${goalProgress.percentComplete}%` }} /></div><div className="flex justify-between"><small>Started {number(goalProgress.startWeight)} {unit}</small><small>Goal {number(goalProgress.goalWeight)} {unit}</small></div></div>}
    </section>
    <section className="chart-card">
      <div className="flex items-center justify-between gap-3"><h2 className="section-title">Bodyweight trend</h2><div className="flex rounded-lg bg-slate-800 p-0.5">{(['1m', '3m', '6m', 'all'] as Range[]).map((item) => <button className={`range-button ${range === item ? 'range-button-active' : ''}`} key={item} onClick={() => setRange(item)}>{item}</button>)}</div></div>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-zinc-950/55 p-1"><button aria-pressed={trendMode === 'daily'} className={`goal-mode-button ${trendMode === 'daily' ? 'goal-mode-button-active' : ''}`} onClick={() => setTrendMode('daily')}>Daily weight</button><button aria-pressed={trendMode === 'weekly'} className={`goal-mode-button ${trendMode === 'weekly' ? 'goal-mode-button-active' : ''}`} onClick={() => setTrendMode('weekly')}>Weekly average</button></div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-zinc-500"><span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-sky-300" />{trendMode === 'weekly' ? 'Weekly average' : 'Daily weight'}</span>{goals.trendStartDate && <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 border-t border-dashed border-amber-300" />Goal pace</span>}</div>
      {chartData.length < 2 ? <div className="chart-empty"><Scale className="size-5" />Log bodyweight or set a calorie goal to reveal your trend.</div> : <div className="mt-4 h-56"><ResponsiveContainer height="100%" width="100%"><LineChart data={chartData} margin={{ top: 5, right: 4, bottom: 0, left: -18 }}><CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} /><XAxis allowDataOverflow dataKey="timestamp" domain={axisDomain} interval="preserveStartEnd" minTickGap={18} scale="time" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(timestamp) => labelFor(toDateKey(new Date(Number(timestamp))))} tickLine={false} ticks={axisTicks} type="number" /><YAxis allowDataOverflow domain={yAxisDomain} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} ticks={yAxisTicks} /><Tooltip contentStyle={{ border: '1px solid #334155', borderRadius: 12, background: '#182238', color: '#e8edf5' }} labelFormatter={(timestamp) => labelFor(toDateKey(new Date(Number(timestamp))))} /><Line connectNulls dataKey="weight" dot={{ r: trendMode === 'daily' ? 2 : 3, fill: '#72baff' }} name={`${trendMode === 'weekly' ? 'Weekly average' : 'Daily weight'} (${unit})`} stroke="#72baff" strokeWidth={2} type="monotone" />{goals.trendStartDate && <Line connectNulls dataKey="goal" dot={false} name="Goal pace" stroke="#fcd34d" strokeDasharray="5 4" strokeWidth={2} type="monotone" />}</LineChart></ResponsiveContainer></div>}
      <div className="mt-4 border-t border-white/[0.07] pt-3">
        <button aria-expanded={showWeightHistory} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.04]" onClick={() => setShowWeightHistory((currentValue) => !currentValue)}><span>Weight history <small className="ml-1 font-normal text-slate-500">({historyRows.length})</small></span><ChevronDown className={`size-4 text-sky-300 transition-transform ${showWeightHistory ? 'rotate-180' : ''}`} /></button>
        {showWeightHistory && (historyRows.length === 0 ? <p className="mt-2 rounded-xl bg-zinc-900/70 px-4 py-5 text-center text-sm text-zinc-500">No weigh-ins logged yet.</p> : <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.07]">
          <table className="min-w-[43rem] w-full border-collapse text-right text-xs">
            <thead className="bg-slate-950/80 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500"><tr><th className="px-3 py-3 text-left">Date</th><th className="px-2 py-3">Weight</th><th className="px-2 py-3">Daily Loss</th><th className="px-2 py-3">Daily Net</th><th className="px-2 py-3">Week Avg</th><th className="px-3 py-3">Avg. Net</th></tr></thead>
            <tbody>{pagedHistory.visibleItems.map((entry) => <tr className="border-t border-white/[0.06] text-slate-300" key={entry.id}><td className="whitespace-nowrap px-3 py-2.5 text-left font-semibold"><span className="inline-flex items-center gap-1.5">{historyDate(entry.date)}<button aria-label={`Delete ${number(entry.weight)} ${unit} weigh-in from ${entry.date}`} className="rounded-md p-1 text-slate-600 transition hover:bg-rose-400/10 hover:text-rose-300" onClick={() => { if (window.confirm(`Delete the ${number(entry.weight)} ${unit} weigh-in from ${entry.date}?`)) void progressRepository.deleteWeightLog(entry.id) }}><Trash2 className="size-3" /></button></span></td><td className="whitespace-nowrap px-2 py-2.5 font-semibold">{historyNumber(entry.weight, 1)}</td><td className="px-2 py-2.5">{historyNumber(entry.dailyLoss, 1)}</td><td className="px-2 py-2.5 text-sky-300">{historyNumber(entry.dailyNet, 1)}</td><td className="px-2 py-2.5 text-sky-300">{historyNumber(entry.weekAverage, 2)}</td><td className="px-3 py-2.5 text-sky-300">{historyNumber(entry.averageNet, 2)}</td></tr>)}</tbody>
          </table>
        </div>)}
        {showWeightHistory && <LoadMoreButton onClick={pagedHistory.showMore} shown={pagedHistory.shown} total={pagedHistory.total} />}
        {showWeightHistory && historyRows.length > 0 && <p className="mt-2 px-1 text-[10px] leading-4 text-slate-600">Daily Loss compares consecutive weigh-ins. Weekly figures use Monday–Sunday periods and appear on each week’s first entry.</p>}
      </div>
    </section>
    <section className="chart-card">
      <div className="flex items-center justify-between gap-3"><div><h2 className="section-title">Strength progress</h2><p className="mt-1 text-xs text-slate-500">Top working set and estimated 1RM where applicable.</p></div><BarChart3 className="size-5 text-sky-300" /></div>
      <label className="field-label mt-4">Exercise<select className="field-input" onChange={(event) => setSelectedExerciseId(event.target.value)} value={selectedExerciseId}><option value="">Choose an exercise</option>{exercises?.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label>
      {!selectedExerciseId ? <div className="chart-empty">Choose an exercise to see completed-session strength history.</div> : strengthChart.length < 1 ? <div className="chart-empty">Complete a session with this exercise to begin tracking strength.</div> : <><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-800/65 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Latest top set</p><p className="mt-1 text-lg font-semibold text-slate-200">{latestStrength?.topWeight} × {latestStrength?.topReps}</p></div><div className="rounded-xl bg-slate-800/65 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Change</p><p className="mt-1 text-lg font-semibold text-slate-200">{firstStrength && latestStrength ? `${number(latestStrength.topWeight - firstStrength.topWeight)} ${preferredUnit}` : '—'}</p></div></div>{latestPrs.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{latestPrs.map((label) => <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-bold text-amber-200" key={String(label)}>{label}</span>)}</div>}<div className="mt-4 h-52"><ResponsiveContainer height="100%" width="100%"><LineChart data={strengthChart} margin={{ top: 5, right: 4, bottom: 0, left: -18 }}><CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" minTickGap={30} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} /><YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} /><Tooltip contentStyle={{ border: '1px solid #334155', borderRadius: 12, background: '#182238', color: '#e8edf5' }} /><Line dataKey="top" dot={{ r: 2, fill: '#72baff' }} name="Top weight" stroke="#72baff" strokeWidth={2} type="monotone" /><Line dataKey="oneRm" dot={false} name="Est. 1RM" stroke="#fbbf24" strokeWidth={1.5} type="monotone" /></LineChart></ResponsiveContainer></div></>}
    </section>
    {logging && <Sheet defaultUnit={preferredUnit} onClose={() => setLogging(false)} />}
  </div>
}
