import type { Day } from '../core/date'
import type { Pos } from '../data/raw'

export type { Pos }
export type Level = 'senior' | 'u23' | 'u21' | 'u20' | 'u19' | 'u17' | 'u16' | 'u15'
export const LEVELS: Level[] = ['senior', 'u23', 'u21', 'u20', 'u19', 'u17', 'u16', 'u15']
export const LEVEL_AGE: Record<Level, number> = { senior: 99, u23: 23, u21: 21, u20: 20, u19: 19, u17: 17, u16: 16, u15: 15 }
export const LEVEL_NAME: Record<Level, string> = {
  senior: 'Senior', u23: 'U23', u21: 'U21', u20: 'U20', u19: 'U19', u17: 'U17', u16: 'U16', u15: 'U15',
}

export interface Traits {
  consistency: number // 1–20
  bigMatch: number
  injuryProne: number
  ambition: number
  professionalism: number
  /** Attachment to representing Iran (drives dual-national willingness). */
  attachment: number
}

export interface SeasonStats {
  apps: number
  starts: number
  mins: number
  goals: number
  assists: number
  ratingSum: number
  cleanSheets: number
  yellows: number
  reds: number
  motm: number
}
export const emptyStats = (): SeasonStats => ({
  apps: 0, starts: 0, mins: 0, goals: 0, assists: 0, ratingSum: 0, cleanSheets: 0, yellows: 0, reds: 0, motm: 0,
})

export interface Injury { name: string; until: Day }

export interface HistoryRow { season: number; clubId: number | null; stats: SeasonStats }
export interface TransferRow { day: Day; from: number | null; to: number | null; fee: number; loan?: boolean }

export interface Player {
  id: number
  rid?: string
  real: boolean
  name: string
  dob: Day
  nat: string[]
  born?: string
  pos: Pos[]
  clubId: number | null
  heightCm: number
  foot: 'L' | 'R' | 'B'
  attrs: number[]
  /** Cached overall at pos[0]. */
  ovr: number
  pot: number
  traits: Traits
  value: number
  wage: number
  contractEnd: Day
  /** Last club match ratings, newest last (max 8). */
  form: number[]
  /** 0–100 physical freshness. */
  cond: number
  /** 0–100 match sharpness from recent minutes. */
  sharp: number
  morale: number
  injury: Injury | null
  club: SeasonStats
  intl: SeasonStats
  caps: number
  goals: number
  capTied: boolean
  youthCaps: Partial<Record<Level, number>>
  history: HistoryRow[]
  transfers: TransferRow[]
  valueHist: [Day, number][]
  photo?: string
  photoCredit?: string
  /** 0–100: how well the federation's scouts know this player. */
  known: number
  retired?: boolean
  intlRetired?: boolean
  /** Dual-national state toward Iran. */
  iranStatus?: 'undeclared' | 'interested' | 'reluctant' | 'declined' | 'committed'
  willingness?: number
  num?: number
}

export interface Club {
  id: number
  rid: string
  name: string
  short: string
  country: string
  leagueId: number
  city?: string
  stadium?: string
  rep: number
  colors: [string, string]
  logo?: string
  /** Team strength used by the fast engine (0–100 scale, same as player overalls). */
  str: number
  /** True when the whole squad is modelled as individuals. */
  full: boolean
  academy: boolean
}

export interface League {
  id: number
  rid: string
  name: string
  country: string
  tier: number
  strength: number
  startMonth: number
  clubIds: number[]
  /** Leagues with no schedule (placeholder "rest of world" buckets). */
  virtual: boolean
}

export interface Nation {
  code: string
  name: string
  confed: 'AFC' | 'UEFA' | 'CAF' | 'CONMEBOL' | 'CONCACAF' | 'OFC'
  region?: string
  points: number
  rank: number
  prevRank: number
  colors: [string, string]
  /** Typical first-XI overall. */
  level: number
}

export interface Staff {
  id: number
  name: string
  dob: Day
  nat: string
  role: 'coach' | 'assistant' | 'gk' | 'fitness' | 'scout' | 'physio'
  job: string | null
  rep: number
  /** 1–20 skills. */
  tactics: number
  motivation: number
  youth: number
  judging: number
  /** -1 (domestic-leaning) … +1 (abroad-leaning) selection bias. */
  abroadBias: number
  /** Preferred formation key and mentality. */
  formation: string
  mentality: number
  wage: number
  contractEnd: Day
  real: boolean
}

/** "c:<clubId>" or "n:<CODE>:<level>". */
export type TeamRef = string
export const clubRef = (id: number): TeamRef => `c:${id}`
export const natRef = (code: string, level: Level = 'senior'): TeamRef => `n:${code}:${level}`
export const parseRef = (r: TeamRef) => {
  const p = r.split(':')
  return p[0] === 'c' ? { kind: 'club' as const, clubId: +p[1] } : { kind: 'nat' as const, code: p[1], level: p[2] as Level }
}

export interface Fixture {
  id: number
  day: Day
  compId: number
  /** Index into comp.stages. */
  stage: number
  group?: number
  round?: number
  /** Knockout tie slot. */
  slot?: number
  home: TeamRef
  away: TeamRef
  neutral?: boolean
  played: boolean
  hg: number
  ag: number
  /** Penalty shootout score if decided on penalties. */
  pens?: [number, number]
  et?: boolean
  /** Goal scorers for display: [playerId|-1, minute, side 0/1, name?]. */
  scorers?: [number, number, number, string?][]
  /** Id of a stored full match report, if one was kept. */
  report?: number
}
