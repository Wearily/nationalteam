import type { Fixture } from '../world/types'
import type { World } from '../world/state'

/**
 * FIFA "SUM" ranking update (in use since 2018): P = Pbefore + I × (W − We),
 * We = 1 / (10^(−dr/600) + 1). Knockout-round losers do not lose points;
 * a shootout win counts 0.75 and a shootout loss 0.5.
 */
export function applyRanking(w: World, f: Fixture, I: number, knockout: boolean) {
  const hc = f.home.split(':')[1]
  const ac = f.away.split(':')[1]
  const h = w.nations[hc]
  const a = w.nations[ac]
  if (!h || !a || I <= 0) return
  const dr = h.points - a.points
  const weH = 1 / (Math.pow(10, -dr / 600) + 1)
  let wH: number
  if (f.hg > f.ag) wH = 1
  else if (f.hg < f.ag) wH = 0
  else if (f.pens) wH = f.pens[0] > f.pens[1] ? 0.75 : 0.5
  else wH = 0.5
  const wA = f.pens && f.hg === f.ag ? (f.pens[1] > f.pens[0] ? 0.75 : 0.5) : 1 - wH
  let dH = I * (wH - weH)
  let dA = I * (wA - (1 - weH))
  if (knockout) { dH = Math.max(0, dH); dA = Math.max(0, dA) }
  h.points = Math.round((h.points + dH) * 100) / 100
  a.points = Math.round((a.points + dA) * 100) / 100
}

export function rerank(w: World) {
  const all = Object.values(w.nations).sort((x, y) => y.points - x.points)
  all.forEach((n, i) => { n.prevRank = n.rank; n.rank = i + 1 })
}
