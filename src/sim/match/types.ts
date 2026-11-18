import type { Pos } from '../data/raw'
import type { TeamRef } from '../world/types'
import type { Tactic } from './tactics'

export interface MPlayer {
  id: number
  name: string
  short: string
  num: number
  pos: Pos[]
  attrs: number[]
  /** Starting freshness 0–100. */
  cond: number
  /** -1 … +1 current form. */
  form: number
  consistency: number
  bigMatch: number
  injuryProne: number
}

export interface MTeam {
  ref: TeamRef
  name: string
  short: string
  colors: [string, string]
  tactic: Tactic
  /** Starters and bench; tactic.lineup / bench hold ids from this list. */
  players: MPlayer[]
  ai: boolean
}

export interface MatchOpts {
  seed: number
  neutral: boolean
  knockout: boolean
  subs: number
  /** 0–1, how big the occasion is (affects bigMatch trait). */
  importance: number
  /** Keep position frames for the 2D viewer. */
  record: boolean
}

export type EvType =
  | 'kickoff' | 'goal' | 'shot' | 'save' | 'block' | 'miss' | 'post' | 'corner' | 'foul' | 'yellow' | 'red' | 'offside'
  | 'sub' | 'injury' | 'pen' | 'penMiss' | 'half' | 'full' | 'shootout' | 'chance' | 'tactic'

export interface MEvent {
  /** Display minute (1-based) and stoppage minutes beyond the period. */
  min: number
  plus: number
  type: EvType
  team: 0 | 1
  /** Player ids. */
  p?: number
  q?: number
  x?: number
  y?: number
  xg?: number
  text: string
  /** Frame index at which this happened. */
  f: number
}

export interface ShotRec {
  team: 0 | 1
  p: number
  min: number
  x: number
  y: number
  xg: number
  out: 'goal' | 'saved' | 'blocked' | 'off' | 'post'
  kind: 'open' | 'header' | 'fk' | 'pen' | 'corner'
}

export interface PStats {
  id: number
  mins: number
  touches: number
  passes: number
  passesC: number
  keyPasses: number
  shots: number
  sot: number
  goals: number
  assists: number
  xg: number
  xa: number
  dribbles: number
  dribblesWon: number
  tackles: number
  tacklesWon: number
  interceptions: number
  clearances: number
  aerials: number
  aerialsWon: number
  fouls: number
  fouled: number
  saves: number
  yellow: number
  red: number
  offsides: number
  lost: number
  conceded: number
  rating: number
  /** 12×8 touch grid. */
  heat: number[]
  on: boolean
  played: boolean
  /** Position played (the slot he started in or came on into). */
  pos?: Pos
  subOn?: number
  subOff?: number
}

export interface TStats {
  goals: number
  possession: number
  shots: number
  sot: number
  xg: number
  passes: number
  passesC: number
  corners: number
  fouls: number
  offsides: number
  yellows: number
  reds: number
  tackles: number
  saves: number
  bigChances: number
}

/** One keyframe: time in match seconds, ball, 22 player positions (x,y pairs; -1 when off). */
export interface Frame {
  t: number
  b: [number, number]
  p: number[]
  /** Team in possession. */
  pos: 0 | 1
  /** Global slot index of the ball carrier (team*11+slot), -1 if loose/in flight. */
  c: number
}

export interface MatchSnapshot {
  min: number
  plus: number
  period: number
  done: boolean
  score: [number, number]
  pens?: [number, number]
  stats: [TStats, TStats]
  players: [PStats[], PStats[]]
  on: [number[], number[]]
  energy: [number[], number[]]
  subsLeft: [number, number]
  momentum: number[]
  tactics: [Tactic, Tactic]
}

export interface MatchReport {
  id: number
  fixtureId: number
  home: { ref: TeamRef; name: string; short: string; colors: [string, string]; formation: string }
  away: { ref: TeamRef; name: string; short: string; colors: [string, string]; formation: string }
  score: [number, number]
  pens?: [number, number]
  et: boolean
  stats: [TStats, TStats]
  players: [PStats[], PStats[]]
  names: Record<number, string>
  events: MEvent[]
  shots: ShotRec[]
  momentum: number[]
  lineups: [number[], number[]]
  motm: number
}
