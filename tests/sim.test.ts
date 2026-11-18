import { describe, expect, it } from 'vitest'
import { roundRobin, table } from '../src/sim/comps/engine'
import { Rng } from '../src/sim/core/rng'
import { Game } from '../src/sim/game'
import { applyRanking } from '../src/sim/intl/ranking'
import { MatchSim } from '../src/sim/match/engine'
import { generateAttrs, overallAt, POS_LIST } from '../src/sim/ratings/attributes'
import type { Fixture } from '../src/sim/world/types'
import { synthTeam } from '../tools/calibrate'
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

describe('career', () => {
  it('runs 500 days headless, completes the Asian Cup, and survives a save round-trip', () => {
    const g = Game.create(synthRaw(), 42, 'Test')
    for (const t of Object.values(g.w.teams)) t.control = 'auto'
    let n = 0
    while (n < 500) n += g.advance(500 - n).days || 1
    const ac = g.w.comps.find((c) => c.key.startsWith('afc-asian-cup'))!
    expect(ac.done).toBe(true)
    expect(ac.winner).toBeTruthy()
    const copy = new Game(JSON.parse(JSON.stringify(g.w)))
    expect(copy.advance(30).days).toBeGreaterThan(0)
  }, 60000)
})
