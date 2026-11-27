import type {CompassDatabase} from '../db'
export async function loadCatalog(db:CompassDatabase) {
  return db.transaction('r', db.tables, async () => {
    const [profile,goal,exercises,gyms,equipment,templates,records,settings] = await Promise.all([
      db.profiles.get('main'),db.goals.get('main'),db.exercises.toArray(),db.gyms.toArray(),
      db.equipment.toArray(),db.templates.orderBy('rotation').toArray(),db.records.toArray(),db.settings.get('main'),
    ])
    if (!profile || !goal || !settings || templates.length !== 3) throw Error('初期設定を読み込めませんでした。')
    return {profile,goal,exercises,gyms,equipment,templates,records,settings}
  })
}
