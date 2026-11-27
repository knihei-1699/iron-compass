import {Activity, Bot, CalendarDays, Dumbbell, Flag, Play, Target, TrendingUp} from 'lucide-react'
import {Card} from '../components/ui'
import {big3} from '../services/analysis'
import {volume} from '../services/training'
import {displayDate,localDate} from '../utils/date'
import {liftLabels} from '../types'
import type {Exercise, PersonalRecord, Workout, WorkoutTemplate} from '../types'
import type {DailyCondition,SuggestedMenu} from '../types/coach'
import {compare,daysBetween} from '../services/growth'
const whole = new Intl.NumberFormat('ja-JP')
export function Home({goal,records,history,template,exercises,draft,start,openHistory,condition,score,suggestion,gym,openCondition,openCoach}: {
  goal:number; records:PersonalRecord[]; history:Workout[]; template:WorkoutTemplate; exercises:Exercise[]; draft:boolean;
  start:()=>void; openHistory:()=>void
  condition?:DailyCondition;score:number|null;suggestion?:SuggestedMenu;gym?:string;openCondition:()=>void;openCoach:()=>void
}) {
  const stats = big3(history,records)
  const total = stats.reduce((sum,stat) => sum + (stat.best ?? 0),0)
  const percent = Math.round(total / goal * 100)
  const previous = history.find(w=>w.session.date<=localDate())
  const elapsed=previous ? daysBetween(previous.session.date,localDate()) : 0
  return <>
    <div className="intro"><span><CalendarDays size={16}/>{displayDate(localDate())}</span><h1>ダッシュボード</h1></div>
    <div className="dashboard-grid">
      <Card className="goal">
        <div className="section-label"><Target size={19}/>BIG3 目標達成率</div>
        <div className="goal-metrics"><div><strong>{whole.format(total)}</strong> <span>/ {whole.format(goal)} kg</span></div><b>{percent}<small>%</small></b></div>
        <progress value={Math.min(percent,100)} max={100} aria-label="BIG3 目標達成率"/>
        <div className="lifts">{stats.map(stat => <div key={stat.id}><span>{liftLabels[stat.id]}</span><strong>{stat.best ?? '—'} <small>kg</small></strong></div>)}</div>
      </Card>
      <Card className="next">
        <div className="section-label"><Dumbbell size={19}/>次回のトレーニング</div>
        <div className="next-title"><b className="rotation-tile">{template.rotation}</b><div><h2>{template.name}</h2><p>{template.items.length} 種目 · {template.items.reduce((sum,item) => sum + item.sets,0)} セット</p></div></div>
        <p className="plan-preview">{template.items.map(item => exercises.find(ex => ex.id === item.exerciseId)?.name).filter(Boolean).join(' / ') || '設定から種目を追加できます'}</p>
        <button className="primary launch" onClick={start}><Play size={19} fill="currentColor"/>{draft ? 'トレーニングを再開' : 'トレーニングを開始'}</button>
      </Card>
      <Card>
        <div className="section-label"><Flag size={18}/>前回のトレーニング</div>
        {previous ? <><h3>{previous.session.name}</h3><p>{displayDate(previous.session.date)} · {elapsed ? elapsed+'日前' : '今日'} · {whole.format(volume(previous.sets))} kg</p><button onClick={openHistory}>履歴を開く</button></> : <p>トレーニング記録がまだありません。</p>}
      </Card>
      <Card><div className="section-label"><Activity size={19}/>本日のコンディション</div>
        {condition ? <p>睡眠 {condition.sleep} 時間 · 疲労 {condition.fatigue}/5 · {score===null ? 'スコア算出に必要な記録が不足' : '参考スコア '+score+'/100'}</p> : <p>今日はまだ入力されていません。</p>}
        {condition?.pain.trim() && <p className="feedback">痛み・違和感の入力あり。負荷や動作を見直してください。</p>}
        <button onClick={openCondition}>{condition ? 'コンディションを編集' : 'コンディションを入力'}</button>
      </Card>
      <Card className="proposal-card"><div className="section-label"><Bot size={19}/>次回の推奨メニュー · 端末提案</div>
        {suggestion ? <><p>{gym} · 利用時間40分{suggestion.exercises.length ? ' · 所要約 '+suggestion.estimatedDurationMinutes+'分' : ''}</p>
          <p>{suggestion.exercises.map(item=>exercises.find(e=>e.id===item.exerciseId)?.name).join(' / ') || suggestion.warnings[0] || '提案できる種目がありません。'}</p></> : <p>提案にはジムの登録が必要です。</p>}
        <button onClick={openCoach}>コーチを開く</button>
      </Card>
      <Card><div className="section-label"><TrendingUp size={19}/>BIG3の成長傾向</div>
        {stats.map(stat=>{
          const result=compare(history,stat.id)
          const rate=result.rates?.estimate
          return <p key={stat.id}>{liftLabels[stat.id]} · {rate===null || rate===undefined ? '比較できる推定1RMなし' : (rate>0 ? '+' : '')+rate+'%（前回比）'}{result.stalled ? ' · 停滞傾向（参考）' : ''}</p>
        })}<button onClick={openHistory}>推移を確認</button>
      </Card>
    </div>
  </>
}
