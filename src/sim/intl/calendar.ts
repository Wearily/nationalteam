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
  return addFixture(w, { day, compId: comp.id, stage: 0, home: home ? iran : o, away: home ? o : iran })
}

const PER_LEVEL: Record<Level, number[]> = { senior: [0, 1, 2, 3], u23: [0, 1, 2, 3], u21: [0, 2], u20: [0, 1, 2, 3], u19: [1, 3], u17: [0, 1, 2, 3], u16: [1, 2], u15: [0, 2] }
const iranBusy = (w: World, level: Level, day: Day) => w.fixtures.some((f) => !f.played && Math.abs(f.day - day) <= 2 && (f.home === natRef('IRN', level) || f.away === natRef('IRN', level)))

/** Match dates available to a team inside the year's international windows. */
export function slotDays(level: Level, year: number): { day: Day; window: string }[] {
  const ws = windows(year)
  const out: { day: Day; window: string }[] = []
  for (const wi of PER_LEVEL[level]) {
    const win = ws[wi]
    for (const d of level === 'senior' ? win.days : win.days.slice(0, 2)) out.push({ day: d + (level === 'senior' ? 0 : 1), window: win.name })
  }
  return out
}
/** Window dates with nothing booked yet, far enough ahead to arrange a match. */
export function openSlots(w: World, level: Level): { day: Day; window: string }[] {
  const { y, m } = ymd(w.day)
  // only years whose qualifiers and tournaments are already on the calendar: next year's are drawn on 1 December
  const through = w.plannedThrough ?? (m === 12 ? y + 1 : y)
  const days = through > y ? [...slotDays(level, y), ...slotDays(level, y + 1)] : slotDays(level, y)
  return days.filter((s) => s.day - w.day >= 10 && s.day - w.day <= 400 && !iranBusy(w, level, s.day))
}

/**
 * Book friendlies in free window dates for teams run by their coach.
 * Teams the user manages are left alone: the user arranges those from the Calendar.
 */
export function scheduleYear(w: World, rng: Rng, year: number, from: Day) {
  for (const level of Object.keys(PER_LEVEL) as Level[]) {
    if (w.teams[level]?.control === 'manual') continue
    const used = new Set<string>()
    slotDays(level, year).forEach((s, k) => {
      if (s.day <= from + 9 || iranBusy(w, level, s.day)) return
      const opp = pickOpponent(w, rng, level, used)
      used.add(opp)
      addFriendly(w, level, s.day, opp, k % 2 === 0)
    })
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
    // a finals tournament needs its own squad announcement: it never rides on a squad already named for a
    // warm-up friendly. Cut such a camp back to its friendlies so the tournament gets a fresh selection.
    const hosted = (c: Comp) => !c.friendly && c.stages[0].neutral
    for (const c of w.camps) {
      if (c.level !== level || c.done || !c.announced || !w.comps[c.compId]?.friendly) continue
      const tf = fx.filter((f) => hosted(w.comps[f.compId]) && f.day >= c.from && f.day <= c.to)
      if (!tf.length) continue
      const before = w.fixtures.filter((f) => (f.home === ref || f.away === ref) && w.comps[f.compId].friendly && f.day >= c.from && f.day < tf[0].day)
      c.to = before.length ? Math.max(...before.map((f) => f.day)) : Math.min(c.first, tf[0].day - 1)
    }
    // likewise a tournament camp does not swallow the warm-up friendlies before its first match: they get
    // their own camp, and the finals squad is named (or named again) once they are out of the way
    for (const c of w.camps) {
      const comp = w.comps[c.compId]
      if (c.level !== level || c.done || !comp || !hosted(comp)) continue
      if (w.fixtures.some((f) => f.compId === comp.id && f.played && (f.home === ref || f.away === ref))) continue
      const warm = w.fixtures.filter((f) => (f.home === ref || f.away === ref) && w.comps[f.compId].friendly && f.day >= c.from && f.day < c.first)
      if (!warm.length) continue
      c.from = Math.max(...warm.map((f) => f.day)) + 1
      c.announced = false
    }
    for (const f of fx) {
      const comp = w.comps[f.compId]
      const tournament = !comp.friendly
      const hit = w.camps.find((c) => c.level === level && !c.done && f.day >= c.from && f.day <= c.to + (tournament && c.compId === comp.id ? 40 : 6) && !(hosted(comp) && c.compId !== comp.id) && !(comp.friendly && hosted(w.comps[c.compId]) && f.day < c.first))
      if (hit) { hit.to = Math.max(hit.to, f.day); if (tournament && hit.compId !== comp.id && !hit.announced) { hit.compId = comp.id; hit.size = comp.squadSize; hit.label = `${comp.name} squad` } continue }
      const lead = tournament ? 12 : 4
      w.camps.push({
        id: w.camps.length, level, from: Math.max(w.day, f.day - lead, ...w.camps.filter((c) => c.level === level && !c.done && c.to < f.day).map((c) => c.to + 1)), first: f.day, to: f.day, size: comp.squadSize || 23,
        label: tournament ? `${comp.name} squad` : `${LEVEL_NAME[level]} camp`, compId: comp.id, announced: false, done: false,
      })
    }
  }
}

const pick = (w: World, confed: string, n: number, rng: Rng, exclude: Set<string>) =>
  Object.values(w.nations).filter((x) => x.confed === confed && !exclude.has(x.code)).map((x) => ({ c: x.code, v: x.points + rng.normal(0, 45) })).sort((a, b) => b.v - a.v).slice(0, n).map((x) => x.c)

/**
 * AFC qualifying for a World Cup, following the 2026 structure (the 2030 format is not published):
 * round 2 — nine groups of four, top two advance; round 3 — three groups of six, top two qualify,
 * third and fourth go to round 4 — two groups of three, winners qualify. Eight AFC places.
 */
export function setupWCQ(w: World, rng: Rng, wcYear: number): Comp {
  const afc = Object.values(w.nations).filter((n) => n.confed === 'AFC').sort((a, b) => b.points - a.points).slice(0, 36).map((n) => n.code)
  if (!afc.includes('IRN')) afc[35] = 'IRN'
  afc.sort((a, b) => w.nations[b].points - w.nations[a].points)
  const groups: string[][] = Array.from({ length: 9 }, () => [])
  for (let pot = 0; pot < 4; pot++) rng.shuffle(afc.slice(pot * 9, pot * 9 + 9)).forEach((t, i) => groups[i].push(natRef(t)))
  const w1 = windows(wcYear - 2)
  const w2 = windows(wcYear - 1)
  const mar = windows(wcYear)[0].start
  const comp: Comp = {
    id: w.comps.length, key: `wcq-afc:${wcYear}`, name: `World Cup ${wcYear} qualifying (AFC)`, short: 'WC qualifier', scope: 'nat', level: 'senior', season: wcYear, weight: 25,
    stages: [
      { type: 'groups', name: 'Second round', groups, legs: 2, days: [...w1[0].days, ...w1[1].days, ...w1[2].days.slice(0, 2)], neutral: false, tiebreak: 'gd', advance: 2, bestNext: 0, fixturesMade: false },
      { type: 'groups', name: 'Third round', groups: [[], [], []], legs: 2, days: [...w2[0].days, ...w2[1].days, ...w2[2].days, ...w2[3].days], neutral: false, tiebreak: 'gd', direct: 2, advance: 2, bestNext: 0, fixturesMade: false },
      { type: 'groups', name: 'Fourth round', groups: [[], []], legs: 1, days: [mar, mar + 3, mar + 6], neutral: true, tiebreak: 'gd', direct: 1, advance: 0, bestNext: 0, fixturesMade: false },
    ],
    cur: 0, done: false, squadSize: 26, subs: 5, assumed: true,
  }
  w.comps.push(comp)
  makeGroupFixtures(w, comp, 0)
  return comp
}

/**
 * FIFA World Cup, 48 teams: twelve groups of four, top two and the eight best third-placed teams
 * reach the round of 32. AFC entrants come from the simulated qualifiers; other confederations
 * are filled by ranking (their qualifiers are not simulated). Draw pots are by ranking.
 */
export function setupWorldCup(w: World, rng: Rng, year: number, hosts: string[]): Comp {
  const q = w.comps.find((c) => c.key === `wcq-afc:${year}`)
  const afc = q?.placings ? Object.entries(q.placings).filter(([, v]) => v === 'Qualified').map(([k]) => k.split(':')[1]) : []
  const ex = new Set<string>([...hosts.filter((h) => w.nations[h]), ...afc])
  const field = [...ex]
  const quota: [string, number][] = [['UEFA', 16], ['CAF', 10], ['CONMEBOL', 6], ['CONCACAF', 6], ['OFC', 1], ['AFC', 8]]
  for (const [conf, n] of quota) {
    const have = field.filter((c) => w.nations[c].confed === conf).length
    for (const c of pick(w, conf, Math.max(0, n - have), rng, ex)) { field.push(c); ex.add(c) }
  }
  const rest = Object.values(w.nations).filter((n) => !ex.has(n.code)).sort((a, b) => b.points - a.points)
  while (field.length < 48 && rest.length) field.push(rest.shift()!.code)
  const hs = new Set(hosts)
  const ranked = field.slice(0, 48).sort((a, b) => Number(hs.has(b)) - Number(hs.has(a)) || w.nations[b].points - w.nations[a].points)
  const groups: string[][] = Array.from({ length: 12 }, () => [])
  for (let pot = 0; pot < 4; pot++) rng.shuffle(ranked.slice(pot * 12, pot * 12 + 12)).forEach((t, i) => groups[i].push(natRef(t)))
  const d0 = toDay(year, 6, 13)
  const ko = (name: string, days: number[], third?: number) => ({ type: 'ko' as const, name, legs: 1 as const, days: days.map((d) => d0 + d), neutral: true, teams: [], fixturesMade: false, thirdPlace: third != null ? d0 + third : undefined })
  const comp: Comp = {
    id: w.comps.length, key: `world-cup:${year}`, name: `FIFA World Cup ${year}`, short: 'World Cup', scope: 'nat', level: 'senior', season: year, weight: 50, bracket: 'std', host: hosts[0],
    stages: [
      { type: 'groups', name: 'Group stage', groups, legs: 1, days: [d0, d0 + 6, d0 + 12], offsets: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5], neutral: true, tiebreak: 'h2h', advance: 2, bestNext: 8, fixturesMade: false },
      ko('Round of 32', [18, 19, 20, 21, 22, 23]), ko('Round of 16', [25, 26, 27, 28]), ko('Quarter-finals', [31, 32]), ko('Semi-finals', [35, 36]), ko('Final', [40], 39),
    ],
    cur: 0, done: false, squadSize: 26, subs: 5, assumed: true,
  }
  w.comps.push(comp)
  makeGroupFixtures(w, comp, 0)
  return comp
}

/** AFC youth championship: sixteen teams, four groups, quarter-finals onward. Entrants are assumed from rankings. */
export function setupYouthCup(w: World, rng: Rng, level: Level, year: number, d0: Day): Comp {
  const afc = Object.values(w.nations).filter((n) => n.confed === 'AFC' && n.code !== 'IRN').map((n) => ({ c: n.code, v: n.points + rng.normal(0, 60) })).sort((a, b) => b.v - a.v).slice(0, 15).map((x) => x.c)
  const ranked = ['IRN', ...afc].sort((a, b) => w.nations[b].points - w.nations[a].points)
  const groups: string[][] = [[], [], [], []]
  for (let pot = 0; pot < 4; pot++) rng.shuffle(ranked.slice(pot * 4, pot * 4 + 4)).forEach((t, i) => groups[i].push(natRef(t, level)))
  const comp: Comp = {
    id: w.comps.length, key: `afc-${level}:${year}`, name: `AFC ${LEVEL_NAME[level]} Asian Cup ${year}`, short: `${LEVEL_NAME[level]} Asian Cup`, scope: 'nat', level, season: year, weight: 0,
    stages: [
      { type: 'groups', name: 'Group stage', groups, legs: 1, days: [d0, d0 + 3, d0 + 6], offsets: [0, 0, 1, 1], neutral: true, tiebreak: 'h2h', advance: 2, bestNext: 0, fixturesMade: false },
      { type: 'ko', name: 'Quarter-finals', legs: 1, days: [d0 + 10, d0 + 11], neutral: true, teams: [], fixturesMade: false },
      { type: 'ko', name: 'Semi-finals', legs: 1, days: [d0 + 14], neutral: true, teams: [], fixturesMade: false },
      { type: 'ko', name: 'Final', legs: 1, days: [d0 + 17], neutral: true, teams: [], fixturesMade: false },
    ],
    cur: 0, done: false, squadSize: 23, subs: 5, assumed: true,
  }
  w.comps.push(comp)
  makeGroupFixtures(w, comp, 0)
  return comp
}

/** Fill a world field: the given entrants first, then each confederation up to its quota by ranking. */
function worldField(w: World, rng: Rng, size: number, fixed: string[], quota: [string, number][]): string[] {
  const ex = new Set<string>(fixed.filter((c) => w.nations[c]))
  const field = [...ex]
  for (const [conf, n] of quota) {
    const have = field.filter((c) => w.nations[c].confed === conf).length
    for (const c of pick(w, conf, Math.max(0, n - have), rng, ex)) { field.push(c); ex.add(c) }
  }
  // Iran only ever enter through qualifying, never as a make-weight
  const rest = Object.values(w.nations).filter((n) => !ex.has(n.code) && n.code !== 'IRN').sort((a, b) => b.points - a.points)
  while (field.length < size && rest.length) field.push(rest.shift()!.code)
  return field.slice(0, size)
}
/** Draw into groups from ranking pots, hosts seeded first. */
function drawGroups(w: World, rng: Rng, field: string[], G: number, level: Level, hosts: string[] = []): string[][] {
  const hs = new Set(hosts)
  const ranked = [...field].sort((a, b) => Number(hs.has(b)) - Number(hs.has(a)) || w.nations[b].points - w.nations[a].points)
  const groups: string[][] = Array.from({ length: G }, () => [])
  for (let pot = 0; pot * G < ranked.length; pot++) rng.shuffle(ranked.slice(pot * G, pot * G + G)).forEach((t, i) => groups[i].push(natRef(t, level)))
  return groups
}
const koStage = (d0: Day, name: string, days: number[], third?: number) => ({ type: 'ko' as const, name, legs: 1 as const, days: days.map((d) => d0 + d), neutral: true, teams: [], fixturesMade: false, thirdPlace: third != null ? d0 + third : undefined })
const randomHost = (w: World, rng: Rng, not: string) => rng.pick(Object.values(w.nations).filter((n) => n.confed !== not).sort((a, b) => b.points - a.points).slice(0, 40)).code

/**
 * FIFA U-17 World Cup (48 teams, every November) and U-20 World Cup (24 teams, odd years). AFC entrants are
 * the teams that qualified through that year's Asian age-group cup; the rest of the field is filled by ranking.
 */
export function setupYouthWorldCup(w: World, rng: Rng, level: 'u17' | 'u20', year: number, afc: string[]): Comp {
  const u17 = level === 'u17'
  const host = u17 ? 'QAT' : randomHost(w, rng, 'AFC')
  const field = worldField(w, rng, u17 ? 48 : 24, [host, ...afc], u17
    ? [['AFC', afc.length + (afc.includes('QAT') ? 0 : 1)], ['CAF', 10], ['CONCACAF', 8], ['CONMEBOL', 7], ['OFC', 3], ['UEFA', 11]]
    : [['AFC', afc.length], ['CAF', 4], ['CONCACAF', 4], ['CONMEBOL', 4], ['OFC', 2], ['UEFA', 5]])
  const d0 = u17 ? toDay(year, 11, 5) : toDay(year, 9, 27)
  const comp: Comp = {
    id: w.comps.length, key: `fifa-${level}:${year}`, name: `FIFA ${LEVEL_NAME[level]} World Cup ${year}`, short: `${LEVEL_NAME[level]} World Cup`, scope: 'nat', level, season: year, weight: 0, host,
    bracket: u17 ? 'std' : 'afc24',
    stages: u17
      ? [{ type: 'groups', name: 'Group stage', groups: drawGroups(w, rng, field, 12, level, [host]), legs: 1, days: [d0, d0 + 3, d0 + 6], offsets: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3], neutral: true, tiebreak: 'h2h', advance: 2, bestNext: 8, fixturesMade: false },
          koStage(d0, 'Round of 32', [11, 12, 13]), koStage(d0, 'Round of 16', [15, 16]), koStage(d0, 'Quarter-finals', [19, 20]), koStage(d0, 'Semi-finals', [23]), koStage(d0, 'Final', [27], 26)]
      : [{ type: 'groups', name: 'Group stage', groups: drawGroups(w, rng, field, 6, level, [host]), legs: 1, days: [d0, d0 + 3, d0 + 6], offsets: [0, 0, 1, 1, 2, 2], neutral: true, tiebreak: 'h2h', advance: 2, bestNext: 4, fixturesMade: false },
          koStage(d0, 'Round of 16', [10, 11, 12]), koStage(d0, 'Quarter-finals', [14, 15]), koStage(d0, 'Semi-finals', [18]), koStage(d0, 'Final', [22], 21)],
    cur: 0, done: false, squadSize: 21, subs: 5, assumed: true,
  }
  w.comps.push(comp)
  makeGroupFixtures(w, comp, 0)
  return comp
}

const OLYMPIC_HOSTS: Record<number, string> = { 2028: 'USA', 2032: 'AUS' }
/** Men's Olympic football: under-23 sides with three over-age players, twelve teams, the two Asian places from the U23 Asian Cup. */
export function setupOlympics(w: World, rng: Rng, year: number, afc: string[]): Comp {
  const host = OLYMPIC_HOSTS[year] ?? randomHost(w, rng, 'OFC')
  const field = worldField(w, rng, 12, [host, ...afc], [['AFC', afc.length + (w.nations[host]?.confed === 'AFC' && !afc.includes(host) ? 1 : 0)], ['UEFA', 3], ['CAF', 2], ['CONMEBOL', 2], ['CONCACAF', 1 + (w.nations[host]?.confed === 'CONCACAF' ? 1 : 0)], ['OFC', 1]])
  const d0 = toDay(year, 7, 24)
  const comp: Comp = {
    id: w.comps.length, key: `olympics:${year}`, name: `Olympic Games ${year}`, short: 'Olympics', scope: 'nat', level: 'u23', season: year, weight: 0, host, bracket: 'std', overage: 3,
    stages: [
      { type: 'groups', name: 'Group stage', groups: drawGroups(w, rng, field, 3, 'u23', [host]), legs: 1, days: [d0, d0 + 3, d0 + 6], offsets: [0, 0, 1], neutral: true, tiebreak: 'h2h', advance: 2, bestNext: 2, fixturesMade: false },
      koStage(d0, 'Quarter-finals', [9, 10]), koStage(d0, 'Semi-finals', [13]), koStage(d0, 'Gold medal match', [17], 16),
    ],
    cur: 0, done: false, squadSize: 18, subs: 5, assumed: true,
  }
  w.comps.push(comp)
  makeGroupFixtures(w, comp, 0)
  return comp
}

const ASIAD_HOSTS: Record<number, string> = { 2030: 'QAT', 2034: 'KSA' }
/** Asian Games men's football: under-23 sides with three over-age players, 24 Asian teams, entered without qualifying. */
export function setupAsianGames(w: World, rng: Rng, year: number): Comp {
  const host = w.nations[ASIAD_HOSTS[year]] ? ASIAD_HOSTS[year] : 'JPN'
  const field = worldField(w, rng, 24, ['IRN', host], [['AFC', 24]])
  const d0 = toDay(year, 9, 14)
  const comp: Comp = {
    id: w.comps.length, key: `asian-games:${year}`, name: `Asian Games ${year}`, short: 'Asian Games', scope: 'nat', level: 'u23', season: year, weight: 0, host, bracket: 'afc24', overage: 3,
    stages: [
      { type: 'groups', name: 'Group stage', groups: drawGroups(w, rng, field, 6, 'u23', [host]), legs: 1, days: [d0, d0 + 3, d0 + 6], offsets: [0, 0, 0, 1, 1, 1], neutral: true, tiebreak: 'h2h', advance: 2, bestNext: 4, fixturesMade: false },
      koStage(d0, 'Round of 16', [10, 11]), koStage(d0, 'Quarter-finals', [14]), koStage(d0, 'Semi-finals', [17]), koStage(d0, 'Gold medal match', [21], 20),
    ],
    cur: 0, done: false, squadSize: 22, subs: 5, assumed: true,
  }
  w.comps.push(comp)
  makeGroupFixtures(w, comp, 0)
  return comp
}

/** Everything that should be created for the coming calendar year (called each 1 December and at the start). */
export function planYear(w: World, rng: Rng, year: number, from: Day) {
  const has = (key: string) => w.comps.some((c) => c.key === key)
  if (year >= 2032 && (year - 2032) % 4 === 0 && !has(`afc-asian-cup:${year}`)) {
    const hosts = Object.values(w.nations).filter((n) => n.confed === 'AFC' && n.code !== 'IRN').sort((a, b) => b.points - a.points).slice(0, 12)
    setupAsianCup(w, rng, year, toDay(year, 1, 8), rng.pick(hosts).code)
  }
  // World Cup qualifying starts two years before each World Cup (2030, 2034, …)
  if ((year + 2 - 2030) % 4 === 0 && year + 2 >= 2030 && !has(`wcq-afc:${year + 2}`)) setupWCQ(w, rng, year + 2)
  if (year % 2 === 0 && !has(`afc-u23:${year}`) && toDay(year, 4, 14) > from) setupYouthCup(w, rng, 'u23', year, toDay(year, 4, 14))
  if (year % 2 === 1 && !has(`afc-u20:${year}`) && toDay(year, 2, 12) > from) setupYouthCup(w, rng, 'u20', year, toDay(year, 2, 12))
  if (!has(`afc-u17:${year}`) && toDay(year, 5, 5) > from) setupYouthCup(w, rng, 'u17', year, toDay(year, 5, 5))
  if (year >= 2030 && (year - 2030) % 4 === 0 && !has(`asian-games:${year}`)) setupAsianGames(w, rng, year)
  w.plannedThrough = Math.max(w.plannedThrough ?? 0, year)
  cancelClashingFriendlies(w)
  scheduleYear(w, rng, year, from)
  rebuildCamps(w)
}

/**
 * A team cannot play two matches in the same slot. Competitive fixtures always win: any unplayed Iran
 * friendly within two days of a competitive match for the same team is called off. Returns what was cancelled.
 */
export function cancelClashingFriendlies(w: World): { level: Level; day: Day; opp: string; versus: string }[] {
  const out: { level: Level; day: Day; opp: string; versus: string }[] = []
  const iran = (f: { home: string; away: string }) => (f.home.startsWith('n:IRN:') ? f.home : f.away.startsWith('n:IRN:') ? f.away : null)
  const comp = w.fixtures.filter((f) => !f.played && iran(f) && !w.comps[f.compId].friendly)
  if (!comp.length) return out
  w.fixtures = w.fixtures.filter((f) => {
    const ref = iran(f)
    if (f.played || !ref || !w.comps[f.compId].friendly) return true
    const clash = comp.find((c) => iran(c) === ref && Math.abs(c.day - f.day) <= 2)
    if (!clash) return true
    out.push({ level: ref.split(':')[2] as Level, day: f.day, opp: (f.home === ref ? f.away : f.home).split(':')[1], versus: w.comps[clash.compId].short })
    return false
  })
  return out
}
