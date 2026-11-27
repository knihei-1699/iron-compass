import {useState} from 'react'
import type {FormEvent, ReactNode} from 'react'
import {Download, Plus, Upload} from 'lucide-react'
import {NumberInput,TextInput,move} from '../components/ui'
import {db} from '../db'
import {entity} from '../db/seed'
import {settingsRepository} from '../repositories/settings'
import {csvCell,download,exportBackup,parseBackup,restoreBackup} from '../services/backup'
import {localDate} from '../utils/date'
import {requiredEquipment} from '../services/planning'
import {liftLabels,lifts} from '../types'
import type {AppSettings,Exercise,Gym,GymEquipment,PersonalRecord,TrainingGoal,UserProfile,Workout,WorkoutTemplate} from '../types'
const repository = settingsRepository(db)
type Run = (action:()=>Promise<unknown>, message?:string)=>void
interface Props {
  profile:UserProfile; goal:TrainingGoal; records:PersonalRecord[]; exercises:Exercise[]; gyms:Gym[];
  equipment:GymEquipment[]; templates:WorkoutTemplate[]; settings:AppSettings; history:Workout[]; run:Run;
}
function Panel({title,children}: {title:string;children:ReactNode}) {
  return <details className="card settings-panel"><summary>{title}</summary>{children}</details>
}
function SaveForm({children,save}: {children:ReactNode;save:()=>void}) {
  function submit(event:FormEvent) {event.preventDefault(); save()}
  return <form onSubmit={submit}>{children}<button className="primary" type="submit">保存</button></form>
}
function MasterRow({name,extra,onSave,onDelete}: {
  name:string; extra?:string; onSave:(name:string,extra:string)=>void; onDelete:()=>void
}) {
  const [label,setLabel] = useState(name)
  const [detail,setDetail] = useState(extra ?? '')
  return <div className="master-row">
    <TextInput label="名前" value={label} onChange={setLabel}/>
    {extra !== undefined && <TextInput label="部位" value={detail} onChange={setDetail}/>}
    <div className="actions"><button disabled={!label.trim() || (extra !== undefined && !detail.trim())} onClick={() => onSave(label.trim(),detail.trim())}>保存</button>
      {name && <button onClick={onDelete}>削除</button>}</div>
  </div>
}
function TemplateForm({template,exercises,run}: {template:WorkoutTemplate;exercises:Exercise[];run:Run}) {
  const [value,setValue] = useState(template)
  const [addition,setAddition] = useState('')
  return <SaveForm save={() => run(async () => {
    if (!value.name.trim() || value.items.some(i => !Number.isInteger(i.sets) || i.sets < 1 || i.sets > 30 || !Number.isInteger(i.reps) || i.reps < 1 || i.reps > 1000)) throw Error('名称・セット数・回数を確認してください。')
    await repository.saveTemplate({...value,name:value.name.trim()})
  }, 'メニューを保存しました。')}>
    <TextInput label={'メニュー ' + template.rotation} value={value.name} onChange={name => setValue({...value,name})}/>
    {value.items.map((item,index) => {
      const patch = (data:Partial<typeof item>) => setValue({...value,items:value.items.map((entry,i) => i === index ? {...entry,...data}:entry)})
      return <div className="master-row" key={index}>
        <strong>{exercises.find(ex => ex.id === item.exerciseId)?.name}</strong><div className="form-grid">
          <NumberInput label="セット" value={item.sets} onChange={sets => patch({sets:sets ?? 0})} min={1} max={30}/>
          <NumberInput label="回数" value={item.reps} onChange={reps => patch({reps:reps ?? 0})} min={1} max={1000}/>
        </div><div className="actions">
          <button type="button" disabled={index === 0} onClick={() => setValue({...value,items:move(value.items,index,-1)})}>上へ</button>
          <button type="button" disabled={index === value.items.length - 1} onClick={() => setValue({...value,items:move(value.items,index,1)})}>下へ</button>
          <button type="button" onClick={() => setValue({...value,items:value.items.filter((_,i) => i !== index)})}>削除</button>
        </div>
      </div>
    })}
    <div className="split"><label>種目を追加<select value={addition} onChange={e => setAddition(e.target.value)}><option value="">種目を選択</option>{exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</select></label>
    <button type="button" disabled={!addition} onClick={() => {setValue({...value,items:[...value.items,{exerciseId:addition,sets:3,reps:10}]}); setAddition('')}}><Plus size={17}/>追加</button></div>
  </SaveForm>
}
function EquipmentRow({item,run}: {item:GymEquipment;run:Run}) {
  const [value,setValue] = useState(item)
  return <div className="master-row">
    <TextInput label="設備名" value={value.name} onChange={name => setValue({...value,name})}/>
    <label className="check"><input type="checkbox" checked={value.available} onChange={e => setValue({...value,available:e.target.checked})}/>利用可能</label>
    <div className="actions"><button disabled={!value.name.trim()} onClick={() => run(() => repository.saveEquipment({...value,name:value.name.trim()}),'設備を保存しました。')}>保存</button>
      <button onClick={() => run(() => repository.removeEquipment(item.id),'設備を削除しました。')}>削除</button></div>
  </div>
}
function ExerciseEquipment({exercise,run}: {exercise:Exercise;run:Run}) {
  const required=requiredEquipment(exercise)
  const [value,setValue]=useState(required?.join('、') ?? '')
  const save=()=>run(()=>repository.saveExercise({...exercise,requiredEquipment:[...new Set(value.split(/[、,，]/)
    .map(part=>part.trim()).filter(Boolean))]}),'必須設備を保存しました。')
  return <div className="master-row">
    <TextInput label="必須設備（読点区切り）" value={value} onChange={setValue}/>
    <p className="muted">{required===null ? '設備未設定。設定するまで提案の対象外です。' : '空欄で保存すると設備不要になります。'}</p>
    <button onClick={save}>{value.trim() ? '必須設備を保存' : '設備不要として保存'}</button>
  </div>
}
export function Settings(props:Props) {
  const {records,exercises,gyms,equipment,templates,history,run} = props
  const [profile,setProfile] = useState(props.profile)
  const [goal,setGoal] = useState(props.goal)
  const [interval,setIntervalValue] = useState<number|null>(props.settings.interval)
  const [best,setBest] = useState({bench:records.find(r => r.exerciseId === 'bench')?.weight ?? null, squat:records.find(r => r.exerciseId === 'squat')?.weight ?? null, deadlift:records.find(r => r.exerciseId === 'deadlift')?.weight ?? null} as Record<typeof lifts[number], number | null>)
  const [exerciseKey,resetExercise] = useState(0)
  const [gymKey,resetGym] = useState(0)
  const [backup,setBackup] = useState<{name:string; text:string; sessions:number}>()
  const [paste,setPaste]=useState('')
  const [fileOutput,setFileOutput]=useState<File>()
  const [fileStatus,setFileStatus]=useState('')
  const previewBackup=(name:string,text:string)=>{
    const data=parseBackup(text)
    setBackup({name,text,sessions:data.sessions.length})
    setFileStatus('JSONを検証しました。内容を確認して復元できます。')
  }
  return <>
    <Panel title="プロフィール・トレーニング方針"><SaveForm save={() => run(async () => {
      if (profile.height < 50 || profile.height > 300 || profile.weight < 10 || profile.weight > 600) throw Error('身長と体重を確認してください。')
      await repository.saveProfile(profile)
    },'プロフィールを保存しました。')}>
      <div className="form-grid"><NumberInput label="身長 cm" value={profile.height || null} onChange={height => setProfile({...profile,height:height ?? 0})} min={50} max={300} step="any"/>
      <NumberInput label="体重 kg" value={profile.weight || null} onChange={weight => setProfile({...profile,weight:weight ?? 0})} min={10} max={600} step="any"/></div>
      {([['experience','トレーニング歴'],['purpose','目的'],['priorities','優先部位'],['policy','トレーニング方針']] as const).map(([key,label]) =>
        <TextInput key={key} label={label} value={profile[key]} multiline={key !== 'experience'} onChange={v => setProfile({...profile,[key]:v})}/>)}
    </SaveForm></Panel>
    <Panel title="BIG3 目標・自己ベスト"><SaveForm save={() => run(async () => {
      if (goal.total < 1 || goal.total > 3000) throw Error('BIG3の目標重量を入力してください。')
      await repository.saveGoal(goal,best)
    },'目標と自己ベストを保存しました。')}>
      <NumberInput label="BIG3 合計目標 kg" value={goal.total || null} onChange={total => setGoal({...goal,total:total ?? 0})} min={1} max={3000} step="any"/>
      {lifts.map(lift => <div key={lift} className="master-row"><b>{liftLabels[lift]}</b><div className="form-grid">
        <NumberInput label="登録自己ベスト kg" value={best[lift]} onChange={weight => setBest({...best,[lift]:weight})} min={0} max={1000} step="any"/>
        <NumberInput label="目標重量 kg" value={goal.targets[lift]} onChange={weight => setGoal({...goal,targets:{...goal.targets,[lift]:weight}})} min={1} max={1000} step="any"/>
      </div></div>)}
    </SaveForm></Panel>
    <Panel title="ジム・設備">
      <MasterRow key={gymKey} name="" onDelete={() => {}} onSave={name => run(async () => {await repository.saveGym({...entity(),name}); resetGym(k => k+1)},'ジムを追加しました。')}/>
      {gyms.map(gym => <details key={gym.id} className="master-row"><summary>{gym.name}</summary>
        <MasterRow name={gym.name} onSave={name => run(() => repository.saveGym({...gym,name}),'ジムを更新しました。')}
          onDelete={() => {if (confirm('このジムと設備を削除しますか？')) run(() => repository.removeGym(gym.id),'ジムを削除しました。')}}/>
        {equipment.filter(item => item.gymId === gym.id).map(item => <EquipmentRow key={item.id} item={item} run={run}/>)}
        <button onClick={() => run(() => repository.saveEquipment({...entity(),gymId:gym.id,name:'新しい設備',available:true}),'設備を追加しました。')}><Plus size={17}/>設備を追加</button>
      </details>)}
    </Panel>
    <Panel title="種目マスター">
      <MasterRow key={exerciseKey} name="" extra="" onDelete={() => {}} onSave={(name,muscle) => run(async () => {await repository.saveExercise({...entity(),name,muscle}); resetExercise(k => k+1)},'種目を追加しました。')}/>
      {exercises.map(ex => <details key={ex.id} className="master-row"><summary>{ex.name}</summary><MasterRow name={ex.name} extra={ex.muscle}
        onSave={(name,muscle) => run(() => repository.saveExercise({...ex,name,muscle}),'種目を更新しました。')}
        onDelete={() => {if (confirm('この種目を削除しますか？')) run(() => repository.removeExercise(ex.id),'種目を削除しました。')}}/>
        <ExerciseEquipment exercise={ex} run={run}/></details>)}
    </Panel>
    <Panel title="A / B / C メニュー">
      {templates.map(template => <details className="master-row" key={template.id}><summary>{template.name}</summary><TemplateForm {...{template,exercises,run}}/></details>)}
    </Panel>
    <Panel title="インターバルタイマー"><SaveForm save={() => run(async () => {
      if (interval === null || !Number.isInteger(interval) || interval < 5 || interval > 3600) throw Error('5〜3600秒の整数を入力してください。')
      await repository.saveSettings({...props.settings,interval})
    },'タイマーを保存しました。')}><NumberInput label="休憩時間（秒）" value={interval} onChange={setIntervalValue} min={5} max={3600}/></SaveForm></Panel>
    <section className="card">
      <h2>アプリとデータ</h2>
      <p>バージョン {__APP_VERSION__}</p>
      <p>データはこの端末とブラウザー内に保存されます。PCとiPhoneは自動同期されません。端末間の移行にはJSONバックアップを使ってください。</p>
    </section>
    <Panel title="バックアップ・データ出力"><div className="actions">
      <button onClick={() => run(async () => {
        setFileOutput(new File([await exportBackup(db)],'iron-compass-backup-' + localDate() + '.json',{type:'application/json'}))
        setFileStatus('')
      })}><Download size={18}/>JSON バックアップ</button>
      <button onClick={() => {
        const rows = [['日付','メニュー','ジム','種目','種類','重量kg','回数','強度方式','強度','メモ'],...history.flatMap(w => w.session.exercises.flatMap(item =>
          w.sets.filter(s => s.itemId === item.id && s.done).map(s => [w.session.date,w.session.name,gyms.find(g => g.id === w.session.gymId)?.name,
            exercises.find(ex => ex.id === item.exerciseId)?.name,s.kind === 'work' ? '本セット' : 'ウォームアップ',s.weight,s.reps,s.effortType,s.effort,item.note])))]
        setFileOutput(new File(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')],
          'iron-compass-' + localDate() + '.csv',{type:'text/csv'}))
        setFileStatus('')
      }}><Download size={18}/>CSV 出力</button>
    </div>
    {fileOutput && <div className="master-row">
      <p>{fileOutput.name}</p>
      <div className="actions">
        <button onClick={()=>download(fileOutput)}>ダウンロード</button>
        {typeof navigator.share==='function' && navigator.canShare?.({files:[fileOutput]}) &&
          <button onClick={()=>{void navigator.share({files:[fileOutput]}).catch((e:unknown)=>{
            if (!(e instanceof Error) || e.name!=='AbortError') setFileStatus('共有できませんでした。ダウンロードをお試しください。')
          })}}>共有・ファイルに保存</button>}
      </div>
    </div>}
    <label><span><Upload size={16}/> JSON 復元ファイル</span><input type="file" accept=".json,application/json" onChange={e => {
      const file = e.target.files?.[0]
      e.target.value = ''
      setBackup(undefined)
      setFileStatus('')
      if (file) run(async () => {
        previewBackup(file.name,await file.text())
      })
    }}/></label>
    <details><summary>ファイルを選べない場合はJSONを貼り付け</summary>
      <TextInput label="バックアップJSON" value={paste} onChange={value=>{setPaste(value);setBackup(undefined);setFileStatus('')}} multiline/>
      <button disabled={!paste.trim()} onClick={()=>{setBackup(undefined);setFileStatus('');run(async()=>previewBackup('貼り付けたバックアップ',paste))}}>貼り付けたJSONを検証</button>
    </details>
    {fileStatus && <p role="status">{fileStatus}</p>}
    {backup && <div className="feedback"><p>{backup.name} ／ セッション {backup.sessions} 件。</p>
      <p><strong>復元すると、この端末の全データが置き換わります。</strong> 下書きやAI回答も含まれます。必要に応じて現在のデータを先にバックアップしてください。</p>
      <button onClick={() => {if (confirm('この端末の記録、設定、下書き、AI回答を置き換えます。復元しますか？')) run(async () => {
        await restoreBackup(db,backup.text)
        window.location.reload()
      })}}>復元する</button></div>}
    </Panel>
  </>
}
