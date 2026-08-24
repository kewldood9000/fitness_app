import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { db } from '@/db/database'
import { refreshCalorieTargetFromLastCompletedWeek } from '@/db/repositories/progressRepository'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { NutritionPage } from '@/features/nutrition/NutritionPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import {
  ActiveWorkoutPage,
  ExerciseLibraryPage,
  TemplateExerciseEditorPage,
  TemplateEditorPage,
  TemplateListPage,
  WorkoutHistoryPage,
  WorkoutSchedulePage,
  WorkoutSessionDetailPage
} from '@/features/workouts/WorkoutViews'
import { WorkoutPage } from '@/features/workouts/WorkoutPage'

export function App() {
  const [databaseUnavailable, setDatabaseUnavailable] = useState(false)

  useEffect(() => {
    void db.open().then(() => { void refreshCalorieTargetFromLastCompletedWeek().catch(() => undefined) }).catch(() => setDatabaseUnavailable(true))
  }, [])

  return (
    <HashRouter>
      <AppShell>
        {databaseUnavailable && (
          <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-sm text-amber-100">
            Local storage is unavailable. Check your browser privacy settings before adding fitness data.
          </div>
        )}
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
      </AppShell>
    </HashRouter>
  )
}
