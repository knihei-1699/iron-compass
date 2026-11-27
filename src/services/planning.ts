import type {Exercise,GymEquipment,Workout,WorkoutTemplate} from '../types'
import type {DailyCondition,SuggestedExercise,SuggestedMenu} from '../types/coach'
import {forExercise} from './analysis'
import {daysBetween} from './growth'

const defaultEquipment:Record<string,string> = {
  bench:'バーベル',squat:'バーベル',deadlift:'バーベル',incline:'ダンベル',pullup:'懸垂設備',
  row:'ダンベル',lateral:'ダンベル',split:'ダンベル',shoulder:'ダンベル',
}
const cues:Record<string,string> = {
  bench:'足を床につけ、下ろす動作を一定にする。',squat:'足裏全体で床を押し、深さを揃える。',
  deadlift:'バーを体の近くに保ち、反動を使わない。',row:'胴体を安定させ、反動を抑える。',
  incline:'肩の位置を保ち、ダンベルをゆっくり下ろす。',lateral:'肩をすくめず、反動を抑える。',
}
export function equipmentAvailable(ex:Exercise,equipment:GymEquipment[]) {
  const required = requiredEquipment(ex)
  return required !== null && required.every(name=>equipment.some(e=>e.available && e.name.trim()===name) &&
    !equipment.some(e=>!e.available && e.name.trim()===name))
}
export function requiredEquipment(ex:Exercise) {
  return ex.requiredEquipment ?? (defaultEquipment[ex.id] ? [defaultEquipment[ex.id]] : null)
}
export function planMinutes(entries: Pick<SuggestedExercise,'sets'|'restSeconds'>[]) {
  return entries.length ? Math.ceil((180+entries.reduce((total,e)=>total+90+e.sets*45+(e.sets-1)*e.restSeconds,0))/60) : 0
}
export function latestSets(history:Workout[],id:string,date:string) {
  return history.filter(w=>w.session.status==='finished' && w.session.date<=date)
    .sort((a,b)=>b.session.date.localeCompare(a.session.date) || b.session.createdAt.localeCompare(a.session.createdAt))
    .map(w=>({date:w.session.date,sets:forExercise(w,id)})).find(p=>p.sets.length)
}
export function suggest({template,exercises,equipment,history,condition,minutes,priorities,date,interval}:{
  template:WorkoutTemplate;exercises:Exercise[];equipment:GymEquipment[];history:Workout[];condition?:DailyCondition;
  minutes:number;priorities:string;date:string;interval:number;
}):SuggestedMenu {
  const menu:SuggestedMenu = {schemaVersion:1,menuName:template.name+'（端末提案）',rotationType:template.rotation,
    summary:'A/B/Cの順序を維持し、設備と時間に合わせて調整しました。',estimatedDurationMinutes:0,exercises:[],warnings:[]}
  if (condition?.pain.trim()) {
    menu.summary='痛み・違和感の入力があります。負荷や動作の見直しを優先してください。'
    menu.warnings.push('痛み・違和感がある日のため、重量付きの提案を保留しました。')
    return menu
  }
  const available = exercises.filter(ex=>equipmentAvailable(ex,equipment))
  const caution = !!condition && (condition.fatigue>=4 || condition.sleep<6 || condition.stress>=4)
  const used = new Set<string>()
  const original = new Set(template.items.map(i=>i.exerciseId))
  const ordered = template.items.map((item,index)=>({item,index,ex:exercises.find(e=>e.id===item.exerciseId)}))
    .sort((a,b)=>Number(b.index===0)-Number(a.index===0) ||
      Number(!!b.ex && priorities.includes(b.ex.muscle))-Number(!!a.ex && priorities.includes(a.ex.muscle)) || a.index-b.index)
  for (const {item,ex} of ordered) {
    if (!ex) continue
    const substitutes = available.filter(e=>e.muscle===ex.muscle && e.id!==ex.id && !used.has(e.id))
    const chosen = available.some(e=>e.id===ex.id) && !used.has(ex.id) ? ex : substitutes.find(e=>!original.has(e.id))
    if (!chosen) {menu.warnings.push(ex.name+' は利用可能な設備・代替種目を確認できません。');continue}
    used.add(chosen.id)
    const soreness = Object.entries(condition?.soreness ?? {}).find(([muscle])=>muscle===chosen.muscle)?.[1] ?? 0
    if (soreness>=4) {menu.warnings.push(chosen.name+' は筋肉痛の入力を踏まえ見送り。');continue}
    const reduced = caution || soreness>=2 || (chosen.muscle==='脚' && !!condition?.sports.trim())
    const prior = latestSets(history,chosen.id,date)
    const sets = prior?.sets ?? []
    const [reference] = [...sets].sort((a,b)=>(a.weight ?? 0)-(b.weight ?? 0) || (a.reps ?? 0)-(b.reps ?? 0))
    const reps = Math.min(30,item.reps,reference?.reps ?? item.reps)
    const count = Math.min(item.sets,6,Math.max(1,sets.length || 2))
    const excess = sets.some(s=>s.effort!==null && (s.effortType==='RIR' ? s.effort<2 : s.effort>8))
    const qualifies = !!prior && daysBetween(prior.date,date)<=14 && sets.length>=item.sets && sets.every(s=>s.effortType==='RIR' &&
      s.effort!==null && s.effort>=3 && (s.reps ?? 0)>=item.reps && s.weight===reference?.weight)
    const baseline = reference?.weight ?? null
    const restSeconds = Math.min(300,Math.max(60,interval))
    const entry:SuggestedExercise = {
      exerciseId:chosen.id,sets:Math.max(1,count-Number(reduced)),reps,targetRIR:reduced || excess ? 4 : 3,restSeconds,
      weightKg:baseline === null ? null : reduced || excess ? Math.floor(baseline*0.9*2)/2
        : qualifies && baseline>=20 ? Math.min(1000,baseline+Math.min(2.5,Math.floor(baseline*0.05*2)/2)) : baseline,
      formCue:cues[chosen.id] ?? '動作をコントロールし、フォームが崩れる手前で止める。',
      alternatives:substitutes.filter(e=>e.id!==chosen.id).slice(0,3).map(e=>e.id),
      recommendationReason:[
        chosen.id!==ex.id ? ex.name+'の設備に合わせた代替。' : '',
        baseline === null ? '本セット実績がないため、重量は未指定。' :
          reduced || excess ? '当日の状態または前回強度を踏まえて負荷を下げる。' :
          qualifies && baseline>=20 ? '前回の目標回数・RIRを満たしたため小幅に増量。' : '前回の重量・回数を上限の目安にする。',
      ].join(''),
    }
    while (entry.sets>0 && planMinutes([...menu.exercises,entry])>minutes) entry.sets--
    if (entry.sets) menu.exercises.push(entry)
    else menu.warnings.push(chosen.name+' は所要時間の上限に合わせて見送り。')
  }
  menu.estimatedDurationMinutes=planMinutes(menu.exercises)
  return menu
}
