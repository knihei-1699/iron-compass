import {useState} from 'react'
import {ArrowDown, ArrowUp, Check, Plus, Timer, Trash2} from 'lucide-react'
import {Card, NumberInput, TextInput, move} from '../components/ui'
import {newSet, validateSet} from '../services/training'
import {useTimer} from '../hooks/useTimer'
import type {Exercise, Gym, Rotation, Workout, WorkoutSet, WorkoutTemplate} from '../types'

export function Training({workout, history, exercises, gyms, templates, rotation, interval, start, change, finish, discard}: {
  workout:Workout | undefined; history:Workout[]; exercises:Exercise[]; gyms:Gym[]; templates:WorkoutTemplate[];
  rotation:Rotation; interval:number; start:(template:WorkoutTemplate,gymId:string)=>void;
  change:(workout:Workout)=>void; finish:()=>void; discard:()=>void
}) {
  const [selected,setSelected] = useState(rotation)
  const [gym,setGym] = useState(gyms[0]?.id ?? '')
  const [addition,setAddition] = useState('')
  const [error,setError] = useState('')
  const timer = useTimer()
  if (!workout) return <Card><h2>メニューを選択</h2><div className="form-grid">
    <label>メニュー<select value={selected} onChange={e => setSelected(e.target.value as Rotation)}>{templates.map(t => <option key={t.id} value={t.rotation}>{t.name}</option>)}</select></label>
    <label>ジム<select value={gym} onChange={e => setGym(e.target.value)}><option value="">指定なし</option>{gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    </div><button className="primary" onClick={() => {const template = templates.find(t => t.rotation === selected); if (template) start(template,gym)}}>記録を開始</button></Card>
  const {session,sets} = workout
  const patchSet = (set:WorkoutSet, patch:Partial<WorkoutSet>) => change({...workout,sets:sets.map(s => s.id === set.id ? {...s,...patch} : s)})
  const patchExercises = (items:typeof session.exercises) => change({session:{...session,exercises:items},sets:sets.filter(set => items.some(item => item.id === set.itemId))})
  return <>
    <Card className="training-head"><div className="split"><div><h2>{session.name}</h2><span className="muted">{session.status === 'draft' ? '入力内容を自動保存' : '履歴を編集中'}</span></div>
      <button onClick={() => timer.remaining ? timer.stop() : timer.start(interval)}><Timer size={18}/>{timer.remaining ? Math.floor(timer.remaining / 60) + ':' + String(timer.remaining % 60).padStart(2,'0') : '休憩開始'}</button></div>
      <div className="form-grid"><label>実施日<input type="date" value={session.date} onChange={e => {if (e.target.value) change({...workout,session:{...session,date:e.target.value}})}}/></label>
      <label>ジム<select value={session.gymId} onChange={e => change({...workout,session:{...session,gymId:e.target.value}})}><option value="">指定なし</option>{gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div>
    </Card>
    {session.exercises.map((item,index) => {
      const prior = history.filter(w => w.session.id !== session.id && w.session.date <= session.date)
        .map(w => w.sets.filter(s => s.done && s.kind === 'work' && w.session.exercises.some(ex => ex.id === s.itemId && ex.exerciseId === item.exerciseId)))
        .find(group => group.length)
      return <Card key={item.id}>
        <div className="split exercise-title"><h3>{exercises.find(ex => ex.id === item.exerciseId)?.name ?? '種目'}</h3><div className="actions">
          <button aria-label="上に移動" disabled={index === 0} onClick={() => patchExercises(move(session.exercises,index,-1))}><ArrowUp size={16}/></button>
          <button aria-label="下に移動" disabled={index === session.exercises.length - 1} onClick={() => patchExercises(move(session.exercises,index,1))}><ArrowDown size={16}/></button>
          <button aria-label="種目を削除" onClick={() => patchExercises(session.exercises.filter(ex => ex.id !== item.id))}><Trash2 size={16}/></button>
        </div></div>
        <p className="muted">前回 {prior?.map(s => s.weight + ' kg × ' + s.reps).join(' / ') ?? '記録なし'}</p>
        {sets.filter(set => set.itemId === item.id).map((set,setIndex) => <div key={set.id} className={'set ' + (set.done ? 'done' : '')}>
          <div className="split"><label className="set-type">セット {setIndex + 1}<select value={set.kind} onChange={e => patchSet(set,{kind:e.target.value as WorkoutSet['kind']})}><option value="work">本セット</option><option value="warmup">ウォームアップ</option></select></label>
            <div className="actions"><button aria-label="セットを削除" onClick={() => change({...workout,sets:sets.filter(s => s.id !== set.id)})}><Trash2 size={16}/></button>
            <button aria-label="セット完了" aria-pressed={set.done} className={set.done ? 'primary' : ''} onClick={() => {
              try {validateSet({...set,done:!set.done}); patchSet(set,{done:!set.done}); setError(''); if (!set.done) timer.start(item.restSeconds ?? interval)}
              catch (e) {setError((e as Error).message)}
            }}><Check size={18}/></button></div></div>
          <div className="set-inputs">
            <NumberInput label="重量 kg" value={set.weight} onChange={weight => patchSet(set,{weight,done:false})} min={0} max={1000} step="any"/>
            <NumberInput label="回数" value={set.reps} onChange={reps => patchSet(set,{reps,done:false})} min={1} max={1000}/>
            <label>強度<select value={set.effortType} onChange={e => patchSet(set,{effortType:e.target.value as WorkoutSet['effortType']})}><option>RPE</option><option>RIR</option></select></label>
            <NumberInput label="強度の値" value={set.effort} onChange={effort => patchSet(set,{effort})} min={0} max={10} step="any"/>
          </div>
          {prior?.[setIndex] && <button className="compact" onClick={() => patchSet(set,{weight:prior[setIndex].weight,reps:prior[setIndex].reps,done:false})}>前回の値を入力</button>}
        </div>)}
        <button onClick={() => change({...workout,sets:[...sets,newSet(session.id,item.id)]})}><Plus size={18}/>セット追加</button>
        <TextInput label="種目メモ" value={item.note} onChange={note => patchExercises(session.exercises.map(ex => ex.id === item.id ? {...ex,note} : ex))}/>
      </Card>
    })}
    <Card><div className="split"><label>追加する種目<select value={addition} onChange={e => setAddition(e.target.value)}><option value="">種目を選択</option>{exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</select></label>
    <button disabled={!addition} onClick={() => {const id = crypto.randomUUID(); change({session:{...session,exercises:[...session.exercises,{id,exerciseId:addition,note:''}]},sets:[...sets,newSet(session.id,id)]}); setAddition('')}}><Plus size={18}/>追加</button></div></Card>
    {error && <p role="alert" className="feedback error">{error}</p>}
    <div className="actions bottom-actions"><button onClick={discard}>{session.status === 'finished' ? '編集をキャンセル' : '下書きを破棄'}</button><button className="primary" onClick={finish}>トレーニングを保存</button></div>
  </>
}
