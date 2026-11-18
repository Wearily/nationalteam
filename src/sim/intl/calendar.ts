import { nextDow, toDay, ymd, type Day } from '../core/date'
import type { Rng } from '../core/rng'
import { addFixture, makeGroupFixtures } from '../comps/engine'
import type { Comp } from '../comps/types'
import type { World } from '../world/state'
import { LEVEL_NAME, natRef, type Level } from '../world/types'

/** FIFA international windows from 2026 on: March, June, a long September–October window, November. */
export function windows(year: number): { start: Day; days: number[]; name: string }[] {
  const thu = (m: number, d: number) => nextDow(toDay(year, m, d), 4)
  const mar = thu(3, 22)
  const jun = thu(6, 3)
  const sep = thu(9, 23)
  const nov = thu(11, 11)
  return [
    { start: mar, days: [mar, mar + 4], name: 'March' },
    { start: jun, days: [jun, jun + 4], name: 'June' },
    { start: sep, days: [sep, sep + 4, sep + 8, sep + 12], name: 'Sep–Oct' },
    { start: nov, days: [nov, nov + 4], name: 'November' },
  ]
}

function friendlyComp(w: World, level: Level, year: number): Comp {
  const key = `fr:${level}:${year}`
  let c = w.comps.find((x) => x.key === key)
  if (!c) {
    c = {
      id: w.comps.length, key, name: `International friendlies ${year}`, short: 'Friendly', scope: 'nat', level, season: year, weight: level === 'senior' ? 10 : 0,
      stages: [{ type: 'groups', name: 'Friendlies', groups: [], legs: 1, days: [], neutral: false, tiebreak: 'gd', advance: 0, bestNext: 0, fixturesMade: true }],
      cur: 0, done: false, squadSize: level === 'senior' ? 26 : 23, subs: 6, friendly: true,
    }
    w.comps.push(c)
  }
  return c
}

export function pickOpponent(w: World, rng: Rng, level: Level, exclude: Set<string>): string {
  const iran = w.nations.IRN
  const all = Object.values(w.nations).filter((n) => n.code !== 'IRN' && !exclude.has(n.code))
  const pool = level === 'senior' ? all.filter((n) => Math.abs(n.level - iran.level) < 11) : all.filter((n) => n.confed === 'AFC' || rng.chance(0.15)).filter((n) => Math.abs(n.level - iran.level) < 16)
  return rng.weighted(pool.length ? pool : all, (n) => (n.confed === 'AFC' ? 1.2 : n.confed === 'UEFA' ? 1 : 0.8) * (n.region === 'CAFA' ? 1.6 : 1)).code
}

export function addFriendly(w: World, level: Level, day: Day, opp: string, home: boolean) {
  const comp = friendlyComp(w, level, ymd(day).y)
  const iran = natRef('IRN', level)
  const o = natRef(opp, level)
  return addFixture(w, { day, compId: comp.id, stage: 0, home: home ? iran : o, away: home ? o : iran, neutral: !home && Math.abs(day % 3) === 0 })
}

/** Fill a year's international windows with friendlies for every Iran team that has nothing booked. */
export function scheduleYear(w: World, rng: Rng, year: number, from: Day) {
  const busy = (level: Level, day: Day) => w.fixtures.some((f) => !f.played && Math.abs(f.day - day) <= 2 && (f.home === natRef('IRN', level) || f.away === natRef('IRN', level)))
  const perLevel: Record<Level, number[]> = { senior: [0, 1, 2, 3], u23: [0, 1, 2, 3], u21: [0, 2], u20: [0, 1, 2, 3], u19: [1, 3], u17: [0, 1, 2, 3], u16: [1, 2], u15: [0, 2] }
  const ws = windows(year)
  for (const level of Object.keys(perLevel) as Level[]) {
    const used = new Set<string>()
    for (const wi of perLevel[level]) {
      const win = ws[wi]
      const days = level === 'senior' ? win.days : win.days.slice(0, 2)
      days.forEach((d, k) => {
        const day = d + (level === 'senior' ? 0 : 1)
        if (day <= from || busy(level, day)) return
        const opp = pickOpponent(w, rng, level, used)
        used.add(opp)
        addFriendly(w, level, day, opp, k % 2 === 0)
      })
    }
  }
}

/** The real draw for the AFC Asian Cup Saudi Arabia 2027 (held 9 May 2026). */
export const ASIAN_CUP_2027: string[][] = [
  ['KSA', 'KUW', 'OMA', 'PLE'], ['UZB', 'BHR', 'PRK', 'JOR'], ['IRN', 'SYR', 'KGZ', 'CHN'],
  ['AUS', 'TJK', 'IRQ', 'SIN'], ['KOR', 'UAE', 'VIE', 'YEM'], ['JPN', 'QAT', 'THA', 'IDN'],
]

/**
 * AFC Asian Cup: 24 teams, six groups of four; top two plus the four best third-placed sides reach the round of 16.
 * The 2027 edition runs 23 December 2027 – 21 January 2028 with the real draw (match dates inside that span are
 * not published yet, so the day-by-day schedule is assumed). From 2032 the tournament is played in even years;
 * hosts and entrants for those editions are generated from the rankings.
 */
export function setupAsianCup(w: World, rng: Rng, year: number, d0: Day, host: string, fixed?: string[][]): Comp {
  let groups: string[][]
  // the dataset may use ISO-style codes for a few nations (e.g. Singapore)
  const alias: Record<string, string> = { SIN: 'SGP' }
  const fx = fixed?.map((g) => g.map((c) => (w.nations[c] ? c : alias[c] ?? c)))
  if (fx && fx.every((g) => g.every((c) => w.nations[c]))) groups = fx
  else {
    const afc = Object.values(w.nations).filter((n) => n.confed === 'AFC').sort((a, b) => b.points - a.points)
    const entrants = [host, ...afc.filter((n) => n.code !== host).slice(0, 23).map((n) => n.code)]
    if (!entrants.includes('IRN')) entrants[entrants.length - 1] = 'IRN'
    const ranked = [host, ...entrants.filter((c) => c !== host).sort((a, b) => w.nations[b].points - w.nations[a].points)]
    groups = [[], [], [], [], [], []]
    for (let pot = 0; pot < 4; pot++) {
      const teams = ranked.slice(pot * 6, pot * 6 + 6)
      if (pot === 0) { groups[0].push(teams[0]); rng.shuffle(teams.slice(1)).forEach((t, i) => groups[i + 1].push(t)) } else rng.shuffle(teams).forEach((t, i) => groups[i].push(t))
    }
  }
  const comp: Comp = {
    id: w.comps.length, key: `afc-asian-cup:${year}`, name: `AFC Asian Cup ${year}`, short: 'Asian Cup', scope: 'nat', level: 'senior', season: year, weight: 35, bracket: 'afc24', host,
    stages: [
      { type: 'groups', name: 'Group stage', groups: groups.map((g) => g.map((c) => natRef(c))), legs: 1, days: [d0, d0 + 5, d0 + 10], offsets: [0, 0, 1, 1, 2, 2], neutral: true, tiebreak: 'h2h', advance: 2, bestNext: 4, fixturesMade: false },
      { type: 'ko', name: 'Round of 16', legs: 1, days: [d0 + 15, d0 + 16, d0 + 17, d0 + 18], neutral: true, teams: [], fixturesMade: false },
      { type: 'ko', name: 'Quarter-finals', legs: 1, days: [d0 + 21, d0 + 22], neutral: true, teams: [], fixturesMade: false },
      { type: 'ko', name: 'Semi-finals', legs: 1, days: [d0 + 25, d0 + 26], neutral: true, teams: [], fixturesMade: false },
      { type: 'ko', name: 'Final', legs: 1, days: [d0 + 29], neutral: true, teams: [], fixturesMade: false },
    ],
    cur: 0, done: false, squadSize: 26, subs: 5, assumed: !fixed,
  }
  w.comps.push(comp)
  makeGroupFixtures(w, comp, 0)
  return comp
}

/** Group unplayed Iran fixtures into camps (call-up periods). */
export function rebuildCamps(w: World) {
  const levels = Object.keys(w.teams) as Level[]
  for (const level of levels) {
    const ref = natRef('IRN', level)
    const fx = w.fixtures.filter((f) => !f.played && f.day >= w.day && (f.home === ref || f.away === ref)).sort((a, b) => a.day - b.day)
    for (const f of fx) {
      const comp = w.comps[f.compId]
      const tournament = !comp.friendly
      const hit = w.camps.find((c) => c.level === level && !c.done && f.day >= c.from && f.day <= c.to + (tournament && c.compId === comp.id ? 40 : 6))
      if (hit) { hit.to = Math.max(hit.to, f.day); if (tournament && hit.compId !== comp.id && !hit.announced) { hit.compId = comp.id; hit.size = comp.squadSize; hit.label = `${comp.name} squad` } continue }
      const lead = tournament ? 12 : 4
      w.camps.push({
        id: w.camps.length, level, from: Math.max(w.day, f.day - lead), first: f.day, to: f.day, size: comp.squadSize || 23,
        label: tournament ? `${comp.name} squad` : `${LEVEL_NAME[level]} camp`, compId: comp.id, announced: false, done: false,
      })
    }
  }
}
