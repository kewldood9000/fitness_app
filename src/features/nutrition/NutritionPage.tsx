import { useLiveQuery } from 'dexie-react-hooks'
import { Barcode, Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Search, Settings, Star, Trash2, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { BarcodeScanner } from '@/features/barcode/BarcodeScanner'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { PageLoading } from '@/components/PageLoading'
import { foodDisplayName, formatFoodLogAmount, GRAMS_PER_OUNCE, nutritionRepository, type FoodAmountUnit, type FoodDetails, type MacroValues } from '@/db/repositories/nutritionRepository'
import { settingsRepository } from '@/db/repositories/settingsRepository'
import { useCachedLiveQueryState } from '@/hooks/useCachedLiveQuery'
import { lookupBarcodeAcrossSources } from '@/services/foodSources/barcodeLookupService'
import { foodSourceLabels, type ExternalFood } from '@/services/foodSources/FoodSourceAdapter'
import { usdaAdapter } from '@/services/foodSources/usda/UsdaFoodSourceAdapter'
import type { FoodSearchResult } from '@/services/foodSources/FoodSourceAdapter'
import type { FoodLogEntry, Meal } from '@/types/models'
import { addDays, formatLongDate, toDateKey } from '@/utils/dates'
import { useIncrementalItems } from '@/hooks/useIncrementalItems'

const meals: Array<{ key: Meal; title: string }> = [{ key: 'breakfast', title: 'Breakfast' }, { key: 'lunch', title: 'Lunch' }, { key: 'dinner', title: 'Dinner' }, { key: 'snacks', title: 'Snacks' }]
interface Goals { calories?: number; protein?: number; carbs?: number; fat?: number }
const emptyMacros = (): MacroValues => ({ ENERGY_KCAL: 0, PROTEIN: 0, CARBOHYDRATE: 0, TOTAL_FAT: 0, FIBER: 0, TOTAL_SUGAR: 0, SODIUM: 0 })

function Sheet({ title, onClose, children, fullHeight = false, hidden = false, keyboardReflow = false }: { title: string; onClose: () => void; children: ReactNode; fullHeight?: boolean; hidden?: boolean; keyboardReflow?: boolean }) {
  const titleId = useId()
  return createPortal(<div aria-hidden={hidden || undefined} aria-labelledby={titleId} aria-modal={hidden ? undefined : 'true'} className={`modal-backdrop ${hidden ? 'modal-hidden' : ''} ${fullHeight ? 'persistent-modal-backdrop' : ''} ${keyboardReflow ? 'keyboard-reflow-modal' : ''}`} role="dialog"><div className={`modal-panel ${fullHeight ? 'persistent-modal-panel' : ''}`}><div className="modal-header flex items-center justify-between gap-3 px-5 pb-4 pt-5"><h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-50" id={titleId}>{title}</h2><button aria-label="Close" className="workout-icon-button" onClick={onClose}><X className="size-4" /></button></div><div className="modal-scroll px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div></div></div>, document.body)
}

function ResultRow({ food, onPick }: { food: FoodDetails; onPick: (food: FoodDetails) => void }) {
  const name = foodDisplayName(food.food)
  return <div className="food-result"><button className="min-w-0 flex-1 text-left" onClick={() => onPick(food)}><strong>{name}</strong><small>{food.food.brand ? `${food.food.brand} · ` : ''}{foodSourceLabels[food.food.source]} · {Math.round(food.nutrients.ENERGY_KCAL)} kcal/100g</small></button><button aria-label={food.favorite ? `Unfavorite ${name}` : `Favorite ${name}`} className={`food-star ${food.favorite ? 'food-star-active' : ''}`} onClick={() => void nutritionRepository.setFavorite(food.food.id, !food.favorite)}><Star className={`size-4 ${food.favorite ? 'fill-current' : ''}`} /></button></div>
}

async function cacheExternalFood(food: ExternalFood): Promise<FoodDetails | undefined> {
  const id = await nutritionRepository.cacheExternalFood({
    source: food.source,
    sourceFoodId: food.sourceFoodId,
    name: food.name,
    brand: food.brand,
    brandOwner: food.brandOwner,
    brandName: food.brandName,
    barcode: food.barcode,
    ingredients: food.ingredients,
    publicationDate: food.publicationDate,
    servingName: food.servingName,
    servingGrams: food.servingGrams,
    nutrients: food.nutrients as MacroValues
  })
  return nutritionRepository.getFoodDetails(id)
}

function MacroInput({ label, name, placeholderValue = 0 }: { label: string; name: string; placeholderValue?: number }) { return <label className="field-label text-[10px] uppercase tracking-[0.08em] text-slate-500">{label}<input className="compact-field mt-1" inputMode="decimal" min="0" name={name} placeholder={String(placeholderValue)} step="0.1" type="number" /></label> }

function FoodLogSheet({ entry, food, date, meal, onEdit, onBack, onSaved }: { entry?: FoodLogEntry; food: FoodDetails; date: string; meal: Meal; onEdit?: (food: FoodDetails) => void; onBack: () => void; onSaved: () => void }) {
  const loggedServing = entry ? food.servings.find((item) => item.name === entry.servingUnit) : undefined
  const initialPortion = entry
    ? entry.servingUnit === 'g' || entry.servingUnit === 'oz'
      ? entry.servingUnit
      : loggedServing?.id ?? 'g'
    : food.food.defaultServingId ?? food.servings[0]?.id ?? 'g'
  const initialQuantity = entry
    ? entry.servingUnit === 'g' || entry.servingUnit === 'oz'
      ? entry.servingQuantity
      : loggedServing ? entry.servingQuantity / Math.max(loggedServing.quantity, 0.01) : entry.grams ?? entry.servingQuantity
    : 1
  const [selectedMeal, setSelectedMeal] = useState(meal)
  const [portion, setPortion] = useState(initialPortion)
  const [quantity, setQuantity] = useState('')
  const [fallbackQuantity, setFallbackQuantity] = useState(initialQuantity)
  const [remembered, setRemembered] = useState(Boolean(entry))
  const [saving, setSaving] = useState(false)
  const [favorite, setFavorite] = useState(food.favorite)
  const [shownName, setShownName] = useState(foodDisplayName(food.food))
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(foodDisplayName(food.food))
  const [renameError, setRenameError] = useState('')
  const lastEntry = useLiveQuery(() => nutritionRepository.getLastFoodLog(food.food.id), [food.food.id], null)
  const serving = food.servings.find((item) => item.id === portion) ?? food.servings[0]
  const amountUnit: FoodAmountUnit = portion === 'g' ? 'g' : portion === 'oz' ? 'oz' : 'serving'
  const amount = quantity.trim() ? Number(quantity) || 0 : fallbackQuantity
  const grams = amountUnit === 'g'
    ? amount
    : amountUnit === 'oz'
      ? amount * GRAMS_PER_OUNCE
      : (serving?.grams ?? 100) * amount
  const factor = grams / 100

  useEffect(() => {
    if (remembered || lastEntry === null) return
    setRemembered(true)
    if (!lastEntry) return
    if ((lastEntry.servingUnit === 'g' || lastEntry.servingUnit === 'oz') && lastEntry.servingQuantity > 0) {
      setPortion(lastEntry.servingUnit)
      setFallbackQuantity(lastEntry.servingQuantity)
      return
    }
    const priorServing = food.servings.find((item) => item.name === lastEntry.servingUnit)
    if (priorServing && lastEntry.servingQuantity > 0) {
      setPortion(priorServing.id)
      setFallbackQuantity(lastEntry.servingQuantity / Math.max(priorServing.quantity, 0.01))
      return
    }
    if (lastEntry.grams && lastEntry.grams > 0) {
      setPortion('g')
      setFallbackQuantity(lastEntry.grams)
    }
  }, [food.servings, lastEntry, remembered])

  function selectPortion(nextPortion: string) {
    setRemembered(true)
    const nextServing = food.servings.find((item) => item.id === nextPortion)
    const nextQuantity = nextPortion === 'g'
      ? grams
      : nextPortion === 'oz'
        ? grams / GRAMS_PER_OUNCE
        : nextServing?.grams ? grams / nextServing.grams : amount
    setPortion(nextPortion)
    if (quantity.trim()) setQuantity(String(Math.round(nextQuantity * 100) / 100))
    else setFallbackQuantity(nextQuantity)
  }

  async function toggleFavorite() {
    const next = !favorite
    setFavorite(next)
    try { await nutritionRepository.setFavorite(food.food.id, next) } catch { setFavorite(!next) }
  }

  async function saveName() {
    const nextName = nameDraft.trim()
    if (!nextName) return setRenameError('Enter a food name.')
    try {
      await nutritionRepository.setFoodDisplayName(food.food.id, nextName)
      setShownName(nextName)
      setRenameError('')
      setRenaming(false)
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : 'Unable to rename this food.')
    }
  }

  async function save() {
    if (amount <= 0) return
    setSaving(true)
    try {
      const input = { date, meal: selectedMeal, foodId: food.food.id, servingId: amountUnit === 'serving' ? portion : undefined, quantity: amount, amountUnit }
      if (entry) await nutritionRepository.updateFoodLog(entry.id, input)
      else await nutritionRepository.logFood(input)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return <Sheet onClose={onBack} title={entry ? 'Edit logged food' : 'Log food'}>
    <div className="rounded-2xl bg-slate-800/65 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-base font-semibold text-slate-100">{shownName}</p><p className="mt-1 text-xs text-slate-500">{food.food.brand || foodSourceLabels[food.food.source]}</p></div><div className="-mr-1 -mt-1 flex shrink-0 gap-1"><button aria-label={favorite ? `Unfavorite ${shownName}` : `Favorite ${shownName}`} className={`food-star ${favorite ? 'food-star-active' : ''}`} onClick={() => void toggleFavorite()} type="button"><Star className={`size-5 ${favorite ? 'fill-current' : ''}`} /></button>{food.food.source !== 'CUSTOM' && <button aria-expanded={renaming} aria-label={`Rename ${shownName}`} className={`food-star ${renaming ? 'text-sky-300 bg-sky-300/[0.08]' : ''}`} onClick={() => setRenaming((current) => !current)} type="button"><Settings className="size-5" /></button>}</div></div><div className="mt-4 grid grid-cols-4 gap-2">{[['kcal', food.nutrients.ENERGY_KCAL * factor], ['protein', food.nutrients.PROTEIN * factor], ['carbs', food.nutrients.CARBOHYDRATE * factor], ['fat', food.nutrients.TOTAL_FAT * factor]].map(([label, value]) => <div key={label as string}><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label as string}</p><p className="mt-1 text-sm font-semibold text-slate-200">{Math.round(Number(value) * 10) / 10}</p></div>)}</div></div>
    {food.food.source !== 'CUSTOM' && renaming && <div className="mt-2 rounded-xl border border-white/[0.07] bg-slate-800/45 p-3"><label className="field-label">Name shown in this app<input aria-label="Food display name" className="field-input" onChange={(event) => setNameDraft(event.target.value)} value={nameDraft} /></label>{renameError && <p className="mt-2 text-xs text-rose-300">{renameError}</p>}<div className="mt-2 flex gap-2"><button className="button-secondary flex-1" onClick={() => { setNameDraft(shownName); setRenameError(''); setRenaming(false) }} type="button">Cancel</button><button className="button-primary flex-1" onClick={() => void saveName()} type="button"><Check className="size-4" />Save name</button></div><p className="mt-2 text-xs leading-5 text-slate-500">This only changes the name shown in Pocket Pace. Barcode and database nutrition remain linked.</p></div>}
    <label className="field-label mt-4">Meal<select className="field-input" onChange={(event) => setSelectedMeal(event.target.value as Meal)} value={selectedMeal}>{meals.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}</select></label>
    <div className="mt-3 grid grid-cols-2 gap-3"><label className="field-label">Amount<input className="field-input" inputMode="decimal" min="0.01" onChange={(event) => { setRemembered(true); setQuantity(event.target.value) }} placeholder={String(Math.round(fallbackQuantity * 10_000) / 10_000)} step="any" type="number" value={quantity} /></label><label className="field-label">Unit<select className="field-input" onChange={(event) => selectPortion(event.target.value)} value={portion}><option value="g">Grams (g)</option><option value="oz">Ounces (oz)</option>{food.servings.map((item) => <option key={item.id} value={item.id}>{item.quantity !== 1 ? `${item.quantity} ` : ''}{item.name}{item.grams ? ` (${item.grams} g)` : ''}</option>)}</select></label></div>
    {onEdit && food.food.source === 'CUSTOM' && <button className="button-quiet mt-3" onClick={() => onEdit(food)}>Edit custom food</button>}
    <button className="button-primary mt-5 w-full" disabled={saving || amount <= 0} onClick={() => void save()}>{saving ? 'Saving…' : entry ? 'Save changes' : 'Log food'}</button>
  </Sheet>
}

function CustomFoodSheet({ barcode, existing, onCreated, onDeleted, onClose }: { barcode?: string; existing?: FoodDetails; onCreated: (food: FoodDetails) => void; onDeleted?: () => void; onClose: () => void }) {
  const [error, setError] = useState('')
  const existingServing = existing?.servings.find((item) => item.id === existing.food.defaultServingId) ?? existing?.servings[0]
  const grams = existingServing?.grams ?? 100
  const macro = (code: keyof MacroValues) => Math.round(((existing?.nutrients[code] ?? 0) * grams / 100) * 10) / 10
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const textValue = (field: string, fallback = '') => String(form.get(field) ?? '').trim() || fallback
    const numberValue = (field: string, fallback: number) => {
      const raw = String(form.get(field) ?? '').trim()
      const parsed = raw ? Number(raw) : fallback
      return Number.isFinite(parsed) ? parsed : fallback
    }
    const name = textValue('name', existing?.food.name ?? '')
    const servingWeightRaw = String(form.get('servingWeight') ?? '').trim()
    const servingWeight = numberValue('servingWeight', grams)
    const servingWeightUnit = String(form.get('servingWeightUnit') ?? 'g')
    const servingGrams = !servingWeightRaw ? grams : servingWeightUnit === 'oz' ? servingWeight * GRAMS_PER_OUNCE : servingWeight
    if (!name || !servingGrams) return setError('Enter a food name and serving weight.')
    const macros = emptyMacros()
    macros.ENERGY_KCAL = numberValue('calories', macro('ENERGY_KCAL')); macros.PROTEIN = numberValue('protein', macro('PROTEIN')); macros.CARBOHYDRATE = numberValue('carbs', macro('CARBOHYDRATE')); macros.TOTAL_FAT = numberValue('fat', macro('TOTAL_FAT')); macros.FIBER = numberValue('fiber', macro('FIBER')); macros.TOTAL_SUGAR = numberValue('sugar', macro('TOTAL_SUGAR')); macros.SODIUM = numberValue('sodium', macro('SODIUM'))
    const input = { name, brand: textValue('brand', existing?.food.brand ?? ''), barcode: textValue('barcode', existing?.food.barcode ?? barcode ?? ''), servingName: textValue('servingName', existingServing?.name ?? 'serving'), servingQuantity: numberValue('servingQuantity', existingServing?.quantity ?? 1), servingGrams, macros, ingredients: textValue('ingredients', existing?.food.ingredients ?? ''), notes: textValue('notes', existing?.food.notes ?? '') }
    const foodId = existing ? existing.food.id : await nutritionRepository.createCustomFood(input)
    if (existing) await nutritionRepository.updateCustomFood(foodId, input)
    const details = await nutritionRepository.getFoodDetails(foodId)
    if (details) onCreated(details)
  }
  async function remove() {
    if (existing && window.confirm(`Delete ${existing.food.name}? Logged meals will keep their saved snapshots.`)) {
      await nutritionRepository.deleteCustomFood(existing.food.id)
      onDeleted?.()
    }
  }
  return <Sheet fullHeight keyboardReflow onClose={onClose} title={existing ? 'Edit custom food' : 'Custom food'}><form className="space-y-3" onSubmit={(event) => void submit(event)}><label className="field-label">Food name<input className="field-input" name="name" placeholder={existing?.food.name ?? 'e.g. Protein shake'} /></label><div className="grid grid-cols-2 gap-3"><label className="field-label">Brand<input className="field-input" name="brand" placeholder={existing?.food.brand ?? 'Optional'} /></label><label className="field-label">Barcode<input className="field-input" inputMode="numeric" name="barcode" placeholder={existing?.food.barcode || barcode || 'Optional'} /></label></div><div className="grid grid-cols-2 gap-3"><label className="field-label">Label serving name<input className="field-input" name="servingName" placeholder={existingServing?.name ?? 'serving'} /></label><label className="field-label">Label serving qty<input className="field-input" inputMode="decimal" min="0.01" name="servingQuantity" placeholder={String(existingServing?.quantity ?? 1)} step="any" type="number" /></label></div><div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3"><label className="field-label">Serving weight<input className="field-input" inputMode="decimal" min="0.01" name="servingWeight" placeholder={String(grams)} step="any" type="number" /></label><label className="field-label">Unit<select className="field-input" defaultValue="g" name="servingWeightUnit"><option value="g">grams</option><option value="oz">ounces</option></select></label></div><p className="text-xs leading-5 text-slate-500">Enter calories and macros exactly as shown for this label serving. You can log any gram or ounce amount later.</p><div className="grid grid-cols-4 gap-2"><MacroInput label="Kcal" name="calories" placeholderValue={macro('ENERGY_KCAL')} /><MacroInput label="Protein" name="protein" placeholderValue={macro('PROTEIN')} /><MacroInput label="Carbs" name="carbs" placeholderValue={macro('CARBOHYDRATE')} /><MacroInput label="Fat" name="fat" placeholderValue={macro('TOTAL_FAT')} /></div><details className="rounded-xl bg-slate-800/60 px-3 py-2"><summary className="cursor-pointer text-sm font-semibold text-slate-300">More nutrients & notes</summary><div className="mt-3 grid grid-cols-3 gap-2"><MacroInput label="Fiber g" name="fiber" placeholderValue={macro('FIBER')} /><MacroInput label="Sugar g" name="sugar" placeholderValue={macro('TOTAL_SUGAR')} /><MacroInput label="Sodium mg" name="sodium" placeholderValue={macro('SODIUM')} /></div><label className="field-label mt-3">Ingredients<textarea className="field-input min-h-18" name="ingredients" placeholder={existing?.food.ingredients ?? 'Optional ingredients'} /></label><label className="field-label mt-3">Notes<textarea className="field-input min-h-18" name="notes" placeholder={existing?.food.notes ?? 'Optional notes'} /></label></details>{error && <p className="text-sm text-rose-300">{error}</p>}<button className="button-primary w-full" type="submit">{existing ? 'Save changes' : 'Save custom food'}</button>{existing && <button className="button-danger-outline w-full" type="button" onClick={() => void remove()}>Delete custom food</button>}</form></Sheet>
}

function BarcodeSourceSheet({ barcode, loading, matches, onChoose, onManual, onClose }: { barcode: string; loading: boolean; matches: ExternalFood[]; onChoose: (food: ExternalFood) => void; onManual: () => void; onClose: () => void }) {
  return <Sheet onClose={onClose} title="Choose food source"><p className="mb-3 text-sm leading-5 text-slate-400">{matches.length > 1 ? `Barcode ${barcode} matched more than one database. Choose the entry whose label information looks right.` : `Found a match for ${barcode}. You can select it now while the other databases finish checking.`}</p>{loading && <p className="mb-3 rounded-xl bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-200">Checking other enabled databases…</p>}<div className="space-y-2">{matches.map((food) => {
    const servingGrams = food.servingGrams ?? 100
    const servingCalories = food.nutrients.ENERGY_KCAL * servingGrams / 100
    return <button className="w-full rounded-2xl border border-white/[0.07] bg-slate-800/70 p-4 text-left transition hover:border-sky-300/30 hover:bg-slate-800" key={`${food.source}:${food.sourceFoodId}`} onClick={() => onChoose(food)} type="button"><span className="inline-flex rounded-full bg-sky-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-sky-300">{foodSourceLabels[food.source]}</span><strong className="mt-2 block text-sm text-slate-100">{food.name}</strong>{food.brand && <span className="mt-0.5 block text-xs text-slate-400">{food.brand}</span>}<span className="mt-2 block text-xs text-slate-500">{Math.round(servingCalories * 10) / 10} kcal · {food.servingName || `${Math.round(servingGrams * 10) / 10} g`}</span></button>
  })}</div><button className="button-secondary mt-3 w-full" onClick={onManual} type="button"><Plus className="size-4" />Enter manually instead</button></Sheet>
}

function FoodSearchSheet({ hidden, onClose, onSelect }: { hidden?: boolean; onClose: () => void; onSelect: (food: FoodDetails) => void }) {
  const [tab, setTab] = useState<'all' | 'favorites' | 'custom'>('all')
  const [query, setQuery] = useState('')
  const [usdaResults, setUsdaResults] = useState<FoodSearchResult[]>([])
  const [message, setMessage] = useState('')
  const [scanning, setScanning] = useState(false)
  const [customBarcode, setCustomBarcode] = useState<string | undefined>()
  const [barcodeMatches, setBarcodeMatches] = useState<ExternalFood[]>([])
  const [matchedBarcode, setMatchedBarcode] = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const barcodeLookupRef = useRef<AbortController | undefined>(undefined)
  const localMatches = useLiveQuery(() => tab === 'all' && query.trim() ? nutritionRepository.searchLocal(query, 30) : Promise.resolve([]), [query, tab])
  const favorites = useLiveQuery(() => nutritionRepository.getFavorites(), [])
  const recents = useLiveQuery(() => nutritionRepository.getRecents(50), [])
  const customFoods = useLiveQuery(() => nutritionRepository.getCustomFoods(), [])
  const cleanQuery = query.trim().toLocaleLowerCase()
  const matchesQuery = (food: FoodDetails) => !cleanQuery || [foodDisplayName(food.food), food.food.name, food.food.brand].some((value) => value?.toLocaleLowerCase().includes(cleanQuery))
  const scopedFoods = tab === 'favorites'
    ? (favorites ?? []).filter(matchesQuery)
    : tab === 'custom'
      ? (customFoods ?? []).filter(matchesQuery)
      : cleanQuery ? (localMatches ?? []) : (recents ?? [])
  const resultRows: Array<{ type: 'local'; food: FoodDetails } | { type: 'usda'; result: FoodSearchResult }> = [
    ...scopedFoods.map((food) => ({ type: 'local' as const, food })),
    ...(tab === 'all' && cleanQuery.length >= 3 ? usdaResults.map((result) => ({ type: 'usda' as const, result })) : [])
  ]
  const pagedResults = useIncrementalItems(resultRows, 25, `${tab}:${cleanQuery}`)
  const placeholder = tab === 'all' ? 'Search all foods' : tab === 'favorites' ? 'Search favorites' : 'Search custom foods'

  useEffect(() => {
    setUsdaResults([])
    setMessage('')
    if (tab !== 'all' || cleanQuery.length < 3) return
    const timer = window.setTimeout(() => {
      void usdaAdapter.search(cleanQuery).then(setUsdaResults).catch((error) => setMessage(error instanceof Error ? error.message : 'USDA search failed.'))
    }, 450)
    return () => window.clearTimeout(timer)
  }, [cleanQuery, tab])

  useEffect(() => () => barcodeLookupRef.current?.abort(), [])

  async function selectUsda(result: FoodSearchResult) { try { const details = await cacheExternalFood(await usdaAdapter.getFood(result.sourceFoodId)); if (details) onSelect(details) } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save that USDA food.') } }
  async function chooseBarcodeFood(food: ExternalFood, fallbackBarcode = matchedBarcode) {
    barcodeLookupRef.current?.abort()
    barcodeLookupRef.current = undefined
    setBarcodeLoading(false)
    try { const details = await cacheExternalFood({ ...food, barcode: food.barcode || fallbackBarcode }); setBarcodeMatches([]); if (details) onSelect(details) } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save that food.'); setBarcodeMatches([]) }
  }

  function dismissBarcodeMatches() {
    barcodeLookupRef.current?.abort()
    barcodeLookupRef.current = undefined
    setBarcodeLoading(false)
    setBarcodeMatches([])
  }

  async function onBarcode(value: string) {
    setScanning(false)
    barcodeLookupRef.current?.abort()
    const lookupController = new AbortController()
    barcodeLookupRef.current = lookupController
    setBarcodeLoading(true)
    setBarcodeMatches([])
    setMatchedBarcode(value)
    setMessage('Checking enabled food databases…')
    const localFood = await nutritionRepository.findByBarcode(value)
    if (lookupController.signal.aborted) return
    if (localFood) {
      barcodeLookupRef.current = undefined
      setBarcodeLoading(false)
      setMessage('')
      onSelect(localFood)
      return
    }
    try {
      const result = await lookupBarcodeAcrossSources(value, {
        signal: lookupController.signal,
        timeoutMs: 3_000,
        onMatch: (food) => {
          if (lookupController.signal.aborted) return
          setBarcodeMatches((current) => current.some((item) => item.source === food.source && item.sourceFoodId === food.sourceFoodId) ? current : [...current, food])
          setMessage('Match found. Checking the remaining databases…')
        }
      })
      if (lookupController.signal.aborted) return
      if (result.matches.length > 1) {
        setBarcodeMatches(result.matches)
        setMessage(result.issues.length ? result.issues.map((issue) => `${issue.source}: ${issue.message}`).join(' ') : '')
        return
      }
      if (result.matches.length === 1) {
        await chooseBarcodeFood(result.matches[0], value)
        return
      }
      if (result.timedOut) {
        const issueText = result.issues.map((issue) => `${issue.source}: ${issue.message}`).join(' ')
        setMessage(`${issueText ? `${issueText} ` : ''}No barcode result arrived within 3 seconds. Try scanning again or enter it manually.`)
        return
      }
      setMessage(result.issues.length ? result.issues.map((issue) => `${issue.source}: ${issue.message}`).join(' ') : 'No database match found. You can create this food manually.')
      setCustomBarcode(value)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Barcode lookup failed.')
      if (localFood) onSelect(localFood)
      else setCustomBarcode(value)
    } finally {
      if (barcodeLookupRef.current === lookupController) {
        barcodeLookupRef.current = undefined
        setBarcodeLoading(false)
      }
    }
  }
  return <Sheet fullHeight hidden={hidden} onClose={onClose} title="Add food">
    <div className="food-search-row"><div className="food-search-field"><Search aria-hidden="true" /><input aria-label={placeholder} className="field-input" onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} type="search" value={query} /></div><button aria-label="Scan barcode" className="food-barcode-button" disabled={barcodeLoading} onClick={() => setScanning(true)}><Barcode aria-hidden="true" /></button></div>
    <div aria-label="Food list" className="food-search-tabs" role="tablist">{(['all', 'favorites', 'custom'] as const).map((item) => <button aria-selected={tab === item} className={`food-search-tab ${tab === item ? 'food-search-tab-active' : ''}`} key={item} onClick={() => setTab(item)} role="tab" type="button">{item === 'all' ? 'All' : item === 'favorites' ? 'Favorites' : 'Custom'}</button>)}</div>
    <button className="button-quiet mt-2" onClick={() => setCustomBarcode('')}><Plus className="size-4" />Create custom food</button>
    {message && <p className="mt-3 rounded-xl bg-amber-300/10 px-3 py-2.5 text-sm leading-5 text-amber-100">{message}</p>}
    <div className="food-tab-results mt-3" role="tabpanel">
      {pagedResults.visibleItems.map((item) => item.type === 'local'
        ? <ResultRow food={item.food} key={`local:${item.food.food.id}`} onPick={onSelect} />
        : <button className="food-result w-full text-left" key={`usda:${item.result.sourceFoodId}`} onClick={() => void selectUsda(item.result)}><span className="min-w-0 flex-1"><strong>{item.result.name}</strong><small>{item.result.brand ? `${item.result.brand} · ` : ''}USDA</small></span><ChevronRight className="size-4 text-slate-500" /></button>)}
      {resultRows.length === 0 && <p className="result-empty">{cleanQuery ? `No ${tab === 'all' ? 'food' : tab} matches yet.` : tab === 'all' ? 'Foods you log will appear here in recent-history order.' : tab === 'favorites' ? 'Favorite a food for fast access.' : 'Create a custom food to see it here.'}</p>}
    </div>
    <LoadMoreButton onClick={pagedResults.showMore} shown={pagedResults.shown} total={pagedResults.total} />
    {scanning && <BarcodeScanner onClose={() => setScanning(false)} onDetected={(value) => void onBarcode(value)} />}
    {customBarcode !== undefined && <CustomFoodSheet barcode={customBarcode} onClose={() => setCustomBarcode(undefined)} onCreated={(food) => { setCustomBarcode(undefined); onSelect(food) }} />}
    {barcodeMatches.length > 0 && <BarcodeSourceSheet barcode={matchedBarcode} loading={barcodeLoading} matches={barcodeMatches} onChoose={(food) => void chooseBarcodeFood(food)} onClose={dismissBarcodeMatches} onManual={() => { dismissBarcodeMatches(); setCustomBarcode(matchedBarcode) }} />}
  </Sheet>
}

export function NutritionPage() {
  const [date, setDate] = useState(new Date())
  const [meal, setMeal] = useState<Meal | undefined>()
  const [selectedFood, setSelectedFood] = useState<FoodDetails | undefined>()
  const [editingFood, setEditingFood] = useState<FoodDetails | undefined>()
  const [editingLog, setEditingLog] = useState<FoodLogEntry | undefined>()
  const [summaryMode, setSummaryMode] = useState<'consumed' | 'remaining'>('consumed')
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [expandedMeals, setExpandedMeals] = useState<Set<Meal>>(new Set())
  const mealEndRefs = useRef(new Map<Meal, HTMLDivElement>())
  const mealRevealTimer = useRef<number | undefined>(undefined)
  const key = toDateKey(date)
  const dayState = useCachedLiveQueryState(`nutrition-day:${key}`, () => nutritionRepository.getDayNutrition(key), [key])
  const settingState = useCachedLiveQueryState('setting:nutrition-goals', () => settingsRepository.get('nutrition-goals'), [])
  const day = dayState.value
  const setting = settingState.value
  const goals = (setting?.value as Goals | undefined) ?? {}
  const totals = day?.totals ?? emptyMacros()
  const isToday = key === toDateKey(new Date())
  const dateLabel = isToday
    ? `Today, ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`
    : formatLongDate(date)
  const currentHour = new Date().getHours()
  const quickMeal: Meal = currentHour < 11 ? 'breakfast' : currentHour < 16 ? 'lunch' : currentHour < 21 ? 'dinner' : 'snacks'

  const percentage = (value: number, target?: number) => target && target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0
  const shown = (value: number, target?: number) => summaryMode === 'remaining' && target != null ? Math.max(0, target - value) : value
  const formatMacro = (value: number) => Math.round(value * 10) / 10
  const caloriePercent = percentage(totals.ENERGY_KCAL, goals.calories)
  const displayedCalories = Math.round(shown(totals.ENERGY_KCAL, goals.calories))
  const calorieStatus = goals.calories && goals.calories > 0
    ? totals.ENERGY_KCAL > goals.calories
      ? 'nutrition-calorie-total-over'
      : totals.ENERGY_KCAL >= goals.calories - 20 ? 'nutrition-calorie-total-on-target' : ''
    : ''

  function openMeal(mealKey: Meal) {
    setExpandedMeals((current) => new Set(current).add(mealKey))
    setEditingLog(undefined)
    setSelectedFood(undefined)
    setMeal(mealKey)
  }

  function toggleMeal(mealKey: Meal) {
    const opening = !expandedMeals.has(mealKey)
    setExpandedMeals((current) => {
      const next = new Set(current)
      if (next.has(mealKey)) next.delete(mealKey)
      else next.add(mealKey)
      return next
    })
    if (opening) {
      window.clearTimeout(mealRevealTimer.current)
      mealRevealTimer.current = window.setTimeout(() => {
        const anchor = mealEndRefs.current.get(mealKey)
        if (!anchor) return
        const viewportBottom = (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? window.innerHeight)
        const navigationTop = document.querySelector<HTMLElement>('.bottom-nav')?.getBoundingClientRect().top ?? viewportBottom
        const visibleBottom = Math.min(viewportBottom, navigationTop) - 12
        const hiddenBy = anchor.getBoundingClientRect().bottom - visibleBottom
        if (hiddenBy > 0) window.scrollBy({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', top: hiddenBy })
      }, 210)
    }
  }

  function openQuickSearch() {
    openMeal(quickMeal)
  }

  async function openLoggedFood(entry: FoodLogEntry) {
    const food = await nutritionRepository.getFoodDetails(entry.foodId)
    if (!food) return
    setMeal(undefined)
    setEditingLog(entry)
    setSelectedFood(food)
  }

  function closeFoodFlow() {
    setEditingFood(undefined)
    setEditingLog(undefined)
    setSelectedFood(undefined)
    setMeal(undefined)
  }

  const macroItems = [
    { key: 'protein', label: 'Protein', value: totals.PROTEIN, target: goals.protein, color: 'violet' },
    { key: 'carbs', label: 'Carbs', value: totals.CARBOHYDRATE, target: goals.carbs, color: 'mint' },
    { key: 'fat', label: 'Fat', value: totals.TOTAL_FAT, target: goals.fat, color: 'amber' }
  ] as const

  useEffect(() => () => window.clearTimeout(mealRevealTimer.current), [])

  if (dayState.loading || settingState.loading) return <PageLoading />

  return <div className="nutrition-page pb-3 pt-2">
    <section className="nutrition-date-row" aria-label="Selected nutrition date">
      <button aria-label="Previous day" className="nutrition-date-button" onClick={() => setDate(addDays(date, -1))}><ChevronLeft /></button>
      <h1>{dateLabel}</h1>
      <button aria-label="Next day" className="nutrition-date-button" onClick={() => setDate(addDays(date, 1))}><ChevronRight /></button>
    </section>

    <section className="nutrition-summary-card" aria-label="Daily nutrition summary">
      <div className="nutrition-summary-tabs" role="group" aria-label="Nutrition summary display">
        <button aria-pressed={summaryMode === 'consumed'} className={summaryMode === 'consumed' ? 'active' : ''} onClick={() => setSummaryMode('consumed')}>Consumed</button>
        <button aria-pressed={summaryMode === 'remaining'} className={summaryMode === 'remaining' ? 'active' : ''} onClick={() => setSummaryMode('remaining')}>Remaining</button>
      </div>

      <div className={`nutrition-calorie-total ${calorieStatus}`}>
        <strong>{displayedCalories}</strong>
        <span>/ {goals.calories ?? '—'} kcal</span>
      </div>
      <div aria-label={`${Math.round(caloriePercent)} percent of calorie goal consumed`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(caloriePercent)} className="nutrition-calorie-track" role="progressbar">
        <i style={{ width: `${caloriePercent}%` }} />
      </div>

      <div className="nutrition-macro-grid">
        {macroItems.map((macro) => {
          const progress = percentage(macro.value, macro.target)
          return <div className="nutrition-macro" key={macro.key}>
            <p>{macro.label}</p>
            <div aria-label={`${Math.round(progress)} percent of ${macro.label.toLowerCase()} goal consumed`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(progress)} className={`nutrition-macro-track nutrition-macro-${macro.color}`} role="progressbar"><i style={{ width: `${progress}%` }} /></div>
            <strong>{formatMacro(shown(macro.value, macro.target))} <span>/ {macro.target ?? '—'}g</span></strong>
          </div>
        })}
      </div>

      <button aria-expanded={showBreakdown} className="nutrition-breakdown-toggle" onClick={() => setShowBreakdown((current) => !current)}>Full breakdown <ChevronDown className={showBreakdown ? 'rotate-180' : ''} /></button>
      {showBreakdown && <div className="nutrition-breakdown">
        <span><small>Fiber</small><strong>{formatMacro(totals.FIBER)}g</strong></span>
        <span><small>Sugar</small><strong>{formatMacro(totals.TOTAL_SUGAR)}g</strong></span>
        <span><small>Sodium</small><strong>{Math.round(totals.SODIUM)}mg</strong></span>
      </div>}
    </section>

    <div className="nutrition-food-heading">
      <h2>Food Log</h2>
      <div className="nutrition-food-actions">
        <button aria-label="Search for a food" className="nutrition-heading-action" onClick={openQuickSearch}><Search /></button>
        <Link aria-label="Edit nutrition goals" className="nutrition-heading-action" to="/settings"><Settings /></Link>
      </div>
    </div>

    <div className="nutrition-meals">
      {meals.map(({ key: mealKey, title }) => {
        const entries = day?.entries.filter((entry) => entry.meal === mealKey) ?? []
        const kcal = entries.reduce((sum, entry) => sum + entry.calories, 0)
        const protein = entries.reduce((sum, entry) => sum + entry.protein, 0)
        const expanded = expandedMeals.has(mealKey)
        return <section className="nutrition-meal-card" key={mealKey}>
          <div className="nutrition-meal-header">
            <button aria-expanded={expanded} className="nutrition-meal-toggle" onClick={() => toggleMeal(mealKey)}>
              <ChevronDown className={expanded ? '' : '-rotate-90'} />
              <strong>{title}</strong>
            </button>
            <div className="nutrition-meal-totals"><span>{Math.round(kcal)} Cal</span><span>{formatMacro(protein)} P</span></div>
            <button aria-label={`Add food to ${title}`} className="nutrition-meal-add" onClick={() => openMeal(mealKey)}><Plus /></button>
          </div>
          <div aria-hidden={!expanded} className={`nutrition-meal-collapse ${expanded ? 'nutrition-meal-collapse-open' : ''}`}>
            <div className="nutrition-meal-collapse-inner">
              <div className="nutrition-meal-entries">
                {entries.length ? entries.map((entry) => <div className="food-log-row" key={entry.id}>
                  <button aria-label={`Edit logged ${String(entry.foodSnapshot.name ?? 'food')}`} className="food-log-edit" onClick={() => void openLoggedFood(entry)}>
                    <span className="min-w-0 flex-1"><strong>{String(entry.foodSnapshot.name ?? 'Food')}</strong><small>{formatFoodLogAmount(entry)}</small></span>
                    <span className="text-right text-sm font-semibold text-slate-300">{entry.calories} Cal<small>{entry.protein}g protein</small></span>
                  </button>
                  <button aria-label={`Delete ${String(entry.foodSnapshot.name ?? 'food')}`} className="set-delete-button" onClick={() => { if (window.confirm('Delete this food entry?')) void nutritionRepository.deleteFoodLog(entry.id) }}><Trash2 className="size-4" /></button>
                </div>) : <p className="nutrition-meal-empty">No foods logged yet.</p>}
                <div aria-hidden="true" className="nutrition-meal-end" ref={(node) => { if (node) mealEndRefs.current.set(mealKey, node); else mealEndRefs.current.delete(mealKey) }} />
              </div>
            </div>
          </div>
        </section>
      })}
    </div>

    {meal && <FoodSearchSheet hidden={Boolean(selectedFood)} onClose={closeFoodFlow} onSelect={setSelectedFood} />}
    {selectedFood && (meal || editingLog) && <FoodLogSheet date={editingLog?.date ?? key} entry={editingLog} food={selectedFood} key={editingLog?.id ?? selectedFood.food.id} meal={editingLog?.meal ?? meal!} onBack={() => { if (editingLog) closeFoodFlow(); else setSelectedFood(undefined) }} onEdit={setEditingFood} onSaved={closeFoodFlow} />}
    {editingFood && <CustomFoodSheet existing={editingFood} onClose={() => setEditingFood(undefined)} onCreated={(food) => { setEditingFood(undefined); setSelectedFood(food) }} onDeleted={closeFoodFlow} />}
  </div>
}
