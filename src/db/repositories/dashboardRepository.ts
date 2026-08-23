import { db } from '@/db/database'
import { nutritionRepository, type DayNutrition } from './nutritionRepository'
import { workoutRepository } from './workoutRepository'

export interface DashboardDay {
  nutrition: DayNutrition
  weightLogged: boolean
  completedWorkout: boolean
  scheduledTemplateId?: string
  scheduledTemplateName?: string
  activeSessionId?: string
  activeSessionName?: string
}

export const dashboardRepository = {
  async getDay(date: string, weekday: number): Promise<DashboardDay> {
    const [nutrition, weight, completed, scheduled, templates, active] = await Promise.all([
      nutritionRepository.getDayNutrition(date), db.weightLogs.where('date').equals(date).first(), db.workoutSessions.where('date').equals(date).toArray(),
      db.workoutSchedules.where('weekday').equals(weekday).first(), workoutRepository.getTemplates(), workoutRepository.getActiveSession()
    ])
    const template = templates.find((item) => item.id === scheduled?.templateId)
    return { nutrition, weightLogged: Boolean(weight), completedWorkout: completed.some((item) => item.status === 'completed'), scheduledTemplateId: template?.id, scheduledTemplateName: template?.name, activeSessionId: active?.id, activeSessionName: active?.name }
  },
  async getWeekIndicators(start: string, end: string): Promise<{ nutrition: Set<string>; weight: Set<string>; workout: Set<string> }> {
    const [foods, weights, sessions] = await Promise.all([
      db.foodLogs.where('date').between(start, end, true, true).toArray(), db.weightLogs.where('date').between(start, end, true, true).toArray(), db.workoutSessions.where('date').between(start, end, true, true).toArray()
    ])
    return { nutrition: new Set(foods.map((item) => item.date)), weight: new Set(weights.map((item) => item.date)), workout: new Set(sessions.filter((item) => item.status === 'completed').map((item) => item.date)) }
  }
}
