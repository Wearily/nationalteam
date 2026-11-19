import type { Day } from '../core/date'
import type { Rng } from '../core/rng'
import type { Fixture, TeamRef } from '../world/types'
import type { World } from '../world/state'
import type { Comp, GroupStage, KoStage, Row, Tiebreak } from './types'

/** Circle-method round robin. Returns rounds of [home, away] index pairs. */
export function roundRobin(n: number, legs: 1 | 2): [number, number][][] {
  const teams = Array.from({ length: n }, (_, i) => i)
  if (n % 2) teams.push(-1)
  const m = teams.length
  const rounds: [number, number][][] = []
  for (let r = 0; r < m - 1; r++) {
    const round: [number, number][] = []
    for (let i = 0; i < m / 2; i++) {
      const a = teams[i]
      const b = teams[m - 1 - i]
      if (a === -1 || b === -1) continue
      round.push((r + i) % 2 === 0 ? [a, b] : [b, a])
    }
    rounds.push(round)
    teams.splice(1, 0, teams.pop()!)
  }
  if (legs === 2) for (const round of [...rounds]) rounds.push(round.map(([a, b]) => [b, a] as [number, number]))
  return rounds
}

export function addFixture(w: World, f: Omit<Fixture, 'id' | 'played' | 'hg' | 'ag'>): Fixture {
  const fx: Fixture = { ...f, id: w.nextId.fixture++, played: false, hg: 0, ag: 0 }
  w.fixtures.push(fx)
  return fx
}

export function makeGroupFixtures(w: World, comp: Comp, si: number) {
  const st = comp.stages[si] as GroupStage
  st.groups.forEach((g, gi) => {
    const rounds = roundRobin(g.length, st.legs)
    rounds.forEach((round, ri) => {
      const day = st.days[Math.min(ri, st.days.length - 1)] + (st.offsets?.[gi] ?? 0)
      for (const [a, b] of round)
        addFixture(w, { day, compId: comp.id, stage: si, group: gi, round: ri, home: g[a], away: g[b], neutral: st.neutral })
    })
  })
  st.fixturesMade = true
}

export function makeKoFixtures(w: World, comp: Comp, si: number) {
  const st = comp.stages[si] as KoStage
  const ties = Math.floor(st.teams.length / 2)
  for (let i = 0; i + 1 < st.teams.length; i += 2) {
    // single-leg rounds are spread across the listed days in bracket order
    const d0 = st.legs === 1 ? st.days[Math.min(st.days.length - 1, Math.floor(((i / 2) * st.days.length) / ties))] : st.days[0]
    addFixture(w, { day: d0, compId: comp.id, stage: si, slot: i / 2, round: 0, home: st.teams[i], away: st.teams[i + 1], neutral: st.neutral })
    if (st.legs === 2)
      addFixture(w, { day: st.days[1], compId: comp.id, stage: si, slot: i / 2, round: 1, home: st.teams[i + 1], away: st.teams[i], neutral: st.neutral })
  }
  st.fixturesMade = true
}

export function stageFixtures(w: World, compId: number, si: number): Fixture[] {
  return w.fixtures.filter((f) => f.compId === compId && f.stage === si)
}

export function table(teams: TeamRef[], fixtures: Fixture[], tiebreak: Tiebreak): Row[] {
  const rows = new Map<TeamRef, Row>(teams.map((t) => [t, { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]))
  const played = fixtures.filter((f) => f.played)
  for (const f of played) {
    const h = rows.get(f.home)
    const a = rows.get(f.away)
    if (!h || !a) continue
    h.p++; a.p++; h.gf += f.hg; h.ga += f.ag; a.gf += f.ag; a.ga += f.hg
    if (f.hg > f.ag) { h.w++; a.l++; h.pts += 3 } else if (f.hg < f.ag) { a.w++; h.l++; a.pts += 3 } else { h.d++; a.d++; h.pts++; a.pts++ }
  }
  const all = [...rows.values()]
  const overall = (x: Row, y: Row) => y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf || (x.team < y.team ? -1 : 1)
  all.sort((x, y) => y.pts - x.pts || overall(x, y))
  if (tiebreak === 'h2h') {
    // re-rank clusters level on points using results among the tied teams only
    let i = 0
    while (i < all.length) {
      let j = i
      while (j + 1 < all.length && all[j + 1].pts === all[i].pts) j++
      if (j > i) {
        const tied = all.slice(i, j + 1)
        const set = new Set(tied.map((r) => r.team))
        const mini = table([...set], played.filter((f) => set.has(f.home) && set.has(f.away)), 'gd')
        const rank = new Map(mini.map((r, k) => [r.team, { k, r }]))
        tied.sort((x, y) => {
          const mx = rank.get(x.team)!.r
          const my = rank.get(y.team)!.r
          return my.pts - mx.pts || my.gf - my.ga - (mx.gf - mx.ga) || my.gf - mx.gf || overall(x, y)
        })
        all.splice(i, tied.length, ...tied)
      }
      i = j + 1
    }
  }
  return all
}

export function groupTables(w: World, comp: Comp, si: number): Row[][] {
  const st = comp.stages[si] as GroupStage
  const fx = stageFixtures(w, comp.id, si)
  return st.groups.map((g, gi) => table(g, fx.filter((f) => f.group === gi), st.tiebreak))
}

/** Winner of a knockout tie (single match or two legs). */
export function tieWinner(legs: Fixture[]): TeamRef | null {
  if (legs.some((f) => !f.played)) return null
  const first = legs[0]
  if (legs.length === 1) {
    if (first.hg !== first.ag) return first.hg > first.ag ? first.home : first.away
    return first.pens && first.pens[0] > first.pens[1] ? first.home : first.away
  }
  const second = legs[1]
  const a = first.hg + second.ag // first.home aggregate
  const b = first.ag + second.hg
  if (a !== b) return a > b ? first.home : first.away
  return second.pens && second.pens[0] > second.pens[1] ? second.home : second.away
}

// AFC Asian Cup / 24-team round of 16: [slotA, slotB] where '3:ACD' = a third-placed team from A, C or D.
const AFC24: [string, string][] = [
  ['A2', 'C2'], ['D1', '3:BEF'], ['B1', '3:ACD'], ['F1', 'E2'], ['C1', '3:ABF'], ['E1', 'D2'], ['A1', '3:CDE'], ['B2', 'F2'],
]

function assignThirds(slots: string[], thirds: { g: string; team: TeamRef }[]): TeamRef[] | null {
  const res: TeamRef[] = []
  const used = new Set<number>()
  const go = (i: number): boolean => {
    if (i === slots.length) return true
    for (let k = 0; k < thirds.length; k++) {
      if (used.has(k) || !slots[i].includes(thirds[k].g)) continue
      used.add(k); res[i] = thirds[k].team
      if (go(i + 1)) return true
      used.delete(k)
    }
    return false
  }
  return go(0) ? res : null
}

/** Called after every result. Creates next-stage fixtures and closes the competition when finished. */
export function progress(w: World, comp: Comp, rng: Rng): boolean {
  if (comp.done) return false
  const si = comp.cur
  const st = comp.stages[si]
  const fx = stageFixtures(w, comp.id, si)
  if (!st.fixturesMade || fx.some((f) => !f.played)) return false
  const next = comp.stages[si + 1] as KoStage | undefined
  if (st.type === 'groups') {
    const tabs = groupTables(w, comp, si)
    const direct = st.direct ?? 0
    if (direct) {
      comp.placings ??= {}
      for (const t of tabs) t.slice(0, direct).forEach((r) => (comp.placings![r.team] = 'Qualified'))
    }
    const nextAny = comp.stages[si + 1]
    if (nextAny && nextAny.type === 'groups') {
      // groups → groups: seed the qualifiers into pots by ranking and draw
      const q: TeamRef[] = []
      for (const t of tabs) t.slice(direct, direct + st.advance).forEach((r) => q.push(r.team))
      const extra = tabs.map((t) => t[direct + st.advance]).filter(Boolean).sort((x, y) => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf).slice(0, st.bestNext)
      for (const r of extra) q.push(r.team)
      comp.placings ??= {}
      for (const t of tabs) for (const r of t) if (!q.includes(r.team) && !comp.placings[r.team]) comp.placings[r.team] = st.name
      const pts = (ref: TeamRef) => w.nations[ref.split(':')[1]]?.points ?? 0
      q.sort((x, y) => pts(y) - pts(x))
      const G = nextAny.groups.length
      nextAny.groups = Array.from({ length: G }, () => [])
      for (let pot = 0; pot * G < q.length; pot++) rng.shuffle(q.slice(pot * G, pot * G + G)).forEach((t, i) => nextAny.groups[i].push(t))
      comp.cur = si + 1
      makeGroupFixtures(w, comp, si + 1)
      return true
    }
    if (!next) {
      if (direct) { comp.done = true; for (const t of tabs) for (const r of t) comp.placings![r.team] ??= st.name; return true }
      comp.done = true
      comp.winner = tabs[0][0].team
      comp.placings = {}
      tabs.forEach((t) => t.forEach((r, i) => (comp.placings![r.team] = ordinal(i + 1))))
      return true
    }
    const L = 'ABCDEFGHIJKLMNOP'
    const pos: Record<string, TeamRef> = {}
    tabs.forEach((t, gi) => t.forEach((r, i) => (pos[`${L[gi]}${i + 1}`] = r.team)))
    const nextRows = tabs.map((t, gi) => ({ g: L[gi], row: t[st.advance] })).filter((x) => x.row)
    nextRows.sort((x, y) => y.row.pts - x.row.pts || y.row.gf - y.row.ga - (x.row.gf - x.row.ga) || y.row.gf - x.row.gf)
    const best = nextRows.slice(0, st.bestNext).map((x) => ({ g: x.g, team: x.row.team }))
    let teams: TeamRef[] = []
    if (comp.bracket === 'afc24' && tabs.length === 6 && st.bestNext === 4) {
      const thirdSlots = AFC24.map((p) => p[1]).filter((s) => s.startsWith('3:'))
      const assigned = assignThirds(thirdSlots, best) ?? best.map((b) => b.team)
      let k = 0
      for (const [a, b] of AFC24) teams.push(pos[a], b.startsWith('3:') ? assigned[k++] : pos[b])
    } else {
      // Standard cross-over: A1 v B2, C1 v D2, … then B1 v A2, D1 v C2.
      const quals: TeamRef[][] = tabs.map((t) => t.slice(0, st.advance).map((r) => r.team))
      if (st.advance === 2 && tabs.length % 2 === 0 && best.length === 0) {
        for (let g = 0; g < tabs.length; g += 2) teams.push(quals[g][0], quals[g + 1][1])
        for (let g = 0; g < tabs.length; g += 2) teams.push(quals[g + 1][0], quals[g][1])
      } else {
        const seeds = [...quals.map((q) => q[0]), ...quals.map((q) => q[1]).filter(Boolean), ...best.map((b) => b.team)]
        const lo = seeds.splice(Math.ceil(seeds.length / 2))
        rng.shuffle(lo)
        seeds.forEach((s, i) => teams.push(s, lo[i]))
      }
    }
    teams = teams.filter(Boolean)
    next.teams = teams
    comp.placings ??= {}
    for (const t of tabs) for (const r of t) if (!teams.includes(r.team)) comp.placings[r.team] ??= st.name
    comp.cur = si + 1
    makeKoFixtures(w, comp, si + 1)
    return true
  }
  // knockout
  const ko = st as KoStage
  const winners: TeamRef[] = []
  const losers: TeamRef[] = []
  for (let s = 0; s < ko.teams.length / 2; s++) {
    const legs = fx.filter((f) => f.slot === s).sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
    const win = tieWinner(legs)!
    winners.push(win)
    losers.push(win === ko.teams[s * 2] ? ko.teams[s * 2 + 1] : ko.teams[s * 2])
  }
  comp.placings ??= {}
  for (const l of losers) comp.placings[l] ??= ko.name
  if (!next) {
    comp.done = true
    comp.winner = winners[0]
    comp.placings[winners[0]] = 'Winners'
    if (losers.length === 1) comp.placings[losers[0]] = 'Runners-up'
    return true
  }
  next.teams = winners
  comp.cur = si + 1
  makeKoFixtures(w, comp, si + 1)
  if (next.thirdPlace != null && losers.length === 2)
    addFixture(w, { day: next.thirdPlace, compId: comp.id, stage: si + 1, slot: 99, round: 0, home: losers[0], away: losers[1], neutral: true })
  return true
}

export const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`

export function koDays(start: Day, gaps: number[]): Day[] {
  const out = [start]
  for (const g of gaps) out.push(out[out.length - 1] + g)
  return out
}
