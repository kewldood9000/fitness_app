import { db } from '@/db/database'
import { nutritionRepository, type DayNutrition } from './nutritionRepository'
import { settingsRepository } from './settingsRepository'
import { workoutRepository } from './workoutRepository'
import { toDateKey } from '@/utils/dates'

export interface DashboardDay {
  nutrition: DayNutrition
  weightLogged: boolean
  completedWorkout: boolean
  scheduledTemplateId?: string
  scheduledTemplateName?: string
  activeSessionId?: string
  activeSessionName?: string
  workoutSource?: 'scheduled' | 'quick'
}

export const dashboardRepository = {
  async getDay(date: string, weekday: number): Promise<DashboardDay> {
    const [nutrition, weight, completed, scheduled, templates, active, quickSetting] = await Promise.all([
      nutritionRepository.getDayNutrition(date), db.weightLogs.where('date').equals(date).first(), db.workoutSessions.where('date').equals(date).toArray(),
      db.workoutSchedules.where('weekday').equals(weekday).first(), workoutRepository.getTemplates(), workoutRepository.getActiveSession(), settingsRepository.get('quick-workout-template')
    ])
    const scheduledTemplate = templates.find((item) => item.id === scheduled?.templateId)
    const quickTemplate = date === toDateKey(new Date()) ? templates.find((item) => item.id === quickSetting?.value) : undefined
    const template = scheduledTemplate ?? quickTemplate
    return { nutrition, weightLogged: Boolean(weight), completedWorkout: completed.some((item) => item.status === 'completed'), scheduledTemplateId: template?.id, scheduledTemplateName: template?.name, workoutSource: scheduledTemplate ? 'scheduled' : quickTemplate ? 'quick' : undefined, activeSessionId: active?.id, activeSessionName: active?.name }
  },
  async getWeekIndicators(start: string, end: string): Promise<{ nutrition: Set<string>; weight: Set<string>; workout: Set<string> }> {
    const [foods, weights, sessions] = await Promise.all([
      db.foodLogs.where('date').between(start, end, true, true).toArray(), db.weightLogs.where('date').between(start, end, true, true).toArray(), db.workoutSessions.where('date').between(start, end, true, true).toArray()
    ])
    return { nutrition: new Set(foods.map((item) => item.date)), weight: new Set(weights.map((item) => item.date)), workout: new Set(sessions.filter((item) => item.status === 'completed').map((item) => item.date)) }
  }
}
