import type { Day } from '../core/date'
import type { Level, TeamRef } from '../world/types'

export type Tiebreak = 'h2h' | 'gd'

export interface GroupStage {
  type: 'groups'
  name: string
  groups: TeamRef[][]
  legs: 1 | 2
  /** One entry per matchday. */
  days: Day[]
  neutral: boolean
  tiebreak: Tiebreak
  /** Teams per group that advance automatically. */
  advance: number
  /** Extra best-ranked teams finishing in position advance+1. */
  bestNext: number
  /** Per-group day offset added to every matchday. */
  offsets?: number[]
  fixturesMade: boolean
}
export interface KoStage {
  type: 'ko'
  name: string
  legs: 1 | 2
  days: Day[]
  neutral: boolean
  /** Filled when the previous stage finishes. Pairs are [0,1],[2,3]… */
  teams: TeamRef[]
  fixturesMade: boolean
  /** On the final stage: day of a third-place match between the beaten semi-finalists. */
  thirdPlace?: Day
}
export type Stage = GroupStage | KoStage

export interface Comp {
  id: number
  key: string
  name: string
  short: string
  scope: 'club' | 'nat'
  level: Level
  season: number
  /** FIFA ranking importance coefficient (5 friendly … 60 World Cup knockouts). 0 for clubs. */
  weight: number
  /** Round-of-16 template for 24-team formats, e.g. "afc24". */
  bracket?: 'afc24' | 'std'
  stages: Stage[]
  cur: number
  done: boolean
  winner?: TeamRef
  host?: string
  squadSize: number
  subs: number
  /** Friendly windows have no table. */
  friendly?: boolean
  /** Final placing notes for history. */
  placings?: Record<TeamRef, string>
  /** True when the format/entrants are assumed rather than confirmed. */
  assumed?: boolean
}

export interface Row {
  team: TeamRef
  p: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  pts: number
}
