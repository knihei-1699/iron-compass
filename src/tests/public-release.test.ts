import 'fake-indexeddb/auto'
import {expect,it} from 'vitest'
import {CompassDatabase} from '../db'
import {initialize} from '../db/seed'
import {exportBackup,restoreBackup} from '../services/backup'
import {pageFromHash,pages} from '../services/navigation'

it('全画面のハッシュを再読み込み時に解決する',()=>{
  for (const page of pages) expect(pageFromHash('#'+page)).toBe(page)
  expect(pageFromHash('')).toBe('home')
  expect(pageFromHash('#missing')).toBe('home')
})
it('公開初期値に実績がなく、初期化の再実行で既存データを書き換えない',async()=>{
  const db=new CompassDatabase('public-seed-'+crypto.randomUUID())
  try {
    await initialize(db)
    expect(await db.records.count()).toBe(0)
    expect(await db.sessions.count()).toBe(0)
    expect((await db.gyms.toArray()).map(g=>g.id)).toEqual(['sample-gym'])
    await db.profiles.update('main',{height:161,weight:61})
    await db.goals.update('main',{total:250})
    const data=await exportBackup(db)
    await initialize(db)
    expect(await exportBackup(db)).toBe(data)
    await restoreBackup(db,data)
    expect((await db.profiles.get('main'))?.weight).toBe(61)
    expect((await db.goals.get('main'))?.total).toBe(250)
  } finally {await db.delete()}
})
