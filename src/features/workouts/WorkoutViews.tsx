import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  ClipboardList,
  Clock3,
  Dumbbell,
  LibraryBig,
  ListPlus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  X
} from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { workoutRepository, type PreviousPerformance, type SessionExerciseDetails } from '@/db/repositories/workoutRepository'
import { settingsRepository } from '@/db/repositories/settingsRepository'
import { useIncrementalItems } from '@/hooks/useIncrementalItems'
import { useCachedLiveQuery } from '@/hooks/useCachedLiveQuery'
import type { Exercise, PlannedWorkoutSet, WorkoutSet, WorkoutTemplateExercise } from '@/types/models'
import { formatLongDate } from '@/utils/dates'

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const weekdayShortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const muscles = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Other']
const equipmentOptions = ['Dumbbell', 'Barbell', 'Cable', 'Machine', 'Bodyweight', 'Bands', 'Other']
const categoryOptions = ['Strength', 'Cardio', 'Mobility', 'Other']

function snapshotValue(snapshot: Record<string, unknown>, key: string, fallback = ''): string {
  const value = snapshot[key]
  return typeof value === 'string' ? value : fallback
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.max(0, totalSeconds % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatSet(set: WorkoutSet): string {
  const weight = set.weight == null ? '—' : set.weight === 0 ? 'BW' : `${set.weight}`
  const reps = set.reps == null ? '—' : `${set.reps}`
  const rir = set.rir == null ? '' : ` @ ${set.rir === 5 ? '5+' : set.rir}`
  return `${weight} × ${reps}${rir}`
}

function PageHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return (
    <section className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {detail && <p className="mt-1.5 text-sm leading-5 text-slate-400">{detail}</p>}
      </div>
      {action}
    </section>
  )
}

function BackLink({ to, children = 'Back' }: { to: string; children?: string }) {
  return <Link className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-sky-200" to={to}><ArrowLeft className="size-4" />{children}</Link>
}

function IconButton({ label, children, onClick, tone = 'default' }: { label: string; children: ReactNode; onClick: () => void; tone?: 'default' | 'danger' }) {
  return (
    <button aria-label={label} className={`workout-icon-button ${tone === 'danger' ? 'workout-icon-button-danger' : ''}`} onClick={onClick} type="button">
      {children}
    </button>
  )
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId()
  return (
    <div aria-labelledby={titleId} aria-modal="true" className="modal-backdrop" role="dialog">
      <div className="modal-panel">
        <div className="modal-header flex items-center justify-between gap-4 px-5 pb-4 pt-5">
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-50" id={titleId}>{title}</h2>
          <IconButton label="Close" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
        <div className="modal-scroll px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

function ExercisePicker({ onPick, onClose }: { onPick: (exerciseId: string) => Promise<void>; onClose: () => void }) {
  const exercises = useLiveQuery(() => workoutRepository.getExercises(), [])
  const [query, setQuery] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('All')
  const [saving, setSaving] = useState(false)
  const availableMuscles = useMemo(() => ['All', ...muscles.filter((muscle) => (exercises ?? []).some((exercise) => exercise.primaryMuscle === muscle))], [exercises])
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return (exercises ?? []).filter((exercise) => {
      const matchesMuscle = selectedMuscle === 'All' || exercise.primaryMuscle === selectedMuscle
      const searchable = [exercise.name, exercise.primaryMuscle, exercise.equipment, ...exercise.secondaryMuscles].join(' ').toLowerCase()
      return matchesMuscle && (!term || searchable.includes(term))
    })
  }, [exercises, query, selectedMuscle])
  const pagedExercises = useIncrementalItems(filtered, 40, `${selectedMuscle}:${query.trim().toLocaleLowerCase()}`)

  async function pick(exerciseId: string) {
    setSaving(true)
    try {
      await onPick(exerciseId)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title="Add exercise">
      <input className="field-input mb-3" onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises, muscles, or equipment" type="search" value={query} />
      <div className="exercise-filter-scroll -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {availableMuscles.map((muscle) => <button aria-pressed={selectedMuscle === muscle} className={`exercise-filter-chip ${selectedMuscle === muscle ? 'exercise-filter-chip-active' : ''}`} key={muscle} onClick={() => setSelectedMuscle(muscle)} type="button">{muscle}</button>)}
      </div>
      <p className="mb-2 text-xs text-zinc-500">{filtered.length} {filtered.length === 1 ? 'exercise' : 'exercises'}</p>
      {filtered.length === 0 ? (
        <p className="rounded-xl bg-slate-800/70 px-4 py-5 text-center text-sm text-slate-400">No matching exercises. Add one in your library first.</p>
      ) : (
        <><div className="overflow-hidden rounded-2xl border border-white/[0.07]">
          {pagedExercises.visibleItems.map((exercise) => (
            <button className="picker-row" disabled={saving} key={exercise.id} onClick={() => void pick(exercise.id)} type="button">
              <span className="min-w-0 flex-1 text-left"><strong>{exercise.name}</strong><small>{exercise.primaryMuscle} · {exercise.equipment}</small></span><Plus className="size-4 text-sky-300" />
            </button>
          ))}
        </div><LoadMoreButton onClick={pagedExercises.showMore} shown={pagedExercises.shown} total={pagedExercises.total} /></>
      )}
    </Modal>
  )
}

function ExerciseForm({ exercise, onSaved, onCancel }: { exercise?: Exercise; onSaved: () => void; onCancel: () => void }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    if (!name) return setError('Give the exercise a name.')
    setSaving(true)
    setError('')
    const payload = {
      name,
      primaryMuscle: String(form.get('primaryMuscle') ?? 'Other'),
      secondaryMuscles: String(form.get('secondaryMuscles') ?? '').split(',').map((item) => item.trim()).filter(Boolean),
      equipment: String(form.get('equipment') ?? 'Other'),
      category: String(form.get('category') ?? 'Strength'),
      notes: String(form.get('notes') ?? '').trim() || undefined
    }
    try {
      if (exercise) await workoutRepository.updateExercise(exercise.id, payload)
      else await workoutRepository.createExercise(payload)
      onSaved()
    } catch {
      setError('Unable to save that exercise. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <label className="field-label">Exercise name<input className="field-input" defaultValue={exercise?.name} name="name" placeholder="e.g. Incline dumbbell press" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">Primary muscle<select className="field-input" defaultValue={exercise?.primaryMuscle ?? 'Other'} name="primaryMuscle">{muscles.map((muscle) => <option key={muscle}>{muscle}</option>)}</select></label>
        <label className="field-label">Equipment<select className="field-input" defaultValue={exercise?.equipment ?? 'Other'} name="equipment">{equipmentOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <label className="field-label">Secondary muscles <span className="font-normal text-slate-600">(optional, comma-separated)</span><input className="field-input" defaultValue={exercise?.secondaryMuscles.join(', ')} name="secondaryMuscles" placeholder="e.g. Triceps, Shoulders" /></label>
      <label className="field-label">Category<select className="field-input" defaultValue={exercise?.category ?? 'Strength'} name="category">{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="field-label">Notes <span className="font-normal text-slate-600">(optional)</span><textarea className="field-input min-h-22" defaultValue={exercise?.notes} name="notes" placeholder="Useful setup cues or reminders" /></label>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <div className="flex gap-3 pt-1"><button className="button-secondary flex-1" onClick={onCancel} type="button">Cancel</button><button className="button-primary flex-1" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save exercise'}</button></div>
    </form>
  )
}

export function WorkoutHubPage() {
  const navigate = useNavigate()
  const activeSession = useCachedLiveQuery('workout:active-session', () => workoutRepository.getActiveSession(), [])
  const templates = useCachedLiveQuery('workout:templates', () => workoutRepository.getTemplates(), [])
  const schedule = useCachedLiveQuery('workout:schedule', () => workoutRepository.getSchedule(), [])
  const quickSetting = useCachedLiveQuery('setting:quick-workout-template', () => settingsRepository.get('quick-workout-template'), [])
  const today = new Date()
  const scheduled = (schedule ?? []).find((item) => item.weekday === today.getDay())
  const scheduledTemplate = (templates ?? []).find((template) => template.id === scheduled?.templateId)
  const quickTemplate = (templates ?? []).find((template) => template.id === quickSetting?.value)
  const todayTemplate = scheduledTemplate ?? quickTemplate

  async function start(templateId?: string) {
    const sessionId = await workoutRepository.startWorkout(templateId)
    navigate(`/workout/active/${sessionId}`)
  }

  return (
    <div className="space-y-6 pb-3 pt-2">
      <PageHeader detail="Workouts and sessions stay fully on this device." eyebrow="Training" title="Your workout week" />

      {activeSession ? (
        <section className="dashboard-card overflow-hidden">
          <div className="card-accent card-accent-blue" />
          <p className="eyebrow">In progress</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-50">{activeSession.name}</h2>
          <p className="mt-1 text-sm text-slate-400">Started {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(activeSession.startedAt))}. Your sets are saved automatically.</p>
          <button className="button-primary mt-5 w-full" onClick={() => navigate(`/workout/active/${activeSession.id}`)}><Play className="size-4" />Resume workout</button>
        </section>
      ) : (
        <section className="dashboard-card overflow-hidden">
          <div className="card-accent card-accent-violet" />
          <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Today · {weekdayNames[today.getDay()]}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-50">{todayTemplate?.name ?? 'Rest day'}</h2><p className="mt-1 text-sm text-slate-400">{scheduledTemplate ? 'Scheduled for today.' : quickTemplate ? 'Your Quick Workout default for unscheduled days.' : 'Assign training days or choose a Quick Workout default.'}</p></div><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-400/10 text-sky-300"><Dumbbell className="size-5" /></div></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><button className="button-primary" disabled={!todayTemplate} onClick={() => void start(todayTemplate?.id)}><Play className="size-4" />{scheduledTemplate ? 'Start workout' : 'Quick workout'}</button><Link className="button-secondary" to="/workout/templates"><ClipboardList className="size-4" />Set workouts</Link></div>
        </section>
      )}

      <section className="overflow-hidden rounded-[1.4rem] border border-white/[0.07] bg-slate-900/75 shadow-card">
        {[
          ['Workouts', 'Create reusable training sessions', LibraryBig, '/workout/templates'],
          ['Exercise library', 'Add and manage custom exercises', Dumbbell, '/workout/library'],
          ['Workout history', 'Review completed sessions', Clock3, '/workout/history']
        ].map(([label, detail, Icon, to]) => {
          const RowIcon = Icon as typeof LibraryBig
          return <Link className="settings-row" key={label as string} to={to as string}><div className="grid size-10 place-items-center rounded-xl bg-slate-800 text-slate-400"><RowIcon className="size-[18px]" /></div><span className="min-w-0 flex-1"><strong>{label as string}</strong><small>{detail as string}</small></span><ChevronRight className="size-4 text-slate-600" /></Link>
        })}
      </section>
    </div>
  )
}

export function ExerciseLibraryPage() {
  const exercises = useLiveQuery(() => workoutRepository.getExercises(), [])
  const [editing, setEditing] = useState<Exercise | 'new' | undefined>()
  const [message, setMessage] = useState('')
  const exerciseItems = exercises ?? []
  const pagedExercises = useIncrementalItems(exerciseItems, 50)

  async function remove(exercise: Exercise) {
    if (!window.confirm(`Delete ${exercise.name}? Exercises used by a workout or history are protected.`)) return
    try {
      await workoutRepository.deleteExercise(exercise.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete that exercise.')
    }
  }

  return <div className="space-y-5 pb-3 pt-2"><BackLink to="/workout">Workout</BackLink><PageHeader action={<button aria-label="Add exercise" className="round-add-button" onClick={() => setEditing('new')}><Plus className="size-5" /></button>} eyebrow="Library" title="Exercises" detail="Choose from the built-in catalog or add your own exercises." />
    {message && <p className="rounded-xl border border-rose-300/15 bg-rose-300/10 px-3 py-2 text-sm text-rose-200">{message}</p>}
    {exerciseItems.length === 0 ? <div className="empty-card"><Dumbbell className="size-6 text-sky-300" /><h2>No exercises yet</h2><p>Add your first custom exercise, then build a workout around it.</p><button className="button-primary mt-5" onClick={() => setEditing('new')}><Plus className="size-4" />Add exercise</button></div> : <><div className="space-y-2">{pagedExercises.visibleItems.map((exercise) => <div className="exercise-row" key={exercise.id}><button className="min-w-0 flex-1 text-left" onClick={() => setEditing(exercise)}><strong>{exercise.name}</strong><small>{exercise.primaryMuscle} · {exercise.equipment} · {exercise.isCustom ? 'Custom' : 'Built-in'}</small></button>{exercise.isCustom && <IconButton label={`Delete ${exercise.name}`} onClick={() => void remove(exercise)} tone="danger"><Trash2 className="size-4" /></IconButton>}</div>)}</div><LoadMoreButton onClick={pagedExercises.showMore} shown={pagedExercises.shown} total={pagedExercises.total} /></>}
    {editing && <Modal onClose={() => setEditing(undefined)} title={editing === 'new' ? 'New exercise' : 'Edit exercise'}><ExerciseForm exercise={editing === 'new' ? undefined : editing} onCancel={() => setEditing(undefined)} onSaved={() => setEditing(undefined)} /></Modal>}
  </div>
}

export function TemplateListPage() {
  const templates = useLiveQuery(() => workoutRepository.getTemplates(), [])
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const templateItems = templates ?? []
  const pagedTemplates = useIncrementalItems(templateItems, 25)

  async function create() {
    const trimmed = name.trim()
    if (!trimmed) return
    const templateId = await workoutRepository.createTemplate(trimmed)
    navigate(`/workout/templates/${templateId}`)
  }

  return <div className="space-y-5 pb-3 pt-2"><BackLink to="/workout">Workout</BackLink><PageHeader action={<button aria-label="Create workout" className="round-add-button" onClick={() => setCreating(true)}><Plus className="size-5" /></button>} eyebrow="Programming" title="Workouts" detail="Changes here never modify completed workout history." />
    {templateItems.length === 0 ? <div className="empty-card"><ListPlus className="size-6 text-sky-300" /><h2>Plan your first workout</h2><p>Build an ordered exercise list, then assign the workout to your week.</p><button className="button-primary mt-5" onClick={() => setCreating(true)}><Plus className="size-4" />Create workout</button></div> : <><div className="space-y-2">{pagedTemplates.visibleItems.map((template) => <Link className="template-row" key={template.id} to={`/workout/templates/${template.id}`}><span className="grid size-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Dumbbell className="size-[18px]" /></span><span className="min-w-0 flex-1"><strong>{template.name}</strong><small>{template.notes || 'Tap to add exercises and targets'}</small></span><ChevronRight className="size-4 text-slate-600" /></Link>)}</div><LoadMoreButton onClick={pagedTemplates.showMore} shown={pagedTemplates.shown} total={pagedTemplates.total} /></>}
    {creating && <Modal onClose={() => setCreating(false)} title="New workout"><label className="field-label">Workout name<input className="field-input mt-1" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void create() }} placeholder="e.g. Pull A" value={name} /></label><div className="mt-5 flex gap-3"><button className="button-secondary flex-1" onClick={() => setCreating(false)}>Cancel</button><button className="button-primary flex-1" disabled={!name.trim()} onClick={() => void create()}>Create</button></div></Modal>}
  </div>
}

function plannedSetsFor(item: WorkoutTemplateExercise): PlannedWorkoutSet[] {
  return item.plannedSets?.length
    ? item.plannedSets
    : Array.from({ length: item.targetSets }, () => ({ type: 'working' as const }))
}

function TemplateExerciseRow({ item, exercise, templateId }: { item: WorkoutTemplateExercise; exercise?: Exercise; templateId: string }) {
  const sets = plannedSetsFor(item)
  const workingSets = sets.filter((set) => set.type !== 'warmup')
  const repValues = [...new Set(workingSets.map((set) => set.reps).filter((value): value is number => value != null))]
  const repSummary = repValues.length === 1 ? `${repValues[0]} reps` : repValues.length > 1 ? `${Math.min(...repValues)}–${Math.max(...repValues)} reps` : 'Set reps and weight'
  return <Link className="template-exercise-row" to={`/workout/templates/${templateId}/exercises/${item.id}`}><span className="set-number-badge">{item.order + 1}</span><span className="min-w-0 flex-1"><strong>{exercise?.name ?? 'Unavailable exercise'}</strong><small>{sets.length} {sets.length === 1 ? 'set' : 'sets'} · {repSummary}</small><small>{exercise ? `${exercise.primaryMuscle} · ${exercise.equipment}` : 'Exercise unavailable'}</small></span><ChevronRight className="size-5 shrink-0 text-zinc-600" /></Link>
}

export function TemplateEditorPage() {
  const { templateId = '' } = useParams()
  const navigate = useNavigate()
  const details = useLiveQuery(() => workoutRepository.getTemplateDetails(templateId), [templateId])
  const exercises = useLiveQuery(() => workoutRepository.getExercises(), [])
  const schedule = useLiveQuery(() => workoutRepository.getSchedule(), [])
  const quickSetting = useLiveQuery(() => settingsRepository.get('quick-workout-template'), [])
  const [pickerOpen, setPickerOpen] = useState(false)
  if (details === undefined) return <div className="pt-6 text-center text-sm text-slate-500">Loading workout…</div>
  if (!details) return <div className="pt-6"><BackLink to="/workout/templates">Workouts</BackLink><div className="empty-card"><h2>Workout not found</h2><p>It may have been deleted.</p></div></div>
  const exerciseMap = new Map((exercises ?? []).map((exercise) => [exercise.id, exercise]))
  const selectedDays = new Set((schedule ?? []).filter((item) => item.templateId === templateId).map((item) => item.weekday))
  const isQuickWorkout = quickSetting?.value === templateId
  const toggleDay = (weekday: number) => workoutRepository.setScheduledTemplate(weekday, selectedDays.has(weekday) ? undefined : templateId)
  return <div className="space-y-5 pb-3 pt-2"><BackLink to="/workout/templates">Workouts</BackLink><section><p className="eyebrow">Workout editor</p><input aria-label="Workout name" className="template-name-input" defaultValue={details.template.name} onBlur={(event) => void workoutRepository.updateTemplate(templateId, { name: event.target.value || details.template.name, notes: details.template.notes })} /><textarea aria-label="Workout notes" className="mt-2 min-h-12 w-full resize-none bg-transparent text-sm text-slate-400 outline-none placeholder:text-slate-600" defaultValue={details.template.notes} onBlur={(event) => void workoutRepository.updateTemplate(templateId, { name: details.template.name, notes: event.target.value || undefined })} placeholder="Optional session notes" /></section>
    <section className="workout-program-card"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><CalendarDays className="size-5" /></span><div><h2 className="section-title">Training days</h2><p className="mt-1 text-xs leading-5 text-zinc-500">Choose every day this workout should appear in Today.</p></div></div><div className="mt-4 grid grid-cols-7 gap-1.5">{weekdayShortNames.map((day, index) => <button aria-label={`Schedule for ${day}`} aria-pressed={selectedDays.has(index)} className={`weekday-chip ${selectedDays.has(index) ? 'weekday-chip-active' : ''}`} key={day} onClick={() => void toggleDay(index)}>{day}</button>)}</div><button aria-pressed={isQuickWorkout} className={`quick-default-button ${isQuickWorkout ? 'quick-default-button-active' : ''}`} onClick={() => void settingsRepository.set('quick-workout-template', isQuickWorkout ? undefined : templateId)}><Star className="size-4" />{isQuickWorkout ? 'Quick Workout default' : 'Use as Quick Workout default'}</button></section>
    <div className="flex items-center justify-between"><h2 className="section-title">Exercises</h2><button className="button-quiet" onClick={() => setPickerOpen(true)}><Plus className="size-4" />Add exercise</button></div>
    {details.exercises.length === 0 ? <div className="empty-card compact"><p>Add exercises from your custom library, then tap each one to set reps and weight.</p><button className="button-primary mt-4" onClick={() => setPickerOpen(true)}><Plus className="size-4" />Add exercise</button></div> : <div className="overflow-hidden rounded-2xl border border-white/[0.07]">{details.exercises.map((item) => <TemplateExerciseRow exercise={exerciseMap.get(item.exerciseId)} item={item} key={item.id} templateId={templateId} />)}</div>}
    <button className="button-danger-outline w-full" onClick={() => { if (window.confirm(`Delete ${details.template.name}? Your completed workout history stays intact.`)) { void workoutRepository.deleteTemplate(templateId); navigate('/workout/templates') } }}><Trash2 className="size-4" />Delete workout</button>
    {pickerOpen && <ExercisePicker onClose={() => setPickerOpen(false)} onPick={(exerciseId) => workoutRepository.addExerciseToTemplate(templateId, exerciseId)} />}
  </div>
}

function TemplateSetEditor({ item, exercise, templateName }: { item: WorkoutTemplateExercise; exercise: Exercise; templateName: string }) {
  const navigate = useNavigate()
  const [sets, setSets] = useState<PlannedWorkoutSet[]>(() => plannedSetsFor(item))
  const saveSets = async (next: PlannedWorkoutSet[]) => {
    setSets(next)
    await workoutRepository.updateTemplateExercise(item.id, { plannedSets: next, targetSets: next.length })
  }
  const changeSet = (index: number, key: 'reps' | 'weight' | 'rir', value: string) => setSets((current) => current.map((set, setIndex) => setIndex === index ? { ...set, [key]: value === '' ? undefined : Number(value) } : set))
  const persist = () => void workoutRepository.updateTemplateExercise(item.id, { plannedSets: sets, targetSets: sets.length })
  const removeExercise = async () => {
    if (!window.confirm(`Remove ${exercise.name} from ${templateName}?`)) return
    await workoutRepository.removeTemplateExercise(item.id)
    navigate(`/workout/templates/${item.templateId}`)
  }
  return <div className="space-y-5"><section><p className="eyebrow">{templateName}</p><h1 className="page-title">{exercise.name}</h1><p className="mt-1.5 text-sm text-zinc-500">{exercise.primaryMuscle} · {exercise.equipment}</p></section><section className="planned-sets-card"><div className="planned-set-header"><span>Set</span><span>Reps</span><span>Weight</span><span>RIR</span><span /></div>{sets.map((set, index) => <div className="planned-set-row" key={`${set.type}-${index}`}><span className={`planned-set-number ${set.type === 'warmup' ? 'planned-set-warmup' : ''}`}>{set.type === 'warmup' ? 'W' : sets.slice(0, index + 1).filter((entry) => entry.type !== 'warmup').length}</span><input aria-label={`Set ${index + 1} reps`} inputMode="numeric" min="0" onBlur={persist} onChange={(event) => changeSet(index, 'reps', event.target.value)} placeholder="—" step="1" type="number" value={set.reps ?? ''} /><input aria-label={`Set ${index + 1} weight`} inputMode="decimal" min="0" onBlur={persist} onChange={(event) => changeSet(index, 'weight', event.target.value)} placeholder="—" step="0.5" type="number" value={set.weight ?? ''} /><input aria-label={`Set ${index + 1} RIR`} inputMode="numeric" max="5" min="0" onBlur={persist} onChange={(event) => changeSet(index, 'rir', event.target.value)} placeholder="—" step="1" type="number" value={set.rir ?? ''} /><button aria-label={`Delete set ${index + 1}`} className="set-delete-button" onClick={() => void saveSets(sets.filter((_, setIndex) => setIndex !== index))}><X className="size-4" /></button></div>)}<div className="grid grid-cols-2 gap-2 border-t border-white/[0.07] p-3"><button className="button-secondary" onClick={() => void saveSets([...sets, { type: 'warmup' }])}><Plus className="size-4" />Add warmup</button><button className="button-primary" onClick={() => void saveSets([...sets, { type: 'working' }])}><Plus className="size-4" />Add set</button></div></section><section className="workout-program-card"><label className="field-label">Rest time<select className="field-input" onChange={(event) => void workoutRepository.updateTemplateExercise(item.id, { restSeconds: Number(event.target.value) })} value={item.restSeconds ?? 120}>{[60, 90, 120, 150, 180].map((seconds) => <option key={seconds} value={seconds}>{seconds / 60} min</option>)}</select></label><label className="field-label mt-4">Exercise note<textarea className="field-input min-h-24" defaultValue={item.notes} onBlur={(event) => void workoutRepository.updateTemplateExercise(item.id, { notes: event.target.value.trim() || undefined })} placeholder="Optional form cues or setup notes" /></label></section><div className="grid grid-cols-2 gap-3"><button className="button-secondary" onClick={() => void workoutRepository.moveTemplateExercise(item.id, -1)}><ArrowUpDown className="size-4 -rotate-90" />Move up</button><button className="button-secondary" onClick={() => void workoutRepository.moveTemplateExercise(item.id, 1)}><ArrowUpDown className="size-4 rotate-90" />Move down</button></div><button className="button-danger-outline w-full" onClick={() => void removeExercise()}><Trash2 className="size-4" />Remove exercise</button></div>
}

export function TemplateExerciseEditorPage() {
  const { templateId = '', templateExerciseId = '' } = useParams()
  const details = useLiveQuery(() => workoutRepository.getTemplateDetails(templateId), [templateId])
  const exercises = useLiveQuery(() => workoutRepository.getExercises(), [])
  if (details === undefined || exercises === undefined) return <div className="pt-6 text-center text-sm text-zinc-500">Loading exercise…</div>
  const item = details?.exercises.find((entry) => entry.id === templateExerciseId)
  const exercise = item && exercises.find((entry) => entry.id === item.exerciseId)
  if (!details || !item || !exercise) return <div className="pt-6"><BackLink to={`/workout/templates/${templateId}`}>Workout</BackLink><div className="empty-card"><h2>Exercise not found</h2><p>It may have been removed from this workout.</p></div></div>
  return <div className="space-y-5 pb-3 pt-2"><BackLink to={`/workout/templates/${templateId}`}>{details.template.name}</BackLink><TemplateSetEditor exercise={exercise} item={item} key={item.id} templateName={details.template.name} /></div>
}

export function WorkoutSchedulePage() {
  const schedule = useLiveQuery(() => workoutRepository.getSchedule(), [])
  const templates = useLiveQuery(() => workoutRepository.getTemplates(), [])
  const scheduleByDay = new Map((schedule ?? []).map((item) => [item.weekday, item.templateId]))
  return <div className="space-y-5 pb-3 pt-2"><BackLink to="/workout">Workout</BackLink><PageHeader eyebrow="Programming" title="Weekly schedule" detail="Assign workouts to days—or leave them as rest days." />
    <section className="overflow-hidden rounded-[1.4rem] border border-white/[0.07] bg-slate-900/75 shadow-card">{weekdayNames.map((day, index) => <label className="schedule-row" key={day}><span><strong>{day}</strong><small>{scheduleByDay.get(index) ? 'Scheduled workout' : 'Rest day'}</small></span><select aria-label={`${day} workout`} className="schedule-select" onChange={(event) => void workoutRepository.setScheduledTemplate(index, event.target.value || undefined)} value={scheduleByDay.get(index) ?? ''}><option value="">Rest day</option>{templates?.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>)}</section>
    {(templates?.length ?? 0) === 0 && <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.07] px-4 py-3 text-sm text-amber-100">Create a workout before assigning your week.</div>}
  </div>
}

function RestTimer({ session }: { session: { id: string; restTimerEndsAt?: string; restTimerRemainingSeconds?: number; restTimerPaused?: boolean } }) {
  const [time, setTime] = useState(() => Date.now())
  useEffect(() => { const interval = window.setInterval(() => setTime(Date.now()), 1000); return () => window.clearInterval(interval) }, [])
  const remaining = session.restTimerEndsAt ? Math.max(0, Math.ceil((new Date(session.restTimerEndsAt).getTime() - time) / 1000)) : session.restTimerRemainingSeconds ?? 0
  const isVisible = Boolean(session.restTimerEndsAt || session.restTimerPaused || session.restTimerRemainingSeconds)
  if (!isVisible) return null
  return <section className="rest-timer-card"><div><p className="eyebrow text-sky-300">Rest timer</p><p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-slate-50">{formatDuration(remaining)}</p></div><div className="flex flex-wrap justify-end gap-2"><button className="timer-button" onClick={() => void (session.restTimerPaused ? workoutRepository.resumeRestTimer(session.id) : workoutRepository.pauseRestTimer(session.id))}>{session.restTimerPaused ? <Play className="size-4" /> : <Pause className="size-4" />}{session.restTimerPaused ? 'Resume' : 'Pause'}</button><button aria-label="Add 30 seconds" className="timer-button" onClick={() => void workoutRepository.addRestTime(session.id)} >+30</button><button aria-label="Reset timer" className="timer-button" onClick={() => void workoutRepository.resetRestTimer(session.id)}><RotateCcw className="size-4" /></button><button aria-label="Dismiss timer" className="timer-button" onClick={() => void workoutRepository.dismissRestTimer(session.id)}><X className="size-4" /></button></div></section>
}

function PreviousSets({ exerciseId, sessionId }: { exerciseId: string; sessionId: string }) {
  const previous = useLiveQuery(() => workoutRepository.getPreviousPerformance(exerciseId, sessionId), [exerciseId, sessionId])
  if (previous === undefined) return null
  return <PreviousSetsDisplay previous={previous} />
}

function PreviousSetsDisplay({ previous }: { previous?: PreviousPerformance }) {
  if (!previous || previous.sets.length === 0) return <p className="mt-3 rounded-xl bg-slate-800/55 px-3 py-2 text-xs text-slate-500">No previous completed sets yet.</p>
  return <div className="mt-3 rounded-xl bg-slate-800/55 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Previous · {previous.date}</p><p className="mt-1.5 text-xs leading-5 text-slate-400">{previous.sets.map(formatSet).join('  ·  ')}</p></div>
}

function ActiveSetRow({ set, showRir }: { set: WorkoutSet; showRir: boolean }) {
  const [saving, setSaving] = useState(false)
  async function complete() {
    setSaving(true)
    try {
      if (set.completed) await workoutRepository.toggleSetCompleted(set.id, false)
      else await workoutRepository.completeSet(set.id)
    } finally { setSaving(false) }
  }
  const saveNumeric = (key: 'weight' | 'reps' | 'rir', value: string) => void workoutRepository.updateSet(set.id, { [key]: value === '' ? undefined : Number(value) })
  return <div className={`active-set-row ${showRir ? '' : 'active-set-row-no-rir'} ${set.completed ? 'active-set-row-complete' : ''}`}><span className="set-number-badge">{set.order + 1}</span><input aria-label={`Set ${set.order + 1} weight`} className="set-input" defaultValue={set.weight ?? ''} inputMode="decimal" min="0" onBlur={(event) => saveNumeric('weight', event.target.value)} placeholder="Weight" step="0.5" type="number" /><input aria-label={`Set ${set.order + 1} reps`} className="set-input" defaultValue={set.reps ?? ''} inputMode="numeric" min="0" onBlur={(event) => saveNumeric('reps', event.target.value)} placeholder="Reps" step="1" type="number" />{showRir && <select aria-label={`Set ${set.order + 1} RIR`} className="set-input" defaultValue={set.rir ?? ''} onChange={(event) => saveNumeric('rir', event.target.value)}><option value="">RIR</option>{[0, 1, 2, 3, 4, 5].map((rir) => <option key={rir} value={rir}>{rir === 5 ? '5+' : rir}</option>)}</select>}<button aria-label={set.completed ? `Mark set ${set.order + 1} incomplete` : `Complete set ${set.order + 1}`} className={`set-done-button ${set.completed ? 'set-done-button-complete' : ''}`} disabled={saving} onClick={() => void complete()}>{set.completed ? <Check className="size-4" /> : 'Done'}</button><button aria-label={`Delete set ${set.order + 1}`} className="set-delete-button" onClick={() => { if (window.confirm('Delete this set?')) void workoutRepository.deleteSet(set.id) }}><X className="size-4" /></button></div>
}

function ActiveExerciseCard({ detail, sessionId, showPrevious, showRir, unit }: { detail: SessionExerciseDetails; sessionId: string; showPrevious: boolean; showRir: boolean; unit: string }) {
  const { sessionExercise, sets } = detail
  const name = snapshotValue(sessionExercise.exerciseSnapshot, 'name', 'Exercise')
  return <article className="active-exercise-card"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h2>{name}</h2><p>{snapshotValue(sessionExercise.exerciseSnapshot, 'primaryMuscle')} · {snapshotValue(sessionExercise.exerciseSnapshot, 'equipment')}</p></div><div className="flex gap-1"><IconButton label="Move exercise up" onClick={() => void workoutRepository.moveSessionExercise(sessionExercise.id, -1)}><ArrowUpDown className="size-4 -rotate-90" /></IconButton><IconButton label="Move exercise down" onClick={() => void workoutRepository.moveSessionExercise(sessionExercise.id, 1)}><ArrowUpDown className="size-4 rotate-90" /></IconButton><IconButton label={`Remove ${name}`} onClick={() => { if (window.confirm(`Remove ${name} and its sets from this active workout?`)) void workoutRepository.removeSessionExercise(sessionExercise.id) }} tone="danger"><Trash2 className="size-4" /></IconButton></div></div>
    {showPrevious && <PreviousSets exerciseId={sessionExercise.exerciseId} sessionId={sessionId} />}
    <div className={`mt-4 grid gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600 ${showRir ? 'grid-cols-[1.2rem_1fr_1fr_1fr_3.4rem_1.5rem]' : 'grid-cols-[1.2rem_1fr_1fr_3.4rem_1.5rem]'}`}><span>#</span><span>Weight ({unit})</span><span>Reps</span>{showRir && <span>RIR</span>}<span className="text-center">Log</span><span /></div>
    <div className="mt-1 space-y-2">{sets.map((set) => <ActiveSetRow key={set.id} set={set} showRir={showRir} />)}</div>
    <div className="mt-3 flex flex-wrap gap-2"><button className="button-quiet" onClick={() => void workoutRepository.addSet(sessionExercise.id)}><Plus className="size-4" />Add set</button><label className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-800 px-3 text-xs font-semibold text-slate-400">Rest<select aria-label={`${name} rest duration`} className="bg-transparent text-slate-200 outline-none" defaultValue={sessionExercise.restSeconds ?? 120} onChange={(event) => void workoutRepository.updateSessionExercise(sessionExercise.id, { restSeconds: Number(event.target.value) })}>{[60, 90, 120, 150, 180].map((seconds) => <option key={seconds} value={seconds}>{seconds < 60 ? `${seconds}s` : `${seconds / 60}:00`}</option>)}</select></label></div>
  </article>
}

export function ActiveWorkoutPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const details = useLiveQuery(() => workoutRepository.getSessionDetails(sessionId), [sessionId])
  const preferences = useLiveQuery(() => settingsRepository.get('workout-preferences'), [])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [clock, setClock] = useState(Date.now())
  useEffect(() => { const interval = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(interval) }, [])
  if (details === undefined) return <div className="pt-6 text-center text-sm text-slate-500">Loading workout…</div>
  if (!details) return <div className="pt-6"><BackLink to="/workout">Workout</BackLink><div className="empty-card"><h2>Workout not found</h2><p>It may have been removed.</p></div></div>
  const elapsed = Math.max(0, Math.floor((clock - new Date(details.session.startedAt).getTime()) / 1000))
  if (details.session.status !== 'active') return <div className="pt-5"><BackLink to="/workout">Workout</BackLink><div className="empty-card"><Check className="size-6 text-emerald-300" /><h2>{details.session.status === 'completed' ? 'Workout complete' : 'Workout cancelled'}</h2><p>{details.session.status === 'completed' ? 'Your sets have been saved in workout history.' : 'This session is kept locally for reference.'}</p><button className="button-primary mt-5" onClick={() => navigate(details.session.status === 'completed' ? `/workout/history/${sessionId}` : '/workout')}>Continue</button></div></div>
  return <div className="space-y-4 pb-3 pt-2"><div className="flex items-center justify-between"><BackLink to="/workout">Save & exit</BackLink><span className="mb-4 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-300">{formatDuration(elapsed)}</span></div><section><p className="eyebrow">Active workout</p><h1 className="page-title">{details.session.name}</h1><p className="mt-1 text-sm text-slate-500">Every change is saved automatically.</p></section><RestTimer session={details.session} />
    {details.exercises.length === 0 ? <div className="empty-card compact"><p>Add an exercise to begin logging your workout.</p></div> : details.exercises.map((exercise) => <ActiveExerciseCard detail={exercise} key={exercise.sessionExercise.id} sessionId={sessionId} showPrevious={(preferences?.value as { showPrevious?: boolean } | undefined)?.showPrevious ?? true} showRir={(preferences?.value as { showRir?: boolean } | undefined)?.showRir ?? true} unit={(preferences?.value as { unit?: string } | undefined)?.unit ?? 'lb'} />)}
    <button className="button-secondary w-full" onClick={() => setPickerOpen(true)}><CirclePlus className="size-4" />Add exercise</button>
    <label className="field-label">Workout notes <span className="font-normal text-slate-600">(optional)</span><textarea className="field-input mt-1 min-h-20" defaultValue={details.session.notes} onBlur={(event) => void workoutRepository.updateWorkoutSession(sessionId, { notes: event.target.value.trim() || undefined })} placeholder="How did the session feel?" /></label>
    <div className="grid grid-cols-2 gap-3"><button className="button-danger-outline" onClick={() => { if (window.confirm('Cancel this workout? Your logged sets will be kept for reference.')) { void workoutRepository.cancelWorkout(sessionId); navigate('/workout') } }}>Cancel workout</button><button className="button-primary" onClick={() => { if (window.confirm('Finish this workout? Completed sets will be added to your history.')) void workoutRepository.finishWorkout(sessionId) }}><Check className="size-4" />Finish workout</button></div>
    {pickerOpen && <ExercisePicker onClose={() => setPickerOpen(false)} onPick={(exerciseId) => workoutRepository.addExerciseToSession(sessionId, exerciseId)} />}
  </div>
}

export function WorkoutHistoryPage() {
  const history = useLiveQuery(() => workoutRepository.getWorkoutHistory(), [])
  const historyItems = history ?? []
  const pagedHistory = useIncrementalItems(historyItems, 25)
  return <div className="space-y-5 pb-3 pt-2"><BackLink to="/workout">Workout</BackLink><PageHeader eyebrow="Training record" title="Workout history" detail="Completed sessions remain separate from their source workouts." />
    {historyItems.length === 0 ? <div className="empty-card"><Clock3 className="size-6 text-sky-300" /><h2>No completed workouts yet</h2><p>Finish your first active workout to build your training history.</p></div> : <><div className="space-y-2">{pagedHistory.visibleItems.map(({ session, workingSetCount, durationMinutes }) => <Link className="history-row" key={session.id} to={`/workout/history/${session.id}`}><span><strong>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${session.date}T12:00:00`))}</strong><small>{durationMinutes} min · {workingSetCount} working {workingSetCount === 1 ? 'set' : 'sets'}</small></span><span className="min-w-0 flex-1 text-right text-sm font-semibold text-slate-200">{session.name}</span><ChevronRight className="size-4 text-slate-600" /></Link>)}</div><LoadMoreButton onClick={pagedHistory.showMore} shown={pagedHistory.shown} total={pagedHistory.total} /></>}
  </div>
}

export function WorkoutSessionDetailPage() {
  const { sessionId = '' } = useParams()
  const details = useLiveQuery(() => workoutRepository.getSessionDetails(sessionId), [sessionId])
  if (details === undefined) return <div className="pt-6 text-center text-sm text-slate-500">Loading workout…</div>
  if (!details) return <div className="pt-6"><BackLink to="/workout/history">History</BackLink><div className="empty-card"><h2>Workout not found</h2></div></div>
  const endTime = details.session.completedAt ?? details.session.updatedAt
  const duration = Math.max(1, Math.round((new Date(endTime).getTime() - new Date(details.session.startedAt).getTime()) / 60000))
  return <div className="space-y-5 pb-3 pt-2"><BackLink to="/workout/history">History</BackLink><section><p className="eyebrow">{formatLongDate(new Date(`${details.session.date}T12:00:00`))}</p><h1 className="page-title">{details.session.name}</h1><p className="mt-1 text-sm text-slate-500">{duration} min · {details.session.status === 'completed' ? 'Completed' : details.session.status}</p>{details.session.notes && <p className="mt-3 rounded-xl bg-slate-800/60 px-3 py-2.5 text-sm leading-5 text-slate-400">{details.session.notes}</p>}</section>{details.exercises.map(({ sessionExercise, sets }) => <article className="history-exercise-card" key={sessionExercise.id}><h2>{snapshotValue(sessionExercise.exerciseSnapshot, 'name', 'Exercise')}</h2><div className="mt-3 space-y-2">{sets.map((set) => <div className="flex items-center justify-between text-sm" key={set.id}><span className="text-slate-500">Set {set.order + 1} · {set.type}</span><span className={set.completed ? 'font-semibold text-slate-200' : 'text-slate-600'}>{formatSet(set)}{set.completed ? '' : ' · not logged'}</span></div>)}</div></article>)}</div>
}
