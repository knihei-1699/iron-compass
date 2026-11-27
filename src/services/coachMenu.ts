import type {Exercise,GymEquipment,Rotation,Workout} from '../types'
import {rotations} from '../types'
import type {DailyCondition,SuggestedExercise,SuggestedMenu} from '../types/coach'
import {equipmentAvailable,latestSets,planMinutes} from './planning'
import {daysBetween} from './growth'
import {inRange} from './training'
const row = (value:unknown):value is Record<string,unknown> => !!value && typeof value==='object' && !Array.isArray(value)
const text = (value:unknown,max=1000):value is string => typeof value==='string' && value.trim().length>0 && value.length<=max
const list = (value:unknown):value is string[] => Array.isArray(value) && value.length<=20 && value.every(s=>text(s,500))
export function parseMenu(raw:string,exercises:Exercise[]):SuggestedMenu {
  if (raw.length>50000) throw Error('JSONが長すぎます。')
  const stripped=raw.trim().match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i)?.[1] ?? raw
  let value:unknown
  try {value=JSON.parse(stripped)} catch {throw Error('JSONの形式を確認してください。')}
  if (!row(value) || value.schemaVersion!==1 || !text(value.menuName,120) || !text(value.summary) ||
    !rotations.some(r=>r===value.rotationType) || !inRange(value.estimatedDurationMinutes,1,600,true) ||
    !list(value.warnings) || !Array.isArray(value.exercises) || value.exercises.length<1 || value.exercises.length>20) {
    throw Error('メニューの版、名称、ローテーション、所要時間、概要、種目または注意事項が無効です。')
  }
  const resolve = (id:unknown,name:unknown) => {
    const matches = exercises.filter(ex=>id!==undefined ? ex.id===id : ex.name===name)
    if (matches.length!==1 || (id!==undefined && name!==undefined && name!==matches[0].name)) {
      throw Error('種目マスターに一致しない種目があります。')
    }
    return matches[0].id
  }
  const items:SuggestedExercise[] = value.exercises.map((item:unknown,index:number)=>{
    if (!row(item) || !inRange(item.sets,1,8,true) || !inRange(item.reps,1,30,true) ||
      !(item.weightKg===null || inRange(item.weightKg,0,1000)) || !inRange(item.targetRIR,2,5) ||
      !inRange(item.restSeconds,30,600,true) || !text(item.formCue) || !text(item.recommendationReason) || !list(item.alternatives)) {
      throw Error((index+1)+'種目目のセット数、重量、回数、RIR、休憩または説明を確認してください。')
    }
    const id = resolve(item.exerciseId,item.exerciseName)
    const alternatives = [...new Set(item.alternatives.map(key=>exercises.some(ex=>ex.id===key) ? resolve(key,undefined) : resolve(undefined,key)))].filter(key=>key!==id)
    return {exerciseId:id,sets:item.sets,reps:item.reps,weightKg:item.weightKg,targetRIR:item.targetRIR,
      restSeconds:item.restSeconds,formCue:item.formCue,alternatives,recommendationReason:item.recommendationReason}
  })
  if (new Set(items.map(item=>item.exerciseId)).size!==items.length) throw Error('同じ種目が重複しています。')
  return {schemaVersion:1,menuName:value.menuName.trim(),rotationType:value.rotationType as Rotation,
    estimatedDurationMinutes:value.estimatedDurationMinutes,summary:value.summary,exercises:items,warnings:value.warnings}
}

export function menuIssues(menu:SuggestedMenu,context:{
  exercises:Exercise[]; equipment:GymEquipment[]; history:Workout[]; date:string; minutes:number; rotation:Rotation; pain?:string;condition?:DailyCondition;
}) {
  const issues:string[]=[]
  if (context.pain?.trim()) issues.push('痛み・違和感が入力されているため、負荷付きメニューの登録・開始を保留します。')
  if (menu.rotationType!==context.rotation) issues.push('次回のローテーション '+context.rotation+' に合わせてください。')
  if (Math.max(planMinutes(menu.exercises),menu.estimatedDurationMinutes)>context.minutes) issues.push('準備・セット・休憩を含む所要時間が利用可能時間を超えています。')
  for (const item of menu.exercises) {
    for (const id of [item.exerciseId,...item.alternatives]) {
      const ex=context.exercises.find(e=>e.id===id)
      if (!ex || !equipmentAvailable(ex,context.equipment)) issues.push((ex?.name ?? id)+' の設備が利用できるか確認してください。')
    }
    const prior = latestSets(context.history,item.exerciseId,context.date)
    const weights=prior?.sets.map(s=>s.weight ?? 0) ?? []
    const ceiling=weights.length ? Math.min(...weights) : 0
    const qualified=!!prior && daysBetween(prior.date,context.date)<=14 && prior.sets.length>=item.sets && prior.sets.every(s=>s.effortType==='RIR' &&
      s.effort!==null && s.effort>=3 && (s.reps ?? 0)>=item.reps && s.weight===ceiling)
    const exercise=context.exercises.find(e=>e.id===item.exerciseId)
    const c=context.condition
    const soreness=Object.entries(c?.soreness ?? {}).find(([muscle])=>muscle===exercise?.muscle)?.[1] ?? 0
    const reduced=!!c && (c.fatigue>=4 || c.sleep<6 || c.stress>=4 || soreness>=2 || (exercise?.muscle==='脚' && !!c.sports.trim()))
    const excess=prior?.sets.some(s=>s.effort!==null && (s.effortType==='RIR' ? s.effort<2 : s.effort>8))
    const cap=reduced || excess ? Math.floor(ceiling*0.9*2)/2 :
      qualified && ceiling>=20 ? ceiling+Math.min(2.5,Math.floor(ceiling*0.05*2)/2) : ceiling
    if (soreness>=4) issues.push((exercise?.name ?? item.exerciseId)+' は筋肉痛の入力を踏まえて見送ってください。')
    if (item.weightKg!==null && item.weightKg>cap) issues.push((exercise?.name ?? item.exerciseId)+' の重量は前回実績と当日の状態を基準に下げるか、未指定にしてください。')
  }
  return [...new Set(issues)]
}
