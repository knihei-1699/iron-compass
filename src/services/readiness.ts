import type {DailyCondition} from '../types/coach'
import {sorenessGroups} from '../types/coach'
import type {Exercise,Workout} from '../types'
import {validDate} from '../utils/date'
import {daysBetween,during,offsetDate,weekly} from './growth'
import {forExercise} from './analysis'
import {inRange,volume} from './training'
export function validCondition(value:unknown):value is DailyCondition {
  if (!value || typeof value !== 'object') return false
  const v = value as DailyCondition
  return validDate(v.date) && inRange(v.sleep,0,24) &&
    [v.sleepQuality,v.fatigue,v.stress,v.motivation].every(n=>inRange(n,1,5,true)) &&
    (v.weight===null || inRange(v.weight,10,600)) &&
    [v.pain,v.sports,v.notes].every(s=>typeof s==='string' && s.length<=4000) &&
    !!v.soreness && typeof v.soreness==='object' && !Array.isArray(v.soreness) &&
    Object.entries(v.soreness).every(([key,n])=>sorenessGroups.some(group=>group===key) && inRange(n,0,4,true))
}
export function readiness(condition:DailyCondition|undefined,history:Workout[],exercises:Exercise[]) {
  const empty = {score:null, factors:[] as {name:string;points:number;max:number;detail:string}[]}
  if (!condition || !validCondition(condition)) return {...empty,reason:'日次コンディションを入力してください。'}
  const {date} = condition
  const previous = during(history,offsetDate(date,-14),offsetDate(date,-1))
    .filter(w=>w.sets.some(s=>s.done && s.kind==='work'))
  if (new Set(previous.map(w=>w.session.date)).size<2) return {...empty,reason:'直前14日間に本セットの記録がある日が2日以上必要です。'}
  const recent = weekly(previous,exercises,offsetDate(date,-1)).volume
  const older = during(previous,offsetDate(date,-14),offsetDate(date,-8)).reduce((s,w)=>s+volume(w.sets),0)
  const affected = Object.entries(condition.soreness).filter(([,severity])=>severity>=2)
  const short = affected.filter(([muscle])=>previous.some(w=>daysBetween(w.session.date,date)<=2 &&
    exercises.some(ex=>ex.muscle===muscle && forExercise(w,ex.id).length))).length
  const factors = [
    {name:'睡眠',points:Math.round(Math.min(condition.sleep/8,1)*20+(condition.sleepQuality-1)*2.5),max:30,detail:condition.sleep+' 時間・質 '+condition.sleepQuality+'/5'},
    {name:'主観的疲労',points:Math.round((5-condition.fatigue)*6.25),max:25,detail:condition.fatigue+'/5'},
    {name:'ストレスと意欲',points:Math.round((5-condition.stress+condition.motivation-1)*1.875),max:15,detail:condition.stress+'/5・'+condition.motivation+'/5'},
    {name:'筋肉痛と部位の運動間隔',points:Math.max(0,20-short*5-affected.length*2),max:20,detail:'筋肉痛のある '+affected.length+' 部位、直近2日にも実施した '+short+' 部位'},
    {name:'週間負荷の変化',points:older===0 ? 5 : recent>older*1.5 ? 2 : recent>older*1.2 ? 6 : 10,max:10,detail:older+' → '+recent+' kg（直前の7日間同士）'},
  ]
  return {score:factors.reduce((sum,f)=>sum+f.points,0),factors,reason:''}
}
