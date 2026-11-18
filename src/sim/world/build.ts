import { ageOn, parseDay, toDay, type Day } from '../core/date'
import { Rng, clamp, hashStr } from '../core/rng'
import type { Pos, RawData, RawPlayer } from '../data/raw'
import { generateAttrs, overallAt } from '../ratings/attributes'
import { emptyTactic, FORMATION_KEYS } from '../match/tactics'
import { genName } from './names'
import type { World } from './state'
import { emptyStats, LEVELS, type Club, type League, type Level, type Nation, type Player, type Staff } from './types'

export const START_DAY = toDay(2026, 11, 18)

export const nationLevel = (points: number) => clamp(57 + (points - 1000) * 0.031, 44, 88)
export const clubBase = (leagueStrength: number, rep: number) => 42 + (0.6 * leagueStrength + 0.4 * rep) * 0.42

/** Market value in EUR from overall, age and potential. */
export function valueOf(ovr: number, pot: number, age: number, leagueStrength: number): number {
  let v = 2_500_000 * Math.exp(0.2 * (ovr - 70))
  const ageF = age <= 21 ? 0.85 + (21 - age) * 0.02 : age <= 26 ? 1 : age <= 29 ? 1 - (age - 26) * 0.1 : age <= 33 ? 0.7 - (age - 29) * 0.13 : Math.max(0.04, 0.18 - (age - 33) * 0.05)
  v *= ageF
  if (age < 25) v *= 1 + Math.max(0, pot - ovr) * 0.07
  v *= 0.45 + 0.55 * (leagueStrength / 90)
  const step = v > 10e6 ? 5e5 : v > 1e6 ? 1e5 : v > 1e5 ? 25e3 : 5e3
  return Math.max(10_000, Math.round(v / step) * step)
}
export const wageOf = (value: number) => Math.round((value * 0.11 + 15_000) / 1000) * 1000

const mkTraits = (rng: Rng) => ({
  consistency: clamp(Math.round(rng.normal(12, 3.5)), 1, 20),
  bigMatch: clamp(Math.round(rng.normal(11, 3.5)), 1, 20),
  injuryProne: clamp(Math.round(rng.normal(8, 3.5)), 1, 20),
  ambition: clamp(Math.round(rng.normal(11, 4)), 1, 20),
  professionalism: clamp(Math.round(rng.normal(12, 3.5)), 1, 20),
  attachment: clamp(Math.round(rng.normal(13, 4)), 1, 20),
})

export function potentialFor(rng: Rng, ovr: number, age: number): number {
  if (age >= 28) return ovr
  const room = (28 - age) * rng.range(0.35, 1.9) * (age < 21 ? 1.25 : 1)
  return clamp(Math.round(ovr + Math.max(0, room + rng.normal(0, 2))), ovr, 94)
}

export function makePlayer(
  w: Pick<World, 'players'>, rng: Rng, o: {
    name: string; dob: Day; nat: string[]; pos: Pos[]; clubId: number | null; ovr: number; today: Day; leagueStrength: number
    real?: boolean; rid?: string; heightCm?: number; foot?: 'L' | 'R' | 'B'; pot?: number
  },
): Player {
  const age = ageOn(o.dob, o.today)
  const pos = o.pos[0]
  const h = o.heightCm ?? Math.round(pos === 'GK' ? rng.normal(189, 4) : pos === 'CB' ? rng.normal(186, 4) : pos === 'ST' ? rng.normal(183, 5) : rng.normal(178, 5))
  const ovr = clamp(Math.round(o.ovr), 30, 95)
  const attrs = generateAttrs(rng, pos, ovr, age, h)
  const pot = o.pot ?? potentialFor(rng, ovr, age)
  const value = valueOf(ovr, pot, age, o.leagueStrength)
  const p: Player = {
    id: w.players.length, rid: o.rid, real: !!o.real, name: o.name, dob: o.dob, nat: o.nat, pos: o.pos, clubId: o.clubId,
    heightCm: h, foot: o.foot ?? (rng.chance(0.24) ? 'L' : rng.chance(0.06) ? 'B' : 'R'), attrs, ovr: overallAt(attrs, pos), pot,
    traits: mkTraits(rng), value, wage: wageOf(value), contractEnd: toDay(2027 + rng.int(0, 3), 6, 30),
    form: [], cond: 95, sharp: o.clubId == null ? 40 : 70, morale: 70, injury: null, club: emptyStats(), intl: emptyStats(),
    caps: 0, goals: 0, capTied: false, youthCaps: {}, history: [], transfers: [], valueHist: [[o.today, value]], known: 100,
  }
  w.players.push(p)
  return p
}

const SQUAD_SHAPE: Pos[] = ['GK', 'GK', 'GK', 'RB', 'RB', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'DM', 'DM', 'CM', 'CM', 'CM', 'AM', 'AM', 'RW', 'RW', 'LW', 'LW', 'ST', 'ST', 'ST', 'CB']
const YOUTH_SHAPE: Pos[] = ['GK', 'CB', 'CB', 'RB', 'LB', 'DM', 'CM', 'CM', 'AM', 'RW', 'LW', 'ST', 'ST', 'GK', 'CB', 'CM']

function staffFrom(rng: Rng, id: number, o: Partial<Staff> & { name: string; dob: Day; nat: string; role: Staff['role']; rep: number }): Staff {
  const q = (o.rep / 100) * 12 + 5
  const sk = () => clamp(Math.round(rng.normal(q, 2.4)), 1, 20)
  return {
    id, job: null, tactics: sk(), motivation: sk(), youth: sk(), judging: sk(), abroadBias: clamp(rng.normal(0, 0.5), -1, 1),
    formation: rng.pick(FORMATION_KEYS.slice(0, 6)), mentality: clamp(Math.round(rng.normal(50, 10)), 25, 75),
    wage: Math.round((30_000 * Math.exp(o.rep / 22)) / 1000) * 1000, contractEnd: toDay(2027 + rng.int(0, 2), 7, 31), real: false, ...o,
  }
}

const COLORS: [string, string][] = [['#c8102e', '#ffffff'], ['#0b3d91', '#ffffff'], ['#f5c400', '#111111'], ['#1b7f3b', '#ffffff'], ['#111111', '#ffffff'], ['#ffffff', '#c8102e'], ['#f26522', '#111111'], ['#5b2a86', '#ffffff'], ['#6ec1e4', '#0b1f33'], ['#7a0019', '#f5c400']]

export function buildWorld(raw: RawData, seed: number, managerName: string, overrides: Record<string, [number, number] | string> = {}, positions: Record<string, Pos[] | string> = {}): World {
  const posFix = new Map<string, Pos[]>()
  for (const [k, v] of Object.entries(positions)) if (Array.isArray(v)) posFix.set(k.toLowerCase(), v)
  const ov = new Map<string, [number, number]>()
  for (const [k, v] of Object.entries(overrides)) if (Array.isArray(v)) ov.set(k.toLowerCase(), v)
  const rng = new Rng(seed)
  const today = START_DAY
  const nations: Record<string, Nation> = {}
  for (const n of raw.nations)
    nations[n.code] = { code: n.code, name: n.name, confed: n.confed, region: n.region, points: n.fifaPoints, rank: n.fifaRank, prevRank: n.fifaRank, colors: n.colors ?? COLORS[hashStr(n.code) % COLORS.length], level: nationLevel(n.fifaPoints) }

  const leagues: League[] = raw.leagues.map((l, i) => ({ id: i, rid: l.id, name: l.name, country: l.country, tier: l.tier, strength: l.strength, startMonth: l.startMonth, clubIds: [], virtual: l.id.startsWith('other-') }))
  const leagueByRid = new Map(leagues.map((l) => [l.rid, l]))
  const clubs: Club[] = []
  const clubByRid = new Map<string, Club>()
  for (const c of raw.clubs) {
    const lg = leagueByRid.get(c.league)
    if (!lg) continue
    const rep = c.rep ?? lg.strength
    const club: Club = {
      id: clubs.length, rid: c.id, name: c.name, short: c.short ?? c.name.replace(/\b(F\.?C\.?|S\.?C\.?|Football Club|Club)\b/g, '').trim(), country: c.country,
      leagueId: lg.id, city: c.city, stadium: c.stadium, rep, colors: c.colors ?? COLORS[hashStr(c.id) % COLORS.length], logo: c.logo,
      str: clubBase(lg.strength, rep), full: c.country === 'IRN' && !lg.virtual, academy: !!c.academy || (c.country === 'IRN' && lg.tier === 1),
    }
    clubs.push(club)
    clubByRid.set(c.id, club)
    lg.clubIds.push(club.id)
  }

  const w: World = {
    version: 1, seed, rng: 0, day: today, startDay: today, season: 2026, managerName, players: [], clubs, leagues, nations, staff: [], comps: [], fixtures: [],
    teams: {} as World['teams'],
    fed: { budget: 14_000_000, income: 0, board: 62, fans: 60, media: 55, pathway: 38, scoutBudget: 600_000, youthInvest: 800_000, ledger: [] },
    inbox: [], reports: [], pending: [], natSquads: {}, nextId: { fixture: 0, msg: 0, report: 0 }, rankHist: [], camps: [], scouts: [], approaches: {}, history: [],
  }

  // ── real players ──
  const estimate = (r: RawPlayer, club: Club | undefined, age: number, prng: Rng): number => {
    const lg = club ? leagues[club.leagueId] : undefined
    let est = club && lg ? clubBase(lg.strength, club.rep) - 1.5 : 56
    est += prng.normal(0, 3.2)
    if (age < 22) est -= (22 - age) * 2.3
    if (age > 32) est -= (age - 32) * 1.4
    const nat = nations[r.nat[0]]
    const caps = r.caps ?? 0
    if (nat && caps > 0) {
      const floor = nat.level - 7 + Math.min(8, Math.sqrt(caps) * 0.9) + prng.normal(0, 1.6) - (age > 33 ? (age - 33) * 1.5 : 0)
      est = Math.max(est, floor)
    }
    // a real market value is strong evidence of level: pull the estimate toward what that value implies
    if (r.valueEur && r.valueEur > 20_000) {
      const ageF = age <= 21 ? 0.85 + (21 - age) * 0.02 : age <= 26 ? 1 : age <= 29 ? 1 - (age - 26) * 0.1 : age <= 33 ? 0.7 - (age - 29) * 0.13 : Math.max(0.04, 0.18 - (age - 33) * 0.05)
      const lgF = 0.45 + 0.55 * ((lg?.strength ?? 45) / 90)
      const implied = 70 + Math.log(r.valueEur / (2_500_000 * ageF * lgF * (age < 24 ? 1.3 : 1))) / 0.2
      est = est * 0.45 + clamp(implied, est - 9, est + 9) * 0.55
    }
    return est
  }
  for (const r of raw.players) {
    const pf = posFix.get(r.name.toLowerCase())
    if (pf) r.pos = pf
    if (!r.dob || !r.pos?.length || !r.nat?.length || !nations[r.nat[0]]) continue
    // year-only birth dates: count the birthday as 1 January so the age ticks over at New Year
    const approx = !!r.dobYearOnly || r.dob.endsWith('-07-01')
    const dob = approx ? toDay(+r.dob.slice(0, 4), 1, 1) : parseDay(r.dob)
    const age = ageOn(dob, today)
    if (age < 14 || age > 42) continue
    const club = r.club ? clubByRid.get(r.club) : undefined
    const prng = new Rng(hashStr(r.id) ^ seed)
    const fixed = ov.get(r.name.toLowerCase())
    const ovr = fixed ? fixed[0] : estimate(r, club, age, prng)
    const p = makePlayer(w, prng, {
      name: r.name, dob, nat: r.nat.filter((n) => nations[n]), pos: r.pos, clubId: club?.id ?? null, ovr, today,
      leagueStrength: club ? leagues[club.leagueId].strength : 45, real: true, rid: r.id, heightCm: r.heightCm, foot: r.foot, pot: fixed ? Math.max(fixed[0], fixed[1]) : undefined,
    })
    if (r.valueEur) { p.value = r.valueEur; p.valueHist = [[today, p.value]] }
    if (approx) p.dobApprox = true
    p.caps = r.caps ?? 0
    p.goals = r.goals ?? 0
    p.capTied = !!r.capTied || p.caps >= 3
    p.born = r.born
    p.photo = r.photo
    p.photoCredit = r.photoCredit
    p.num = r.num
    // dual nationals who could still choose Iran
    const iranIdx = p.nat.indexOf('IRN')
    if (iranIdx > 0) {
      if (p.capTied) p.nat = p.nat.filter((n) => n !== 'IRN')
      else {
        p.iranStatus = 'undeclared'
        p.willingness = clamp(Math.round(40 + (p.traits.attachment - 10) * 4 - (nations[p.nat[0]].level - nations.IRN.level) * 2.5 + prng.normal(0, 10)), 3, 95)
        p.known = age < 21 ? 15 : 35
      }
    } else if (iranIdx === 0) {
      p.iranStatus = 'committed'
      const lgS = club ? leagues[club.leagueId].strength : 30
      p.known = clamp(Math.round(30 + p.caps * 4 + (lgS - 35) * 1.2 + (age - 18) * 2), 12, 100)
      if (p.caps > 0 || lgS >= 55) p.known = Math.max(p.known, 85)
    }
  }

  // ── fill Iranian clubs and their academies with generated players ──
  const byClub = new Map<number, Player[]>()
  for (const p of w.players) if (p.clubId != null) (byClub.get(p.clubId) ?? byClub.set(p.clubId, []).get(p.clubId)!).push(p)
  const foreignPool = ['IRQ', 'UZB', 'BRA', 'GEO', 'ARM', 'TJK', 'NGA', 'SEN', 'CRO', 'SRB', 'POR', 'ESP', 'CMR', 'GHA', 'MLI'].filter((c) => nations[c])
  for (const c of clubs) {
    if (!c.full) continue
    const lg = leagues[c.leagueId]
    const have = byClub.get(c.id) ?? []
    const base = clubBase(lg.strength, c.rep)
    const counts = new Map<Pos, number>()
    for (const p of have) counts.set(p.pos[0], (counts.get(p.pos[0]) ?? 0) + 1)
    const need = new Map<Pos, number>()
    for (const s of SQUAD_SHAPE) need.set(s, (need.get(s) ?? 0) + 1)
    let foreigners = have.filter((p) => p.nat[0] !== 'IRN').length
    for (const [pos, n] of need) {
      for (let k = counts.get(pos) ?? 0; k < n; k++) {
        const foreign = lg.tier === 1 && foreigners < 3 && rng.chance(0.12)
        if (foreign) foreigners++
        const nat = foreign ? rng.pick(foreignPool) : 'IRN'
        const age = clamp(Math.round(rng.normal(25.5, 4)), 18, 36)
        const dob = today - Math.round(age * 365.25) - rng.int(0, 364)
        const pl = makePlayer(w, rng, { name: genName(rng, nat, nations[nat]?.confed), dob, nat: [nat], pos: [pos], clubId: c.id, ovr: base - 2 + rng.normal(0, 3.4) - (age < 22 ? (22 - age) * 2 : 0), today, leagueStrength: lg.strength })
        if (nat === 'IRN') { pl.iranStatus = 'committed'; pl.known = clamp(Math.round(40 + (lg.strength - 40) + (pl.ovr - 60) * 2), 15, 90) }
      }
    }
    if (c.academy || lg.tier === 2) {
      const n = lg.tier === 1 ? 16 : 7
      for (let k = 0; k < n; k++) {
        const pos = YOUTH_SHAPE[k % YOUTH_SHAPE.length]
        const age = 14 + (k % 5) + (rng.chance(0.3) ? 1 : 0)
        const dob = today - Math.round(age * 365.25) - rng.int(0, 364)
        const pot = clamp(Math.round(rng.normal(64 + (c.rep - 50) * 0.12, 7)), 48, 90)
        const ovr = clamp(pot - (22 - age) * rng.range(2.2, 3.6), 30, pot)
        const pl = makePlayer(w, rng, { name: genName(rng, 'IRN'), dob, nat: ['IRN'], pos: [pos], clubId: c.id, ovr, today, leagueStrength: lg.strength, pot })
        pl.iranStatus = 'committed'
        pl.known = clamp(Math.round(10 + (pot - 60) * 1.5 + rng.range(0, 25)), 5, 60)
        pl.sharp = 55
      }
    }
  }
  // generated young Iranian-eligible players abroad (diaspora academies) for scouts to find
  const diaspora: [string, number][] = [['GER', 9], ['SWE', 8], ['NED', 6], ['ENG', 6], ['USA', 6], ['DEN', 4], ['NOR', 4], ['AUT', 3], ['CAN', 3], ['BEL', 3], ['AUS', 3], ['FRA', 3]]
  for (const [code, n] of diaspora) {
    if (!nations[code]) continue
    const pool = clubs.filter((c) => c.country === code && !leagues[c.leagueId].virtual)
    for (let k = 0; k < n; k++) {
      const age = rng.int(15, 21)
      const dob = today - Math.round(age * 365.25) - rng.int(0, 364)
      const pot = clamp(Math.round(rng.normal(70, 6)), 58, 88)
      const club = pool.length ? rng.pick(pool) : null
      const pos = rng.pick(YOUTH_SHAPE)
      const first = genName(rng, rng.chance(0.6) ? 'IRN' : code, nations[code].confed).split(' ')[0]
      const last = genName(rng, 'IRN').split(' ').slice(1).join(' ')
      const pl = makePlayer(w, rng, { name: `${first} ${last}`, dob, nat: [code, 'IRN'], pos: [pos], clubId: club?.id ?? null, ovr: clamp(pot - (22 - age) * rng.range(1.8, 3.2), 35, pot), today, leagueStrength: club ? leagues[club.leagueId].strength : 50, pot })
      pl.born = code
      pl.iranStatus = 'undeclared'
      pl.willingness = clamp(Math.round(42 + (pl.traits.attachment - 10) * 4 - (nations[code].level - nations.IRN.level) * 2 + rng.normal(0, 12)), 3, 95)
      pl.known = 0
    }
  }
  // full clubs: strength from their best eleven
  byClub.clear()
  for (const p of w.players) if (p.clubId != null) (byClub.get(p.clubId) ?? byClub.set(p.clubId, []).get(p.clubId)!).push(p)
  for (const c of clubs) {
    if (!c.full) continue
    const top = (byClub.get(c.id) ?? []).map((p) => p.ovr).sort((a, b) => b - a).slice(0, 13)
    if (top.length) c.str = top.reduce((a, b) => a + b, 0) / top.length
  }

  // ── staff ──
  for (const s of raw.staff ?? []) {
    if (!s.dob) continue
    const st = staffFrom(new Rng(hashStr(s.id) ^ seed), w.staff.length, { name: s.name, dob: parseDay(s.dob), nat: nations[s.nat] ? s.nat : 'IRN', role: s.role, rep: s.rep ?? 50, real: true })
    st.job = s.job
    w.staff.push(st)
  }
  const genStaff = (role: Staff['role'], nat: string, rep: number) => {
    const age = rng.int(36, 64)
    const st = staffFrom(rng, w.staff.length, { name: genName(rng, nat, nations[nat]?.confed), dob: today - age * 365 - rng.int(0, 364), nat, role, rep })
    w.staff.push(st)
    return st
  }
  for (let i = 0; i < 26; i++) genStaff('coach', rng.chance(0.55) ? 'IRN' : rng.pick(['POR', 'ESP', 'ITA', 'GER', 'CRO', 'SRB', 'NED', 'BEL', 'FRA', 'BRA', 'ARG'].filter((c) => nations[c])), clamp(Math.round(rng.normal(52, 13)), 25, 86))
  for (let i = 0; i < 18; i++) genStaff('scout', rng.chance(0.7) ? 'IRN' : rng.pick(['GER', 'SWE', 'NED', 'ENG', 'POR'].filter((c) => nations[c])), clamp(Math.round(rng.normal(48, 14)), 20, 85))
  for (const role of ['assistant', 'gk', 'fitness', 'physio'] as const) for (let i = 0; i < 6; i++) genStaff(role, 'IRN', clamp(Math.round(rng.normal(50, 12)), 25, 80))

  // ── Iran teams ──
  const coaches = () => w.staff.filter((s) => s.role === 'coach' && (!s.job || s.job.startsWith('nation:IRN')))
  for (const level of LEVELS) {
    const job = `nation:IRN:${level}`
    let coach = w.staff.find((s) => s.job === job && s.role === 'coach')
    if (!coach) {
      const target = level === 'senior' ? 70 : level === 'u23' ? 56 : 46
      coach = coaches().filter((s) => !s.job && s.nat === 'IRN').sort((a, b) => Math.abs(a.rep - target) - Math.abs(b.rep - target))[0]
      if (coach) coach.job = job
    }
    const tac = emptyTactic(coach?.formation ?? '4-3-3')
    tac.mentality = coach?.mentality ?? 50
    w.teams[level as Level] = { level, control: level === 'senior' ? 'manual' : 'auto', coachId: coach?.id ?? null, tactic: tac, squad: [], shortlist: [] }
  }
  w.rng = rng.s
  return w
}
