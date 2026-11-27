import { entity } from '../db/seed'
import { rotations } from '../types'
import type { Workout, WorkoutSession, WorkoutSet, WorkoutTemplate } from '../types'
import { localDate, validDate } from '../utils/date'

export function nextRotation(sessions: WorkoutSession[]) {
  const last = [...sessions].filter(s => s.status === 'finished')
    .sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
  return last ? rotations[(rotations.indexOf(last.rotation) + 1) % rotations.length] : 'A'
}
export function newSet(sessionId: string, itemId: string, reps: number | null = null): WorkoutSet {
  return {...entity(), sessionId, itemId, weight:null, reps, effort:null, effortType:'RPE', kind:'work', done:false}
}
export function newWorkout(template: WorkoutTemplate, gymId: string): Workout {
  const session: WorkoutSession = {...entity(), date:localDate(), name:template.name, rotation:template.rotation,
    gymId, status:'draft', exercises:[]}
  const sets = template.items.flatMap(item => {
    const exercise = {id:crypto.randomUUID(), exerciseId:item.exerciseId, note:''}
    session.exercises.push(exercise)
    return Array.from({length:item.sets}, () => newSet(session.id, exercise.id, item.reps))
  })
  return {session, sets}
}
export function inRange(n: unknown, min: number, max: number, integer = false): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n))
}
export function validateSet(set: WorkoutSet) {
  if ((set.done || set.weight !== null) && !inRange(set.weight,0,1000)) throw Error('重量は0〜1000kgで入力してください。')
  if ((set.done || set.reps !== null) && !inRange(set.reps,1,1000,true)) throw Error('回数は1〜1000の整数で入力してください。')
  if (set.effort !== null && !inRange(set.effort,0,10)) throw Error('RPE・RIRは0〜10で入力してください。')
}
export function validateWorkout(workout: Workout) {
  if (!validDate(workout.session.date)) throw Error('有効な日付を指定してください。')
  if (!workout.sets.some(set => set.done)) throw Error('保存するセットを1つ以上完了してください。')
  workout.sets.forEach(validateSet)
}
export const workSets = (sets: WorkoutSet[]) => sets.filter(set => set.done && set.kind === 'work')
export const volume = (sets: WorkoutSet[]) => workSets(sets).reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0)
export function estimatedMax(sets: WorkoutSet[]) {
  const estimates = workSets(sets).filter(set => set.reps !== null && set.reps <= 10)
    .map(set => (set.weight ?? 0) * (set.reps === 1 ? 1 : 1 + (set.reps ?? 0) / 30))
  return estimates.length ? Math.round(Math.max(...estimates) * 10) / 10 : null
}
