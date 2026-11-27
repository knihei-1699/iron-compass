import {lifts} from '../types'
import type {PersonalRecord, Workout} from '../types'
import {estimatedMax, workSets} from './training'
export function forExercise(workout: Workout, exerciseId:string) {
  const itemIds = new Set(workout.session.exercises.filter(item => item.exerciseId === exerciseId).map(item => item.id))
  return workSets(workout.sets).filter(set => itemIds.has(set.itemId))
}
export function personalBest(history:Workout[], records:PersonalRecord[], exerciseId:string) {
  const singles = history.flatMap(workout => forExercise(workout,exerciseId).filter(set => set.reps === 1).map(set => set.weight ?? 0))
  const baseline = records.find(record => record.exerciseId === exerciseId)?.weight
  return singles.length || baseline !== undefined ? Math.max(baseline ?? 0,...singles) : null
}
export function big3(history:Workout[], records:PersonalRecord[]) {
  return lifts.map(id => ({
    id, best:personalBest(history,records,id),
    estimate:estimatedMax(history.flatMap(workout => forExercise(workout,id))),
  }))
}
