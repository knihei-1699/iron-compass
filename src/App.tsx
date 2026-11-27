import {lazy,Suspense,useEffect,useRef,useState,useSyncExternalStore} from 'react'
import {Bot, Compass, Dumbbell, House, Settings2, TrendingUp} from 'lucide-react'
import {db} from './db'
import {initialize} from './db/seed'
import {loadCatalog} from './repositories/catalog'
import {deleteWorkout, loadWorkouts, saveWorkout} from './repositories/workouts'
import {newWorkout,nextRotation} from './services/training'
import {Home} from './pages/Home'
import {Training} from './pages/Training'
import {Settings} from './pages/Settings'
import type {Workout} from './types'
import type {SavedMenu} from './types/coach'
import {loadCoach,registerMenu,saveCondition,saveReply} from './repositories/coach'
import {Condition} from './pages/Condition'
import {Coach} from './pages/Coach'
import {localDate} from './utils/date'
import {suggest} from './services/planning'
import {menuIssues} from './services/coachMenu'
import {readiness} from './services/readiness'
import {pageFromHash,type Page} from './services/navigation'
import type {watchUpdates} from './services/updates'
import {useKeyboard} from './hooks/useKeyboard'

const nav = [
  {id:'home', label:'ホーム', title:'ホーム', icon:House},
  {id:'training', label:'記録', title:'トレーニング', icon:Dumbbell},
  {id:'history', label:'履歴', title:'履歴・分析', icon:TrendingUp},
  {id:'coach', label:'コーチ', title:'AIコーチ', icon:Bot},
  {id:'settings', label:'設定', title:'プロフィール・設定', icon:Settings2},
] as const
const History = lazy(() => import('./pages/History').then(module => ({default:module.History})))

export function App({updates}: {updates:ReturnType<typeof watchUpdates>}) {
  const [page,setPage] = useState(()=>pageFromHash(window.location.hash))
  const [catalog,setCatalog] = useState<Awaited<ReturnType<typeof loadCatalog>>>()
  const [workouts,setWorkouts] = useState<Workout[]>([])
  const [coach,setCoach] = useState<Awaited<ReturnType<typeof loadCoach>>>({conditions:[],menus:[],replies:[]})
  const [draft,setDraft] = useState<Workout>()
  const [editing,setEditing] = useState<Workout>()
  const [feedback,setFeedback] = useState<{text:string; error:boolean}>()
  const hasUpdate=useSyncExternalStore(updates.subscribe,updates.getSnapshot)
  const [updating,setUpdating]=useState(false)
  useKeyboard()
  const busy = useRef(false)
  const pending = useRef<Promise<void>>(Promise.resolve())
  const open = (next:Page) => {
    setFeedback(undefined)
    setPage(next)
    if (window.location.hash!=='#'+next) window.location.hash=next
    window.scrollTo(0,0)
  }
  const failure = (e:unknown) => setFeedback({text:e instanceof Error ? e.message : '処理に失敗しました。',error:true})
  async function refresh() {
    const [nextCatalog,nextWorkouts,nextCoach] = await Promise.all([loadCatalog(db),loadWorkouts(db),loadCoach(db)])
    setCatalog(nextCatalog)
    setWorkouts(nextWorkouts)
    setCoach(nextCoach)
    return nextWorkouts
  }
  useEffect(() => {
    void initialize(db).then(refresh).then(rows => setDraft(rows.find(w => w.session.status === 'draft'))).catch(failure)
    const listener = () => {setPage(pageFromHash(window.location.hash));window.scrollTo(0,0)}
    window.addEventListener('hashchange',listener)
    return () => window.removeEventListener('hashchange',listener)
  },[])
  function run(action:()=>Promise<unknown>, message?:string) {
    if (busy.current) return
    busy.current = true
    setFeedback(undefined)
    void pending.current.then(action).then(refresh).then(() => {
      if (message) setFeedback({text:message,error:false})
    }).catch(failure).finally(() => {busy.current = false})
  }
  function change(workout:Workout) {
    if (busy.current) return
    if (editing) {setEditing(workout); return}
    setDraft(workout)
    pending.current = pending.current.then(() => saveWorkout(db,workout)).catch(failure)
  }
  const history = workouts.filter(w => w.session.status === 'finished')
  const rotation = nextRotation(history.map(w => w.session))
  const today = localDate()
  const condition = coach.conditions.find(c=>c.date===today)
  const template = catalog?.templates.find(t=>t.rotation===rotation)
  const gym = catalog?.gyms[0]
  const suggestion = catalog && template && gym ? suggest({template,exercises:catalog.exercises,
    equipment:catalog.equipment.filter(e=>e.gymId===gym.id),history,condition,minutes:40,
    priorities:catalog.profile.priorities,date:today,interval:catalog.settings.interval}) : undefined
  function startMenu(saved:SavedMenu) {
    if (!catalog || busy.current) return
    if (draft) {failure(Error('入力中の記録を終了または破棄してから開始してください。'));return}
    const {menu,gymId}=saved
    const issues=menuIssues(menu,{exercises:catalog.exercises,equipment:catalog.equipment.filter(e=>e.gymId===gymId),
      history,date:today,minutes:menu.estimatedDurationMinutes,rotation,pain:condition?.pain,condition})
    if (issues.length) {failure(Error(issues.join(' ')));return}
    const workout=newWorkout({...saved, name:menu.menuName,rotation:menu.rotationType,items:menu.exercises},gymId)
    workout.session.exercises.forEach((item,index)=>{
      const suggestion=menu.exercises[index]
      item.note='目標RIR '+suggestion.targetRIR+' · '+suggestion.formCue
      item.restSeconds=suggestion.restSeconds
      workout.sets.filter(set=>set.itemId===item.id).forEach(set=>{set.weight=suggestion.weightKg;set.effortType='RIR'})
    })
    run(async()=>{await saveWorkout(db,workout);setDraft(workout);setEditing(undefined);open('training')})
  }
  const current = editing ?? draft
  async function requestUpdate() {
    if (busy.current || current || !catalog) return
    if (!confirm('保存済みデータのバックアップをおすすめします。保存していないフォーム入力は失われます。更新しますか？')) return
    busy.current=true
    setUpdating(true)
    const canceled=(error:Error)=>{
      busy.current=false
      setUpdating(false)
      failure(error)
    }
    try {
      await pending.current
      if (await db.sessions.where('status').equals('draft').count()) {
        canceled(Error('別の画面に下書きがあります。記録を保存してから更新してください。'))
        return
      }
      updates.apply(()=>canceled(Error('更新を開始できませんでした。通信状態を確認し、もう一度お試しください。')))
    } catch (e) {canceled(e instanceof Error ? e : Error('更新に失敗しました。'))}
  }
  return <>
    <header className="topbar"><div className="header-inner">
      <button className="brand" onClick={() => open('home')} aria-label="IRON COMPASS ホーム"><span><Compass size={24}/></span>IRON <b>COMPASS</b></button>
      <button className="top-settings" onClick={() => open('settings')} aria-label="設定"><Settings2 size={21}/></button>
    </div></header>
    <main>
      {page !== 'home' && <h1>{page==='condition' ? 'コンディション' : nav.find(item => item.id === page)?.title}</h1>}
      {feedback && <p className={'feedback ' + (feedback.error ? 'error' : '')} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      {hasUpdate && <section className="feedback" aria-label="アプリの更新">
        <p role="status">{current ? '新しいバージョンがあります。記録の保存または編集の完了後に更新できます。' : '新しいバージョンがあります。更新前にJSONバックアップを保存してください。'}</p>
        <div className="actions"><button disabled={!catalog || !!current || updating} onClick={()=>void requestUpdate()}>{updating ? '更新中…' : '更新する'}</button>
          {page!=='settings' && <button onClick={()=>open('settings')}>バックアップ設定を開く</button>}</div>
      </section>}
      {!catalog && !feedback?.error && <p role="status">読み込み中…</p>}
      {catalog && template && <>
        {page === 'home' && <Home goal={catalog.goal.total} records={catalog.records} history={history} template={template}
          exercises={catalog.exercises} draft={!!draft} start={() => {setEditing(undefined); open('training')}} openHistory={() => open('history')}
          condition={condition} score={readiness(condition,history,catalog.exercises).score} suggestion={suggestion} gym={gym?.name}
          openCondition={()=>open('condition')} openCoach={()=>open('coach')}/>}
        {page === 'training' && <Training workout={current} history={history} exercises={catalog.exercises} gyms={catalog.gyms} templates={catalog.templates}
          rotation={rotation} interval={catalog.settings.interval} change={change}
          start={(template,gymId) => {if (!draft) change(newWorkout(template,gymId))}}
          finish={() => {if (current) run(async () => {
            await saveWorkout(db,{...current,session:{...current.session,status:'finished'}})
            if (editing) setEditing(undefined)
            else setDraft(undefined)
            open('history')
          },'トレーニングを保存しました。')}}
          discard={() => {
            if (editing) {setEditing(undefined); open('history'); return}
            if (draft && confirm('入力中のトレーニングを破棄しますか？')) run(async () => {
              await deleteWorkout(db,draft.session.id)
              setDraft(undefined)
            },'下書きを破棄しました。')
          }}/>}
        {page === 'history' && <Suspense fallback={<p role="status">履歴を読み込み中…</p>}><History {...{history}} exercises={catalog.exercises} records={catalog.records}
          edit={w => {setEditing(w); open('training')}}
          remove={id => {if (confirm('このトレーニング記録を削除しますか？')) run(async () => {
            await deleteWorkout(db,id)
            if (editing?.session.id === id) setEditing(undefined)
          },'トレーニングを削除しました。')}}/></Suspense>}
        {page === 'settings' && <Settings {...catalog} {...{history,run}}/>}
        {page === 'condition' && <Condition conditions={coach.conditions} history={history} exercises={catalog.exercises}
          save={value=>run(()=>saveCondition(db,value),'コンディションを保存しました。')}/>}
        {page === 'coach' && <Coach {...{catalog,condition,history,template}} menus={coach.menus} replies={coach.replies}
          register={(input,minutes)=>run(()=>registerMenu(db,input,minutes),'提案メニューを登録しました。')}
          saveReply={(date,mode,body)=>run(()=>saveReply(db,date,mode,body),'AI回答を保存しました。')} useMenu={startMenu}/>}
      </>}
    </main>
    <nav className="bottom-nav" aria-label="メインナビゲーション"><div className="nav-inner">
      {nav.map(item => <button key={item.id} onClick={() => {if (item.id === 'training') setEditing(undefined); open(item.id)}} aria-current={page === item.id ? 'page' : undefined}>
        <item.icon size={22}/><span>{item.label}</span>
      </button>)}
    </div></nav>
  </>
}
