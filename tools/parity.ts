// Do the different ways a match gets decided agree? Full engine (run in one go, stepped like the live viewer,
// user side skipped without a coach) against the quick-result model used for club and age-group matches.
import { Rng } from '../src/sim/core/rng'
import { expectedGoals } from '../src/sim/match/quick'
import { MatchSim } from '../src/sim/match/engine'
import { synthTeam } from './calibrate'

export interface Line { gf: number; ga: number; w: number; d: number; l: number }
const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4)
const show = (name: string, r: Line) => `${name.padEnd(26)} ${r.gf.toFixed(2)}-${r.ga.toFixed(2)}  W${pct(r.w)} D${pct(r.d)} L${pct(r.l)}`

export function engineLine(gap: number, neutral: boolean, n: number, mode: 'run' | 'stepped' | 'skipped' = 'run', seed = 11): Line & { subs: number; rating: number; r85: number; assisted: number; yellows: number } {
  const rng = new Rng(seed)
  let gf = 0, ga = 0, w = 0, d = 0, subs = 0, rs = 0, rn = 0, r85 = 0, ast = 0, yel = 0
  for (let i = 0; i < n; i++) {
    const h = synthTeam(rng, 'H', 72 + gap / 2, '4-3-3', 0), a = synthTeam(rng, 'A', 72 - gap / 2, '4-3-3', 100)
    if (mode === 'skipped') h.ai = false
    const m = new MatchSim(h, a, { seed: rng.int(1, 1e9), neutral, knockout: false, subs: 5, importance: 0.6, record: mode === 'stepped' })
    if (mode === 'stepped') while (!m.done) for (let k = 0; k < 17 && !m.done; k++) m.step()
    else m.run()
    gf += m.score[0]; ga += m.score[1]
    if (m.score[0] > m.score[1]) w++; else if (m.score[0] === m.score[1]) d++
    subs += m.ps[0].filter((p) => p.subOn).length
    for (const p of m.ps[0]) if (p.played && p.mins > 30) { rs += p.rating; rn++; if (p.rating >= 8.5) r85++ }
    ast += m.ps[0].reduce((s, p) => s + p.assists, 0); yel += m.ts[0].yellows
  }
  return { gf: gf / n, ga: ga / n, w: w / n, d: d / n, l: 1 - (w + d) / n, subs: subs / n, rating: rs / rn, r85: r85 / rn, assisted: ast / Math.max(1, gf), yellows: yel / n }
}

export function quickLine(gap: number, neutral: boolean, n: number, seed = 5): Line {
  const rng = new Rng(seed)
  let gf = 0, ga = 0, w = 0, d = 0
  const [lh, la] = expectedGoals(gap, neutral)
  for (let i = 0; i < n; i++) {
    const h = rng.poisson(lh), a = rng.poisson(la)
    gf += h; ga += a
    if (h > a) w++; else if (h === a) d++
  }
  return { gf: gf / n, ga: ga / n, w: w / n, d: d / n, l: 1 - (w + d) / n }
}

if (process.argv[1]?.endsWith('parity.ts')) {
  const N = +(process.argv[2] ?? 300)
  for (const neutral of [false, true]) {
    console.log(neutral ? '\n— neutral ground —' : '— home v away —')
    for (const gap of [0, 4, 8, 12, 18]) {
      const e = engineLine(gap, neutral, N)
      console.log(`gap ${String(gap).padStart(2)}  ${show('engine', e)}   |  ${show('quick result', quickLine(gap, neutral, 20000))}`)
    }
  }
  const run = engineLine(0, false, N), st = engineLine(0, false, N, 'stepped'), sk = engineLine(0, false, N, 'skipped')
  console.log('\n— same engine, different ways of playing it (even teams, home) —')
  console.log(show('simulated in one go', run), ` subs ${run.subs.toFixed(1)}`)
  console.log(show('stepped with recording', st), ` subs ${st.subs.toFixed(1)}`)
  console.log(show('user side, nobody managing', sk), ` subs ${sk.subs.toFixed(1)}`)
  console.log(`\nengine player ratings: mean ${run.rating.toFixed(2)}, 8.5+ ${(run.r85 * 100).toFixed(1)}% of appearances, assisted goals ${pct(run.assisted)}, yellows per team ${run.yellows.toFixed(2)}`)
}
