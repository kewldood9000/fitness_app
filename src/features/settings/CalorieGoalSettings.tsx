import { useLiveQuery } from 'dexie-react-hooks'
import { Calculator, Check, Info } from 'lucide-react'
import { useState } from 'react'
import { progressRepository } from '@/db/repositories/progressRepository'
import { settingsRepository } from '@/db/repositories/settingsRepository'
import type { WeightUnit } from '@/types/models'
import {
  activityLevels,
  convertWeight,
  estimateCalories,
  type BodyProfile,
  type EquationSex,
  type ProgressGoalSettings,
  type WeeklyLossMode
} from '@/utils/calorieEstimator'
import { toDateKey } from '@/utils/dates'

interface NutritionGoals { calories?: number; protein?: number; carbs?: number; fat?: number }
type GoalInputMode = 'target' | 'amount'

function numeric(value: string): number { return Number(value) || 0 }

function CalorieGoalForm({ profile, nutrition, progress, unit, latestWeight }: {
  profile: Partial<BodyProfile>
  nutrition: NutritionGoals
  progress: ProgressGoalSettings
  unit: WeightUnit
  latestWeight?: { date: string; weight: number; unit: WeightUnit; note?: string }
}) {
  const initialHeightInches = (profile.heightCm ?? 0) / 2.54
  const [sex, setSex] = useState<EquationSex>(profile.sex ?? 'male')
  const [age, setAge] = useState(profile.age ? String(profile.age) : '')
  const [heightFeet, setHeightFeet] = useState(profile.heightCm ? String(Math.floor(initialHeightInches / 12)) : '')
  const [heightInches, setHeightInches] = useState(profile.heightCm ? String(Math.round(initialHeightInches % 12)) : '')
  const [heightCm, setHeightCm] = useState(profile.heightCm ? String(Math.round(profile.heightCm)) : '')
  const initialWeight = latestWeight
    ? convertWeight(latestWeight.weight, latestWeight.unit, unit)
    : profile.weightKg ? convertWeight(profile.weightKg, 'kg', unit) : 0
  const storedGoalWeight = progress.goalWeight == null
    ? 0
    : convertWeight(progress.goalWeight, progress.weightUnit ?? unit, unit)
  const [weight, setWeight] = useState(initialWeight ? String(Math.round(initialWeight * 10) / 10) : '')
  const [goalWeight, setGoalWeight] = useState(storedGoalWeight ? String(Math.round(storedGoalWeight * 10) / 10) : '')
  const [goalAmount, setGoalAmount] = useState(initialWeight && storedGoalWeight ? String(Math.round((initialWeight - storedGoalWeight) * 10) / 10) : '')
  const [goalInputMode, setGoalInputMode] = useState<GoalInputMode>(storedGoalWeight ? 'target' : 'amount')
  const [activityFactor, setActivityFactor] = useState(String(profile.activityFactor ?? 1.375))
  const [lossMode, setLossMode] = useState<WeeklyLossMode>(progress.weeklyLossMode ?? 'fixed')
  const [lossValue, setLossValue] = useState(String(progress.weeklyLossValue ?? (progress.weeklyChange ? Math.abs(progress.weeklyChange) : 1)))
  const [saved, setSaved] = useState(false)

  const resolvedHeightCm = unit === 'lb'
    ? (numeric(heightFeet) * 12 + numeric(heightInches)) * 2.54
    : numeric(heightCm)
  const currentWeight = numeric(weight)
  const targetWeight = goalInputMode === 'amount' ? currentWeight - numeric(goalAmount) : numeric(goalWeight)
  const lossRate = numeric(lossValue)
  const profileForEstimate: BodyProfile = {
    sex,
    age: numeric(age),
    heightCm: resolvedHeightCm,
    weightKg: convertWeight(currentWeight, unit, 'kg'),
    activityFactor: numeric(activityFactor)
  }
  const estimate = profileForEstimate.age < 18 || !profileForEstimate.heightCm || !profileForEstimate.weightKg || profileForEstimate.activityFactor < 0.8 || !lossRate
    ? undefined
    : estimateCalories(profileForEstimate, { mode: lossMode, value: lossRate, unit })
  const targetValid = targetWeight > 0 && targetWeight < currentWeight
  const canSave = Boolean(estimate && estimate.calorieTarget > 0 && targetValid)
  const fastLoss = Boolean(estimate && (estimate.weeklyLossLb > 2 || (lossMode === 'percent' && lossRate > 1)))
  const lowCalories = Boolean(estimate && estimate.calorieTarget < (sex === 'male' ? 1500 : 1200))
  const selectedActivity = activityLevels.find((level) => level.value === numeric(activityFactor))

  async function save() {
    if (!estimate || !canSave) return
    const today = toDateKey(new Date())
    await Promise.all([
      settingsRepository.set('body-profile', profileForEstimate),
      settingsRepository.set('nutrition-goals', { ...nutrition, calories: estimate.calorieTarget }),
      progressRepository.logWeight(today, currentWeight, unit, latestWeight?.date === today ? latestWeight.note : 'Calorie goal starting weight'),
      settingsRepository.set('progress-goals', {
        ...progress,
        startingWeight: currentWeight,
        goalWeight: targetWeight,
        weeklyChange: lossMode === 'fixed' ? -lossRate : undefined,
        weeklyLossMode: lossMode,
        weeklyLossValue: lossRate,
        trendStartDate: today,
        trendStartWeight: currentWeight,
        weightUnit: unit
      } satisfies ProgressGoalSettings)
    ])
    setSaved(true)
  }

  return <section className="settings-card">
    <div className="mb-4 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Calculator className="size-5" /></span><div><h2 className="section-title">Calorie & weight-loss goal</h2><p className="mt-1 text-xs leading-5 text-slate-500">Estimate BMR with Mifflin–St Jeor, then apply activity and your weekly loss goal.</p></div></div>

    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">Equation sex<select className="field-input" onChange={(event) => { setSaved(false); setSex(event.target.value as EquationSex) }} value={sex}><option value="male">Male</option><option value="female">Female</option></select></label>
        <label className="field-label">Age<input className="field-input" inputMode="numeric" min="18" onChange={(event) => { setSaved(false); setAge(event.target.value) }} placeholder="Years" type="number" value={age} /></label>
      </div>
      {unit === 'lb' ? <div className="grid grid-cols-2 gap-3"><label className="field-label">Height (feet)<input className="field-input" inputMode="numeric" min="3" onChange={(event) => { setSaved(false); setHeightFeet(event.target.value) }} type="number" value={heightFeet} /></label><label className="field-label">Height (inches)<input className="field-input" inputMode="numeric" max="11" min="0" onChange={(event) => { setSaved(false); setHeightInches(event.target.value) }} type="number" value={heightInches} /></label></div> : <label className="field-label">Height (cm)<input className="field-input" inputMode="decimal" min="100" onChange={(event) => { setSaved(false); setHeightCm(event.target.value) }} type="number" value={heightCm} /></label>}
      <label className="field-label">Current weight ({unit})<input className="field-input" inputMode="decimal" min="1" onChange={(event) => { setSaved(false); setWeight(event.target.value) }} type="number" value={weight} /></label>
      <div>
        <p className="field-label mb-2">Set weight goal by</p>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-950/55 p-1"><button aria-pressed={goalInputMode === 'amount'} className={`goal-mode-button ${goalInputMode === 'amount' ? 'goal-mode-button-active' : ''}`} onClick={() => { setSaved(false); setGoalInputMode('amount'); if (!goalAmount && currentWeight > numeric(goalWeight)) setGoalAmount(String(Math.round((currentWeight - numeric(goalWeight)) * 10) / 10)) }} type="button">Amount to lose</button><button aria-pressed={goalInputMode === 'target'} className={`goal-mode-button ${goalInputMode === 'target' ? 'goal-mode-button-active' : ''}`} onClick={() => { setSaved(false); setGoalInputMode('target'); if (!goalWeight && numeric(goalAmount)) setGoalWeight(String(Math.round((currentWeight - numeric(goalAmount)) * 10) / 10)) }} type="button">Target weight</button></div>
        {goalInputMode === 'amount' ? <label className="field-label mt-3">Amount to lose ({unit})<input className="field-input" inputMode="decimal" min="0.1" onChange={(event) => { setSaved(false); setGoalAmount(event.target.value) }} placeholder={`e.g. 20 ${unit}`} type="number" value={goalAmount} /></label> : <label className="field-label mt-3">Goal weight ({unit})<input className="field-input" inputMode="decimal" min="1" onChange={(event) => { setSaved(false); setGoalWeight(event.target.value) }} type="number" value={goalWeight} /></label>}
        {targetValid && <p className="mt-2 text-xs text-zinc-500">Goal weight: {Math.round(targetWeight * 10) / 10} {unit}</p>}
      </div>
      {!targetValid && (goalAmount || goalWeight) && <p className="text-xs text-amber-200">Your weight-loss goal must be greater than zero and below current weight.</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">Activity preset<select className="field-input" onChange={(event) => { setSaved(false); if (event.target.value !== 'custom') setActivityFactor(event.target.value) }} value={selectedActivity ? String(selectedActivity.value) : 'custom'}><option value="custom">Custom</option>{activityLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}</select></label>
        <label className="field-label">TDEE multiplier<input className="field-input" inputMode="decimal" max="3" min="0.8" onChange={(event) => { setSaved(false); setActivityFactor(event.target.value) }} step="0.025" type="number" value={activityFactor} /></label>
      </div>
      <p className="-mt-2 text-xs leading-5 text-zinc-500">{selectedActivity ? selectedActivity.detail : 'Custom activity scaling'} · TDEE = BMR × {activityFactor || '—'}</p>

      <div>
        <p className="field-label mb-2">Weekly goal</p>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-950/55 p-1"><button aria-pressed={lossMode === 'fixed'} className={`goal-mode-button ${lossMode === 'fixed' ? 'goal-mode-button-active' : ''}`} onClick={() => { setSaved(false); setLossMode('fixed'); setLossValue('1') }} type="button">{unit}/week</button><button aria-pressed={lossMode === 'percent'} className={`goal-mode-button ${lossMode === 'percent' ? 'goal-mode-button-active' : ''}`} onClick={() => { setSaved(false); setLossMode('percent'); setLossValue('0.5') }} type="button">% bodyweight/week</button></div>
        <label className="field-label mt-3">{lossMode === 'fixed' ? `Loss per week (${unit})` : 'Bodyweight loss per week (%)'}<input className="field-input" inputMode="decimal" max={lossMode === 'fixed' ? 5 : 3} min="0.1" onChange={(event) => { setSaved(false); setLossValue(event.target.value) }} step={lossMode === 'fixed' ? 0.25 : 0.1} type="number" value={lossValue} /></label>
      </div>

      {estimate && <div className="calorie-estimate-card">
        <div><span>BMR</span><strong>{estimate.bmr.toLocaleString()} kcal</strong></div>
        <div><span>TDEE</span><strong>{estimate.tdee.toLocaleString()} kcal</strong></div>
        <div><span>Daily deficit</span><strong>−{estimate.dailyDeficit.toLocaleString()} kcal</strong></div>
        <div className="calorie-target-result"><span>Daily calorie target</span><strong>{estimate.calorieTarget.toLocaleString()} kcal</strong></div>
        <p>Activity factor: {selectedActivity?.label ?? activityFactor}. Estimated loss: {convertWeight(estimate.weeklyLossLb, 'lb', unit).toFixed(1)} {unit}/week.</p>
      </div>}
      {(fastLoss || lowCalories) && <div className="flex gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-xs leading-5 text-amber-100"><Info className="mt-0.5 size-4 shrink-0" /><span>{fastLoss ? 'This is faster than the commonly recommended gradual pace of about 1–2 lb per week. ' : ''}{lowCalories ? 'The resulting calorie target is quite low. ' : ''}Consider a slower goal or guidance from a qualified health professional.</span></div>}
      <button className="button-primary w-full" disabled={!canSave} onClick={() => void save()}>{saved ? <><Check className="size-4" />Goal saved</> : 'Save and use calorie target'}</button>
      <p className="text-xs leading-5 text-zinc-500">For adults only. This estimate is a planning starting point—not medical advice. Real energy needs and weight change can differ; adjust using your logged trend.</p>
    </div>
  </section>
}

export function CalorieGoalSettings() {
  const data = useLiveQuery(async () => {
    const [profileSetting, nutritionSetting, progressSetting, workoutSetting, weights] = await Promise.all([
      settingsRepository.get('body-profile'),
      settingsRepository.get('nutrition-goals'),
      settingsRepository.get('progress-goals'),
      settingsRepository.get('workout-preferences'),
      progressRepository.getWeightLogs()
    ])
    return { profileSetting, nutritionSetting, progressSetting, workoutSetting, latestWeight: weights.at(-1) }
  }, [], null)
  if (!data) return <section className="settings-card"><p className="text-sm text-zinc-500">Loading calorie goal setup…</p></section>
  const unit = ((data.workoutSetting?.value as { unit?: WeightUnit } | undefined)?.unit ?? 'lb')
  return <CalorieGoalForm key={unit} latestWeight={data.latestWeight} nutrition={(data.nutritionSetting?.value as NutritionGoals | undefined) ?? {}} profile={(data.profileSetting?.value as Partial<BodyProfile> | undefined) ?? {}} progress={(data.progressSetting?.value as ProgressGoalSettings | undefined) ?? {}} unit={unit} />
}
