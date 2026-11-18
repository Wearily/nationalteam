import { ymd, type Day } from '../core/date'
import { clamp, hashStr, type Rng } from '../core/rng'
import type { Pos } from '../data/raw'
import { effectiveOverall, posLine } from '../ratings/attributes'
import { dynOvr, engineDelta } from '../ratings/dynamic'
import { defaultRole, emptyTactic, FORMATION_KEYS, FORMATIONS, type Tactic } from '../match/tactics'
import type { MPlayer, MTeam } from '../match/types'
import { makePlayer } from '../world/build'
import { genName } from '../world/names'
import type { Index, World } from '../world/state'
import { LEVEL_AGE, LEVEL_NAME, natRef, type Level, type Player, type TeamRef } from '../world/types'

const LEVEL_DROP: Record<Level, number> = { senior: 0, u23: 8, u21: 11, u20: 13, u19: 16, u17: 21, u16: 24, u15: 27 }

/** Youth eligibility uses birth-year cut-offs, as real competitions do. */
export function ageEligible(p: Player, level: Level, day: Day): boolean {
  if (level === 'senior') return true
  return ymd(p.dob).y >= ymd(day).y - LEVEL_AGE[level]
}

export function eligible(_w: World, idx: Index, code: string, level: Level, day: Day): Player[] {
  const base = idx.byNat.get(code) ?? []
  const out = base.filter((p) => !p.retired && !p.intlRetired && ageEligible(p, level, day) && (code !== 'IRN' || p.iranStatus === 'committed' || p.iranStatus === undefined))
  return out
}

const TEMPLATE: Pos[] = ['GK', 'GK', 'GK', 'RB', 'RB', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'DM', 'DM', 'CM', 'CM', 'CM', 'CM', 'AM', 'AM', 'RW', 'RW', 'LW', 'LW', 'ST', 'ST', 'ST']

export function selectionScore(w: World, p: Player, bias = 0): number {
  const lg = p.clubId != null ? w.leagues[w.clubs[p.clubId].leagueId] : null
  const abroad = lg ? lg.country !== 'IRN' : false
  return dynOvr(p).ovr + Math.min(2.5, p.caps / 25) + (p.nat[0] === 'IRN' ? bias * (abroad ? 2.2 : -2.2) : 0)
}

/** Make sure a nation has enough eligible players at a level; generate anonymous ones if not. */
export function ensurePool(w: World, idx: Index, rng: Rng, code: string, level: Level, day: Day, exclude?: Set<number>) {
  const nat = w.nations[code]
  if (!nat) return
  const have = eligible(w, idx, code, level, day).filter((p) => !p.injury && !exclude?.has(p.id))
  const target = nat.level - LEVEL_DROP[level]
  // only count players good enough to plausibly be selected
  const good = have.filter((p) => p.ovr >= target - 12)
  // count by line (GK/DEF/MID/ATT): real squad lists rarely say which defenders are full backs
  const have2 = new Map<string, number>()
  for (const p of good) have2.set(posLine(p.pos[0]), (have2.get(posLine(p.pos[0])) ?? 0) + 1)
  const need = new Map<Pos, number>()
  for (const line of ['GK', 'DEF', 'MID', 'ATT']) {
    const tpl = TEMPLATE.filter((t) => posLine(t) === line)
    for (let k = have2.get(line) ?? 0; k < tpl.length; k++) need.set(tpl[k], (need.get(tpl[k]) ?? 0) + 1)
  }
  const yr = ymd(day).y
  for (const [pos, n] of need)
    for (let k = 0; k < n; k++) {
      const age = level === 'senior' ? clamp(Math.round(rng.normal(26.5, 3.6)), 19, 35) : LEVEL_AGE[level] - rng.int(0, 2)
      const dob = level === 'senior' ? day - Math.round(age * 365.25) - rng.int(0, 364) : Math.floor(Date.UTC(yr - age, rng.int(0, 11), rng.int(1, 28)) / 86400000)
      const pl = makePlayer(w, rng, { name: genName(rng, code, nat.confed), dob, nat: [code], pos: [pos], clubId: null, ovr: target - 1.5 + rng.normal(0, 3), today: day, leagueStrength: clamp(nat.level, 35, 90) })
      pl.sharp = 75
      pl.caps = level === 'senior' ? rng.int(0, 45) : 0
      if (code === 'IRN') pl.iranStatus = 'committed'
      let a = idx.byNat.get(code)
      if (!a) idx.byNat.set(code, (a = []))
      a.push(pl)
    }
}

export function pickSquad(w: World, idx: Index, rng: Rng, code: string, level: Level, size: number, day: Day, bias = 0, exclude?: Set<number>): number[] {
  ensurePool(w, idx, rng, code, level, day, exclude)
  const pool = eligible(w, idx, code, level, day).filter((p) => (!p.injury || p.injury.until < day + 4) && !exclude?.has(p.id))
  const sc = new Map(pool.map((p) => [p.id, selectionScore(w, p, bias) + rng.normal(0, 0.8)]))
  const by = (a: Player, b: Player) => sc.get(b.id)! - sc.get(a.id)!
  const chosen: Player[] = []
  const used = new Set<number>()
  const need = new Map<Pos, number>()
  for (const s of TEMPLATE) need.set(s, (need.get(s) ?? 0) + 1)
  for (const [pos, n] of need) {
    const c = pool.filter((p) => p.pos[0] === pos && !used.has(p.id)).sort(by).slice(0, n)
    for (const p of c) { chosen.push(p); used.add(p.id) }
  }
  // cover any line the exact-position pass left short
  for (const line of ['GK', 'DEF', 'MID', 'ATT']) {
    const want = TEMPLATE.filter((t) => posLine(t) === line).length
    const extra = pool.filter((p) => posLine(p.pos[0]) === line && !used.has(p.id)).sort(by)
    while (chosen.filter((p) => posLine(p.pos[0]) === line).length < want && extra.length) { const p = extra.shift()!; chosen.push(p); used.add(p.id) }
  }
  // trim to size, protecting three goalkeepers
  chosen.sort(by)
  while (chosen.length > size) {
    for (let i = chosen.length - 1; i >= 0; i--) {
      const p = chosen[i]
      if (p.pos[0] === 'GK' && chosen.filter((x) => x.pos[0] === 'GK').length <= (size >= 23 ? 3 : 2)) continue
      chosen.splice(i, 1)
      break
    }
  }
  const rest = pool.filter((p) => !used.has(p.id) && p.pos[0] !== 'GK').sort(by)
  while (chosen.length < size && rest.length) chosen.push(rest.shift()!)
  return chosen.map((p) => p.id)
}

/** Best eleven for a formation: repeatedly take the strongest remaining player/slot pairing. */
export function pickXI(players: Player[], formation: string): { lineup: number[]; bench: number[] } {
  const slots = FORMATIONS[formation]
  const avail = players.filter((p) => !p.injury)
  const lineup = new Array(11).fill(-1)
  const used = new Set<number>()
  const val = (p: Player, s: number) => effectiveOverall(p.attrs, p.pos, slots[s].pos) + dynOvr(p).total
  // goalkeeper first
  const gks = avail.filter((p) => p.pos[0] === 'GK').sort((a, b) => val(b, 0) - val(a, 0))
  if (gks[0]) { lineup[0] = gks[0].id; used.add(gks[0].id) }
  for (let n = 0; n < 10; n++) {
    let best = -1e9
    let bp: Player | null = null
    let bs = -1
    for (let s = 1; s < 11; s++) {
      if (lineup[s] !== -1) continue
      for (const p of avail) {
        if (used.has(p.id) || p.pos[0] === 'GK') continue
        const v = val(p, s)
        if (v > best) { best = v; bp = p; bs = s }
      }
    }
    if (!bp) break
    lineup[bs] = bp.id
    used.add(bp.id)
  }
  const bench = avail.filter((p) => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr).map((p) => p.id)
  return { lineup, bench }
}

export const shortName = (name: string) => {
  const parts = name.split(' ')
  return parts.length > 1 ? parts.slice(1).join(' ') : name
}
export function toMPlayer(p: Player, i: number, today = 0): MPlayer {
  // dynamic overall: form, morale and sharpness shift every attribute for this match
  const d = engineDelta(p)
  const age = (today - p.dob) / 365.25
  return {
    id: p.id, name: p.name, short: shortName(p.name), num: p.num ?? i + 1, pos: p.pos, attrs: d ? p.attrs.map((a) => clamp(a + d, 1, 99)) : p.attrs,
    cond: clamp(p.cond, 40, 100), form: 0,
    consistency: p.traits.consistency, bigMatch: p.traits.bigMatch, injuryProne: p.traits.injuryProne, prospect: prospectScore(p, age),
  }
}

/** Young, with room to grow, and short of senior experience: the players worth blooding when a match is safe. */
export function prospectScore(p: Player, age: number): number {
  if (age > 24) return 0
  const room = clamp((p.pot - p.ovr) / 10, 0, 1)
  const youth = age <= 20 ? 1 : age <= 22 ? 0.8 : 0.55
  const green = p.caps < 3 ? 1 : p.caps < 10 ? 0.7 : 0.35
  return Math.round(room * youth * green * 100) / 100
}

export function teamName(w: World, ref: TeamRef): { name: string; short: string; colors: [string, string] } {
  const [k, a, lv] = ref.split(':')
  if (k === 'c') { const c = w.clubs[+a]; return { name: c.name, short: c.short, colors: c.colors } }
  const n = w.nations[a]
  const suffix = lv && lv !== 'senior' ? ` ${LEVEL_NAME[lv as Level]}` : ''
  return { name: (n?.name ?? a) + suffix, short: a + (suffix ? suffix : ''), colors: n?.colors ?? ['#888', '#fff'] }
}

/** Formation and approach an AI national coach would use against this opponent. */
export function aiTactic(w: World, code: string, oppCode: string): Tactic {
  const h = hashStr(code)
  const tac = emptyTactic(FORMATION_KEYS[h % 6])
  const diff = (w.nations[code]?.level ?? 60) - (w.nations[oppCode]?.level ?? 60)
  tac.mentality = clamp(50 + diff * 1.6 + ((h >> 4) % 11) - 5, 28, 72)
  tac.pressing = clamp(45 + ((h >> 8) % 25) + diff * 0.6, 25, 80)
  tac.line = clamp(42 + ((h >> 12) % 20) + diff * 0.8, 25, 78)
  tac.directness = clamp(35 + ((h >> 16) % 35) - diff * 0.5, 20, 80)
  tac.tempo = clamp(45 + ((h >> 20) % 20), 30, 75)
  return tac
}

export function buildMTeam(w: World, ref: TeamRef, squad: number[], tactic: Tactic, ai: boolean, autoXI: boolean): MTeam {
  const players = squad.map((id) => w.players[id])
  const tac: Tactic = { ...tactic, roles: [...tactic.roles], lineup: [...tactic.lineup], bench: [...tactic.bench] }
  const valid = tac.lineup.filter((id) => id >= 0 && squad.includes(id) && !w.players[id].injury).length === 11
  if (autoXI || !valid) {
    const xi = pickXI(players, tac.formation)
    tac.lineup = xi.lineup
    tac.bench = xi.bench
    if (tac.roles.length !== 11) tac.roles = FORMATIONS[tac.formation].map((s) => defaultRole(s.pos))
  } else tac.bench = squad.filter((id) => !tac.lineup.includes(id) && !w.players[id].injury)
  const nm = teamName(w, ref)
  // unique shirt numbers: keep a player's real number when free, otherwise the lowest unused
  const used = new Set<number>()
  const mps = players.map((pl, i) => toMPlayer(pl, i, w.day))
  for (const m of mps) { const real = w.players[m.id].num; if (real && real <= 99 && !used.has(real)) { m.num = real; used.add(real) } else m.num = 0 }
  let next = 1
  for (const m of mps) if (!m.num) { while (used.has(next)) next++; m.num = next; used.add(next) }
  return { ref, ...nm, tactic: tac, players: mps, ai }
}

export const iranRef = (level: Level) => natRef('IRN', level)
