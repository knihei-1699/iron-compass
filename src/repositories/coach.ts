import type {CompassDatabase} from '../db'
import {entity} from '../db/seed'
import type {CoachReply,DailyCondition,SavedMenu} from '../types/coach'
import {validCondition} from '../services/readiness'
import {menuIssues,parseMenu} from '../services/coachMenu'
import {loadWorkouts} from './workouts'
import {nextRotation} from '../services/training'
import {validDate} from '../utils/date'

export async function saveCondition(db:CompassDatabase,value:DailyCondition) {
  if (!validCondition(value)) throw Error('日付、睡眠時間、評価項目、体重、記述の長さを確認してください。')
  await db.transaction('rw',db.conditions,async ()=>{
    const old=await db.conditions.where('date').equals(value.date).first()
    await db.conditions.put({...value,...old && {id:old.id,createdAt:old.createdAt},updatedAt:new Date().toISOString()})
  })
}
export async function registerMenu(db:CompassDatabase,input:Omit<SavedMenu,'id'|'createdAt'|'updatedAt'>,minutes:number) {
  if (!validDate(input.date) || !Number.isInteger(minutes) || minutes<5 || minutes>180) throw Error('日付・利用可能時間を確認してください。')
  return db.transaction('rw',[db.coachMenus,db.exercises,db.equipment,db.gyms,db.conditions,db.sessions,db.sets],async ()=>{
    const [exercises,equipment,gym,condition,history] = await Promise.all([
      db.exercises.toArray(),db.equipment.where('gymId').equals(input.gymId).toArray(),db.gyms.get(input.gymId),
      db.conditions.where('date').equals(input.date).first(),loadWorkouts(db),
    ])
    if (!gym) throw Error('利用ジムを選択してください。')
    const menu=parseMenu(JSON.stringify(input.menu),exercises)
    const issues=menuIssues(menu,{exercises,equipment,history,date:input.date,minutes,
      rotation:nextRotation(history.map(w=>w.session)),pain:condition?.pain,condition})
    if (issues.length) throw Error(issues.join(' '))
    const saved={...entity(),...input,menu}
    await db.coachMenus.add(saved)
    return saved
  })
}
export async function saveReply(db:CompassDatabase,date:string,mode:CoachReply['mode'],body:string) {
  if (!validDate(date) || !body.trim() || body.length>50000 || (mode!=='review' && mode!=='analysis')) {
    throw Error('相談日と回答の内容を確認してください。')
  }
  await db.coachReplies.add({...entity(),date,mode,body:body.trim()})
}
export async function loadCoach(db:CompassDatabase) {
  const [conditions,menus,replies]=await Promise.all([
    db.conditions.orderBy('date').reverse().toArray(),db.coachMenus.orderBy('date').reverse().toArray(),
    db.coachReplies.orderBy('date').reverse().toArray(),
  ])
  return {conditions,menus:menus.sort((a,b)=>b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),replies}
}
