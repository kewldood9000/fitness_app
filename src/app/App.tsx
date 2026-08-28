import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { PageLoading } from '@/components/PageLoading'
import { db } from '@/db/database'
import { refreshCalorieTargetFromLastCompletedWeek } from '@/db/repositories/progressRepository'
import { preloadPrimaryRoutes, routeLoaders } from './routeLoaders'

const DashboardPage = lazy(() => routeLoaders.dashboard().then((module) => ({ default: module.DashboardPage })))
const NutritionPage = lazy(() => routeLoaders.nutrition().then((module) => ({ default: module.NutritionPage })))
const ProgressPage = lazy(() => routeLoaders.progress().then((module) => ({ default: module.ProgressPage })))
const SettingsPage = lazy(() => routeLoaders.settings().then((module) => ({ default: module.SettingsPage })))
const WorkoutPage = lazy(() => routeLoaders.workout().then((module) => ({ default: module.WorkoutPage })))
const ActiveWorkoutPage = lazy(() => routeLoaders.workoutViews().then((module) => ({ default: module.ActiveWorkoutPage })))
const ExerciseLibraryPage = lazy(() => routeLoaders.workoutViews().then((module) => ({ default: module.ExerciseLibraryPage })))
const TemplateExerciseEditorPage = lazy(() => routeLoaders.workoutViews().then((module) => ({ default: module.TemplateExerciseEditorPage })))
const TemplateEditorPage = lazy(() => routeLoaders.workoutViews().then((module) => ({ default: module.TemplateEditorPage })))
const TemplateListPage = lazy(() => routeLoaders.workoutViews().then((module) => ({ default: module.TemplateListPage })))
const WorkoutHistoryPage = lazy(() => routeLoaders.workoutViews().then((module) => ({ default: module.WorkoutHistoryPage })))
const WorkoutSchedulePage = lazy(() => routeLoaders.workoutViews().then((module) => ({ default: module.WorkoutSchedulePage })))
const WorkoutSessionDetailPage = lazy(() => routeLoaders.workoutViews().then((module) => ({ default: module.WorkoutSessionDetailPage })))

export function App() {
  const [databaseUnavailable, setDatabaseUnavailable] = useState(false)

  useEffect(() => {
    void db.open().then(() => { void refreshCalorieTargetFromLastCompletedWeek().catch(() => undefined) }).catch(() => setDatabaseUnavailable(true))
    const preload = window.setTimeout(preloadPrimaryRoutes, 250)
    return () => window.clearTimeout(preload)
  }, [])

  return (
    <HashRouter>
      <AppShell>
        {databaseUnavailable && (
          <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-sm text-amber-100">
            Local storage is unavailable. Check your browser privacy settings before adding fitness data.
          </div>
        )}
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="nutrition" element={<NutritionPage />} />
            <Route path="workout" element={<WorkoutPage />} />
            <Route path="workout/library" element={<ExerciseLibraryPage />} />
            <Route path="workout/templates" element={<TemplateListPage />} />
            <Route path="workout/templates/:templateId" element={<TemplateEditorPage />} />
            <Route path="workout/templates/:templateId/exercises/:templateExerciseId" element={<TemplateExerciseEditorPage />} />
            <Route path="workout/schedule" element={<WorkoutSchedulePage />} />
            <Route path="workout/active/:sessionId" element={<ActiveWorkoutPage />} />
            <Route path="workout/history" element={<WorkoutHistoryPage />} />
            <Route path="workout/history/:sessionId" element={<WorkoutSessionDetailPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate replace to="/" />} />
          </Routes>
        </Suspense>
      </AppShell>
    </HashRouter>
  )
}
