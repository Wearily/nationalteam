// Who takes the shots? Reports the lone striker's share and how often one player runs riot.
import { Rng } from '../src/sim/core/rng'
import { MatchSim } from '../src/sim/match/engine'
import { synthTeam } from './calibrate'

export function shotShare(gap: number, n = 300, formation = '4-3-3') {
  const rng = new Rng(7)
  let goals = 0, big = 0, hat = 0, five = 0, stG = 0, stS = 0, shots = 0, r95 = 0, all = 0
  const byPos: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const h = synthTeam(rng, 'H', 70 + gap, formation), a = synthTeam(rng, 'A', 70, '4-2-3-1', 100)
    const m = new MatchSim(h, a, { seed: rng.int(1, 1e9), neutral: true, knockout: false, subs: 5, importance: 0.7, record: false }).run()
    goals += m.score[0]; all += m.score[0] + m.score[1]
    if (m.score[0] >= 5) big++
    const top = Math.max(...m.ps[0].map((p) => p.goals))
    if (top >= 3) hat++
    if (top >= 5) five++
    stG += m.ps[0][10].goals; stS += m.ps[0][10].shots; shots += m.ts[0].shots
    if (m.ps[0].some((p) => p.rating >= 9.5)) r95++
    m.ps[0].forEach((p, k) => { if (k < 11) byPos[h.players[k].pos[0]] = (byPos[h.players[k].pos[0]] ?? 0) + p.shots })
  }
  return { gap, teamGoals: goals / n, matchGoals: all / n, shots: shots / n, big: big / n, hat: hat / n, five: five / n, stShots: stS / shots, stGoals: stG / Math.max(1, goals), r95: r95 / n, byPos: Object.fromEntries(Object.entries(byPos).map(([k, v]) => [k, Math.round((v / shots) * 100)])) }
}

if (process.argv[1]?.endsWith('shotshare.ts')) {
  const pc = (x: number) => `${Math.round(x * 100)}%`
  for (const gap of [0, 12, 18]) {
    const r = shotShare(gap)
    console.log(`gap ${gap}: match goals ${r.matchGoals.toFixed(2)}, team shots ${r.shots.toFixed(1)} | striker ${pc(r.stShots)} of shots [25-40], ${pc(r.stGoals)} of goals [30-45] | hat-trick ${pc(r.hat)}, 5+ by one ${pc(r.five)}, 9.5+ rating ${pc(r.r95)} | shots by position ${JSON.stringify(r.byPos)}`)
  }
}
