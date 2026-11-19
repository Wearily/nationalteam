import { describe, expect, it } from 'vitest'
import { roundRobin, table } from '../src/sim/comps/engine'
import { Rng } from '../src/sim/core/rng'
import { Game } from '../src/sim/game'
import { applyRanking } from '../src/sim/intl/ranking'
import { MatchSim } from '../src/sim/match/engine'
import { generateAttrs, overallAt, POS_LIST } from '../src/sim/ratings/attributes'
import type { Fixture } from '../src/sim/world/types'
import { synthTeam } from '../tools/calibrate'
import { shotShare } from '../tools/shotshare'
import { synthRaw } from '../tools/synthRaw'

const fx = (home: string, away: string, hg: number, ag: number): Fixture => ({ id: 0, day: 0, compId: 0, stage: 0, home, away, played: true, hg, ag })

describe('competition engine', () => {
  it('round robin: everyone meets once per leg, nobody plays twice in a round', () => {
    for (const n of [4, 5, 16, 18]) {
      const rounds = roundRobin(n, 2)
      const seen = new Map<string, number>()
      for (const r of rounds) {
        const busy = new Set<number>()
        for (const [a, b] of r) { expect(busy.has(a) || busy.has(b)).toBe(false); busy.add(a); busy.add(b); seen.set(`${a}-${b}`, (seen.get(`${a}-${b}`) ?? 0) + 1) }
      }
      expect(seen.size).toBe(n * (n - 1))
      expect([...seen.values()].every((v) => v === 1)).toBe(true)
    }
  })
  it('head-to-head tiebreak outranks overall goal difference', () => {
    const t = ['A', 'B', 'C', 'D']
    const games = [fx('A', 'B', 0, 1), fx('A', 'C', 5, 0), fx('A', 'D', 5, 0), fx('B', 'C', 1, 0), fx('B', 'D', 0, 1), fx('C', 'D', 0, 0)]
    // A and B both have 6 points; A has the better goal difference, B won the meeting
    expect(table(t, games, 'gd')[0].team).toBe('A')
    expect(table(t, games, 'h2h')[0].team).toBe('B')
  })
})

describe('FIFA ranking formula', () => {
  it('matches the published worked example shape: equal teams, qualifier win = +12.5', () => {
    const w = { nations: { AAA: { points: 1500 }, BBB: { points: 1500 } } } as never
    applyRanking(w, fx('n:AAA:senior', 'n:BBB:senior', 2, 0), 25, false)
    expect((w as { nations: Record<string, { points: number }> }).nations.AAA.points).toBeCloseTo(1512.5)
    expect((w as { nations: Record<string, { points: number }> }).nations.BBB.points).toBeCloseTo(1487.5)
  })
  it('knockout losers do not lose points', () => {
    const w = { nations: { AAA: { points: 1600 }, BBB: { points: 1400 } } } as never
    applyRanking(w, fx('n:AAA:senior', 'n:BBB:senior', 0, 1), 50, true)
    expect((w as { nations: Record<string, { points: number }> }).nations.AAA.points).toBe(1600)
  })
})

describe('ratings', () => {
  it('generated attributes hit the requested overall', () => {
    const rng = new Rng(3)
    for (const pos of POS_LIST) for (const target of [48, 63, 77, 88]) expect(overallAt(generateAttrs(rng, pos, target, 25), pos)).toBe(target)
  })
})

describe('match engine', () => {
  it('is deterministic for a seed and produces consistent totals', () => {
    const play = () => {
      const rng = new Rng(11)
      const m = new MatchSim(synthTeam(rng, 'H', 74), synthTeam(rng, 'A', 70, '4-2-3-1', 100), { seed: 99, neutral: true, knockout: true, subs: 5, importance: 1, record: true }).run()
      return m
    }
    const a = play()
    const b = play()
    expect(a.score).toEqual(b.score)
    expect(a.events.length).toBe(b.events.length)
    for (const t of [0, 1] as const) {
      expect(a.shots.filter((s) => s.team === t).length).toBe(a.ts[t].shots)
      expect(a.shots.filter((s) => s.team === t && s.out === 'goal').length).toBe(a.score[t])
      expect(a.ps[t].reduce((x, p) => x + p.goals, 0)).toBe(a.score[t])
    }
    expect(a.done).toBe(true)
    expect(a.score[0] !== a.score[1] || !!a.pens).toBe(true)
  })
})

describe('match engine balance', () => {
  it('spreads shots and goals around the team instead of funnelling them to the striker', () => {
    const r = shotShare(0, 150)
    expect(r.stShots).toBeGreaterThan(0.2)
    expect(r.stShots).toBeLessThan(0.45)
    expect(r.stGoals).toBeLessThan(0.52)
    expect(r.hat).toBeLessThan(0.08)
    expect(r.five).toBeLessThan(0.02)
    expect(r.matchGoals).toBeGreaterThan(2.1)
    expect(r.matchGoals).toBeLessThan(3.2)
  })
})

describe('live match lineup', () => {
  it('keeps eleven different players on the pitch when the user changes things after the coach has made substitutions', () => {
    const g = Game.create(synthRaw(), 21, 'T', {}, null)
    for (const t of Object.values(g.w.teams)) t.control = 'auto'
    g.w.teams.senior.control = 'manual'
    let r = g.advance(400)
    while (r.stop !== 'match') {
      if (r.stop === 'squad') g.announceSquad('senior', g.suggestSquad('senior', g.w.camps.find((c) => c.id === r.campId)!.size), false)
      r = g.advance(400)
    }
    const f = g.w.fixtures.find((x) => x.id === r.fixtureId)!
    const side = f.home.startsWith('n:IRN') ? 0 : 1
    let ch = g.liveStart(f.id)
    if (typeof ch === 'string') throw new Error(ch)
    g.liveCoach(true)
    while (!ch.snap.done && ch.snap.subsLeft[side] > 2) ch = g.liveStep(50)
    g.liveCoach(false)
    // the screen sends back the lineup it was given, with two players swapped and a new shape
    const tac = { ...ch.snap.tactics[side], lineup: [...ch.snap.tactics[side].lineup], formation: '4-4-2' }
    ;[tac.lineup[2], tac.lineup[7]] = [tac.lineup[7], tac.lineup[2]]
    g.liveTactic(tac)
    ch = g.liveStep(10)
    const reds = ch.snap.players[side].filter((p) => p.red).length
    const on = ch.snap.on[side].filter((i) => i >= 0)
    expect(new Set(on).size).toBe(on.length)
    expect(on.length).toBeGreaterThanOrEqual(10 - reds)
    const rid = g.liveFinish()
    const rep = g.w.reports.find((x) => x.id === rid)!
    expect(new Set(rep.lineups[side]).size).toBe(11)
    for (const id of rep.lineups[side]) expect(rep.players[side].some((p) => p.id === id && p.played && !p.subOn)).toBe(true)
  })
})

describe('career', () => {
  it('runs 500 days headless, completes the Asian Cup, and survives a save round-trip', () => {
    const g = Game.create(synthRaw(), 42, 'Test')
    for (const t of Object.values(g.w.teams)) t.control = 'auto'
    let n = 0
    while (n < 500) n += g.advance(500 - n).days || 1
    const ac = g.w.comps.find((c) => c.key.startsWith('afc-asian-cup'))!
    expect(ac.done).toBe(true)
    expect(ac.winner).toBeTruthy()
    // the Asian age-group cups feed the world tournaments
    for (const key of ['fifa-u20:2027', 'fifa-u17:2027']) {
      const c = g.w.comps.find((x) => x.key === key)!
      expect(c, key).toBeTruthy()
      expect(c.done, key).toBe(true)
      expect(c.winner, key).toBeTruthy()
    }
    const copy = new Game(JSON.parse(JSON.stringify(g.w)))
    expect(copy.advance(30).days).toBeGreaterThan(0)
  }, 60000)
})
