export const routeLoaders = {
  dashboard: () => import('@/features/dashboard/DashboardPage'),
  nutrition: () => import('@/features/nutrition/NutritionPage'),
  progress: () => import('@/features/progress/ProgressPage'),
  settings: () => import('@/features/settings/SettingsPage'),
  workout: () => import('@/features/workouts/WorkoutPage'),
  workoutViews: () => import('@/features/workouts/WorkoutViews')
}

export function preloadPrimaryRoutes() {
  void Promise.allSettled([
    routeLoaders.dashboard(),
    routeLoaders.nutrition(),
    routeLoaders.progress(),
    routeLoaders.settings(),
    routeLoaders.workout()
  ])
}

export function preloadRoute(path: string) {
  if (path === '/') void routeLoaders.dashboard()
  else if (path === '/nutrition') void routeLoaders.nutrition()
  else if (path === '/progress') void routeLoaders.progress()
  else if (path === '/settings') void routeLoaders.settings()
  else if (path === '/workout') void routeLoaders.workout()
  else if (path.startsWith('/workout/')) void routeLoaders.workoutViews()
}
