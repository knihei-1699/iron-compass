import type { CompassDatabase } from '.'
import type { Entity, Rotation } from '../types'

export function entity(id = crypto.randomUUID() as string): Entity {
  const now = new Date().toISOString()
  return { id, createdAt: now, updatedAt: now }
}

export async function initialize(db: CompassDatabase) {
  await db.transaction('rw', db.tables, async () => {
    if (await db.settings.get('main')) return
    await db.profiles.add({...entity('main'), height:170, weight:70, experience:'',
      purpose:'', priorities:'',
      policy:'フォーストレップ禁止。コンディションとフォームに合わせて重量を調整する。'})
    await db.goals.add({...entity('main'), total:300, targets:{bench:null,squat:null,deadlift:null}})
    await db.exercises.bulkAdd([
      ['bench','ベンチプレス','胸'], ['squat','スクワット','脚'], ['deadlift','デッドリフト','背中'],
      ['incline','インクラインダンベルプレス','胸'], ['pullup','懸垂','背中'],
      ['row','ダンベルロー','背中'], ['lateral','サイドレイズ','肩'],
      ['split','ブルガリアンスクワット','脚'], ['shoulder','ダンベルショルダープレス','肩'],
    ].map(([id,name,muscle]) => ({...entity(id),name,muscle})))
    await db.gyms.add({...entity('sample-gym'),name:'サンプルジム'})
    await db.equipment.bulkAdd(['バーベル','ダンベル'].map(name => ({...entity(),gymId:'sample-gym',name,available:true})))
    const plans = { A:['bench','row','squat','lateral'], B:['deadlift','incline','row','split'], C:['squat','shoulder','row','incline'] }
    await db.templates.bulkAdd(Object.entries(plans).map(([rotation, ids]) => ({
      ...entity(rotation), rotation:rotation as Rotation, name:'Priority Full Body ' + rotation,
      items:ids.map((exerciseId,index) => ({exerciseId,sets:3,reps:index === 0 ? 5 : 10})),
    })))
    await db.settings.add({...entity('main'),interval:120})
  })
}
