import {useState} from 'react'
import {Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts'
import {Card} from '../components/ui'
import {forExercise,personalBest} from '../services/analysis'
import {estimatedMax,volume,workSets} from '../services/training'
import {displayDate,localDate} from '../utils/date'
import type {Exercise, PersonalRecord, Workout} from '../types'
import {liftLabels} from '../types'
import {big3Series,compare,exerciseSeries,monthlyVolume,weekly} from '../services/growth'

function WeightChart({points,label,showWeight=false}:{
  points:ReturnType<typeof exerciseSeries>;label:string;showWeight?:boolean
}) {
  if (!points.length) return <p className="muted">集計対象の本セット記録がありません。</p>
  const hasEstimate=points.some(p=>p.estimate!==null)
  const hasActual=points.some(p=>p.actual!==null)
  if (!showWeight && !hasEstimate && !hasActual) return <p className="muted">推定1RM・実測1回重量の対象記録がありません。</p>
  return <div className="chart" role="group" aria-label={label}><ResponsiveContainer width="100%" height={210}>
    <LineChart data={points}><XAxis dataKey="date" stroke="#a4adad" tickFormatter={(s:string)=>s.slice(5)}/>
      <YAxis stroke="#a4adad" width={44} unit=" kg" domain={['auto','auto']}/>
      <Tooltip contentStyle={{background:'#202629',borderColor:'#343b3b'}}/><Legend/>
      {showWeight && <Line name="最大重量" dataKey="weight" stroke="#bbfa60" strokeWidth={2} isAnimationActive={false}/>}
      {hasActual && <Line name="実測1回重量" dataKey="actual" stroke="#f4c176" connectNulls dot={{r:4}} isAnimationActive={false}/>}
      {hasEstimate && <Line name="推定1RM" dataKey="estimate" stroke="#81cfe8" strokeDasharray="5 3" connectNulls isAnimationActive={false}/>}
    </LineChart>
  </ResponsiveContainer></div>
}
const percent=(n:number|null)=>n===null ? '比較不可' : (n>0 ? '+' : '')+n+'%'

export function History({history,exercises,records,edit,remove}: {
  history:Workout[]; exercises:Exercise[]; records:PersonalRecord[];
  edit:(workout:Workout)=>void; remove:(id:string)=>void
}) {
  const [exercise,setExercise] = useState('bench')
  const points=exerciseSeries(history,exercise)
  const comparison=compare(history,exercise)
  const now = new Date()
  const sevenDaysAgo = new Date(now.getFullYear(),now.getMonth(),now.getDate() - 6)
  const today = localDate(now)
  const week=weekly(history,exercises,today)
  const month=monthlyVolume(history,today)
  const best = personalBest(history,records,exercise)
  const estimate = estimatedMax(history.flatMap(w => forExercise(w,exercise)))
  return <>
    <Card><h2>トレーニング分析</h2><div className="lifts summary">
      <div><span>直近7日</span><strong>{history.filter(w => w.session.date >= localDate(sevenDaysAgo) && w.session.date <= today).length} <small>回</small></strong></div>
      <div><span>今月</span><strong>{history.filter(w => w.session.date.startsWith(today.slice(0,7)) && w.session.date <= today).length} <small>回</small></strong></div>
      <div><span>累計負荷</span><strong>{history.reduce((sum,w) => sum + volume(w.sets),0).toLocaleString('ja-JP')} <small>kg</small></strong></div>
    </div><label>種目別 最大重量<select value={exercise} onChange={e => setExercise(e.target.value)}>{exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</select></label>
    <p>実測自己ベスト {best === null ? '—' : best + ' kg'} ／ 推定1RM最高 {estimate === null ? '—' : estimate + ' kg'}</p>
    <WeightChart points={points} label="種目別重量推移" showWeight/>
    {comparison.rates && comparison.previous && comparison.current ? <>
      <h3>前回実績との比較</h3>
      <p>{displayDate(comparison.previous.date)} {comparison.previous.weight} kg × {comparison.previous.reps} 回 → {displayDate(comparison.current.date)} {comparison.current.weight} kg × {comparison.current.reps} 回</p>
      <p>重量 {percent(comparison.rates.weight)} · 回数 {percent(comparison.rates.reps)} · 推定1RM {percent(comparison.rates.estimate)}</p>
    </> : <p className="muted">前回比には本セットのあるセッションが2回以上必要です。</p>}
    {comparison.stalled && <p className="feedback">停滞傾向（参考）。推定1RMの直近3回が14日以上にわたり、初回比1%以上の伸びがありません。</p>}
    <details><summary>集計条件と推定1RMの計算式</summary>
      <p>完了済みセッションの完了本セットだけを使用。推定1RMは Epley 式（重量 × (1 + 回数 ÷ 30)）を2〜10回のセットに適用し、1回は実測値をそのまま用います。セッションごとの最大値を採用します。</p>
      <p>実測自己ベストは登録値と実測1回重量の最大です。グラフは日付のある実績のみ。前回比の重量・回数は各回の最重量セット（同重量なら最多回数）を比較し、前回値が0の場合は比較不可とします。</p>
      <p>総負荷量は重量 × 回数の合計。自重種目で記録された0 kgは加算されません。頻度は種目を実施したセッション数、部位は種目マスターの主部位です。</p>
    </details>
    </Card>
    <Card><h2>週間・月間の負荷</h2>
      <p>直近7日 {week.volume.toLocaleString('ja-JP')} kg · 今月 {month.toLocaleString('ja-JP')} kg</p>
      {week.byExercise.length ? <>
        <h3>直近7日 · 種目別</h3><ul className="metric-list">{week.byExercise.map(e=><li key={e.id}><span>{e.name}</span><b>{e.sets} セット ／ {e.frequency} 回</b></li>)}</ul>
        <h3>直近7日 · 部位別</h3><ul className="metric-list">{Object.entries(week.byMuscle).map(([name,sets])=><li key={name}><span>{name}</span><b>{sets} セット</b></li>)}</ul>
      </> : <p>直近7日の本セット記録がありません。</p>}
    </Card>
    <Card><h2>BIG3の時系列</h2>
      {big3Series(history).map(({id,points})=><section key={id} className="history-row">
        <h3>{liftLabels[id]}</h3><p>実測自己ベスト {personalBest(history,records,id) ?? '—'} kg</p>
        <WeightChart points={points} label={liftLabels[id]+'の実測と推定1RM'}/>
      </section>)}
    </Card>
    <Card><h2>セッション履歴</h2>{history.length ? history.map(w => <article className="history-row" key={w.session.id}>
      <div className="split"><div><h3>{w.session.name}</h3><p>{displayDate(w.session.date)} · 本セット {workSets(w.sets).length} · {volume(w.sets).toLocaleString('ja-JP')} kg</p></div>
      <div className="actions"><button onClick={() => edit(w)}>編集</button><button onClick={() => remove(w.session.id)}>削除</button></div></div>
      <details><summary>セット詳細</summary>{w.session.exercises.map(item => <div key={item.id}><b>{exercises.find(ex => ex.id === item.exerciseId)?.name}</b>
        <p>{w.sets.filter(s => s.itemId === item.id && s.done).map(s => (s.kind === 'warmup' ? 'WU ' : '') + s.weight + ' kg × ' + s.reps + (s.effort === null ? '' : ' ' + s.effortType + ' ' + s.effort)).join(' / ') || '完了セットなし'}</p>{item.note && <p>{item.note}</p>}</div>)}</details>
    </article>) : <p>保存済みの履歴がありません。</p>}</Card>
  </>
}
