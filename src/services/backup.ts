import type { CompassDatabase } from '../db'
import { lifts, rotations } from '../types'
import { validDate } from '../utils/date'
import { inRange } from './training'
import { validCondition } from './readiness'
import { parseMenu } from './coachMenu'
import type {Exercise} from '../types'
type Row = Record<string, unknown>
const fields = {
  profiles:'height weight experience purpose priorities policy', goals:'total targets', exercises:'name muscle',
  gyms:'name', equipment:'gymId name available', templates:'name rotation items', sessions:'date rotation name gymId status exercises',
  sets:'sessionId itemId weight reps effort effortType kind done', readiness:'date minutes gymId sleep fatigue soreness pain request',
  records:'exerciseId weight', recommendations:'name items', settings:'interval',
  conditions:'date sleep sleepQuality fatigue stress motivation soreness pain weight sports notes',
  coachMenus:'date gymId source menu', coachReplies:'date mode body',
}
type TableName = keyof typeof fields
const tables = Object.keys(fields) as TableName[]
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v)
const string = (v: unknown): v is string => typeof v === 'string'
const id = (v: unknown): v is string => string(v) && v.length > 0
const timestamp = (v: unknown) => string(v) && Number.isFinite(Date.parse(v))
const oneOf = (v: unknown, options: readonly string[]) => string(v) && options.includes(v)
const maybe = (v: unknown, min: number, max: number, integer = false) => v === null || inRange(v,min,max,integer)
const plan = (v: unknown) => Array.isArray(v) && v.every(item => object(item) && id(item.exerciseId) && inRange(item.sets,1,30,true) && inRange(item.reps,1,1000,true))
const checks: Record<TableName, (row: Row) => boolean> = {
  profiles:r => inRange(r.height,50,300) && inRange(r.weight,10,600) && [r.experience,r.purpose,r.priorities,r.policy].every(string),
  goals:r => inRange(r.total,1,3000) && object(r.targets) && lifts.every(lift => Object.hasOwn(r.targets as Row,lift) && maybe((r.targets as Row)[lift],1,1000)),
  exercises:r => id(r.name) && id(r.muscle) && (r.requiredEquipment===undefined ||
    (Array.isArray(r.requiredEquipment) && r.requiredEquipment.every(id))),
  gyms:r => id(r.name),
  equipment:r => id(r.gymId) && id(r.name) && typeof r.available === 'boolean',
  templates:r => id(r.name) && oneOf(r.rotation,rotations) && plan(r.items),
  sessions:r => validDate(r.date) && oneOf(r.rotation,rotations) && id(r.name) && string(r.gymId) && oneOf(r.status,['draft','finished']) &&
    Array.isArray(r.exercises) && r.exercises.every(item => object(item) && id(item.id) && id(item.exerciseId) && string(item.note) &&
      (item.restSeconds===undefined || inRange(item.restSeconds,30,600,true))) &&
    new Set(r.exercises.map(item => item.id)).size === r.exercises.length,
  sets:r => id(r.sessionId) && id(r.itemId) && [r.weight,r.reps,r.effort].every(v => v === null || (typeof v === 'number' && Number.isFinite(v))) &&
    (r.position === undefined || inRange(r.position,0,Number.MAX_SAFE_INTEGER,true)) &&
    oneOf(r.effortType,['RPE','RIR']) && oneOf(r.kind,['work','warmup']) && typeof r.done === 'boolean',
  readiness:r => validDate(r.date) && inRange(r.minutes,1,600,true) && string(r.gymId) && inRange(r.sleep,0,24) &&
    inRange(r.fatigue,0,10) && [r.soreness,r.pain,r.request].every(string),
  records:r => id(r.exerciseId) && inRange(r.weight,0,1000),
  recommendations:r => id(r.name) && plan(r.items),
  settings:r => inRange(r.interval,5,3600,true),
  conditions:validCondition,
  coachMenus:r => validDate(r.date) && id(r.gymId) && oneOf(r.source,['local','ai']) && object(r.menu),
  coachReplies:r => validDate(r.date) && oneOf(r.mode,['review','analysis']) && id(r.body) && r.body.length<=50000,
}

export function parseBackup(text: string) {
  const value: unknown = JSON.parse(text)
  if (!object(value) || (value.version !== 1 && value.version !== 2) || !object(value.data)) throw Error('バックアップ形式またはバージョンが無効です。')
  const data = value.version===1 ? {...value.data,conditions:[],coachMenus:[],coachReplies:[]} : value.data
  for (const name of tables) {
    const rows = data[name]
    if (!Array.isArray(rows) || !rows.every(row => object(row) && id(row.id) && timestamp(row.createdAt) &&
      timestamp(row.updatedAt) && fields[name].split(' ').every(field => Object.hasOwn(row,field)) && checks[name](row)) ||
      new Set(rows.map(row => row.id)).size !== rows.length) throw Error(name + ' のデータが無効です。')
  }
  const rows = data as Record<TableName, Row[]>
  const has = (table: TableName, key: string, value: unknown) => rows[table].some(row => row[key] === value)
  const knownGym = (value: unknown) => value === '' || has('gyms','id',value)
  const knownExercise = (item: Row) => has('exercises','id',item.exerciseId)
  const invalidReferences =
    !['profiles','goals','settings'].every(name => rows[name as TableName].length === 1 && has(name as TableName,'id','main')) ||
    !lifts.every(lift => has('exercises','id',lift)) ||
    rows.templates.length !== 3 || !rotations.every(rotation => has('templates','rotation',rotation)) ||
    [...rows.templates,...rows.recommendations].some(row => !(row.items as Row[]).every(knownExercise)) ||
    rows.equipment.some(row => !has('gyms','id',row.gymId)) ||
    rows.sessions.filter(row => row.status === 'draft').length > 1 ||
    rows.sessions.some(row => !knownGym(row.gymId) || !(row.exercises as Row[]).every(knownExercise) ||
      (row.status === 'finished' && !rows.sets.some(set => set.sessionId === row.id && set.done))) ||
    rows.sets.some(set => {
      const session = rows.sessions.find(row => row.id === set.sessionId)
      return !session || !(session.exercises as Row[]).some(item => item.id === set.itemId) ||
        (session.status === 'finished' && (!maybe(set.weight,0,1000) || !maybe(set.reps,1,1000,true) ||
          !maybe(set.effort,0,10) || (set.done && (set.weight === null || set.reps === null))))
    }) ||
    rows.records.some(row => !knownExercise(row)) || rows.readiness.some(row => !knownGym(row.gymId)) ||
    new Set(rows.records.map(row => row.exerciseId)).size !== rows.records.length ||
    new Set(rows.readiness.map(row => row.date)).size !== rows.readiness.length ||
    new Set(rows.conditions.map(row => row.date)).size !== rows.conditions.length ||
    rows.coachMenus.some(row=>!has('gyms','id',row.gymId))
  if (invalidReferences) throw Error('データ間の参照または必須設定が無効です。')
  rows.coachMenus=rows.coachMenus.map(row=>({...row,menu:parseMenu(JSON.stringify(row.menu),rows.exercises as unknown as Exercise[])}))
  return rows
}
export async function exportBackup(db: CompassDatabase) {
  return db.transaction('r', db.tables, async () => {
    const entries = await Promise.all(tables.map(async name => [name,await db.table(name).toArray()]))
    return JSON.stringify({version:2,data:Object.fromEntries(entries)}, null, 2)
  })
}
export async function restoreBackup(db: CompassDatabase, text: string) {
  const data = parseBackup(text)
  await db.transaction('rw', db.tables, async () => {
    for (const name of tables) {
      await db.table(name).clear()
      await db.table(name).bulkAdd(data[name])
    }
  })
}
export function download(file:File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url),60000)
}
export const csvCell = (value: unknown) => {
  const text = String(value ?? '')
  return '"' + (/^[\s]*[=+\-@\t\r]/.test(text) && typeof value === 'string' ? "'" : '') + text.replaceAll('"','""') + '"'
}
