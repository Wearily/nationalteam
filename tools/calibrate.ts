import { Rng } from '../src/sim/core/rng'
import { generateAttrs } from '../src/sim/ratings/attributes'
import { MatchSim } from '../src/sim/match/engine'
import { emptyTactic, FORMATIONS } from '../src/sim/match/tactics'
import type { MTeam } from '../src/sim/match/types'

export function synthTeam(rng: Rng, name: string, level: number, formation = '4-3-3', idBase = 0, mods: Partial<ReturnType<typeof emptyTactic>> = {}): MTeam {
  const tac = { ...emptyTactic(formation), ...mods }
  const players = [] as MTeam['players']
  const slots = FORMATIONS[formation]
  const mk = (pos: (typeof slots)[number]['pos'], i: number) => {
    const ovr = Math.round(level + rng.normal(0, 2.5))
    players.push({ id: idBase + i, name: `${name} ${i}`, short: `${name}${i}`, num: i + 1, pos: [pos], attrs: generateAttrs(rng, pos, ovr, 26), cond: 96, form: 0, consistency: 12, bigMatch: 10, injuryProne: 8 })
  }
  slots.forEach((s, i) => mk(s.pos, i))
  ;(['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'CM', 'RW', 'LW', 'ST', 'ST', 'AM'] as const).forEach((p, i) => mk(p, 11 + i))
  players.slice(11).forEach((p) => (p.attrs = p.attrs.map((a) => Math.max(5, a - 3))))
  tac.lineup = players.slice(0, 11).map((p) => p.id)
  tac.bench = players.slice(11).map((p) => p.id)
  return { ref: name, name, short: name, colors: ['#fff', '#000'], tactic: tac, players, ai: true }
}

if (process.argv[1]?.endsWith('calibrate.ts')) {
  const N = +(process.argv[2] ?? 300)
  const gap = +(process.argv[3] ?? 0)
  const rng = new Rng(7)
  const acc: Record<string, number> = {}
  const add = (k: string, v: number) => (acc[k] = (acc[k] ?? 0) + v)
  let hw = 0, d = 0, aw = 0, steps = 0
  const t0 = Date.now()
  const scores: Record<string, number> = {}
  for (let i = 0; i < N; i++) {
    const h = synthTeam(rng, 'H', 72 + gap, '4-3-3', 0)
    const a = synthTeam(rng, 'A', 72, '4-2-3-1', 100)
    const m = new MatchSim(h, a, { seed: rng.int(1, 1e9), neutral: gap !== 0, knockout: false, subs: 5, importance: 0.5, record: false })
    let g = 0
    while (!m.done && g++ < 20000) { m.step(); steps++ }
    for (const t of [0, 1]) {
      const s = m.ts[t]
      add('goals', s.goals); add('shots', s.shots); add('sot', s.sot); add('xg', s.xg); add('passes', s.passes); add('passC', s.passesC)
      add('corners', s.corners); add('fouls', s.fouls); add('offsides', s.offsides); add('yellows', s.yellows); add('reds', s.reds); add('tackles', s.tackles)
      add('big', s.bigChances)
      const rs = m.ps[t].filter((p) => p.played && p.mins > 30).map((p) => p.rating)
      add('rating', rs.reduce((x, y) => x + y, 0) / rs.length)
      add('ratingMax', Math.max(...rs)); add('ratingMin', Math.min(...rs))
    }
    add('possH', m.ts[0].possession)
    add('inj', m.injured.length)
    if (m.score[0] > m.score[1]) hw++; else if (m.score[0] < m.score[1]) aw++; else d++
    const k = `${m.score[0]}-${m.score[1]}`; scores[k] = (scores[k] ?? 0) + 1
  }
  const per = (k: string) => (acc[k] / N).toFixed(2)
  console.log(`matches ${N}  ms/match ${((Date.now() - t0) / N).toFixed(1)}  steps/match ${(steps / N).toFixed(0)}`)
  console.log(`per match (both teams): goals ${per('goals')} [2.4-2.9]  shots ${per('shots')} [22-28]  SoT ${per('sot')} [7.5-10]  xG ${per('xg')}  big ${per('big')}`)
  console.log(`passes ${per('passes')} [800-1000]  acc ${((acc.passC / acc.passes) * 100).toFixed(1)}% [78-86]  corners ${per('corners')} [9-11]  fouls ${per('fouls')} [20-26]  offsides ${per('offsides')} [3-5]`)
  console.log(`yellows ${per('yellows')} [3.2-4.6]  reds ${per('reds')} [0.1-0.25]  tackles won ${per('tackles')}  injuries ${per('inj')}  possH ${per('possH')}`)
  console.log(`H ${(hw / N * 100).toFixed(0)}%  D ${(d / N * 100).toFixed(0)}%  A ${(aw / N * 100).toFixed(0)}%   avg rating ${(acc.rating / N / 2).toFixed(2)} max ${(acc.ratingMax / N / 2).toFixed(2)} min ${(acc.ratingMin / N / 2).toFixed(2)}`)
  console.log(Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(' '))
  void import('./shotshare').then(({ shotShare }) => {
    const pc = (x: number) => `${Math.round(x * 100)}%`
    for (const gap of [0, 12]) {
      const r = shotShare(gap, Math.min(N, 300))
      console.log(`gap ${gap}: striker ${pc(r.stShots)} of shots [25-40], ${pc(r.stGoals)} of goals [30-45]  hat-trick ${pc(r.hat)}${gap ? '' : ' [<3]'}  5+ by one ${pc(r.five)} [<1]  9.5+ rating ${pc(r.r95)}${gap ? '' : ' [<8]'}`)
    }
  })
}
