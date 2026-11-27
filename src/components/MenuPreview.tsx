import {NumberInput,TextInput} from './ui'
import type {Exercise} from '../types'
import type {SuggestedMenu} from '../types/coach'
import {planMinutes} from '../services/planning'

export function MenuPreview({menu,exercises,edit}:{
  menu:SuggestedMenu;exercises:Exercise[];edit?:(menu:SuggestedMenu)=>void;
}) {
  const name=(id:string)=>exercises.find(ex=>ex.id===id)?.name ?? id
  return <div className="menu-preview">
    {edit ? <TextInput label="メニュー名" value={menu.menuName} onChange={menuName=>edit({...menu,menuName})}/> : <h3>{menu.menuName}</h3>}
    <p>{menu.rotationType} · 準備・セット・休憩込み 約 {Math.max(menu.estimatedDurationMinutes,planMinutes(menu.exercises))} 分</p>
    <p>{menu.summary}</p>
    {menu.warnings.length>0 && <ul className="warnings">{menu.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>}
    {menu.exercises.map((item,index)=>{
      const patch=(value:Partial<typeof item>)=>{
        const items=menu.exercises.map((e,i)=>i===index ? {...e,...value} : e)
        edit?.({...menu,estimatedDurationMinutes:planMinutes(items),exercises:items})
      }
      return <article className="master-row" key={item.exerciseId}>
        <h3>{name(item.exerciseId)}</h3>
        {edit ? <div className="form-grid">
          <NumberInput label="重量 kg（空欄可）" value={item.weightKg} min={0} max={1000} step="any" onChange={weightKg=>patch({weightKg})}/>
          <NumberInput label="回数" value={item.reps || null} min={1} max={30} onChange={reps=>patch({reps:reps ?? 0})}/>
          <NumberInput label="セット" value={item.sets || null} min={1} max={8} onChange={sets=>patch({sets:sets ?? 0})}/>
          <NumberInput label="休憩 秒" value={item.restSeconds || null} min={30} max={600} onChange={restSeconds=>patch({restSeconds:restSeconds ?? 0})}/>
        </div> : <p>{item.weightKg===null ? '重量未指定' : item.weightKg+' kg'} · {item.reps} 回 × {item.sets} セット · 休憩 {item.restSeconds} 秒</p>}
        <p>目標 RIR {item.targetRIR} · {item.formCue}</p><p className="muted">{item.recommendationReason}</p>
        <p className="muted">代替 {item.alternatives.map(name).join('、') || '候補なし'}</p>
      </article>
    })}
  </div>
}
