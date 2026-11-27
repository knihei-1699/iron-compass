import 'fake-indexeddb/auto'
import {afterEach,beforeEach,describe,expect,it} from 'vitest'
import {CompassDatabase} from '../db'
import {initialize} from '../db/seed'
import {deleteWorkout, loadWorkouts, saveWorkout} from '../repositories/workouts'
import {exportBackup,parseBackup,restoreBackup} from '../services/backup'
import {estimatedMax,newWorkout,nextRotation,validateSet,volume} from '../services/training'
import type {Workout} from '../types'

let db:CompassDatabase
beforeEach(async () => {
  db = new CompassDatabase('test-' + crypto.randomUUID())
  await initialize(db)
})
afterEach(async () => db.delete())
async function example(finished = true): Promise<Workout> {
  const workout = newWorkout((await db.templates.get('A'))!,'sample-gym')
  if (finished) workout.session.status = 'finished'
  workout.sets[0] = {...workout.sets[0], weight:100, reps:5, done:true}
  return workout
}

describe('ワークアウト', () => {
  it('完了セットと種目を登録し、編集と削除を反映する',async () => {
    const workout = await example()
    await saveWorkout(db,workout)
    expect(volume((await loadWorkouts(db))[0].sets)).toBe(500)
    workout.sets[0].weight = 105
    await saveWorkout(db,workout)
    expect((await loadWorkouts(db))[0].sets[0].weight).toBe(105)
    await deleteWorkout(db,workout.session.id)
    expect(await db.sessions.count()).toBe(0)
    expect(await db.sets.count()).toBe(0)
  })
  it('DBを開き直しても下書きとセット順が保持される',async () => {
    const draft = await example(false)
    await saveWorkout(db,draft)
    const name = db.name
    db.close()
    db = new CompassDatabase(name)
    await initialize(db)
    const [saved] = await loadWorkouts(db)
    expect(saved.session.status).toBe('draft')
    expect(saved.sets.map(set => set.id)).toEqual(draft.sets.map(set => set.id))
    expect(saved.sets[0].weight).toBe(100)
  })
  it('日付に間があっても完了した記録でA→B→C→Aと進む',async () => {
    expect(nextRotation([])).toBe('A')
    const workout = await example()
    expect(nextRotation([workout.session])).toBe('B')
    const b = {...workout.session,rotation:'B' as const,date:'2099-01-01'}
    expect(nextRotation([b,workout.session])).toBe('C')
    expect(nextRotation([{...b,rotation:'C',date:'2099-02-03'},b])).toBe('A')
    expect(nextRotation([{...b,status:'draft'},workout.session])).toBe('B')
  })
  it('負の重量、小数・ゼロの回数、完了時の未入力を拒否する',async () => {
    const [set] = (await example()).sets
    for (const patch of [{weight:-1},{weight:null},{reps:1.5},{reps:0},{reps:null},{effort:11}]) {
      expect(() => validateSet({...set,...patch})).toThrow()
    }
    expect(() => validateSet({...set,weight:0,reps:1})).not.toThrow()
    expect(estimatedMax([set,{...set,kind:'warmup',weight:200}])).toBe(116.7)
  })
  it('完了セットがない記録はトランザクション前に拒否する',async () => {
    const workout = await example()
    workout.sets.forEach(set => set.done = false)
    await expect(saveWorkout(db,workout)).rejects.toThrow()
    expect(await db.sessions.count()).toBe(0)
  })
})
describe('バックアップ', () => {
  it('設定と記録をまとめて復元する',async () => {
    const workout = await example()
    await saveWorkout(db,workout)
    const backup = await exportBackup(db)
    await deleteWorkout(db,workout.session.id)
    await db.goals.update('main',{total:600})
    await restoreBackup(db,backup)
    expect(await db.sessions.count()).toBe(1)
    expect((await db.goals.get('main'))?.total).toBe(300)
    expect((await loadWorkouts(db))[0].sets[0].reps).toBe(5)
  })
  it('壊れたJSON、未対応の版、不正な型、参照切れを拒否し現行データを保つ',async () => {
    const workout = await example()
    await saveWorkout(db,workout)
    expect(() => parseBackup('invalid')).toThrow()
    expect(() => parseBackup('{"version":2,"data":{}}')).toThrow()
    const backup = JSON.parse(await exportBackup(db))
    backup.data.goals[0].total = '300'
    await expect(restoreBackup(db,JSON.stringify(backup))).rejects.toThrow()
    backup.data.goals[0].total = 300
    backup.data.sets[0].itemId = 'missing'
    await expect(restoreBackup(db,JSON.stringify(backup))).rejects.toThrow()
    expect(await db.sessions.count()).toBe(1)
  })
})
