import { useLiveQuery } from 'dexie-react-hooks'
import { Download, KeyRound, RotateCcw, Upload, WifiOff } from 'lucide-react'
import { type ChangeEvent, type ReactNode, useState } from 'react'
import { credentialRepository } from '@/db/repositories/credentialRepository'
import { settingsRepository } from '@/db/repositories/settingsRepository'
import { CalorieGoalSettings } from './CalorieGoalSettings'
import { createBackup, downloadBackup, replaceWithBackup, summarizeBackup, validateBackup } from '@/services/backup/backupService'
import type { FitnessBackup } from '@/services/backup/backupTypes'

interface NutritionGoals { calories?: number; protein?: number; carbs?: number; fat?: number }
interface WorkoutPrefs { defaultRest?: number; showRir?: boolean; showPrevious?: boolean; unit?: 'lb' | 'kg' }

function parseNumber(value: string): number | undefined {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric !== 0 ? numeric : undefined
}

function SettingsCard({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return <section className="settings-card"><div className="mb-4"><h2 className="section-title">{title}</h2>{detail && <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>}</div>{children}</section>
}

function BackupRestore() {
  const [pending, setPending] = useState<FitnessBackup | undefined>()
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  async function exportNow() {
    setWorking(true)
    try { downloadBackup(await createBackup()) } finally { setWorking(false) }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setError('')
      setPending(validateBackup(JSON.parse(await file.text())))
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Unable to read that backup.')
    }
  }

  async function restore() {
    if (!pending) return
    setWorking(true)
    try {
      downloadBackup(await createBackup())
      await replaceWithBackup(pending)
      setPending(undefined)
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore that backup.')
    } finally {
      setWorking(false)
    }
  }

  const summary = pending && summarizeBackup(pending)
  return <SettingsCard detail="Your fitness data stays on this device. Export a backup periodically to protect your history." title="Backup & Restore">
    <div className="grid grid-cols-2 gap-3"><button className="button-secondary" disabled={working} onClick={() => void exportNow()}><Download className="size-4" />Export backup</button><label className="button-secondary cursor-pointer"><Upload className="size-4" />Import backup<input accept="application/json,.json" className="sr-only" onChange={(event) => void chooseFile(event)} type="file" /></label></div>
    {error && <p className="mt-3 rounded-xl bg-rose-300/10 px-3 py-2.5 text-sm text-rose-200">{error}</p>}
    {summary && <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3"><p className="text-sm font-semibold text-amber-100">Ready to replace current data</p><p className="mt-1 text-xs leading-5 text-amber-50/75">Backup created {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(summary.exportedAt))}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-amber-50/80"><span>{summary.foodEntries} foods</span><span>{summary.workoutSessions} workouts</span><span>{summary.workoutTemplates} templates</span><span>{summary.weightLogs} weigh-ins</span><span>{summary.workoutSets} sets</span></div><div className="mt-4 flex gap-2"><button className="button-secondary flex-1" onClick={() => setPending(undefined)}>Cancel</button><button className="button-danger-outline flex-1" disabled={working} onClick={() => void restore()}><RotateCcw className="size-4" />Export & replace</button></div></div>}
  </SettingsCard>
}

export function SettingsPage() {
  const nutritionSetting = useLiveQuery(() => settingsRepository.get('nutrition-goals'), [])
  const workoutSetting = useLiveQuery(() => settingsRepository.get('workout-preferences'), [])
  const nameSetting = useLiveQuery(() => settingsRepository.get('preferred-name'), [])
  const credential = useLiveQuery(() => credentialRepository.get('usda-api-key'), [])
  const nutrition = (nutritionSetting?.value as NutritionGoals | undefined) ?? {}
  const workout = (workoutSetting?.value as WorkoutPrefs | undefined) ?? {}

  return <div className="space-y-5 pb-3 pt-2">
    <section><p className="eyebrow">Settings</p><h1 className="page-title">Make it yours</h1><p className="mt-1.5 text-sm text-slate-400">Preferences and credentials remain in local browser storage.</p></section>
    <div className="rounded-[1.25rem] border border-sky-300/10 bg-sky-300/[0.055] p-4"><div className="flex gap-3"><WifiOff className="mt-0.5 size-5 shrink-0 text-sky-300" /><div><p className="text-sm font-semibold text-slate-200">Private by design</p><p className="mt-1 text-sm leading-5 text-slate-400">No account or cloud database. Clearing website data can delete local history, so use JSON backups.</p></div></div></div>
    <SettingsCard title="General"><label className="field-label">Preferred name <span className="font-normal text-slate-600">(optional)</span><input className="field-input" defaultValue={String(nameSetting?.value ?? '')} onBlur={(event) => void settingsRepository.set('preferred-name', event.target.value.trim())} placeholder="Used in your dashboard greeting" /></label></SettingsCard>
    <SettingsCard detail="The calorie estimator can set calories automatically; macros remain editable." title="Nutrition goals"><div className="grid grid-cols-2 gap-3"><NumberSetting defaultValue={nutrition.calories} label="Daily calories" onSave={(value) => void settingsRepository.set('nutrition-goals', { ...nutrition, calories: value })} /><NumberSetting defaultValue={nutrition.protein} label="Protein (g)" onSave={(value) => void settingsRepository.set('nutrition-goals', { ...nutrition, protein: value })} /><NumberSetting defaultValue={nutrition.carbs} label="Carbs (g)" onSave={(value) => void settingsRepository.set('nutrition-goals', { ...nutrition, carbs: value })} /><NumberSetting defaultValue={nutrition.fat} label="Fat (g)" onSave={(value) => void settingsRepository.set('nutrition-goals', { ...nutrition, fat: value })} /></div></SettingsCard>
    <CalorieGoalSettings />
    <SettingsCard title="Workout"><div className="grid grid-cols-2 gap-3"><label className="field-label">Default rest<select className="field-input" defaultValue={workout.defaultRest ?? 120} onChange={(event) => void settingsRepository.set('workout-preferences', { ...workout, defaultRest: Number(event.target.value) })}>{[60, 90, 120, 180].map((seconds) => <option key={seconds} value={seconds}>{seconds / 60} min</option>)}</select></label><label className="field-label">Weight unit<select className="field-input" defaultValue={workout.unit ?? 'lb'} onChange={(event) => void settingsRepository.set('workout-preferences', { ...workout, unit: event.target.value as 'lb' | 'kg' })}><option value="lb">Pounds (lb)</option><option value="kg">Kilograms (kg)</option></select></label></div><div className="mt-3 grid grid-cols-2 gap-3"><Toggle label="Show RIR" value={workout.showRir ?? true} onChange={(value) => void settingsRepository.set('workout-preferences', { ...workout, showRir: value })} /><Toggle label="Show previous workout" value={workout.showPrevious ?? true} onChange={(value) => void settingsRepository.set('workout-preferences', { ...workout, showPrevious: value })} /></div></SettingsCard>
    <SettingsCard detail="Your key is stored only in this browser profile and is excluded from normal JSON backups." title="Food Data"><div className="flex items-center gap-2"><KeyRound className="size-4 text-sky-300" /><label className="field-label min-w-0 flex-1">USDA API key<input className="field-input" defaultValue={credential?.value} onBlur={(event) => void credentialRepository.set('usda-api-key', event.target.value)} placeholder="Paste your data.gov key" type="password" /></label></div><p className="mt-2 text-xs leading-5 text-slate-500">FoodData Central search is browser-direct, so a static web app cannot make this key secret from this device. Never commit it.</p></SettingsCard>
    <BackupRestore />
    <SettingsCard detail="Pocket Pace is a private, offline-first fitness tracker built for a single browser profile." title="About"><p className="text-sm leading-5 text-slate-400">No accounts, cloud database, analytics, or server are required. Use a JSON backup to move or protect your data.</p></SettingsCard>
    <p className="px-1 text-center text-xs text-slate-600">Pocket Pace · Local-first personal fitness</p>
  </div>
}

function NumberSetting({ label, defaultValue, onSave }: { label: string; defaultValue?: number; onSave: (value: number | undefined) => void }) {
  return <label className="field-label">{label}<input className="field-input" defaultValue={defaultValue ?? ''} inputMode="decimal" onBlur={(event) => onSave(parseNumber(event.target.value))} type="number" /></label>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-slate-800/65 px-3 text-sm font-semibold text-slate-300">{label}<input checked={value} className="size-4 accent-sky-400" onChange={(event) => onChange(event.target.checked)} type="checkbox" /></label>
}
