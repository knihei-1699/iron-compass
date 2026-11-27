import {lifts} from '../types'
import type {Exercise, Workout} from '../types'
import {forExercise} from './analysis'
import {estimatedMax, volume} from './training'

export function offsetDate(date:string, days:number) {
  const value = new Date(date + 'T00:00:00Z')
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0,10)
}
export function daysBetween(from:string,to:string) {
  return Math.round((Date.parse(to)-Date.parse(from))/86400000)
}
export function during(history:Workout[],start:string,end:string) {
  return history.filter(w => w.session.status === 'finished' && w.session.date >= start && w.session.date <= end)
}
export function weekly(history:Workout[],exercises:Exercise[],date:string) {
  const rows = during(history,offsetDate(date,-6),date)
  const byMuscle = new Map<string,number>()
  const byExercise = exercises.flatMap(ex => {
    const groups = rows.map(w => forExercise(w,ex.id)).filter(sets => sets.length)
    const sets = groups.reduce((sum,group) => sum + group.length,0)
    if (!sets) return []
    byMuscle.set(ex.muscle,(byMuscle.get(ex.muscle) ?? 0)+sets)
    return [{id:ex.id,name:ex.name,sets,frequency:groups.length}]
  })
  return {volume:rows.reduce((sum,w)=>sum+volume(w.sets),0),byExercise,byMuscle:Object.fromEntries(byMuscle)}
}
export function monthlyVolume(history:Workout[],date:string) {
  return during(history,date.slice(0,7)+'-01',date).reduce((sum,w)=>sum+volume(w.sets),0)
}
export function exerciseSeries(history:Workout[],id:string) {
  return history.filter(w=>w.session.status==='finished').sort((a,b)=>a.session.date.localeCompare(b.session.date) ||
    a.session.createdAt.localeCompare(b.session.createdAt)).flatMap(w=>{
    const sets = forExercise(w,id)
    if (!sets.length) return []
    const top = [...sets].sort((a,b)=>(b.weight ?? 0)-(a.weight ?? 0) || (b.reps ?? 0)-(a.reps ?? 0))[0]
    const singles = sets.filter(s=>s.reps===1).map(s=>s.weight ?? 0)
    return [{date:w.session.date,weight:top.weight ?? 0,reps:top.reps ?? 0,estimate:estimatedMax(sets),
      actual:singles.length ? Math.max(...singles) : null}]
  })
}
export function big3Series(history:Workout[]) {
  return lifts.map(id=>({id,points:exerciseSeries(history,id)}))
}
function rate(current:number|null, prior:number|null) {
  return current === null || prior === null || prior === 0 ? null : Math.round((current-prior)/prior*1000)/10
}
export function compare(history:Workout[],id:string) {
  const points = exerciseSeries(history,id)
  const [previous,current] = points.slice(-2)
  const eligible = points.filter(p=>p.estimate !== null && p.estimate>0).slice(-3)
  const stalled = eligible.length === 3 && points.at(-1) === eligible.at(-1) &&
    daysBetween(eligible[0].date,eligible[2].date) >= 14 &&
    Math.max(...eligible.slice(1).map(p=>p.estimate!)) < eligible[0].estimate!*1.01
  return {previous:current ? previous : undefined,current:points.at(-1),stalled,
    rates:current && previous ? {weight:rate(current.weight,previous.weight),reps:rate(current.reps,previous.reps),
      estimate:rate(current.estimate,previous.estimate)} : null}
}
