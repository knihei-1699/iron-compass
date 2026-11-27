import type {Entity, Rotation} from './index'
export const sorenessGroups = ['胸','背中','肩','脚','腕','体幹'] as const
export type Soreness = Partial<Record<typeof sorenessGroups[number],number>>
export interface DailyCondition extends Entity {
  date:string; sleep:number; sleepQuality:number; fatigue:number; stress:number; motivation:number;
  soreness:Soreness; pain:string; weight:number|null; sports:string; notes:string;
}
export interface SuggestedExercise {
  exerciseId:string; sets:number; weightKg:number|null; reps:number; targetRIR:number;
  restSeconds:number; formCue:string; alternatives:string[]; recommendationReason:string;
}
export interface SuggestedMenu {
  schemaVersion:1; menuName:string; rotationType:Rotation; estimatedDurationMinutes:number;
  summary:string; exercises:SuggestedExercise[]; warnings:string[];
}
export interface SavedMenu extends Entity {
  date:string; gymId:string; source:'local'|'ai'; menu:SuggestedMenu;
}
export const modes = ['menu','review','analysis'] as const
export type CoachMode = typeof modes[number]
export interface CoachReply extends Entity {date:string; mode:Exclude<CoachMode,'menu'>; body:string}
