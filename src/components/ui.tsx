import type { ReactNode } from 'react'
export function Card({children, className = ''}: {children:ReactNode; className?:string}) {
  return <section className={'card ' + className}>{children}</section>
}
export function NumberInput({label,value,onChange,min,max,step = 1}: {
  label:string; value:number | null; onChange:(value:number | null)=>void; min:number; max:number; step?:number | 'any'
}) {
  return <label>{label}<input type="number" inputMode={step === 1 ? 'numeric' : 'decimal'} enterKeyHint="next" autoComplete="off" min={min} max={max} step={step}
    value={value ?? ''} onChange={event => onChange(event.target.value === '' ? null : event.target.valueAsNumber)}/></label>
}
export function TextInput({label,value,onChange,multiline = false,id}: {
  label:string; value:string; onChange:(value:string)=>void; multiline?:boolean;id?:string
}) {
  return <label>{label}{multiline
    ? <textarea id={id} value={value} onChange={event => onChange(event.target.value)}/>
    : <input id={id} value={value} onChange={event => onChange(event.target.value)}/>}</label>
}
export function move<T>(items:T[], index:number, offset:number) {
  const result = [...items]
  const target = index + offset
  if (target >= 0 && target < items.length) [result[index],result[target]] = [result[target],result[index]]
  return result
}
