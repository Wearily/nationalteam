import { nextDow, toDay, ymd, type Day } from '../core/date'
import { clamp, type Rng } from '../core/rng'
import { A, posLine } from '../ratings/attributes'
import { dynOvr } from '../ratings/dynamic'
import { makeGroupFixtures } from '../comps/engine'
import type { Comp } from '../comps/types'
import type { Index, World } from '../world/state'
import { clubRef, parseRef, type Fixture, type League, type Player } from '../world/types'

export const formAvg = (p: Player) => (p.form.length ? p.form.reduce((a, b) => a + b, 0) / p.form.length : 6.6)

/** Create a league season: double round robin spread over roughly nine months. */
export function startLeagueSeason(w: World, lg: League, year: number): Comp | null {
  const n = lg.clubIds.length
  if (lg.virtual || n < 4) return null
  const rounds = 2 * (n % 2 ? n : n - 1)
  const start = nextDow(toDay(year, lg.startMonth, 8), 6)
  const gap = clamp(Math.floor(275 / rounds), 4, 9)
  const days: Day[] = []
  for (let r = 0; r < rounds; r++) days.push(start + r * gap)
  const comp: Comp = {
    id: w.comps.length, key: `lg:${lg.rid}:${year}`, name: lg.name, short: lg.name, scope: 'club', level: 'senior', season: year, weight: 0,
    stages: [{ type: 'groups', name: 'League', groups: [lg.clubIds.map(clubRef)], legs: 2, days, neutral: false, tiebreak: 'gd', advance: 0, bestNext: 0, fixturesMade: false }],
    cur: 0, done: false, squadSize: 0, subs: 5,
  }
  w.comps.push(comp)
  makeGroupFixtures(w, comp, 0)
  return comp
}

const GOAL_W: Record<string, number> = { ST: 4.2, RW: 2.3, LW: 2.3, AM: 2.1, CM: 1, DM: 0.5, RB: 0.35, LB: 0.35, CB: 0.45, GK: 0 }
const AST_W: Record<string, number> = { ST: 1.6, RW: 2.6, LW: 2.6, AM: 3, CM: 1.9, DM: 0.9, RB: 1.3, LB: 1.3, CB: 0.3, GK: 0.05 }

interface Side { clubId: number; str: number; starters: Player[]; subs: Player[]; anon: number }

function lineupFor(w: World, idx: Index, clubId: number, rng: Rng, away: Set<number>): Side {
  const club = w.clubs[clubId]
  const all = (idx.clubPlayers.get(clubId) ?? []).filter((p) => !p.injury && !away.has(p.id) && !p.retired)
  const score = (p: Player) => dynOvr(p).ovr + rng.normal(0, 2.2) + (p.cond < 70 ? -4 : 0)
  if (club.full) {
    const sorted = [...all].sort((a, b) => score(b) - score(a))
    const starters: Player[] = []
    const quota: Record<string, number> = { GK: 1, DEF: 4, MID: 3, ATT: 3 }
    for (const p of sorted) {
      const l = posLine(p.pos[0])
      if (quota[l] > 0) { quota[l]--; starters.push(p) }
      if (starters.length === 11) break
    }
    const rest = sorted.filter((p) => !starters.includes(p) && p.pos[0] !== 'GK')
    for (const p of rest) if (starters.length < 11) starters.push(p)
    const subs = rest.filter((p) => !starters.includes(p)).slice(0, 3)
    const str = starters.length ? starters.reduce((a, p) => a + p.ovr, 0) / starters.length - (11 - starters.length) * 1.5 : club.str
    return { clubId, str: str * 0.6 + club.str * 0.4, starters, subs, anon: Math.max(0, 11 - starters.length) }
  }
  const starters: Player[] = []
  const subs: Player[] = []
  for (const p of all) {
    const pStart = 1 / (1 + Math.exp(-(p.ovr + dynOvr(p).form - club.str + 2.5) / 2.4))
    const r = rng.next()
    if (r < pStart * (p.sharp < 40 ? 0.8 : 1)) starters.push(p)
    else if (r < pStart + (1 - pStart) * 0.4) subs.push(p)
  }
  return { clubId, str: club.str, starters: starters.slice(0, 11), subs: subs.slice(0, 3), anon: Math.max(0, 11 - starters.length) }
}

function credit(side: Side, goals: number, conceded: number, rng: Rng, f: Fixture, sideIdx: 0 | 1, day: Day) {
  const diff = goals - conceded
  const involved: [Player, number][] = [...side.starters.map((p) => [p, 90] as [Player, number]), ...side.subs.map((p) => [p, rng.int(12, 35)] as [Player, number])]
  const rating = new Map<number, number>()
  const ga = new Map<number, [number, number]>()
  for (const [p, mins] of involved) {
    ga.set(p.id, [0, 0])
    const base = 6.45 + diff * 0.17 + (p.ovr - side.str) * 0.035 + rng.normal(0, 0.45 + (20 - p.traits.consistency) * 0.022)
    rating.set(p.id, mins < 45 ? 6.3 + (base - 6.3) * 0.6 : base)
    p.club.apps++
    if (mins === 90) p.club.starts++
    p.club.mins += mins
    p.sharp = Math.min(100, p.sharp + (mins / 90) * 9)
    p.cond = Math.max(40, p.cond - (mins / 90) * 22)
    if (conceded === 0 && mins === 90 && (posLine(p.pos[0]) === 'DEF' || p.pos[0] === 'GK')) { p.club.cleanSheets++; rating.set(p.id, rating.get(p.id)! + 0.45) }
    if (rng.chance(0.11)) p.club.yellows++
    if (rng.chance(0.0045 * (0.5 + p.traits.injuryProne / 10) * (mins / 90))) {
      const sev = rng.next()
      const days = sev < 0.55 ? rng.int(5, 14) : sev < 0.88 ? rng.int(15, 45) : rng.int(60, 240)
      p.injury = { name: days > 120 ? 'Knee ligament injury' : days > 40 ? 'Hamstring tear' : days > 14 ? 'Muscle strain' : 'Knock', until: day + days }
    }
  }
  const anonW = side.anon * 1.35
  const wOf = (tab: Record<string, number>, attr: number) => ([p, mins]: [Player, number]) => tab[p.pos[0]] * (p.attrs[attr] / 62) * (mins / 90)
  for (let g = 0; g < goals; g++) {
    const tot = involved.reduce((a, x) => a + wOf(GOAL_W, A.finishing)(x), 0) + anonW
    let r = rng.next() * tot
    let scorer: Player | null = null
    for (const x of involved) { r -= wOf(GOAL_W, A.finishing)(x); if (r <= 0) { scorer = x[0]; break } }
    const min = rng.int(1, 90)
    if (scorer) {
      scorer.club.goals++
      ga.get(scorer.id)![0]++
      rating.set(scorer.id, rating.get(scorer.id)! + 0.95)
      ;(f.scorers ??= []).push([scorer.id, min, sideIdx])
    }
    if (rng.chance(0.72)) {
      const totA = involved.reduce((a, x) => a + (x[0] === scorer ? 0 : wOf(AST_W, A.passing)(x)), 0) + anonW * 1.3
      let ra = rng.next() * totA
      for (const x of involved) {
        if (x[0] === scorer) continue
        ra -= wOf(AST_W, A.passing)(x)
        if (ra <= 0) { x[0].club.assists++; ga.get(x[0].id)![1]++; rating.set(x[0].id, rating.get(x[0].id)! + 0.55); break }
      }
    }
  }
  let best: Player | null = null
  for (const [p] of involved) {
    const r = clamp(Math.round(rating.get(p.id)! * 10) / 10, 4, 10)
    p.club.ratingSum += r
    p.form.push(r)
    if (p.form.length > 8) p.form.shift()
    ;(p.recent ??= []).push(ga.get(p.id)!)
    if (p.recent.length > 6) p.recent.shift()
    if (!best || r > rating.get(best.id)!) best = p
  }
  return best
}

/** Fast result model for club matches. Tracked players get minutes, goals and a rating. */
export function simClubFixture(w: World, idx: Index, f: Fixture, rng: Rng, away: Set<number>) {
  const h = parseRef(f.home)
  const a = parseRef(f.away)
  if (h.kind !== 'club' || a.kind !== 'club') return
  const hs = lineupFor(w, idx, h.clubId, rng, away)
  const as = lineupFor(w, idx, a.clubId, rng, away)
  const d = hs.str - as.str
  f.hg = rng.poisson(1.36 * Math.exp(0.046 * d) * 1.1)
  f.ag = rng.poisson(1.36 * Math.exp(-0.046 * d) * 0.92)
  f.played = true
  credit(hs, f.hg, f.ag, rng, f, 0, f.day)
  credit(as, f.ag, f.hg, rng, f, 1, f.day)
  // players left out lose sharpness
  for (const side of [hs, as]) {
    const used = new Set([...side.starters, ...side.subs].map((p) => p.id))
    for (const p of idx.clubPlayers.get(side.clubId) ?? []) if (!used.has(p.id)) p.sharp = Math.max(20, p.sharp - 2.2)
  }
}

export const seasonLabel = (year: number, startMonth: number) => (startMonth <= 4 ? `${year}` : `${year}/${String((year + 1) % 100).padStart(2, '0')}`)
export const seasonYearFor = (day: Day, startMonth: number) => {
  const { y, m } = ymd(day)
  return m >= startMonth ? y : y - 1
}
