import Dexie, { type Table } from 'dexie'
import type {CoachReply,DailyCondition,SavedMenu} from '../types/coach'
import type { AppSettings, CoachingRecommendation, Exercise, Gym, GymEquipment, PersonalRecord, ReadinessCheck, TrainingGoal, UserProfile, WorkoutSession, WorkoutSet, WorkoutTemplate } from '../types'

export class CompassDatabase extends Dexie {
  profiles!: Table<UserProfile, string>
  goals!: Table<TrainingGoal, string>
  exercises!: Table<Exercise, string>
  gyms!: Table<Gym, string>
  equipment!: Table<GymEquipment, string>
  templates!: Table<WorkoutTemplate, string>
  sessions!: Table<WorkoutSession, string>
  sets!: Table<WorkoutSet, string>
  readiness!: Table<ReadinessCheck, string>
  records!: Table<PersonalRecord, string>
  recommendations!: Table<CoachingRecommendation, string>
  settings!: Table<AppSettings, string>
  conditions!: Table<DailyCondition,string>
  coachMenus!: Table<SavedMenu,string>
  coachReplies!: Table<CoachReply,string>

  constructor(name = 'iron-compass') {
    super(name)
    this.version(1).stores({
      profiles: 'id', goals: 'id', exercises: 'id', gyms: 'id', equipment: 'id,gymId',
      templates: 'id,&rotation', sessions: 'id,date,status', sets: 'id,sessionId,itemId',
      readiness: 'id,&date', records: 'id,&exerciseId', recommendations: 'id', settings: 'id',
    })
    this.version(2).stores({conditions:'id,&date',coachMenus:'id,date,gymId',coachReplies:'id,date'})
  }
}
export const db = new CompassDatabase()
