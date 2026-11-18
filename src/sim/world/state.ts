import type { Day } from '../core/date'
import type { Club, Fixture, League, Level, Nation, Player, Staff, TeamRef } from './types'
import type { Comp } from '../comps/types'
import type { Tactic } from '../match/tactics'
import type { MatchReport } from '../match/types'

export interface Message {
  id: number
  day: Day
  cat: 'news' | 'squad' | 'match' | 'scout' | 'board' | 'transfer' | 'injury' | 'staff'
  title: string
  body: string
  read: boolean
  /** Optional deep link: "player:12", "comp:3", "fixture:88". */
  link?: string
  important?: boolean
}

export interface IranTeam {
  level: Level
  control: 'manual' | 'auto'
  coachId: number | null
  tactic: Tactic
  /** Current call-up (player ids). Empty outside camps. */
  squad: number[]
  /** Depth-chart shortlist kept between windows. */
  shortlist: number[]
  /** The most recently announced squad, for "same again" call-ups. */
  lastSquad?: number[]
}

export interface Federation {
  budget: number
  income: number
  board: number
  fans: number
  media: number
  /** 0–100 "Europe pathway" culture. */
  pathway: number
  scoutBudget: number
  youthInvest: number
  ledger: { day: Day; label: string; amount: number }[]
}

export interface Pending {
  kind: 'squad' | 'match'
  level: Level
  fixtureId?: number
  compId?: number
  deadline: Day
  label: string
}

export interface Camp {
  id: number
  level: Level
  /** Day the squad must be named / players report. */
  from: Day
  first: Day
  to: Day
  size: number
  label: string
  compId: number
  announced: boolean
  done: boolean
}

export interface ScoutJob { staffId: number; scope: ScoutScope }
export type ScoutScope = 'iran-top' | 'iran-lower' | 'iran-youth' | 'gulf' | 'europe' | 'diaspora'
export const SCOUT_SCOPES: { key: ScoutScope; name: string; blurb: string }[] = [
  { key: 'iran-top', name: 'Persian Gulf Pro League', blurb: 'First-team players in the top flight.' },
  { key: 'iran-lower', name: 'Azadegan League', blurb: 'Second-tier squads, where late developers hide.' },
  { key: 'iran-youth', name: 'Iranian academies', blurb: 'Under-19 players at club academies.' },
  { key: 'gulf', name: 'Gulf and Asia', blurb: 'Iranians playing in the UAE, Qatar, Saudi Arabia, Iraq and beyond.' },
  { key: 'europe', name: 'Europe', blurb: 'Iranians at European clubs.' },
  { key: 'diaspora', name: 'Diaspora search', blurb: 'Foreign-born players who are eligible for Iran but undeclared.' },
]

export interface NewsItem {
  day: Day
  kind: 'transfer' | 'form' | 'result' | 'injury' | 'intl'
  text: string
  /** Player the story is about, for the portrait and link. */
  playerId?: number
  link?: string
}

export interface World {
  version: number
  seed: number
  rng: number
  day: Day
  startDay: Day
  season: number
  managerName: string
  players: Player[]
  clubs: Club[]
  leagues: League[]
  nations: Record<string, Nation>
  staff: Staff[]
  comps: Comp[]
  fixtures: Fixture[]
  teams: Record<Level, IranTeam>
  fed: Federation
  inbox: Message[]
  reports: MatchReport[]
  pending: Pending[]
  /** Cached squads for AI national teams: ref → player ids. */
  natSquads: Record<TeamRef, number[]>
  nextId: { fixture: number; msg: number; report: number }
  rankHist: [Day, number][]
  camps: Camp[]
  scouts: ScoutJob[]
  /** Result of each approach to a dual national: playerId → last day asked. */
  approaches: Record<number, Day>
  history: { year: number; comp: string; level: Level; result: string }[]
  /** Short football news feed shown on the overview. */
  news?: NewsItem[]
}

/** Runtime indexes rebuilt after load (not serialised). */
export interface Index {
  byDay: Map<Day, Fixture[]>
  clubPlayers: Map<number, Player[]>
  byNat: Map<string, Player[]>
}
export function buildIndex(w: World): Index {
  const byDay = new Map<Day, Fixture[]>()
  for (const f of w.fixtures) {
    if (f.played) continue
    let a = byDay.get(f.day)
    if (!a) byDay.set(f.day, (a = []))
    a.push(f)
  }
  const clubPlayers = new Map<number, Player[]>()
  const byNat = new Map<string, Player[]>()
  for (const p of w.players) {
    if (p.retired) continue
    if (p.clubId != null) {
      let a = clubPlayers.get(p.clubId)
      if (!a) clubPlayers.set(p.clubId, (a = []))
      a.push(p)
    }
    let b = byNat.get(p.nat[0])
    if (!b) byNat.set(p.nat[0], (b = []))
    b.push(p)
  }
  return { byDay, clubPlayers, byNat }
}
