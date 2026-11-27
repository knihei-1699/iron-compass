export interface Entity { id: string; createdAt: string; updatedAt: string }
export const rotations = ['A', 'B', 'C'] as const
export type Rotation = typeof rotations[number]
export const lifts = ['bench', 'squat', 'deadlift'] as const
export type Lift = typeof lifts[number]
export interface UserProfile extends Entity {
  height: number; weight: number; experience: string; purpose: string; priorities: string; policy: string
}
export interface TrainingGoal extends Entity { total: number; targets: Record<Lift, number | null> }
export interface Exercise extends Entity { name: string; muscle: string; requiredEquipment?:string[] }
export interface Gym extends Entity { name: string }
export interface GymEquipment extends Entity { gymId: string; name: string; available: boolean }
export interface PlanItem { exerciseId: string; sets: number; reps: number }
export interface WorkoutTemplate extends Entity { name: string; rotation: Rotation; items: PlanItem[] }
export interface SessionExercise { id: string; exerciseId: string; note: string; restSeconds?:number }
export interface WorkoutSession extends Entity {
  date: string; rotation: Rotation; name: string; gymId: string; status: 'draft' | 'finished'; exercises: SessionExercise[]
}
export interface WorkoutSet extends Entity {
  sessionId: string; itemId: string; position?: number; weight: number | null; reps: number | null;
  effort: number | null; effortType: 'RPE' | 'RIR'; kind: 'work' | 'warmup'; done: boolean
}
export interface Workout { session: WorkoutSession; sets: WorkoutSet[] }
export interface ReadinessCheck extends Entity {
  date: string; minutes: number; gymId: string; sleep: number; fatigue: number;
  soreness: string; pain: string; request: string
}
export interface PersonalRecord extends Entity { exerciseId: string; weight: number }
export interface CoachingRecommendation extends Entity { name: string; items: PlanItem[] }
export interface AppSettings extends Entity { interval: number }
export const liftLabels: Record<Lift, string> = {bench:'ベンチプレス',squat:'スクワット',deadlift:'デッドリフト'}
