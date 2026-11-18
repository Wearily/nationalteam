import { ageOn, toDay, ymd, type Day } from '../core/date'
import { clamp, type Rng } from '../core/rng'
import { clubBase } from '../world/build'
import type { World } from '../world/state'
import type { Club, Player } from '../world/types'

/** Leagues Iranian players realistically move to, with a pull factor. */
const AFFINITY: Record<string, number> = {
  UAE: 3, QAT: 2.6, KSA: 1.2, IRQ: 1.2, TUR: 1.6, RUS: 2, BEL: 2, NED: 1.8, POR: 1.8, GRE: 1.8, DEN: 1, SWE: 0.8, AUT: 0.9, CRO: 0.9,
  GER: 1, ESP: 0.7, ITA: 0.8, FRA: 0.6, ENG: 0.7, UZB: 0.6,
}
const europe = (w: World, country: string) => w.nations[country]?.confed === 'UEFA'

export interface Move { player: Player; from: Club | null; to: Club; fee: number }

export function move(_w: World, p: Player, to: Club, fee: number, day: Day) {
  p.transfers.push({ day, from: p.clubId, to: to.id, fee })
  p.clubId = to.id
  p.contractEnd = toDay(ymd(day).y + 3, 6, 30)
  p.sharp = Math.min(p.sharp, 60)
  p.morale = clamp(p.morale + 8, 0, 100)
}

function destination(w: World, rng: Rng, p: Player, abroad: boolean, minLevel = 0): Club | null {
  const cands = w.clubs.filter((c) => {
    const lg = w.leagues[c.leagueId]
    if (lg.virtual || c.id === p.clubId) return false
    if (abroad ? c.country === 'IRN' : c.country !== 'IRN') return false
    const base = c.full ? c.str : clubBase(lg.strength, c.rep)
    return base >= minLevel && p.ovr >= base - 3.5 && p.ovr <= base + 7
  })
  if (!cands.length) return null
  return rng.weighted(cands, (c) => (abroad ? (AFFINITY[c.country] ?? 0.3) : 1) * (0.5 + c.rep / 100))
}

/**
 * Weekly transfer activity during windows. The "Europe pathway" culture (0–100) scales how readily
 * Iranian players accept moves to Europe; ambitious players go more easily either way.
 */
export function transferWeek(w: World, rng: Rng, day: Day): Move[] {
  const { m } = ymd(day)
  const summer = m === 7 || m === 8
  const windowOpen = summer || m === 1
  const moves: Move[] = []
  const path = w.fed.pathway / 100
  for (const p of w.players) {
    if (p.retired || p.injury) continue
    const iranian = p.nat.includes('IRN')
    if (!iranian) continue
    if (p.clubId == null) {
      // free agents can sign at any time of year. Form and a tournament spotlight bring offers sooner and
      // from better clubs; an unremarkable player without a club waits longer and usually signs at home.
      const age = ageOn(p.dob, day)
      if (age < 17 || age > 36 || p.ovr < 52) continue
      const spot = p.spotlight ?? 0
      const recent = p.form.slice(-3)
      const hot = recent.length ? Math.max(0, recent.reduce((a, b) => a + b, 0) / recent.length - 7) : 0
      const chance = clamp(0.035 + spot * 0.03 + hot * 0.05 + (p.ovr - 60) * 0.002, 0.01, 0.3)
      if (!rng.chance(chance)) continue
      const abroad = p.ovr >= 64 && rng.chance(clamp(0.25 + path * 0.4 + spot * 0.07 + hot * 0.1, 0, 0.9))
      // a player in the spotlight can hold out for a club at or above his level
      const to = destination(w, rng, p, abroad, spot >= 1 || hot >= 0.5 ? p.ovr - 2 : 0) ?? destination(w, rng, p, abroad) ?? destination(w, rng, p, !abroad)
      if (to) { moves.push({ player: p, from: null, to, fee: 0 }); move(w, p, to, 0, day) }
      continue
    }
    if (!windowOpen) continue
    const club = w.clubs[p.clubId]
    const lg = w.leagues[club.leagueId]
    const age = ageOn(p.dob, day)
    if (age < 17 || p.transfers.some((t) => day - t.day < 300)) continue
    const here = club.full ? club.str : clubBase(lg.strength, club.rep)
    const k = summer ? 1 : 0.45
    // a player who shone at a tournament is on more clubs' lists, and they pay more for him
    const spot = p.spotlight ?? 0
    const eye = 1 + Math.min(2.5, spot * 0.35)
    if (club.country === 'IRN') {
      // step abroad
      const surplus = p.ovr - here
      const want = clamp(0.004 + surplus * 0.0035 + (p.pot - p.ovr) * 0.0012, 0, 0.05) * (0.45 + path * 1.3) * (0.6 + p.traits.ambition / 16) * (age <= 27 ? 1.2 : age <= 30 ? 0.7 : 0.25) * k * eye
      if (p.ovr >= 62 && rng.chance(want)) {
        const to = destination(w, rng, p, true, rng.chance(0.35 + path * 0.5 + spot * 0.05) ? here + 1 : 0)
        if (to && (!europe(w, to.country) || rng.chance(0.3 + path * 0.7))) {
          const fee = Math.round((p.value * rng.range(0.7, 1.35) * (1 + spot * 0.05)) / 50_000) * 50_000
          moves.push({ player: p, from: club, to, fee })
          move(w, p, to, fee, day)
          continue
        }
      }
      // domestic step up
      if (surplus > 2.5 && lg.tier >= 1 && rng.chance(0.03 * k)) {
        const to = destination(w, rng, p, false, here + 1.5)
        if (to) { const fee = Math.round((p.value * rng.range(0.5, 1)) / 25_000) * 25_000; moves.push({ player: p, from: club, to, fee }); move(w, p, to, fee, day) }
      }
    } else if (!lg.virtual || age > 24) {
      // abroad: move up if excelling, drift home if not playing or ageing
      const stuck = p.sharp < 45 || p.ovr < here - 4
      const home = clamp((stuck ? 0.05 : 0.004) + (age >= 31 ? 0.03 : 0) - path * 0.012, 0.001, 0.1) * k
      if (rng.chance(home)) {
        const to = destination(w, rng, p, false)
        if (to) { const fee = age >= 31 || stuck ? 0 : Math.round((p.value * 0.5) / 25_000) * 25_000; moves.push({ player: p, from: club, to, fee }); move(w, p, to, fee, day); continue }
      }
      if ((p.ovr > here + 3 || (spot >= 3 && p.ovr > here)) && age <= 29 && rng.chance(0.035 * k * eye)) {
        const to = destination(w, rng, p, true, here + 2)
        if (to) { const fee = Math.round((p.value * rng.range(0.8, 1.4) * (1 + spot * 0.05)) / 50_000) * 50_000; moves.push({ player: p, from: club, to, fee }); move(w, p, to, fee, day) }
      }
    }
  }
  return moves
}
