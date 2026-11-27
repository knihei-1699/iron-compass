import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import {afterEach,beforeEach,expect,it} from 'vitest'
import {CompassDatabase} from '../db'
import {entity,initialize} from '../db/seed'
import {loadCatalog} from '../repositories/catalog'
import {loadCoach,registerMenu,saveCondition,saveReply} from '../repositories/coach'
import {loadWorkouts,saveWorkout} from '../repositories/workouts'
import {exportBackup,restoreBackup} from '../services/backup'
import {parseMenu,menuIssues} from '../services/coachMenu'
import {buildPrompt} from '../services/coaching'
import {compare,monthlyVolume,weekly,big3Series} from '../services/growth'
import {planMinutes,suggest} from '../services/planning'
import {readiness} from '../services/readiness'
import {newWorkout} from '../services/training'
import type {DailyCondition,SuggestedMenu} from '../types/coach'

let db:CompassDatabase
const date='2026-11-27'
const gymId='sample-gym'
beforeEach(async ()=>{
  db=new CompassDatabase('coach-'+crypto.randomUUID())
  await initialize(db)
})
afterEach(async()=>{await db.delete()})
const condition=(values:Partial<DailyCondition>={}):DailyCondition=>({...entity(),date,sleep:8,sleepQuality:5,
  fatigue:1,stress:1,motivation:5,soreness:{},pain:'',weight:null,sports:'',notes:'',...values})
const sampleMenu:SuggestedMenu={schemaVersion:1,menuName:'提案',rotationType:'A',estimatedDurationMinutes:8,summary:'要点',
  exercises:[{exerciseId:'bench',sets:1,weightKg:null,reps:5,targetRIR:3,restSeconds:120,
    formCue:'反動を抑える',alternatives:['incline'],recommendationReason:'フォームの確認'}],warnings:[]}
async function session(day:string,weight:number,reps=5) {
  const workout=newWorkout((await db.templates.get('A'))!,gymId)
  workout.session.date=day
  workout.session.status='finished'
  workout.sets[0]={...workout.sets[0],weight,reps,done:true,effortType:'RIR',effort:3}
  workout.sets[1]={...workout.sets[1],weight:999,reps:1,done:true,kind:'warmup'}
  return workout
}
async function planningInput() {
  const catalog=await loadCatalog(db)
  return {template:catalog.templates[0],exercises:catalog.exercises,
    equipment:catalog.equipment.filter(e=>e.gymId===gymId),history:[],minutes:40,
    priorities:catalog.profile.priorities,date,interval:120}
}
it('日付でコンディションを更新し、提案と回答を含む新形式で復元する',async()=>{
  const first=condition()
  await saveCondition(db,first)
  await saveCondition(db,condition({sleep:7.5,soreness:{胸:2},weight:81.5}))
  await saveReply(db,date,'review','保存するレビュー')
  await registerMenu(db,{date,gymId,source:'ai',menu:sampleMenu},40)
  const [saved]=(await loadCoach(db)).conditions
  expect(saved).toMatchObject({id:first.id,sleep:7.5,weight:81.5,soreness:{胸:2}})
  expect(await db.conditions.count()).toBe(1)
  const backup=await exportBackup(db)
  await db.conditions.clear()
  await db.coachMenus.clear()
  await db.coachReplies.clear()
  await restoreBackup(db,backup)
  expect(await db.conditions.get(saved.id)).toEqual(saved)
  expect(await db.coachMenus.count()).toBe(1)
  expect(await db.coachReplies.count()).toBe(1)
  await expect(saveCondition(db,condition({fatigue:0}))).rejects.toThrow()
})
it('参考スコアの不足時と境界値を扱い、根拠を返す',async()=>{
  const {exercises}=await loadCatalog(db)
  const older=await session('2026-11-17',100)
  const recent=await session('2026-11-25',100)
  expect(readiness(condition(),[recent],exercises).score).toBeNull()
  expect(readiness(undefined,[older,recent],exercises).score).toBeNull()
  expect(readiness(condition(),[older,recent],exercises).score).toBe(100)
  const low=readiness(condition({sleep:0,sleepQuality:1,fatigue:5,stress:5,motivation:1,soreness:{胸:4,背中:4,肩:4,脚:4,腕:4,体幹:4}}),[older,recent],exercises)
  expect(low.score).toBeGreaterThanOrEqual(0)
  expect(low.score).toBeLessThan(20)
  expect(low.factors.every(f=>f.points>=0 && f.points<=f.max)).toBe(true)
})
it('本セットだけで負荷量・頻度・実測1回と推定1RM・伸び率を算出する',async()=>{
  const {exercises}=await loadCatalog(db)
  const rows=await Promise.all([session('2026-11-01',100),session('2026-11-23',100,5),session(date,110,6)])
  expect(weekly(rows,exercises,date)).toMatchObject({volume:1160,byMuscle:{胸:2},byExercise:[{id:'bench',sets:2,frequency:2}]})
  expect(monthlyVolume(rows,date)).toBe(1660)
  expect(compare(rows,'bench').rates).toEqual({weight:10,reps:20,estimate:13.1})
  expect(big3Series(rows)[0].points.at(-1)).toMatchObject({actual:null,estimate:132})
  expect(big3Series(rows)[1].points).toHaveLength(0)
  expect(compare([rows[0],await session('2026-11-10',100),rows[1]],'bench').stalled).toBe(true)
  expect(big3Series([await session(date,113,1)])[0].points[0]).toMatchObject({actual:113,estimate:113})
})
it('利用不可設備の代替、時間制限、痛みがある日の提案保留を適用する',async()=>{
  const input=await planningInput()
  const equipment=input.equipment.map(row=>row.name==='バーベル' ? {...row,available:false} : row)
  const plan=suggest({...input,equipment})
  expect(plan.exercises.some(item=>item.exerciseId==='bench')).toBe(false)
  expect(plan.exercises.some(item=>item.exerciseId==='incline')).toBe(true)
  expect(plan.exercises.every(item=>item.weightKg===null)).toBe(true)
  const short=suggest({...input,minutes:6})
  expect(short.exercises.length).toBeGreaterThan(0)
  expect(short.exercises.length).toBeLessThan(suggest(input).exercises.length)
  expect(planMinutes(short.exercises)).toBeLessThanOrEqual(6)
  expect(suggest({...input,condition:condition({pain:'肩に違和感'})}).exercises).toHaveLength(0)
})
it('前回達成時のみ小幅に増量し、疲労時は抑える',async()=>{
  const input=await planningInput()
  const workout=await session('2026-11-25',100)
  for (const i of [1,2]) workout.sets[i]={...workout.sets[i],kind:'work',weight:100,reps:5,done:true,effortType:'RIR',effort:3}
  const baseline=suggest({...input,history:[workout]})
  expect(baseline.exercises[0].weightKg).toBe(102.5)
  expect(suggest({...input,history:[workout],condition:condition({fatigue:5})}).exercises[0].weightKg).toBe(90)
})
it('3モードで期間指定のプロンプトを生成し、個別メモや範囲外の記録を除外する',async()=>{
  const catalog=await loadCatalog(db)
  const input={start:'2026-11-21',end:date,today:date,profile:catalog.profile,goal:catalog.goal,template:catalog.templates[0],
    records:catalog.records,history:[await session(date,110),await session('2026-11-01',321)],exercises:catalog.exercises,
    condition:condition({notes:'共有しないメモ'}),gym:catalog.gyms.find(g=>g.id===gymId),equipment:catalog.equipment,minutes:40,request:'上胸を優先'}
  for (const mode of ['menu','review','analysis'] as const) {
    const prompt=buildPrompt({...input,mode})
    expect(prompt).toContain('"RIR": 3')
    expect(prompt).toContain('latestByExercise')
    expect(prompt).toContain('上胸を優先')
    expect(prompt).not.toContain('"kg": 321')
    expect(prompt).not.toContain('共有しないメモ')
    expect(prompt).not.toContain('"kg": 999')
  }
  expect(buildPrompt({...input,mode:'review'})).toContain('100点満点')
  expect(buildPrompt({...input,mode:'analysis'})).toContain('デロード')
  expect(buildPrompt({...input,mode:'menu'})).toContain('schemaVersion')
})
it('コードブロックと種目名を解決し、不正な型・値・種目を拒否する',async()=>{
  const {exercises}=await loadCatalog(db)
  const exercise={...sampleMenu.exercises[0],exerciseId:undefined,exerciseName:'ベンチプレス'}
  const val={...sampleMenu,exercises:[exercise]}
  expect(parseMenu('```json\n'+JSON.stringify(val)+'\n```',exercises)).toEqual(sampleMenu)
  for (const change of [{sets:0},{sets:1.5},{reps:0},{weightKg:-1},{exerciseName:'存在しない種目'},{targetRIR:0},{alternatives:['unknown']}]) {
    expect(()=>parseMenu(JSON.stringify({...val,exercises:[{...exercise,...change}]}),exercises)).toThrow()
  }
  expect(()=>parseMenu('bad JSON',exercises)).toThrow()
})
it('AI登録を原子的に検証し、既存メニューとトレーニングを保持する',async()=>{
  const workout=await session('2026-11-23',100)
  await saveWorkout(db,workout)
  const before=await loadWorkouts(db)
  const template=await db.templates.get('B')
  const menu={...sampleMenu,rotationType:'B' as const}
  await registerMenu(db,{date,gymId,source:'ai',menu},40)
  await expect(registerMenu(db,{date,gymId,source:'ai',menu:{...menu,exercises:[{...menu.exercises[0],weightKg:250}]}},40)).rejects.toThrow()
  await expect(registerMenu(db,{date,gymId,source:'ai',menu},5)).rejects.toThrow()
  await saveCondition(db,condition({pain:'痛み'}))
  await expect(registerMenu(db,{date,gymId,source:'ai',menu},40)).rejects.toThrow()
  const input=await planningInput()
  expect(menuIssues(menu,{...input,equipment:[],rotation:'B'})).toEqual(expect.arrayContaining([expect.stringContaining('設備')]))
  expect(await db.coachMenus.count()).toBe(1)
  expect(await loadWorkouts(db)).toEqual(before)
  expect(await db.templates.get('B')).toEqual(template)
})
it('DBバージョン1の実績・設定・旧コンディションを保持し、旧バックアップを復元する',async()=>{
  const original=await exportBackup(db)
  const snapshot=JSON.parse(original)
  const name=db.name+'-legacy'
  const old=new Dexie(name)
  old.version(1).stores({
    profiles:'id',goals:'id',exercises:'id',gyms:'id',equipment:'id,gymId',templates:'id,&rotation',
    sessions:'id,date,status',sets:'id,sessionId,itemId',readiness:'id,&date',records:'id,&exerciseId',recommendations:'id',settings:'id',
  })
  const workout=await session('2026-11-25',100)
  snapshot.data.sessions=[workout.session]
  snapshot.data.sets=workout.sets
  snapshot.data.readiness=[{...entity(),date,minutes:40,gymId,sleep:7,fatigue:3,soreness:'胸',pain:'',request:''}]
  snapshot.version=1
  for (const key of ['conditions','coachMenus','coachReplies']) delete snapshot.data[key]
  for (const table of old.tables) await table.bulkAdd(snapshot.data[table.name])
  old.close()
  const upgraded=new CompassDatabase(name)
  try {
    await initialize(upgraded)
    expect(upgraded.verno).toBe(2)
    expect(await upgraded.sessions.get(workout.session.id)).toEqual(workout.session)
    expect(await upgraded.readiness.count()).toBe(1)
    expect(await upgraded.conditions.count()).toBe(0)
    await restoreBackup(db,JSON.stringify(snapshot))
    expect(await db.sessions.get(workout.session.id)).toEqual(workout.session)
    expect(await db.readiness.count()).toBe(1)
  } finally {await upgraded.delete()}
})
