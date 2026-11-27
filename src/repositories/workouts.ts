import type { CompassDatabase } from '../db'
import type { Workout } from '../types'
import { validateWorkout } from '../services/training'

export async function saveWorkout(db: CompassDatabase, workout: Workout) {
  const {session, sets} = workout
  if (session.status === 'finished') validateWorkout(workout)
  const items = new Set(session.exercises.map(item => item.id))
  if (sets.some(set => set.sessionId !== session.id || !items.has(set.itemId))) throw Error('セットの参照が無効です。')
  await db.transaction('rw', db.sessions, db.sets, async () => {
    const now = new Date().toISOString()
    const existing = await db.sessions.get(session.id)
    if (existing?.status === 'finished' && session.status === 'draft') return
    if (session.status === 'draft' && !existing &&
        await db.sessions.where('status').equals('draft').count()) throw Error('別の画面に入力中の記録があります。再読み込みしてください。')
    await db.sessions.put({...session, updatedAt:now})
    await db.sets.where('sessionId').equals(session.id).delete()
    await db.sets.bulkPut(sets.map((set,position) => ({...set, position, updatedAt:now})))
  })
}
export async function deleteWorkout(db: CompassDatabase, id: string) {
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sessions.delete(id)
    await db.sets.where('sessionId').equals(id).delete()
  })
}
export async function loadWorkouts(db: CompassDatabase) {
  return db.transaction('r', db.sessions, db.sets, async () => {
    const [sessions, sets] = await Promise.all([db.sessions.toArray(),db.sets.toArray()])
    const grouped = new Map<string, Workout['sets']>()
    sets.forEach(set => {
      const group = grouped.get(set.sessionId) ?? []
      group.push(set)
      grouped.set(set.sessionId,group)
    })
    return sessions.sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .map(session => ({session,sets:(grouped.get(session.id) ?? []).sort((a,b) => (a.position ?? 0) - (b.position ?? 0))}))
  })
}
