import { ageOn, toDay, ymd, type Day } from '../core/date'
import { clamp, type Rng } from '../core/rng'
import { N_ATTR, overallAt, POS_WEIGHTS, ATTRS, A } from '../ratings/attributes'
import { makePlayer, valueOf, wageOf } from '../world/build'
import { genName } from '../world/names'
import type { World } from '../world/state'
import { emptyStats, type Player } from '../world/types'

const leagueStrengthOf = (w: World, p: Player) => (p.clubId != null ? w.leagues[w.clubs[p.clubId].leagueId].strength : 40)

/** Monthly progression: young players grow toward potential (faster with minutes), veterans decline. */
export function developAll(w: World, rng: Rng, day: Day) {
  for (const p of w.players) {
    if (p.retired) continue
    const age = ageOn(p.dob, day)
    const minsF = clamp(p.club.mins / 1200, 0, 1.3)
    let d = 0
    if (age < 30 && p.ovr < p.pot) {
      const rate = age < 18 ? 0.34 : age < 21 ? 0.3 : age < 24 ? 0.2 : age < 27 ? 0.1 : 0.04
      d = rate * (0.45 + 0.75 * minsF) * (0.7 + p.traits.professionalism / 33) * Math.min(1, (p.pot - p.ovr) / 6 + 0.25)
      // playing in a stronger league stretches a player
      d *= 0.85 + clamp((leagueStrengthOf(w, p) - 50) / 120, -0.15, 0.3)
    } else if (age >= 31) d = -(0.07 + (age - 31) * 0.045) * (1.25 - p.traits.professionalism / 40)
    if (d === 0) continue
    const steps = Math.floor(Math.abs(d)) + (rng.chance(Math.abs(d) % 1) ? 1 : 0)
    if (!steps) continue
    const sign = d > 0 ? 1 : -1
    const w8 = POS_WEIGHTS[p.pos[0]]
    for (let s = 0; s < steps; s++)
      for (let i = 0; i < N_ATTR; i++) {
        const k = ATTRS[i]
        const physical = i >= A.pace && i <= A.jumping
        const chance = sign > 0 ? 0.25 + ((w8[k] as number) ?? 0) * 0.08 : physical ? 0.6 : (w8[k] as number) ? 0.22 : 0.1
        if (rng.chance(chance)) p.attrs[i] = clamp(p.attrs[i] + sign, 5, 99)
      }
    p.ovr = overallAt(p.attrs, p.pos[0])
    if (p.ovr > p.pot) p.pot = p.ovr
  }
}

export function revalue(w: World, day: Day) {
  for (const p of w.players) {
    if (p.retired) continue
    const age = ageOn(p.dob, day)
    const formF = p.form.length >= 4 ? 1 + (p.form.reduce((a, b) => a + b, 0) / p.form.length - 6.7) * 0.12 : 1
    const v = Math.round(valueOf(p.ovr, p.pot, age, leagueStrengthOf(w, p)) * clamp(formF, 0.8, 1.3) * (1 + Math.min(0.25, p.caps / 200)))
    p.value = Math.round((p.value * 0.6 + v * 0.4) / 5000) * 5000
    p.wage = wageOf(p.value)
    const last = p.valueHist[p.valueHist.length - 1]
    if (!last || day - last[0] >= 85) { p.valueHist.push([day, p.value]); if (p.valueHist.length > 40) p.valueHist.shift() }
  }
}

/** 1 July: archive the season, retire veterans, promote a new academy intake. */
export function seasonRollover(w: World, rng: Rng, day: Day): string[] {
  const news: string[] = []
  const year = ymd(day).y
  for (const p of w.players) {
    if (p.retired) continue
    if (p.club.apps > 0) { p.history.push({ season: year - 1, clubId: p.clubId, stats: p.club }); if (p.history.length > 25) p.history.shift() }
    p.club = emptyStats()
    p.intl = emptyStats()
    const age = ageOn(p.dob, day)
    if (age >= 33 && rng.chance(clamp((age - 32) * 0.16 + (p.ovr < 60 ? 0.15 : 0), 0, 0.95))) {
      p.retired = true
      p.clubId = null
      if (p.nat[0] === 'IRN' && p.caps >= 20) news.push(`${p.name} (${p.caps} caps, ${p.goals} goals) has retired from football.`)
    } else if (!p.intlRetired && p.nat[0] === 'IRN' && p.caps >= 30 && age >= 33 && rng.chance(0.3)) {
      p.intlRetired = true
      news.push(`${p.name} has announced his retirement from international football after ${p.caps} caps.`)
    }
    if (p.clubId == null && !p.real && age > 24 && p.nat[0] !== 'IRN') p.retired = true
  }
  // academy intake: better youth investment and a stronger pathway culture raise the ceiling
  const invest = clamp(w.fed.youthInvest / 1_000_000, 0.2, 3)
  for (const c of w.clubs) {
    if (!c.full) continue
    const lg = w.leagues[c.leagueId]
    const n = lg.tier === 1 ? 4 : 2
    for (let k = 0; k < n; k++) {
      const pos = rng.pick(['GK', 'CB', 'CB', 'RB', 'LB', 'DM', 'CM', 'CM', 'AM', 'RW', 'LW', 'ST', 'ST'] as const)
      const age = 15
      const pot = clamp(Math.round(rng.normal(63 + (c.rep - 50) * 0.12 + Math.log2(invest + 1) * 2.2, 7.5)), 46, 93)
      const pl = makePlayer(w, rng, { name: genName(rng, 'IRN'), dob: day - Math.round(age * 365.25) - rng.int(0, 300), nat: ['IRN'], pos: [pos], clubId: c.id, ovr: clamp(pot - rng.range(17, 26), 30, pot), today: day, leagueStrength: lg.strength, pot })
      pl.iranStatus = 'committed'
      pl.known = clamp(Math.round(5 + (pot - 62) * 1.4 + rng.range(0, 15)), 0, 45)
      pl.contractEnd = toDay(year + 3, 6, 30)
    }
  }
  return news
}
