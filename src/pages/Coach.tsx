import {useState} from 'react'
import {Card,NumberInput,TextInput} from '../components/ui'
import {MenuPreview} from '../components/MenuPreview'
import type {loadCatalog} from '../repositories/catalog'
import type {CoachMode,CoachReply,DailyCondition,SavedMenu,SuggestedMenu} from '../types/coach'
import type {Workout,WorkoutTemplate} from '../types'
import {modes} from '../types/coach'
import {buildPrompt,modeLabels} from '../services/coaching'
import {parseMenu,menuIssues} from '../services/coachMenu'
import {suggest} from '../services/planning'
import {offsetDate} from '../services/growth'
import {localDate,displayDate} from '../utils/date'

export function Coach({catalog,condition,history,template,menus,replies,register,saveReply,useMenu}:{
  catalog:Awaited<ReturnType<typeof loadCatalog>>;condition?:DailyCondition;history:Workout[];template:WorkoutTemplate;
  menus:SavedMenu[];replies:CoachReply[];register:(input:Omit<SavedMenu,'id'|'createdAt'|'updatedAt'>,minutes:number)=>void;
  saveReply:(date:string,mode:CoachReply['mode'],body:string)=>void;useMenu:(menu:SavedMenu)=>void;
}) {
  const today=localDate()
  const [mode,setMode]=useState<CoachMode>('menu')
  const [gymId,setGym]=useState(catalog.gyms[0]?.id ?? '')
  const [minutes,setMinutes]=useState<number|null>(40)
  const [period,setPeriod]=useState('30')
  const [start,setStart]=useState(offsetDate(today,-29))
  const [end,setEnd]=useState(today)
  const [request,setRequest]=useState('')
  const [prompt,setPrompt]=useState('')
  const [raw,setRaw]=useState('')
  const [preview,setPreview]=useState<SuggestedMenu>()
  const [checked,setChecked]=useState(false)
  const [reply,setReply]=useState('')
  const [replyDate,setReplyDate]=useState(today)
  const [status,setStatus]=useState('')
  const [jsonError,setJsonError]=useState('')
  const gym=catalog.gyms.find(g=>g.id===gymId)
  const equipment=catalog.equipment.filter(e=>e.gymId===gymId)
  const validMinutes=minutes!==null && Number.isInteger(minutes) && minutes>=5 && minutes<=180
  const local=gym && validMinutes ? suggest({template,exercises:catalog.exercises,equipment,history,condition,minutes,
    priorities:catalog.profile.priorities,date:today,interval:catalog.settings.interval}) : undefined
  const validate=(menu:SuggestedMenu)=>menuIssues(menu,{exercises:catalog.exercises,equipment,history,date:today,
    minutes:minutes ?? 0,rotation:template.rotation,pain:condition?.pain,condition})
  const issues=preview ? validate(preview) : []
  const attempt=(action:()=>void)=>{
    try {setStatus('');action()} catch (e) {setStatus((e as Error).message)}
  }
  const registerMenu=(menu:SuggestedMenu,source:SavedMenu['source'])=>{
    if (!gym || !validMinutes) return
    register({date:today,gymId,source,menu},minutes)
  }
  return <>
    <Card><h2>今日の利用条件</h2><div className="form-grid">
      <label>利用ジム<select value={gymId} onChange={e=>{setGym(e.target.value);setChecked(false)}}><option value="">選択してください</option>{catalog.gyms.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <NumberInput label="利用可能時間（分）" value={minutes} min={5} max={180} onChange={n=>{setMinutes(n);setChecked(false)}}/>
    </div><TextInput label="今日の要望" value={request} onChange={setRequest} multiline/>
    {condition?.pain.trim() && <p className="feedback">痛み・違和感が入力されています。負荷や動作の見直しを優先してください。</p>}</Card>
    <Card className="proposal-card"><h2>端末内のメニュー提案</h2>
      {local?.exercises.length ? <details>
        <summary>{local.rotationType} · {local.exercises.length} 種目 · 約 {local.estimatedDurationMinutes} 分</summary>
        <MenuPreview menu={local} exercises={catalog.exercises}/>
        <button onClick={()=>registerMenu(local,'local')}>端末提案を登録</button>
      </details> : local ? <><p>{local.summary}</p>{local.warnings.length>0 && <ul className="warnings">
        {local.warnings.map((warning,index)=><li key={index}>{warning}</li>)}
      </ul>}</> : <p>ジムと5〜180分の利用時間を指定してください。</p>}
    </Card>
    <Card><h2>AIに相談する</h2><div className="form-grid">
      <label>相談モード<select value={mode} onChange={e=>{setMode(e.target.value as CoachMode);setPrompt('');setReply('');setStatus('')}}>
        {modes.map(m=><option key={m} value={m}>{modeLabels[m]}</option>)}</select></label>
      <label>履歴の対象期間<select value={period} onChange={e=>setPeriod(e.target.value)}>
        <option value="7">7日</option><option value="30">30日</option><option value="90">90日</option><option value="custom">任意期間</option>
      </select></label>
    </div>
    {period==='custom' && <div className="form-grid">
      <label>開始日<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label>終了日<input type="date" value={end} max={today} onChange={e=>setEnd(e.target.value)}/></label>
    </div>}
    <p>内容を確認・編集してコピーし、選んだAIの画面に貼り付けてください。</p>
    <button className="primary" disabled={!validMinutes} onClick={()=>attempt(()=>setPrompt(buildPrompt({
      mode,start:period==='custom' ? start : offsetDate(today,1-Number(period)),end:period==='custom' ? end : today,
      today,profile:catalog.profile,goal:catalog.goal,template,records:catalog.records,history,exercises:catalog.exercises,
      condition,gym,equipment,minutes:minutes ?? 0,request,
    })))}>プロンプトを生成</button>
    {prompt && <TextInput id="coach-prompt" label="共有する内容（編集できます）" value={prompt} onChange={setPrompt} multiline/>}
    <div className="actions">
      <button disabled={!prompt.trim()} onClick={()=>void (async ()=>{
        try {await navigator.clipboard.writeText(prompt);setStatus('クリップボードにコピーしました。')}
        catch {
          const field=document.getElementById('coach-prompt')
          if (field instanceof HTMLTextAreaElement) {field.focus();field.setSelectionRange(0,field.value.length)}
          setStatus('自動コピーを利用できません。テキスト欄で「すべてを選択」してコピーしてください。')
        }
      })()}>コピー</button>
      <a className="link-button" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPTを開く</a>
      <a className="link-button" href="https://claude.ai/" target="_blank" rel="noopener noreferrer">Claudeを開く</a>
    </div>
    {status && <p role="status" className="feedback">{status}</p>}
    </Card>
    {mode==='menu' ? <Card className="proposal-card"><h2>AIメニューの取り込み</h2>
      <TextInput label="メニューJSON" value={raw} onChange={value=>{setRaw(value);setPreview(undefined);setChecked(false);setJsonError('')}} multiline/>
      <button onClick={()=>{
        setChecked(false)
        try {setPreview(parseMenu(raw,catalog.exercises));setJsonError('')}
        catch (e) {setPreview(undefined);setJsonError((e as Error).message)}
      }}>検証してプレビュー</button>
      {jsonError && <p role="alert" className="feedback error">{jsonError}</p>}
      {preview && <>
        <MenuPreview menu={preview} exercises={catalog.exercises} edit={value=>{setPreview(value);setChecked(false)}}/>
        {issues.length>0 && <ul className="warnings">{issues.map(issue=><li key={issue}>{issue}</li>)}</ul>}
        <label className="check"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>種目・重量・設備・時間を確認した</label>
        <button className="primary" disabled={!checked || issues.length>0 || !validMinutes || !gym}
          onClick={()=>{registerMenu(preview,'ai');setChecked(false)}}>確認済みメニューを登録</button>
      </>}
    </Card> : <Card><h2>AI回答の保存</h2><label>相談日<input type="date" value={replyDate} onChange={e=>setReplyDate(e.target.value)}/></label>
      <TextInput label="回答を貼り付け" value={reply} onChange={setReply} multiline/>
      <button disabled={!reply.trim()} onClick={()=>{saveReply(replyDate,mode,reply)}}>AI回答を保存</button>
    </Card>}
    <Card><h2>登録済みの提案</h2>{menus.length ? menus.map(saved=><details key={saved.id} className="master-row">
      <summary>{saved.menu.menuName} · {saved.source==='ai' ? 'AI提案' : '端末提案'}</summary>
      <p>{displayDate(saved.date)} · {catalog.gyms.find(g=>g.id===saved.gymId)?.name}</p>
      <MenuPreview menu={saved.menu} exercises={catalog.exercises}/>
      <button disabled={saved.menu.rotationType!==template.rotation || !!condition?.pain.trim()} onClick={()=>useMenu(saved)}>この提案で記録を開始</button>
    </details>) : <p>登録済みの提案はありません。</p>}</Card>
    <Card><h2>保存済みのAI回答</h2>{replies.length ? replies.map(saved=><details key={saved.id} className="master-row">
      <summary>{displayDate(saved.date)} · {modeLabels[saved.mode]}</summary><p className="preserve-text">{saved.body}</p>
    </details>) : <p>保存済みの回答はありません。</p>}</Card>
  </>
}
