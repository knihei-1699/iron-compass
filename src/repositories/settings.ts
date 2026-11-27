import type {CompassDatabase} from '../db'
import {entity} from '../db/seed'
import {lifts} from '../types'
import type {AppSettings, Entity, Exercise, Gym, GymEquipment, Lift, TrainingGoal, UserProfile, WorkoutTemplate} from '../types'

export function updated<T extends Entity>(value:T):T {
  return {...value,updatedAt:new Date().toISOString()}
}
export function settingsRepository(db:CompassDatabase) {
  return {
    saveProfile:(profile:UserProfile) => db.profiles.put(updated(profile)),
    saveSettings:(settings:AppSettings) => db.settings.put(updated(settings)),
    saveTemplate:(template:WorkoutTemplate) => db.templates.put(updated(template)),
    saveGym:(gym:Gym) => db.gyms.put(updated(gym)),
    saveEquipment:(equipment:GymEquipment) => db.equipment.put(updated(equipment)),
    saveExercise:(exercise:Exercise) => db.exercises.put(updated(exercise)),
    removeEquipment:(id:string) => db.equipment.delete(id),
    removeExercise:(id:string) => removeExercise(db,id),
    removeGym:(id:string) => removeGym(db,id),
    saveGoal:(goal:TrainingGoal,best:Record<Lift,number | null>) =>
      db.transaction('rw',db.goals,db.records,async () => {
        await db.goals.put(updated(goal))
        for (const lift of lifts) {
          const record = await db.records.where('exerciseId').equals(lift).first()
          const weight = best[lift]
          if (weight !== null) await db.records.put(updated({...(record ?? entity(lift)),exerciseId:lift,weight}))
          else if (record) await db.records.delete(record.id)
        }
      }),
  }
}
export async function removeExercise(db:CompassDatabase,id:string) {
  await db.transaction('rw', [db.exercises, db.templates, db.sessions, db.records, db.recommendations, db.coachMenus], async () => {
    if (['bench','squat','deadlift'].includes(id)) throw Error('BIG3の種目は削除できません。')
    const [templates,sessions,recommendations] = await Promise.all([db.templates.toArray(),db.sessions.toArray(),db.recommendations.toArray()])
    if ([...templates,...recommendations].some(t => t.items.some(item => item.exerciseId === id)) ||
        (await db.coachMenus.toArray()).some(m=>m.menu.exercises.some(e=>e.exerciseId===id || e.alternatives.includes(id))) ||
        sessions.some(s => s.exercises.some(item => item.exerciseId === id)) ||
        await db.records.where('exerciseId').equals(id).count()) throw Error('メニュー、記録、または自己ベストから参照されている種目です。')
    await db.exercises.delete(id)
  })
}
export async function removeGym(db:CompassDatabase,id:string) {
  await db.transaction('rw', db.gyms, db.equipment, db.sessions, db.readiness, db.coachMenus, async () => {
    const [sessions,readiness] = await Promise.all([db.sessions.toArray(),db.readiness.toArray()])
    if ([...sessions,...readiness].some(row => row.gymId === id) ||
        await db.coachMenus.where('gymId').equals(id).count()) throw Error('記録から参照されているジムです。')
    await db.equipment.where('gymId').equals(id).delete()
    await db.gyms.delete(id)
  })
}
