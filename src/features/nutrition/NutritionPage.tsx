import { useLiveQuery } from 'dexie-react-hooks'
import { Barcode, Camera, ChevronDown, ChevronLeft, ChevronRight, Plus, Search, Settings, Star, Trash2, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarcodeScanner } from '@/features/barcode/BarcodeScanner'
import { nutritionRepository, type FoodDetails, type MacroValues } from '@/db/repositories/nutritionRepository'
import { settingsRepository } from '@/db/repositories/settingsRepository'
import { usdaAdapter } from '@/services/foodSources/usda/UsdaFoodSourceAdapter'
import type { FoodSearchResult } from '@/services/foodSources/FoodSourceAdapter'
import type { Meal } from '@/types/models'
import { addDays, formatLongDate, toDateKey } from '@/utils/dates'

const meals: Array<{ key: Meal; title: string }> = [{ key: 'breakfast', title: 'Breakfast' }, { key: 'lunch', title: 'Lunch' }, { key: 'dinner', title: 'Dinner' }, { key: 'snacks', title: 'Snacks' }]
interface Goals { calories?: number; protein?: number; carbs?: number; fat?: number }
const emptyMacros = (): MacroValues => ({ ENERGY_KCAL: 0, PROTEIN: 0, CARBOHYDRATE: 0, TOTAL_FAT: 0, FIBER: 0, TOTAL_SUGAR: 0, SODIUM: 0 })

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  return <div aria-labelledby={titleId} aria-modal="true" className="modal-backdrop" role="dialog"><div className="modal-panel"><div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5"><h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-50" id={titleId}>{title}</h2><button aria-label="Close" className="workout-icon-button" onClick={onClose}><X className="size-4" /></button></div><div className="max-h-[72dvh] overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div></div></div>
}

function ResultRow({ food, onPick }: { food: FoodDetails; onPick: (food: FoodDetails) => void }) {
  return <div className="food-result"><button className="min-w-0 flex-1 text-left" onClick={() => onPick(food)}><strong>{food.food.name}</strong><small>{food.food.brand ? `${food.food.brand} · ` : ''}{food.food.source === 'USDA' ? 'USDA' : 'Custom'} · {Math.round(food.nutrients.ENERGY_KCAL)} kcal/100g</small></button><button aria-label={food.favorite ? `Unfavorite ${food.food.name}` : `Favorite ${food.food.name}`} className={`food-star ${food.favorite ? 'food-star-active' : ''}`} onClick={() => void nutritionRepository.setFavorite(food.food.id, !food.favorite)}><Star className="size-4" /></button></div>
}

function MacroInput({ label, name, defaultValue = 0 }: { label: string; name: string; defaultValue?: number }) { return <label className="field-label text-[10px] uppercase tracking-[0.08em] text-slate-500">{label}<input className="compact-field mt-1" defaultValue={defaultValue} inputMode="decimal" min="0" name={name} step="0.1" type="number" /></label> }

function FoodLogSheet({ food, date, meal, onEdit, onClose }: { food: FoodDetails; date: string; meal: Meal; onEdit?: (food: FoodDetails) => void; onClose: () => void }) {
  const [selectedMeal, setSelectedMeal] = useState(meal)
  const [servingId, setServingId] = useState(food.food.defaultServingId ?? food.servings[0]?.id ?? '')
  const [quantity, setQuantity] = useState('1')
  const [saving, setSaving] = useState(false)
  const serving = food.servings.find((item) => item.id === servingId) ?? food.servings[0]
  const grams = (serving?.grams ?? 100) * (Number(quantity) || 0) / Math.max(serving?.quantity ?? 1, 0.01)
  const factor = grams / 100
  async function log() { setSaving(true); try { await nutritionRepository.logFood({ date, meal: selectedMeal, foodId: food.food.id, servingId, quantity: Number(quantity) || 1 }); onClose() } finally { setSaving(false) } }
  return <Sheet onClose={onClose} title="Log food"><div className="rounded-2xl bg-slate-800/65 p-4"><p className="text-base font-semibold text-slate-100">{food.food.name}</p><p className="mt-1 text-xs text-slate-500">{food.food.brand || (food.food.source === 'USDA' ? 'USDA FoodData Central' : 'Custom food')}</p><div className="mt-4 grid grid-cols-4 gap-2">{[['kcal', food.nutrients.ENERGY_KCAL * factor], ['protein', food.nutrients.PROTEIN * factor], ['carbs', food.nutrients.CARBOHYDRATE * factor], ['fat', food.nutrients.TOTAL_FAT * factor]].map(([label, value]) => <div key={label as string}><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label as string}</p><p className="mt-1 text-sm font-semibold text-slate-200">{Math.round(Number(value) * 10) / 10}</p></div>)}</div></div><div className="mt-4 grid grid-cols-2 gap-3"><label className="field-label">Meal<select className="field-input" onChange={(event) => setSelectedMeal(event.target.value as Meal)} value={selectedMeal}>{meals.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}</select></label><label className="field-label">Amount<input className="field-input" inputMode="decimal" min="0.01" onChange={(event) => setQuantity(event.target.value)} step="0.1" type="number" value={quantity} /></label></div><label className="field-label mt-3">Serving<select className="field-input" onChange={(event) => setServingId(event.target.value)} value={servingId}>{food.servings.map((item) => <option key={item.id} value={item.id}>{item.quantity !== 1 ? `${item.quantity} ` : ''}{item.name}{item.grams ? ` (${item.grams} g)` : ''}</option>)}</select></label>{onEdit && food.food.source === 'CUSTOM' && <button className="button-quiet mt-3" onClick={() => onEdit(food)}>Edit custom food</button>}<button className="button-primary mt-5 w-full" disabled={saving} onClick={() => void log()}>{saving ? 'Logging…' : 'Log food'}</button></Sheet>
}

function CustomFoodSheet({ barcode, existing, onCreated, onDeleted, onClose }: { barcode?: string; existing?: FoodDetails; onCreated: (food: FoodDetails) => void; onDeleted?: () => void; onClose: () => void }) {
  const [error, setError] = useState('')
  const existingServing = existing?.servings.find((item) => item.id === existing.food.defaultServingId) ?? existing?.servings[0]
  const grams = existingServing?.grams ?? 100
  const macro = (code: keyof MacroValues) => Math.round(((existing?.nutrients[code] ?? 0) * grams / 100) * 10) / 10
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const servingGrams = Number(form.get('grams') ?? 0)
    if (!name || !servingGrams) return setError('Enter a food name and gram weight.')
    const macros = emptyMacros()
    macros.ENERGY_KCAL = Number(form.get('calories') ?? 0); macros.PROTEIN = Number(form.get('protein') ?? 0); macros.CARBOHYDRATE = Number(form.get('carbs') ?? 0); macros.TOTAL_FAT = Number(form.get('fat') ?? 0); macros.FIBER = Number(form.get('fiber') ?? 0); macros.TOTAL_SUGAR = Number(form.get('sugar') ?? 0); macros.SODIUM = Number(form.get('sodium') ?? 0)
    const input = { name, brand: String(form.get('brand') ?? ''), barcode: String(form.get('barcode') ?? ''), servingName: String(form.get('servingName') ?? 'serving'), servingQuantity: Number(form.get('servingQuantity') ?? 1), servingGrams, macros, ingredients: String(form.get('ingredients') ?? ''), notes: String(form.get('notes') ?? '') }
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
  return <Sheet onClose={onClose} title={existing ? 'Edit custom food' : 'Custom food'}><form className="space-y-3" onSubmit={(event) => void submit(event)}><label className="field-label">Food name<input autoFocus className="field-input" defaultValue={existing?.food.name} name="name" placeholder="e.g. Protein shake" /></label><div className="grid grid-cols-2 gap-3"><label className="field-label">Brand<input className="field-input" defaultValue={existing?.food.brand} name="brand" placeholder="Optional" /></label><label className="field-label">Barcode<input className="field-input" defaultValue={existing?.food.barcode ?? barcode} inputMode="numeric" name="barcode" placeholder="Optional" /></label></div><div className="grid grid-cols-3 gap-3"><label className="field-label">Serving name<input className="field-input" defaultValue={existingServing?.name ?? 'serving'} name="servingName" /></label><label className="field-label">Serving qty<input className="field-input" defaultValue={existingServing?.quantity ?? 1} inputMode="decimal" name="servingQuantity" type="number" /></label><label className="field-label">Gram weight<input className="field-input" defaultValue={grams} inputMode="decimal" name="grams" type="number" /></label></div><div className="grid grid-cols-4 gap-2"><MacroInput defaultValue={macro('ENERGY_KCAL')} label="Kcal" name="calories" /><MacroInput defaultValue={macro('PROTEIN')} label="Protein" name="protein" /><MacroInput defaultValue={macro('CARBOHYDRATE')} label="Carbs" name="carbs" /><MacroInput defaultValue={macro('TOTAL_FAT')} label="Fat" name="fat" /></div><details className="rounded-xl bg-slate-800/60 px-3 py-2"><summary className="cursor-pointer text-sm font-semibold text-slate-300">More nutrients & notes</summary><div className="mt-3 grid grid-cols-3 gap-2"><MacroInput defaultValue={macro('FIBER')} label="Fiber g" name="fiber" /><MacroInput defaultValue={macro('TOTAL_SUGAR')} label="Sugar g" name="sugar" /><MacroInput defaultValue={macro('SODIUM')} label="Sodium mg" name="sodium" /></div><label className="field-label mt-3">Ingredients<textarea className="field-input min-h-18" defaultValue={existing?.food.ingredients} name="ingredients" /></label><label className="field-label mt-3">Notes<textarea className="field-input min-h-18" defaultValue={existing?.food.notes} name="notes" /></label></details>{error && <p className="text-sm text-rose-300">{error}</p>}<button className="button-primary w-full" type="submit">{existing ? 'Save changes' : 'Save custom food'}</button>{existing && <button className="button-danger-outline w-full" type="button" onClick={() => void remove()}>Delete custom food</button>}</form></Sheet>
}

function Group({ title, children }: { title: string; children: ReactNode }) { return <section><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{title}</p><div className="overflow-hidden rounded-2xl border border-white/[0.07]">{children}</div></section> }

function FoodSearchSheet({ onClose, onSelect }: { onClose: () => void; onSelect: (food: FoodDetails) => void }) {
  const [query, setQuery] = useState(''); const [usdaResults, setUsdaResults] = useState<FoodSearchResult[]>([]); const [message, setMessage] = useState(''); const [scanning, setScanning] = useState(false); const [customBarcode, setCustomBarcode] = useState<string | undefined>()
  const local = useLiveQuery(() => query.trim() ? nutritionRepository.searchLocal(query) : Promise.resolve([]), [query])
  const favorites = useLiveQuery(() => nutritionRepository.getFavorites(), []); const recents = useLiveQuery(() => nutritionRepository.getRecents(), [])
  useEffect(() => { const clean = query.trim(); setUsdaResults([]); setMessage(''); if (clean.length < 3) return; const timer = window.setTimeout(() => { void usdaAdapter.search(clean).then(setUsdaResults).catch((error) => setMessage(error instanceof Error ? error.message : 'USDA search failed.')) }, 450); return () => window.clearTimeout(timer) }, [query])
  async function selectUsda(result: FoodSearchResult) { try { const external = await usdaAdapter.getFood(result.sourceFoodId); const id = await nutritionRepository.cacheUsdaFood({ sourceFoodId: external.sourceFoodId, name: external.name, brand: external.brand, brandOwner: external.brandOwner, brandName: external.brandName, barcode: external.barcode, ingredients: external.ingredients, publicationDate: external.publicationDate, servingName: external.servingName, servingGrams: external.servingGrams, nutrients: external.macroValues }); const details = await nutritionRepository.getFoodDetails(id); if (details) onSelect(details) } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save that USDA food.') } }
  async function onBarcode(value: string) { setScanning(false); const localFood = await nutritionRepository.findByBarcode(value); if (localFood) return onSelect(localFood); try { const external = await usdaAdapter.lookupBarcode(value); if (!external) return setCustomBarcode(value); const id = await nutritionRepository.cacheUsdaFood({ sourceFoodId: external.sourceFoodId, name: external.name, brand: external.brand, brandOwner: external.brandOwner, brandName: external.brandName, barcode: external.barcode ?? value, ingredients: external.ingredients, publicationDate: external.publicationDate, servingName: external.servingName, servingGrams: external.servingGrams, nutrients: external.macroValues }); const details = await nutritionRepository.getFoodDetails(id); if (details) onSelect(details) } catch (error) { setMessage(error instanceof Error ? error.message : 'Barcode lookup failed.'); setCustomBarcode(value) } }
  return <Sheet onClose={onClose} title="Add food"><div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><input autoFocus className="field-input mt-0 pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search foods" type="search" value={query} /></div><button aria-label="Scan barcode" className="round-add-button" onClick={() => setScanning(true)}><Barcode className="size-5" /></button></div><button className="button-quiet mt-2" onClick={() => setCustomBarcode('')}><Plus className="size-4" />Create custom food</button>{message && <p className="mt-3 rounded-xl bg-amber-300/10 px-3 py-2.5 text-sm leading-5 text-amber-100">{message}</p>}<div className="mt-3 space-y-4">{query.trim() ? <><Group title="On this device">{local?.length ? local.map((food) => <ResultRow food={food} key={food.food.id} onPick={onSelect} />) : <p className="result-empty">No local matches yet.</p>}</Group><Group title="USDA FoodData Central">{usdaResults.length ? usdaResults.map((result) => <button className="food-result w-full text-left" key={result.sourceFoodId} onClick={() => void selectUsda(result)}><span className="min-w-0 flex-1"><strong>{result.name}</strong><small>{result.brand ? `${result.brand} · ` : ''}USDA</small></span><ChevronRight className="size-4 text-slate-500" /></button>) : <p className="result-empty">USDA results appear after three letters; enter your API key in Settings.</p>}</Group></> : <><Group title="Recent foods">{recents?.length ? recents.map((food) => <ResultRow food={food} key={food.food.id} onPick={onSelect} />) : <p className="result-empty">Recently logged foods will appear here.</p>}</Group><Group title="Favorites">{favorites?.length ? favorites.map((food) => <ResultRow food={food} key={food.food.id} onPick={onSelect} />) : <p className="result-empty">Favorite a food for fast access.</p>}</Group></>}</div>{scanning && <BarcodeScanner onClose={() => setScanning(false)} onDetected={(value) => void onBarcode(value)} />}{customBarcode !== undefined && <CustomFoodSheet barcode={customBarcode} onClose={() => setCustomBarcode(undefined)} onCreated={(food) => { setCustomBarcode(undefined); onSelect(food) }} />}</Sheet>
}

export function NutritionPage() {
  const [date, setDate] = useState(new Date())
  const [meal, setMeal] = useState<Meal | undefined>()
  const [selectedFood, setSelectedFood] = useState<FoodDetails | undefined>()
  const [editingFood, setEditingFood] = useState<FoodDetails | undefined>()
  const [summaryMode, setSummaryMode] = useState<'consumed' | 'remaining'>('consumed')
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [expandedMeals, setExpandedMeals] = useState<Set<Meal>>(new Set())
  const key = toDateKey(date)
  const day = useLiveQuery(() => nutritionRepository.getDayNutrition(key), [key])
  const setting = useLiveQuery(() => settingsRepository.get('nutrition-goals'), [])
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

  function openMeal(mealKey: Meal) {
    setExpandedMeals((current) => new Set(current).add(mealKey))
    setMeal(mealKey)
  }

  function toggleMeal(mealKey: Meal) {
    setExpandedMeals((current) => {
      const next = new Set(current)
      if (next.has(mealKey)) next.delete(mealKey)
      else next.add(mealKey)
      return next
    })
  }

  function openQuickSearch() {
    openMeal(quickMeal)
  }

  const macroItems = [
    { key: 'protein', label: 'Protein', value: totals.PROTEIN, target: goals.protein, color: 'violet' },
    { key: 'carbs', label: 'Carbs', value: totals.CARBOHYDRATE, target: goals.carbs, color: 'mint' },
    { key: 'fat', label: 'Fat', value: totals.TOTAL_FAT, target: goals.fat, color: 'amber' }
  ] as const

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

      <div className="nutrition-calorie-total">
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
      <Link aria-label="Edit nutrition goals" to="/settings"><Settings /></Link>
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
          {expanded && <div className="nutrition-meal-entries">
            {entries.length ? entries.map((entry) => <div className="food-log-row" key={entry.id}>
              <span className="min-w-0 flex-1"><strong>{String(entry.foodSnapshot.name ?? 'Food')}</strong><small>{entry.servingQuantity} {entry.servingUnit}</small></span>
              <span className="text-right text-sm font-semibold text-slate-300">{entry.calories} Cal<small>{entry.protein}g protein</small></span>
              <button aria-label={`Delete ${String(entry.foodSnapshot.name ?? 'food')}`} className="set-delete-button" onClick={() => { if (window.confirm('Delete this food entry?')) void nutritionRepository.deleteFoodLog(entry.id) }}><Trash2 className="size-4" /></button>
            </div>) : <p className="nutrition-meal-empty">No foods logged yet.</p>}
          </div>}
        </section>
      })}
    </div>

    <div className="nutrition-search-dock">
      <button onClick={openQuickSearch}><Search /><span>Search for a food</span></button>
      <button aria-label="Scan a food barcode" onClick={openQuickSearch}><Camera /></button>
    </div>

    {meal && !selectedFood && <FoodSearchSheet onClose={() => setMeal(undefined)} onSelect={setSelectedFood} />}
    {meal && selectedFood && <FoodLogSheet date={key} food={selectedFood} meal={meal} onEdit={setEditingFood} onClose={() => { setSelectedFood(undefined); setMeal(undefined) }} />}
    {editingFood && <CustomFoodSheet existing={editingFood} onClose={() => setEditingFood(undefined)} onCreated={(food) => { setEditingFood(undefined); setSelectedFood(food) }} onDeleted={() => { setEditingFood(undefined); setSelectedFood(undefined); setMeal(undefined) }} />}
  </div>
}
