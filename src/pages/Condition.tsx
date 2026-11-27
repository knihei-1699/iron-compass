import {useState} from 'react'
import {Card,NumberInput,TextInput} from '../components/ui'
import {entity} from '../db/seed'
import type {DailyCondition} from '../types/coach'
import {sorenessGroups} from '../types/coach'
import type {Exercise,Workout} from '../types'
import {readiness} from '../services/readiness'
import {displayDate,localDate} from '../utils/date'

const ratings=[['sleepQuality','睡眠の質','低い → 高い'],['fatigue','全身疲労','軽い → 強い'],
  ['stress','ストレス','低い → 高い'],['motivation','トレーニング意欲','低い → 高い']] as const
function blank(date:string):DailyCondition {
  return {...entity(),date,sleep:-1,sleepQuality:0,fatigue:0,stress:0,motivation:0,soreness:{},pain:'',weight:null,sports:'',notes:''}
}
export function Condition({conditions,history,exercises,save}:{
  conditions:DailyCondition[];history:Workout[];exercises:Exercise[];save:(value:DailyCondition)=>void
}) {
  const today=localDate()
  const [value,setValue]=useState(()=>conditions.find(c=>c.date===today) ?? blank(today))
  const choose=(date:string)=>{if (date) setValue(conditions.find(c=>c.date===date) ?? blank(date))}
  const score=readiness(conditions.find(c=>c.date===value.date),history,exercises)
  return <>
    <Card><form onSubmit={e=>{e.preventDefault();save(value)}}>
      <label>日付<input type="date" value={value.date} max={today} onChange={e=>choose(e.target.value)}/></label>
      <div className="form-grid">
        <NumberInput label="睡眠時間" value={value.sleep<0 ? null : value.sleep} min={0} max={24} step="any" onChange={sleep=>setValue({...value,sleep:sleep ?? -1})}/>
        <NumberInput label="体重 kg（任意）" value={value.weight} min={10} max={600} step="any" onChange={weight=>setValue({...value,weight})}/>
        {ratings.map(([key,label,hint])=><label key={key}>{label}<select required value={value[key] || ''} onChange={e=>setValue({...value,[key]:Number(e.target.value)})}>
          <option value="">{hint}</option>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label>)}
      </div>
      <h3>部位別筋肉痛</h3><p className="muted">0 なし／1 軽い／2 中程度／3 強い／4 非常に強い</p>
      <div className="form-grid">{sorenessGroups.map(group=><label key={group}>{group}
        <select value={value.soreness[group] ?? 0} onChange={e=>setValue({...value,soreness:{...value.soreness,[group]:Number(e.target.value)}})}>
          {[0,1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>)}</div>
      <TextInput label="痛み・違和感" value={value.pain} onChange={pain=>setValue({...value,pain})} multiline/>
      {value.pain.trim() && <p className="feedback">痛み・違和感がある場合は、スコアに関係なく負荷や動作を見直してください。</p>}
      <TextInput label="運動予定（バスケットボールなど）" value={value.sports} onChange={sports=>setValue({...value,sports})}/>
      <TextInput label="自由記述" value={value.notes} onChange={notes=>setValue({...value,notes})} multiline/>
      <button className="primary" type="submit">コンディションを保存</button>
    </form></Card>
    <Card><h2>保存済みコンディションの参考スコア</h2>
      <p>医療的な疲労測定や回復の保証ではありません。</p>
      {score.score===null ? <p>{score.reason}</p> : <><p className="score">{score.score} / 100</p>
        <details><summary>計算の内訳</summary>{score.factors.map(f=><p key={f.name}><b>{f.name} {f.points}/{f.max}</b> ／ {f.detail}</p>)}</details></>}
    </Card>
    <Card><h2>コンディション履歴</h2>{conditions.length ? conditions.map(c=><div className="split history-row" key={c.id}>
      <div><strong>{displayDate(c.date)}</strong><p>睡眠 {c.sleep} 時間 · 疲労 {c.fatigue}/5{c.pain.trim() ? ' · 痛み・違和感あり' : ''}</p></div>
      <button onClick={()=>{choose(c.date);window.scrollTo(0,0)}}>編集</button>
    </div>) : <p>保存済みの記録がありません。</p>}</Card>
  </>
}
