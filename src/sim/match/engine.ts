import { Rng, clamp } from '../core/rng'
import { A, positionPenalty } from '../ratings/attributes'
import { FORMATIONS, ROLE, type RoleDef, type Slot, type Tactic } from './tactics'
import type { EvType, Frame, MatchOpts, MatchSnapshot, MEvent, MPlayer, MTeam, PStats, ShotRec, TStats } from './types'

const PL = 105
const PW = 68
const GOAL_Y = PW / 2
const sig = (x: number) => 1 / (1 + Math.exp(-x))

const newP = (id: number): PStats => ({
  id, mins: 0, touches: 0, passes: 0, passesC: 0, keyPasses: 0, shots: 0, sot: 0, goals: 0, assists: 0, xg: 0, xa: 0,
  dribbles: 0, dribblesWon: 0, tackles: 0, tacklesWon: 0, interceptions: 0, clearances: 0, aerials: 0, aerialsWon: 0,
  fouls: 0, fouled: 0, saves: 0, yellow: 0, red: 0, offsides: 0, lost: 0, conceded: 0, rating: 5.9, heat: new Array(96).fill(0),
  on: false, played: false,
})
const newT = (): TStats => ({
  goals: 0, possession: 0, shots: 0, sot: 0, xg: 0, passes: 0, passesC: 0, corners: 0, fouls: 0, offsides: 0, yellows: 0,
  reds: 0, tackles: 0, saves: 0, bigChances: 0,
})

/** Expected goals from location. Distances in metres, measured to the centre of the goal attacked. */
export function xgModel(dist: number, offCentre: number, pressure: number, header: boolean): number {
  const dx2 = Math.max(0.25, dist * dist - offCentre * offCentre)
  const theta = Math.atan2(7.32 * Math.sqrt(dx2), Math.max(0.1, dist * dist - 3.66 * 3.66))
  let xg = sig(-1.86 - 0.1 * dist + 1.7 * Math.min(theta, 1.6))
  // headers are harder, but a marker matters less to a header than to a shot along the ground
  if (header) xg *= 0.78
  xg *= 1 - (header ? 0.2 : 0.4) * pressure
  return clamp(xg, 0.01, 0.92)
}

const threat = (nx: number, ny: number) => {
  const dx = (1 - nx) * PL
  const dy = (ny - 0.5) * PW
  return 0.42 * Math.exp(-Math.sqrt(dx * dx + dy * dy) / 11) + 0.012 * nx
}

/** Minutes at which a coach reviews substitutions and approach. */
const SUB_MARKS = [58, 68, 76, 84, 96, 106]

type Restart = 'kickoff' | 'goalkick' | 'corner' | 'freekick' | 'throw' | 'penalty' | null

const LONG = 0.12
export class MatchSim {
  teams: [MTeam, MTeam]
  opts: MatchOpts
  rng: Rng
  /** [team][slot] → index into team.players, or -1 (sent off / empty). */
  on: [number[], number[]]
  slots: [Slot[], Slot[]]
  roles: [RoleDef[], RoleDef[]]
  px = new Float32Array(22)
  py = new Float32Array(22)
  energy: [number[], number[]]
  ps: [PStats[], PStats[]]
  ts: [TStats, TStats] = [newT(), newT()]
  score: [number, number] = [0, 0]
  pens?: [number, number]
  period = 1
  /** Seconds elapsed in the current period. */
  pt = 0
  added = 0
  deadTime = 0
  /** Total seconds simulated (for frames). */
  clock = 0
  poss: 0 | 1 = 0
  /** Slot of the ball carrier within the possessing team. */
  carrier = 10
  bx = PL / 2
  by = PW / 2
  restart: Restart = 'kickoff'
  lastPasser = -1
  lastPassXg = 0
  done = false
  frames: Frame[] = []
  events: MEvent[] = []
  shots: ShotRec[] = []
  momentum: number[] = []
  subsUsed: [number, number] = [0, 0]
  boost: [number, number] = [1, 1]
  possTime: [number, number] = [0, 0]
  private dayBoost: [number[], number[]]
  private aiSubMarks: [number, number] = [0, 0]
  private yellowed: [Set<number>, Set<number>] = [new Set(), new Set()]
  private mustSub: [number[], number[]] = [[], []]

  constructor(home: MTeam, away: MTeam, opts: MatchOpts) {
    this.teams = [home, away]
    this.opts = opts
    this.rng = new Rng(opts.seed)
    this.on = [[], []]
    this.slots = [FORMATIONS[home.tactic.formation], FORMATIONS[away.tactic.formation]]
    this.roles = [[], []]
    this.energy = [home.players.map((p) => p.cond), away.players.map((p) => p.cond)]
    this.ps = [home.players.map((p) => newP(p.id)), away.players.map((p) => newP(p.id))]
    this.dayBoost = [[], []]
    this.startXI = [[...home.tactic.lineup], [...away.tactic.lineup]]
    this.startFormation = [home.tactic.formation, away.tactic.formation]
    for (const t of [0, 1] as const) {
      const team = this.teams[t]
      this.on[t] = team.tactic.lineup.map((id) => team.players.findIndex((p) => p.id === id))
      this.applyTactic(t)
      this.on[t].forEach((pi, slot) => {
        if (pi >= 0) { this.ps[t][pi].on = true; this.ps[t][pi].played = true; this.ps[t][pi].pos = this.slots[t][slot].pos }
      })
      // each player has a slightly good or bad day, driven by consistency, form and occasion
      this.dayBoost[t] = team.players.map((p) => {
        const spread = 0.095 - p.consistency * 0.003
        const big = (p.bigMatch - 10) * 0.004 * opts.importance
        return 1 + this.rng.normal(0, spread) + p.form * 0.03 + big
      })
    }
    this.boost = opts.neutral ? [1, 1] : [1.009, 0.996]
    this.poss = this.rng.chance(0.5) ? 0 : 1
    this.resetShape()
  }

  // ───────────────────────── helpers ─────────────────────────
  private applyTactic(t: 0 | 1) {
    const tac = this.teams[t].tactic
    this.slots[t] = FORMATIONS[tac.formation]
    this.roles[t] = tac.roles.map((r, i) => ROLE[r] ?? ROLE[Object.keys(ROLE).find((k) => ROLE[k].for.includes(this.slots[t][i].pos))!])
  }
  private gi = (t: number, s: number) => t * 11 + s
  private pl(t: 0 | 1, s: number): MPlayer | null {
    const i = this.on[t][s]
    return i >= 0 ? this.teams[t].players[i] : null
  }
  private st(t: 0 | 1, s: number): PStats { return this.ps[t][this.on[t][s]] }
  /** Effective attribute: fatigue, home edge, day form and out-of-position penalty applied. */
  private at(t: 0 | 1, s: number, a: number): number {
    const i = this.on[t][s]
    if (i < 0) return 1
    const p = this.teams[t].players[i]
    const pen = positionPenalty(p.pos, this.slots[t][s].pos)
    const e = this.energy[t][i]
    return Math.max(1, (p.attrs[a] - pen * 0.9) * (0.8 + 0.2 * (e / 100)) * this.boost[t] * this.dayBoost[t][i])
  }
  private nx(t: number, x: number) { return t === 0 ? x / PL : 1 - x / PL }
  private ny(t: number, y: number) { return t === 0 ? y / PW : 1 - y / PW }
  private wx(t: number, nx: number) { return t === 0 ? nx * PL : (1 - nx) * PL }
  private wy(t: number, ny: number) { return t === 0 ? ny * PW : (1 - ny) * PW }
  private dist(a: number, b: number) { return Math.hypot(this.px[a] - this.px[b], this.py[a] - this.py[b]) }
  private nearestOpp(t: 0 | 1, x: number, y: number, skipGk = false): { s: number; d: number } {
    const o = (1 - t) as 0 | 1
    let best = -1
    let bd = 1e9
    for (let s = skipGk ? 1 : 0; s < 11; s++) {
      if (this.on[o][s] < 0) continue
      const g = this.gi(o, s)
      const d = Math.hypot(this.px[g] - x, this.py[g] - y)
      if (d < bd) { bd = d; best = s }
    }
    return { s: best, d: bd }
  }
  private minute(): { min: number; plus: number } {
    const base = [0, 45, 90, 105][this.period - 1]
    const len = this.period <= 2 ? 45 : 15
    const m = Math.floor(this.pt / 60)
    return m >= len ? { min: base + len, plus: m - len + 1 } : { min: base + m + 1, plus: 0 }
  }
  private ev(type: EvType, team: 0 | 1, text: string, extra: Partial<MEvent> = {}) {
    const { min, plus } = this.minute()
    this.events.push({ min, plus, type, team, text, f: this.frames.length, ...extra })
  }
  private name(t: 0 | 1, s: number) { return this.pl(t, s)?.short ?? '' }
  private rate(t: 0 | 1, s: number, d: number) {
    const i = this.on[t][s]
    if (i >= 0) this.ps[t][i].rating = clamp(this.ps[t][i].rating + d, 3, 10)
  }
  private touch(t: 0 | 1, s: number) {
    const i = this.on[t][s]
    if (i < 0) return
    const st = this.ps[t][i]
    st.touches++
    const g = this.gi(t, s)
    const cx = clamp(Math.floor(this.nx(t, this.px[g]) * 12), 0, 11)
    const cy = clamp(Math.floor(this.ny(t, this.py[g]) * 8), 0, 7)
    st.heat[cy * 12 + cx]++
  }
  private mom(t: 0 | 1, v: number) {
    const { min } = this.minute()
    while (this.momentum.length < min) this.momentum.push(0)
    this.momentum[min - 1] += t === 0 ? v : -v
  }
  private tick(dt: number, dead = false) {
    this.pt += dt
    this.clock += dt
    if (dead) this.deadTime += dt
    else this.possTime[this.poss] += dt
    for (const t of [0, 1] as const) {
      const tac = this.teams[t].tactic
      for (let s = 0; s < 11; s++) {
        const i = this.on[t][s]
        if (i < 0) continue
        const p = this.teams[t].players[i]
        const work = s === 0 ? 0.25 : 0.7 + 0.6 * (p.attrs[A.workRate] / 99)
        const drain = 0.0044 * dt * work * (0.75 + 0.55 * (tac.pressing / 100) + 0.15 * (tac.tempo / 100)) * (1.3 - p.attrs[A.stamina] / 180)
        this.energy[t][i] = Math.max(20, this.energy[t][i] - (dead ? drain * 0.3 : drain))
        this.ps[t][i].mins += dt / 60
      }
    }
  }
  private frame(c = -1) {
    if (!this.opts.record) return
    const p = new Array(44)
    for (let i = 0; i < 22; i++) {
      const t = i < 11 ? 0 : 1
      const off = this.on[t][i % 11] < 0
      p[i * 2] = off ? -1 : Math.round(this.px[i] * 10) / 10
      p[i * 2 + 1] = off ? -1 : Math.round(this.py[i] * 10) / 10
    }
    this.frames.push({ t: Math.round(this.clock * 10) / 10, b: [Math.round(this.bx * 10) / 10, Math.round(this.by * 10) / 10], p, pos: this.poss, c })
  }

  // ───────────────────────── shape & movement ─────────────────────────
  private target(t: 0 | 1, s: number): [number, number] {
    const tac = this.teams[t].tactic
    const sl = this.slots[t][s]
    const role = this.roles[t][s]
    const bnx = this.nx(t, this.bx)
    const bny = this.ny(t, this.by)
    const inPoss = this.poss === t
    const ment = tac.mentality / 100
    let x: number
    let y: number
    if (s === 0) {
      x = 0.035 + (inPoss ? 0.05 * bnx + role.fwd / 400 : 0.02 * bnx)
      y = 0.5 + (bny - 0.5) * 0.12
    } else if (inPoss) {
      x = sl.x * (0.58 + 0.2 * ment) + bnx * 0.4 + role.fwd / PL + 0.02
      const w = 0.72 + 0.5 * (tac.width / 100)
      y = 0.5 + (sl.y - 0.5) * w + (bny - 0.5) * 0.2
      if (role.inside) y += (0.5 - y) * clamp((role.inside / 34) * (0.4 + bnx), -0.3, 0.8)
      // in the final third the supporting cast arrives as well: wingers attack the far post, attacking
      // midfielders and runners from midfield get into and around the box, while the striker holds his line
      if (bnx > 0.6) {
        const push = (bnx - 0.6) * 2.5 // 0 at the edge of the final third, 1 near the byline
        if (sl.pos === 'ST') x += 0.03
        else if (sl.pos === 'RW' || sl.pos === 'LW') { x += 0.07 + 0.07 * push; y += (0.5 - y) * 0.45 * push * (Math.abs(bny - sl.y) > 0.4 ? 1.4 : 0.7) }
        else if (sl.pos === 'AM') x += 0.08 + 0.06 * push
        else if (sl.pos === 'CM') x += (0.035 + 0.05 * push) * (0.6 + ment * 0.8) * (role.fwd > 3 ? 1.5 : role.fwd < 0 ? 0.4 : 1)
      }
    } else {
      const line = tac.line / 100
      x = sl.x * (0.5 + 0.22 * line) + bnx * 0.36 - 0.03
      y = 0.5 + (sl.y - 0.5) * 0.66 + (bny - 0.5) * 0.36
    }
    return [clamp(x, 0.02, 0.97), clamp(y, 0.03, 0.97)]
  }
  private move(dt: number) {
    // offside lines: attackers hold on the second-last defender unless the ball is already ahead
    const lineX: [number, number] = [0, 0]
    for (const t of [0, 1] as const) {
      const o = (1 - t) as 0 | 1
      let deepest = 0.5
      for (let s = 1; s < 11; s++) if (this.on[o][s] >= 0) deepest = Math.max(deepest, 1 - this.nx(o, this.px[this.gi(o, s)]))
      lineX[t] = Math.max(deepest, this.nx(t, this.bx))
    }
    for (const t of [0, 1] as const) {
      const inPoss = this.poss === t
      const tac = this.teams[t].tactic
      // closest outfielders press the ball when defending
      const pressers: number[] = []
      if (!inPoss) {
        const n = 1 + Math.round(tac.pressing / 50)
        const order = []
        for (let s = 1; s < 11; s++) if (this.on[t][s] >= 0) order.push([Math.hypot(this.px[this.gi(t, s)] - this.bx, this.py[this.gi(t, s)] - this.by), s])
        order.sort((a, b) => a[0] - b[0])
        for (let k = 0; k < n && k < order.length; k++) if (order[k][0] < 12 + tac.pressing * 0.22) pressers.push(order[k][1])
      }
      for (let s = 0; s < 11; s++) {
        if (this.on[t][s] < 0) continue
        const g = this.gi(t, s)
        if (inPoss && s === this.carrier) continue
        let [tx, ty] = this.target(t, s)
        if (inPoss && s > 0) tx = Math.min(tx, lineX[t] + 0.005)
        let wx = this.wx(t, tx)
        let wy = this.wy(t, ty)
        if (pressers.includes(s)) {
          const k = pressers.indexOf(s) === 0 ? 0.85 : 0.5
          wx += (this.bx - wx) * k
          wy += (this.by - wy) * k
        }
        const dx = wx - this.px[g]
        const dy = wy - this.py[g]
        const d = Math.hypot(dx, dy)
        const sp = (3.2 + 4.3 * (this.at(t, s, A.pace) / 99)) * dt
        const k = d > sp ? sp / d : 1
        this.px[g] += dx * k + this.rng.normal(0, 0.25)
        this.py[g] += dy * k + this.rng.normal(0, 0.25)
      }
    }
  }
  private resetShape() {
    for (const t of [0, 1] as const)
      for (let s = 0; s < 11; s++) {
        const sl = this.slots[t][s]
        const g = this.gi(t, s)
        this.px[g] = this.wx(t, Math.min(0.48, sl.x * 0.6))
        this.py[g] = this.wy(t, sl.y)
      }
  }
  private setCarrier(t: 0 | 1, s: number) {
    if (this.on[t][s] < 0) s = this.firstOn(t)
    this.poss = t
    this.carrier = s
    const g = this.gi(t, s)
    this.bx = this.px[g]
    this.by = this.py[g]
    this.touch(t, s)
  }
  private firstOn(t: 0 | 1, from = 1) {
    for (let s = from; s < 11; s++) if (this.on[t][s] >= 0) return s
    return 0
  }
  private closest(t: 0 | 1, x: number, y: number, skipGk = true, skip = -1) {
    let best = this.firstOn(t)
    let bd = 1e9
    for (let s = skipGk ? 1 : 0; s < 11; s++) {
      if (this.on[t][s] < 0 || s === skip) continue
      const g = this.gi(t, s)
      const d = Math.hypot(this.px[g] - x, this.py[g] - y)
      if (d < bd) { bd = d; best = s }
    }
    return best
  }
  private bestAt(t: 0 | 1, attr: number, pref: number): number {
    const tac = this.teams[t].tactic
    const want = this.on[t].findIndex((i) => i >= 0 && this.teams[t].players[i].id === pref)
    if (want > 0) return want
    let best = this.firstOn(t)
    let bv = -1
    for (let s = 1; s < 11; s++) if (this.on[t][s] >= 0 && this.at(t, s, attr) > bv) { bv = this.at(t, s, attr); best = s }
    void tac
    return best
  }

  // ───────────────────────── main loop ─────────────────────────
  step() {
    if (this.done) return
    const len = (this.period <= 2 ? 45 : 15) * 60
    if (this.pt >= len && this.added === 0) {
      this.added = clamp(Math.round(this.deadTime / 60 / (this.period <= 2 ? 4.2 : 5)), 1, 10) * 60
    }
    if (this.pt >= len + this.added && this.restart !== 'penalty') return this.endPeriod()
    this.aiManage()
    if (this.restart) return this.doRestart()
    const t = this.poss
    const o = (1 - t) as 0 | 1
    const tac = this.teams[t].tactic
    const s = this.carrier
    if (this.on[t][s] < 0) return this.setCarrier(t, this.firstOn(t))
    const g = this.gi(t, s)
    const dt = (1.0 + this.rng.range(0, 1.3)) * (1.28 - 0.5 * (tac.tempo / 100)) * (1 + (tac.timeWasting / 100) * 0.5)
    this.tick(dt)
    this.move(dt)
    this.bx = this.px[g]
    this.by = this.py[g]
    const nx = this.nx(t, this.bx)
    const ny = this.ny(t, this.by)
    const near = this.nearestOpp(t, this.bx, this.by, true)
    const pressure = clamp(1 - near.d / 7, 0, 1)
    const role = this.roles[t][s]
    const sl0 = this.slots[t][s]

    // defender challenges the carrier
    const otac = this.teams[o].tactic
    if (s !== 0 && near.d < 2.8 && this.rng.chance(0.03 + 0.08 * (otac.pressing / 100) * this.roles[o][near.s].press)) {
      if (this.duel(t, s, o, near.s, false)) { this.frame(); return }
    }

    // ── evaluate options ──
    type Opt = { u: number; kind: 'shoot' | 'long' | 'pass' | 'dribble' | 'cross' | 'clear' | 'hold'; to?: number; lead?: number }
    const opts: Opt[] = [{ u: 0.012 + (tac.timeWasting / 100) * 0.02, kind: 'hold' }]
    const gdx = (1 - nx) * PL
    const gdy = (ny - 0.5) * PW
    const gd = Math.hypot(gdx, gdy)
    const here = threat(nx, ny)
    const ment = tac.mentality / 100
    if (gd < 27 && s !== 0) {
      const xg = xgModel(gd, Math.abs(gdy), pressure, false)
      const skill = (this.at(t, s, A.finishing) + (gd > 18 ? this.at(t, s, A.longShots) : this.at(t, s, A.composure))) / 2
      opts.push({ u: xg * (1.6 + skill / 120) * role.shoot * (gd > 19 ? clamp(0.5 + (this.at(t, s, A.longShots) - 58) / 70, 0.35, 1.0) : gd > 14 ? 0.85 : 1.0) + (gd < 9 ? 0.2 : 0), kind: 'shoot' })
      // with a sight of goal and room to hit it, players have a go: most shots outside the box come from
      // midfielders and wide players, not the striker
      if (gd > 15 && pressure < 0.55 && Math.abs(gdy) < 17 && this.rng.chance((LONG + (this.at(t, s, A.longShots) - 55) / 400) * role.shoot * (1 - pressure) * (sl0.pos === 'ST' ? 0.5 : sl0.pos === 'CB' || sl0.pos === 'RB' || sl0.pos === 'LB' ? 0.45 : 1) * (0.75 + ment * 0.5))) opts.push({ u: 1.2, kind: 'long' })
    }
    const direct = tac.directness / 100
    const passSkill = this.at(t, s, A.passing) * 0.6 + this.at(t, s, A.vision) * 0.2 + this.at(t, s, A.technique) * 0.2
    for (let j = 0; j < 11; j++) {
      if (j === s || this.on[t][j] < 0) continue
      const gj = this.gi(t, j)
      const d = this.dist(g, gj)
      if (d < 4 || d > 28 + direct * 34) continue
      const rnx = this.nx(t, this.px[gj])
      const rny = this.ny(t, this.py[gj])
      const open = this.nearestOpp(t, this.px[gj], this.py[gj], true).d
      const fwd = rnx - nx
      let ps = sig(3.25 + (passSkill - 62) / 21 - d / 15 - pressure * 1.3 + clamp(open - 3, -3, 6) / 3.6 - Math.max(0, fwd) * 5.2 * (1 - direct * 0.3))
      if (j === 0) ps = Math.min(0.99, ps + 0.2)
      const gain = threat(rnx, rny) - here
      let u = ps * (0.05 + threat(rnx, rny) * 1.0 + Math.max(0, gain) * (1.1 + ment * 0.9)) - (1 - ps) * (0.035 + here * 0.5 + (nx < 0.35 ? 0.1 : 0)) * (2.05 - ment * 0.5 - role.risk * 0.55)
      if (fwd < -0.02) u *= 0.6 + (1 - ment) * 0.3 + pressure * 0.25
      if (rnx > 0.72 && open > 3.5 && j !== 0) u += ps * 0.035 * Math.min(1, (open - 3.5) / 4) // the free man around the box
      if (open < 2.2) u *= 0.72 // a tightly marked team-mate is a poor option: look for the free man
      if (d > 30) u *= 0.55 + direct * 0.8 + (this.roles[t][j].target - 1) * 0.3
      opts.push({ u, kind: 'pass', to: j })
    }
    if (s !== 0) {
      const dribSkill = this.at(t, s, A.dribbling)
      opts.push({ u: (0.02 + (threat(Math.min(1, nx + 0.08), ny) - here) * 1.5) * role.dribble * (0.55 + dribSkill / 130) * (1 - pressure * 0.5) * (0.7 + ment * 0.6), kind: 'dribble' })
      if (nx > 0.7 && Math.abs(ny - 0.5) > 0.22) opts.push({ u: 0.05 * role.cross * (0.5 + this.at(t, s, A.crossing) / 100) * (nx > 0.82 ? 1.4 : 1), kind: 'cross' })
      if (nx < 0.3 && pressure > 0.55) opts.push({ u: 0.035 + pressure * 0.04 * (1.4 - ment), kind: 'clear' })
    }
    const temp = (0.05 - (this.at(t, s, A.decisions) / 99) * 0.03)
    const pick = this.rng.weighted(opts, (op) => Math.exp(clamp(op.u, -0.5, 1.2) / temp))

    switch (pick.kind) {
      case 'hold': {
        this.px[g] += this.rng.normal(0, 1.2)
        this.py[g] = clamp(this.py[g] + this.rng.normal(0, 1.2), 1, PW - 1)
        this.frame(g)
        break
      }
      case 'shoot':
        this.finishMove(t, s, gd)
        break
      case 'long':
        this.shoot(t, s, 'open')
        break
      case 'pass':
        this.pass(t, s, pick.to!, pressure, passSkill)
        break
      case 'dribble':
        this.dribble(t, s)
        break
      case 'cross':
        this.cross(t, s, 'open')
        break
      case 'clear': {
        this.st(t, s).clearances++
        this.rate(t, s, 0.04)
        if (nx < 0.14 && this.rng.chance(0.3)) { this.corner(o); break }
        const tx = this.wx(t, clamp(nx + this.rng.range(0.3, 0.5), 0, 0.95))
        const ty = this.rng.range(8, PW - 8)
        this.bx = tx; this.by = ty
        this.lastPasser = -1
        this.tick(2.5)
        this.loose(tx, ty, 0.42, t)
        break
      }
    }
  }

  /** Run the whole match without stopping. */
  run() {
    let guard = 0
    while (!this.done && guard++ < 20000) this.step()
    return this
  }

  // ───────────────────────── actions ─────────────────────────
  /**
   * The end of an attacking move. The player who works the opening is often not the one who finishes it:
   * he may square it, cut it back or lay it off to a team-mate arriving in support. Who gets the chance
   * depends on position and role (forwards and attacking midfielders most, midfielders from the edge of
   * the box, defenders rarely), and the provider is credited with the pass. Otherwise he shoots himself.
   */
  private finishMove(t: 0 | 1, s: number, gd: number) {
    const W: Record<string, number> = { ST: 0.8, RW: 1.0, LW: 1.0, AM: 1.05, CM: 0.6, DM: 0.22, RB: 0.16, LB: 0.16, CB: 0.04, GK: 0 }
    const mine = this.slots[t][s].pos
    // a striker in on goal usually shoots; others look for a better-placed team-mate more often
    const pShare = clamp((mine === 'ST' ? 0.74 : 0.36) + (this.at(t, s, A.teamwork) - 60) / 250 + (this.at(t, s, A.vision) - 60) / 300 - (this.roles[t][s].shoot - 1) * 0.25, 0.1, 0.75)
    if (!this.rng.chance(pShare)) return this.shoot(t, s, 'open')
    const cands: number[] = []
    for (let j = 1; j < 11; j++) if (j !== s && this.on[t][j] >= 0) cands.push(j)
    if (!cands.length) return this.shoot(t, s, 'open')
    const j = this.rng.weighted(cands, (c) => W[this.slots[t][c].pos] * this.roles[t][c].shoot * (0.5 + (this.at(t, c, A.offTheBall) + this.at(t, c, A.finishing)) / 240))
    const g = this.gi(t, s)
    const gj = this.gi(t, j)
    const pos = this.slots[t][j].pos
    const front = pos === 'ST' || pos === 'RW' || pos === 'LW' || pos === 'AM'
    const nx = this.nx(t, this.px[g])
    const ny = this.ny(t, this.py[g])
    // forwards arrive level with the ball in the box; midfielders and defenders meet it further out
    const rnx = front ? clamp(nx + this.rng.range(-0.02, 0.05), 0.82, 0.95) : clamp(Math.min(nx, 0.82) - this.rng.range(0.03, 0.1), 0.7, 0.84)
    const rny = clamp(0.5 + (ny - 0.5) * 0.35 + this.rng.normal(0, front ? 0.065 : 0.1), 0.2, 0.8)
    this.px[gj] = this.wx(t, rnx)
    this.py[gj] = this.wy(t, rny)
    const st = this.st(t, s)
    st.passes++; this.ts[t].passes++
    st.passesC++; this.ts[t].passesC++
    this.lastPasser = s
    this.tick(1.1)
    this.setCarrier(t, j)
    this.frame(gj)
    void gd
    this.shoot(t, j, 'open')
  }

  private loose(x: number, y: number, pKeep: number, t: 0 | 1) {
    const win = this.rng.chance(pKeep) ? t : ((1 - t) as 0 | 1)
    const s = this.closest(win, x, y, true)
    const g = this.gi(win, s)
    this.px[g] += (x - this.px[g]) * 0.8
    this.py[g] += (y - this.py[g]) * 0.8
    this.setCarrier(win, s)
    this.frame(g)
  }

  private pass(t: 0 | 1, s: number, j: number, pressure: number, passSkill: number) {
    const o = (1 - t) as 0 | 1
    const g = this.gi(t, s)
    const gj = this.gi(t, j)
    const st = this.st(t, s)
    st.passes++; this.ts[t].passes++
    const d = this.dist(g, gj)
    const open = this.nearestOpp(t, this.px[gj], this.py[gj], true)
    const fwd = this.nx(t, this.px[gj]) - this.nx(t, this.px[g])
    const direct = this.teams[t].tactic.directness / 100
    let ps = sig(3.25 + (passSkill - 62) / 21 - d / 15 - pressure * 1.3 + clamp(open.d - 3, -3, 6) / 3.6 - Math.max(0, fwd) * 5.2 * (1 - direct * 0.3))
    if (j === 0) ps = Math.min(0.99, ps + 0.2)
    this.tick(0.4 + d / 22)
    // through ball beyond the line → offside chance
    const rnx = this.nx(t, this.px[gj])
    if (rnx > 0.55 && fwd > 0.1 && j !== 0) {
      let line = 0
      for (let k = 1; k < 11; k++) if (this.on[o][k] >= 0) line = Math.max(line, 1 - this.nx(o, this.px[this.gi(o, k)]))
      if (rnx >= line - 0.012 && this.rng.chance(0.13 + (this.teams[o].tactic.line / 100) * 0.12 - this.at(t, j, A.offTheBall) / 900)) {
        this.st(t, j).offsides++; this.ts[t].offsides++
        this.ev('offside', t, `${this.name(t, j)} is caught offside.`, { p: this.pl(t, j)!.id })
        this.bx = this.px[gj]; this.by = this.py[gj]
        this.frame()
        this.freeKick(o, this.bx, this.by, false)
        return
      }
    }
    if (this.rng.chance(ps)) {
      st.passesC++; this.ts[t].passesC++
      this.rate(t, s, fwd > 0.12 ? 0.02 : 0.005)
      this.mom(t, Math.max(0, threat(rnx, this.ny(t, this.py[gj])) - threat(this.nx(t, this.px[g]), this.ny(t, this.py[g]))) * 6)
      this.lastPasser = s
      this.setCarrier(t, j)
      // heavy touch under pressure
      if (open.d < 2.2 && this.rng.chance(0.22 - this.at(t, j, A.firstTouch) / 600)) {
        this.st(t, j).lost++
        this.rate(t, j, -0.06)
        this.st(o, open.s).interceptions++
        this.rate(o, open.s, 0.07)
        this.lastPasser = -1
        this.setCarrier(o, open.s)
      }
      this.frame(this.gi(this.poss, this.carrier))
    } else {
      st.lost++
      this.rate(t, s, -0.045)
      this.lastPasser = -1
      const tx = this.px[gj] + this.rng.normal(0, 3)
      const ty = this.py[gj] + this.rng.normal(0, 3)
      if (ty < 0 || ty > PW || this.rng.chance(0.1)) {
        this.bx = clamp(tx, 1, PL - 1); this.by = ty < PW / 2 ? 0 : PW
        this.frame()
        this.throwIn(o)
        return
      }
      if (this.nx(t, tx) > 1 || (this.nx(t, tx) > 0.9 && this.rng.chance(0.25))) {
        this.bx = this.wx(t, 1); this.by = clamp(ty, 2, PW - 2)
        this.frame()
        if (this.rng.chance(0.3)) { this.corner(t); return }
        this.restart = 'goalkick'; this.poss = o
        return
      }
      const is = this.closest(o, tx, ty, false)
      this.st(o, is).interceptions++
      this.rate(o, is, 0.08)
      const gi = this.gi(o, is)
      this.px[gi] += (tx - this.px[gi]) * 0.7
      this.py[gi] += (clamp(ty, 1, PW - 1) - this.py[gi]) * 0.7
      this.setCarrier(o, is)
      this.frame(gi)
    }
  }

  /** Returns true when possession changed or play stopped. */
  private duel(t: 0 | 1, s: number, o: 0 | 1, ds: number, fromDribble: boolean): boolean {
    const att = this.at(t, s, A.dribbling) * 0.45 + this.at(t, s, A.agility) * 0.2 + this.at(t, s, A.strength) * 0.15 + this.at(t, s, A.acceleration) * 0.2
    const def = this.at(o, ds, A.tackling) * 0.5 + this.at(o, ds, A.positioning) * 0.2 + this.at(o, ds, A.strength) * 0.15 + this.at(o, ds, A.anticipation) * 0.15
    const dst = this.st(o, ds)
    dst.tackles++
    const hard = this.teams[o].tactic.tackling / 100
    const pFoul = 0.11 + hard * 0.1 + this.at(o, ds, A.aggression) / 900 - this.at(o, ds, A.tackling) / 1000
    const r = this.rng.next()
    if (r < pFoul) {
      this.foul(o, ds, t, s)
      return true
    }
    const pWin = sig((def - att) / 24 + (fromDribble ? -0.25 : 0.1))
    if (this.rng.chance(pWin)) {
      dst.tacklesWon++; this.ts[o].tackles++
      this.rate(o, ds, 0.065)
      this.st(t, s).lost++
      this.rate(t, s, -0.05)
      this.lastPasser = -1
      this.maybeInjury(t, s, 0.0004)
      const cnx = this.nx(t, this.px[this.gi(t, s)])
      if (cnx > 0.83 && this.rng.chance(0.4)) { this.corner(t); return true }
      this.setCarrier(o, ds)
      return true
    }
    if (fromDribble) { this.st(t, s).dribblesWon++; this.rate(t, s, 0.06) }
    return false
  }

  private dribble(t: 0 | 1, s: number) {
    const o = (1 - t) as 0 | 1
    const g = this.gi(t, s)
    const st = this.st(t, s)
    const near = this.nearestOpp(t, this.px[g], this.py[g], true)
    const adv = 5 + this.rng.range(0, 6) * (0.6 + this.at(t, s, A.pace) / 150)
    const dir = t === 0 ? 1 : -1
    const wide = this.slots[t][s].pos === 'RW' || this.slots[t][s].pos === 'LW'
    const toGoalY = (GOAL_Y - this.py[g]) * (this.nx(t, this.px[g]) > 0.75 ? 0.3 : 0.05) * (wide ? 1.5 + Math.max(0, this.roles[t][s].inside) / 10 : 1)
    if (near.d < 5.5) {
      st.dribbles++
      if (this.duel(t, s, o, near.s, true)) { this.frame(); return }
    }
    this.px[g] = clamp(this.px[g] + dir * adv, 1, PL - 1)
    this.py[g] = clamp(this.py[g] + toGoalY + this.rng.normal(0, 2), 1, PW - 1)
    this.bx = this.px[g]; this.by = this.py[g]
    this.mom(t, 0.04)
    this.touch(t, s)
    this.tick(1.2)
    this.frame(g)
  }

  private cross(t: 0 | 1, s: number, kind: 'open' | 'corner' | 'fk') {
    const o = (1 - t) as 0 | 1
    const st = this.st(t, s)
    st.passes++; this.ts[t].passes++
    const q = this.at(t, s, kind === 'open' ? A.crossing : A.setPieces) * 0.7 + this.at(t, s, A.technique) * 0.3
    // pick a target in the box
    const cands: number[] = []
    for (let j = 1; j < 11; j++) if (j !== s && this.on[t][j] >= 0 && (this.slots[t][j].x > 0.55 || (kind !== 'open' && this.slots[t][j].pos === 'CB'))) cands.push(j)
    if (!cands.length) { this.loose(this.wx(t, 0.88), GOAL_Y, 0.2, t); return }
    const j = this.rng.weighted(cands, (c) => (this.at(t, c, A.heading) + this.at(t, c, A.jumping)) * this.roles[t][c].target)
    const tx = this.wx(t, this.rng.range(0.87, 0.95))
    const ty = GOAL_Y + this.rng.normal(0, 6)
    const gj = this.gi(t, j)
    this.px[gj] = tx; this.py[gj] = ty
    const ds = this.closest(o, tx, ty, true)
    const gd = this.gi(o, ds)
    this.px[gd] = tx + (t === 0 ? 1 : -1) * 1.2; this.py[gd] = ty + this.rng.normal(0, 1)
    this.tick(2.2)
    this.bx = tx; this.by = ty
    const a = this.at(t, j, A.heading) * 0.4 + this.at(t, j, A.jumping) * 0.35 + this.at(t, j, A.strength) * 0.1 + this.at(t, j, A.offTheBall) * 0.15
    const dd = this.at(o, ds, A.heading) * 0.35 + this.at(o, ds, A.jumping) * 0.3 + this.at(o, ds, A.marking) * 0.2 + this.at(o, ds, A.positioning) * 0.15
    this.st(t, j).aerials++; this.st(o, ds).aerials++
    const pReach = sig((q - 64) / 15 - 0.1)
    const gkClaim = this.at(o, 0, A.command) / 99
    if (!this.rng.chance(pReach) || this.rng.chance(0.1 + gkClaim * 0.13)) {
      // overhit, or keeper claims
      st.lost++
      this.frame()
      if (this.rng.chance(0.55)) { this.rate(o, 0, 0.05); this.setCarrier(o, 0); this.frame(this.gi(o, 0)) } else { this.restart = 'goalkick'; this.poss = o }
      return
    }
    if (this.rng.chance(sig((a - dd) / 20 - 0.55))) {
      this.st(t, j).aerialsWon++
      st.passesC++; this.ts[t].passesC++
      this.lastPasser = s
      this.poss = t; this.carrier = j
      this.touch(t, j)
      this.frame(gj)
      if (this.rng.chance(0.8)) this.shoot(t, j, kind === 'corner' ? 'corner' : 'header')
      else this.loose(tx, ty, 0.5, t)
    } else {
      this.st(o, ds).aerialsWon++; this.st(o, ds).clearances++
      this.rate(o, ds, 0.09)
      this.lastPasser = -1
      this.frame()
      if (this.rng.chance(0.34)) { this.corner(t); return }
      const cx = this.wx(o, this.rng.range(0.25, 0.5))
      const cy = this.rng.range(10, PW - 10)
      this.bx = cx; this.by = cy
      this.tick(2)
      this.loose(cx, cy, 0.5, o)
    }
  }

  private shoot(t: 0 | 1, s: number, kind: ShotRec['kind']) {
    const o = (1 - t) as 0 | 1
    const g = this.gi(t, s)
    const p = this.pl(t, s)!
    const st = this.st(t, s)
    const nx = this.nx(t, this.px[g])
    const ny = this.ny(t, this.py[g])
    const gdx = (1 - nx) * PL
    const gdy = Math.abs(ny - 0.5) * PW
    const dist = Math.hypot(gdx, gdy)
    const near = this.nearestOpp(t, this.px[g], this.py[g], true)
    const pressure = kind === 'pen' || kind === 'fk' ? 0 : clamp(1 - near.d / 6, 0, 1)
    const header = kind === 'header' || kind === 'corner'
    let xg = kind === 'pen' ? 0.77 : kind === 'fk' ? clamp(0.085 - dist / 420, 0.02, 0.055) : xgModel(dist, gdy, pressure, header)
    const fin = kind === 'pen' ? this.at(t, s, A.penalties) : kind === 'fk' ? this.at(t, s, A.setPieces) : header ? this.at(t, s, A.heading) : dist > 18 ? (this.at(t, s, A.longShots) + this.at(t, s, A.finishing)) / 2 : (this.at(t, s, A.finishing) * 0.7 + this.at(t, s, A.composure) * 0.3)
    const gk = this.on[o][0] >= 0 ? this.at(o, 0, A.reflexes) * 0.45 + this.at(o, 0, A.handling) * 0.2 + this.at(o, 0, A.oneOnOnes) * 0.2 + this.at(o, 0, A.positioning) * 0.15 : 25
    st.shots++; this.ts[t].shots++
    st.xg += xg; this.ts[t].xg += xg
    if (xg > 0.3) this.ts[t].bigChances++
    this.mom(t, 0.5 + xg * 6)
    const assist = this.lastPasser >= 0 && this.lastPasser !== s && this.on[t][this.lastPasser] >= 0 ? this.lastPasser : -1
    if (assist >= 0) { this.st(t, assist).keyPasses++; this.st(t, assist).xa += xg; this.rate(t, assist, 0.12 + xg * 0.5) }
    this.tick(1.2)
    const pGoal = clamp(xg * (1.45 + (fin - gk) / 150), 0.005, 0.95)
    const pOn = clamp(Math.max(pGoal + 0.03, 0.4 + (fin - 62) / 170 - pressure * 0.12 + (dist < 11 ? 0.12 : 0) - (header ? 0.05 : 0)), 0, 0.92)
    const pBlock = kind === 'pen' ? 0 : clamp(0.1 + pressure * 0.26 + (dist > 18 ? 0.06 : 0), 0, 0.42)
    const gx = this.wx(t, 1)
    const r = this.rng.next()
    const rec: ShotRec = { team: t, p: p.id, min: this.minute().min, x: Math.round(nx * 1000) / 1000, y: Math.round(ny * 1000) / 1000, xg: Math.round(xg * 100) / 100, out: 'off', kind }
    this.shots.push(rec)
    this.frame(g)
    const desc = kind === 'pen' ? 'penalty' : kind === 'fk' ? 'free kick' : header ? 'header' : dist > 20 ? 'long-range effort' : 'shot'
    if (r < pBlock * (1 - pGoal)) {
      rec.out = 'blocked'
      const b = near.s >= 0 ? near.s : this.firstOn(o)
      this.rate(o, b, 0.1)
      this.bx += (gx - this.bx) * 0.3
      if (xg > 0.12) this.ev('block', t, `${p.short}'s ${desc} is blocked by ${this.name(o, b)}.`, { p: p.id, xg })
      this.frame()
      if (this.rng.chance(0.45)) return this.corner(t)
      return this.loose(this.bx, this.by, 0.4, t)
    }
    const r2 = this.rng.next()
    this.bx = gx; this.by = GOAL_Y + this.rng.normal(0, 2.2)
    if (r2 < pGoal) {
      rec.out = 'goal'
      st.sot++; this.ts[t].sot++
      st.goals++; this.ts[t].goals++
      this.score[t]++
      // the first goal makes a match; the third adds less to an already excellent mark
      this.rate(t, s, (1.0 + (1 - xg) * 0.35) * [1, 0.7, 0.5, 0.35, 0.25][Math.min(4, st.goals - 1)])
      if (assist >= 0) { this.st(t, assist).assists++; this.rate(t, assist, 0.65) }
      for (let k = 0; k < 11; k++) if (this.on[o][k] >= 0) { this.st(o, k).conceded++; this.rate(o, k, k === 0 ? -0.3 : this.slots[o][k].x < 0.3 ? -0.2 : -0.08) }
      for (let k = 0; k < 11; k++) if (this.on[t][k] >= 0 && k !== s) this.rate(t, k, 0.05)
      const a = assist >= 0 ? this.pl(t, assist)! : null
      this.ev(kind === 'pen' ? 'pen' : 'goal', t, `GOAL! ${p.short} scores${kind === 'pen' ? ' from the spot' : header ? ' with a header' : dist > 20 ? ' from distance' : ''}${a ? `, set up by ${a.short}` : ''}. ${this.teams[0].short} ${this.score[0]}–${this.score[1]} ${this.teams[1].short}`, { p: p.id, q: a?.id, xg, x: rec.x, y: rec.y })
      this.frame()
      this.tick(48, true)
      this.lastPasser = -1
      this.poss = o
      this.restart = 'kickoff'
      return
    }
    if (r2 < pOn) {
      rec.out = 'saved'
      st.sot++; this.ts[t].sot++
      this.rate(t, s, 0.08)
      if (this.on[o][0] >= 0) { this.st(o, 0).saves++; this.rate(o, 0, 0.18 + xg * 1.1) }
      this.ts[o].saves++
      if (xg > 0.1 || kind === 'pen') this.ev(kind === 'pen' ? 'penMiss' : 'save', o, `${this.name(o, 0)} saves ${p.short}'s ${desc}${xg > 0.3 ? ' — a big chance' : ''}.`, { p: p.id, xg })
      this.frame()
      this.lastPasser = -1
      const rr = this.rng.next()
      if (rr < 0.36) return this.corner(t)
      if (rr < 0.48) return this.loose(this.wx(t, 0.9), GOAL_Y + this.rng.normal(0, 6), 0.38, t)
      this.setCarrier(o, 0)
      this.frame(this.gi(o, 0))
      return
    }
    // off target
    const post = this.rng.chance(0.06)
    rec.out = post ? 'post' : 'off'
    this.by = GOAL_Y + (this.rng.chance(0.5) ? 1 : -1) * (post ? 3.7 : this.rng.range(4.5, 12))
    this.rate(t, s, -0.04 - xg * 0.5)
    if (post || xg > 0.2 || kind === 'pen') this.ev(kind === 'pen' ? 'penMiss' : post ? 'post' : 'miss', t, post ? `${p.short} hits the woodwork!` : `${p.short} ${kind === 'pen' ? 'misses the penalty' : `puts the ${desc} wide`}.`, { p: p.id, xg })
    this.frame()
    this.lastPasser = -1
    if (post && this.rng.chance(0.5)) return this.loose(this.wx(t, 0.9), GOAL_Y + this.rng.normal(0, 7), 0.4, t)
    this.restart = 'goalkick'
    this.poss = o
  }

  private foul(o: 0 | 1, ds: number, t: 0 | 1, s: number) {
    const dst = this.st(o, ds)
    dst.fouls++; this.ts[o].fouls++
    this.st(t, s).fouled++
    this.rate(o, ds, -0.05)
    const g = this.gi(t, s)
    const nx = this.nx(t, this.px[g])
    const ny = this.ny(t, this.py[g])
    const inBox = nx > 0.843 && Math.abs(ny - 0.5) < 0.296
    const hard = this.teams[o].tactic.tackling / 100
    const dp = this.pl(o, ds)!
    const danger = nx > 0.7 ? 0.08 : 0
    const r = this.rng.next()
    const pRed = 0.002 + hard * 0.003 + (inBox ? 0.01 : 0)
    const pYel = (0.1 + hard * 0.08 + danger + this.at(o, ds, A.aggression) / 1500) * (this.yellowed[o].has(dp.id) ? 0.3 : 1)
    this.tick(22, true)
    this.maybeInjury(t, s, 0.0022)
    if (r < pRed) this.sendOff(o, ds, `${dp.short} is shown a straight red card!`)
    else if (r < pRed + pYel) {
      if (this.yellowed[o].has(dp.id)) {
        dst.yellow++; this.ts[o].yellows++
        this.sendOff(o, ds, `${dp.short} gets a second yellow and is sent off!`)
      } else {
        this.yellowed[o].add(dp.id)
        dst.yellow++; this.ts[o].yellows++
        this.rate(o, ds, -0.25)
        this.ev('yellow', o, `Yellow card for ${dp.short}.`, { p: dp.id })
      }
    }
    if (inBox && this.rng.chance(0.2)) {
      this.ev('foul', o, `Penalty to ${this.teams[t].short}! ${dp.short} brings down ${this.name(t, s)}.`, { p: dp.id })
      this.poss = t
      this.restart = 'penalty'
      return
    }
    this.freeKick(t, this.px[g], this.py[g], true)
  }

  private sendOff(o: 0 | 1, ds: number, text: string) {
    const dp = this.pl(o, ds)!
    const st = this.st(o, ds)
    st.red++; this.ts[o].reds++
    st.on = false
    st.rating = clamp(st.rating - 1.4, 3, 10)
    this.ev('red', o, text, { p: dp.id })
    this.on[o][ds] = -1
    if (ds === 0) {
      // an outfielder goes in goal
      const k = this.firstOn(o, 1)
      this.on[o][0] = this.on[o][k]
      this.on[o][k] = -1
    }
  }

  private maybeInjury(t: 0 | 1, s: number, p: number) {
    const pl = this.pl(t, s)
    if (!pl) return
    const e = this.energy[t][this.on[t][s]]
    if (this.rng.chance(p * (0.5 + pl.injuryProne / 12) * (e < 55 ? 1.8 : 1))) {
      this.ev('injury', t, `${pl.short} is down injured and cannot continue.`, { p: pl.id })
      this.tick(50, true)
      this.mustSub[t].push(pl.id)
      this.injured.push([t, pl.id])
      if (this.teams[t].ai || this.subsUsed[t] >= this.opts.subs) this.forceSub(t, s)
    }
  }
  injured: [number, number][] = []
  /** The elevens and shapes that kicked off, for the match report. */
  startXI: [number[], number[]] = [[], []]
  startFormation: [string, string] = ['', '']
  private forceSub(t: 0 | 1, s: number) {
    if (this.subsUsed[t] < this.opts.subs) {
      const b = this.pickBench(t, s)
      if (b >= 0) { this.doSub(t, s, b); return }
    }
    this.st(t, s).on = false
    this.on[t][s] = -1
  }

  private freeKick(t: 0 | 1, x: number, y: number, fromFoul: boolean) {
    const nx = this.nx(t, x)
    const ny = this.ny(t, y)
    const d = Math.hypot((1 - nx) * PL, (ny - 0.5) * PW)
    const tac = this.teams[t].tactic
    this.poss = t
    this.lastPasser = -1
    if (fromFoul && d < 25 && Math.abs(ny - 0.5) < 0.2 && nx < 0.84) {
      const k = this.bestAt(t, A.setPieces, tac.freeKicks)
      const g = this.gi(t, k)
      this.px[g] = x; this.py[g] = y
      this.carrier = k; this.bx = x; this.by = y
      this.touch(t, k)
      this.shoot(t, k, 'fk')
      return
    }
    if (fromFoul && nx > 0.62) {
      const k = this.bestAt(t, A.setPieces, tac.freeKicks)
      const g = this.gi(t, k)
      this.px[g] = x; this.py[g] = y
      this.carrier = k; this.bx = x; this.by = y
      this.touch(t, k)
      this.frame(g)
      this.cross(t, k, 'fk')
      return
    }
    const k = this.closest(t, x, y, false)
    const g = this.gi(t, k)
    this.px[g] = x; this.py[g] = clamp(y, 1, PW - 1)
    this.setCarrier(t, k)
    this.frame(g)
  }
  private throwIn(t: 0 | 1) {
    this.tick(9, true)
    const k = this.closest(t, this.bx, this.by, true)
    const g = this.gi(t, k)
    this.px[g] = this.bx; this.py[g] = clamp(this.by, 0.5, PW - 0.5)
    this.lastPasser = -1
    this.setCarrier(t, k)
    this.frame(g)
  }
  private corner(t: 0 | 1) {
    this.ts[t].corners++
    this.poss = t
    this.restart = 'corner'
  }

  private doRestart() {
    const r = this.restart
    this.restart = null
    const t = this.poss
    const o = (1 - t) as 0 | 1
    const tac = this.teams[t].tactic
    this.lastPasser = -1
    if (r === 'kickoff') {
      this.resetShape()
      const k = this.bestSlot(t, 'ST')
      const g = this.gi(t, k)
      this.px[g] = PL / 2; this.py[g] = PW / 2
      this.setCarrier(t, k)
      this.frame(g)
    } else if (r === 'goalkick') {
      this.tick(20, true)
      this.move(8)
      const g = this.gi(t, 0)
      this.px[g] = this.wx(t, 0.055); this.py[g] = GOAL_Y
      this.setCarrier(t, 0)
      this.frame(g)
      if (this.rng.chance(0.25 + (tac.directness / 100) * 0.5)) {
        // long kick → aerial contest in midfield
        const tx = this.wx(t, this.rng.range(0.5, 0.68))
        const ty = this.rng.range(14, PW - 14)
        this.st(t, 0).passes++; this.ts[t].passes++
        this.tick(3.5)
        const a = this.closest(t, tx, ty)
        const d = this.closest(o, tx, ty)
        this.st(t, a).aerials++; this.st(o, d).aerials++
        const pa = this.at(t, a, A.heading) + this.at(t, a, A.jumping) + (this.roles[t][a].target - 1) * 25
        const pd = this.at(o, d, A.heading) + this.at(o, d, A.jumping) + 8
        const win = this.rng.chance(sig((pa - pd) / 26)) ? t : o
        if (win === t) { this.st(t, a).aerialsWon++; this.st(t, 0).passesC++; this.ts[t].passesC++ } else this.st(o, d).aerialsWon++
        this.bx = tx; this.by = ty
        this.loose(tx, ty, win === t ? 0.72 : 0.28, t)
      }
    } else if (r === 'corner') {
      this.tick(26, true)
      this.move(10)
      const k = this.bestAt(t, A.setPieces, tac.corners)
      const g = this.gi(t, k)
      const side = this.rng.chance(0.5) ? 0.5 : PW - 0.5
      this.px[g] = this.wx(t, 0.995); this.py[g] = side
      this.bx = this.px[g]; this.by = side
      this.carrier = k
      this.touch(t, k)
      this.frame(g)
      if (this.rng.chance(0.14)) { this.setCarrier(t, this.closest(t, this.bx, this.by, true, k)); this.frame(); return }
      this.cross(t, k, 'corner')
    } else if (r === 'penalty') {
      this.tick(55, true)
      const k = this.bestAt(t, A.penalties, tac.pens)
      const g = this.gi(t, k)
      this.px[g] = this.wx(t, 1 - 11 / PL); this.py[g] = GOAL_Y
      this.bx = this.px[g]; this.by = GOAL_Y
      this.carrier = k
      this.touch(t, k)
      this.shoot(t, k, 'pen')
    }
  }
  private bestSlot(t: 0 | 1, pos: string) {
    for (let s = 10; s > 0; s--) if (this.on[t][s] >= 0 && this.slots[t][s].pos === pos) return s
    for (let s = 10; s > 0; s--) if (this.on[t][s] >= 0) return s
    return 0
  }

  // ───────────────────────── periods ─────────────────────────
  private endPeriod() {
    const s = `${this.teams[0].short} ${this.score[0]}–${this.score[1]} ${this.teams[1].short}`
    if (this.period === 1) {
      this.ev('half', 0, `Half-time. ${s}`)
      this.nextPeriod()
      for (const t of [0, 1] as const) this.energy[t] = this.energy[t].map((e) => Math.min(100, e + 6))
    } else if (this.period === 2) {
      if (this.opts.knockout && this.score[0] === this.score[1]) {
        this.ev('half', 0, `Full-time, and we go to extra time. ${s}`)
        this.nextPeriod()
      } else this.finish(`Full-time. ${s}`)
    } else if (this.period === 3) {
      this.ev('half', 0, `Half-time in extra time. ${s}`)
      this.nextPeriod()
    } else {
      if (this.score[0] === this.score[1]) this.shootout()
      this.finish(`Full-time after extra time. ${s}${this.pens ? ` (${this.pens[0]}–${this.pens[1]} on penalties)` : ''}`)
    }
  }
  private nextPeriod() {
    this.period++
    this.pt = 0
    this.added = 0
    this.deadTime = 0
    this.poss = this.period % 2 === 0 ? ((1 - this.poss) as 0 | 1) : this.poss
    this.restart = 'kickoff'
  }
  private finish(text: string) {
    this.ev('full', 0, text)
    this.done = true
    const tot = this.possTime[0] + this.possTime[1] || 1
    this.ts[0].possession = Math.round((this.possTime[0] / tot) * 100)
    this.ts[1].possession = 100 - this.ts[0].possession
    for (const t of [0, 1] as const) {
      const o = (1 - t) as 0 | 1
      for (const st of this.ps[t]) {
        if (!st.played) continue
        const res = this.score[t] > this.score[o] ? 0.25 : this.score[t] < this.score[o] ? -0.15 : 0
        const share = clamp(st.mins / 90, 0.2, 1)
        let r = st.rating + res * share
        if (this.score[o] === 0 && st.mins > 60) {
          const idx = this.teams[t].players.findIndex((p) => p.id === st.id)
          const line = this.teams[t].players[idx].pos[0]
          if (line === 'GK' || line === 'CB' || line === 'RB' || line === 'LB') r += 0.5
          else if (line === 'DM') r += 0.25
        }
        if (r > 8.2) r = 8.2 + (r - 8.2) * 0.56 // the top of the scale is hard to reach
        st.rating = Math.round(clamp(r, 3, 10) * 10) / 10
      }
    }
  }
  private shootout() {
    const p: [number, number] = [0, 0]
    const order = ([0, 1] as const).map((t) => {
      const idx = []
      for (let s = 10; s >= 0; s--) if (this.on[t][s] >= 0) idx.push(s)
      return idx.sort((a, b) => this.at(t, b, A.penalties) - this.at(t, a, A.penalties))
    })
    const kick = (t: 0 | 1, n: number) => {
      const o = (1 - t) as 0 | 1
      const s = order[t][n % order[t].length]
      const pr = clamp(0.74 + (this.at(t, s, A.penalties) - 65) / 230 + (this.at(t, s, A.composure) - 65) / 500 - (this.at(o, 0, A.reflexes) - 70) / 380, 0.5, 0.92)
      const ok = this.rng.chance(pr)
      if (ok) p[t]++
      this.ev('shootout', t, `${this.name(t, s)} ${ok ? 'scores' : 'misses'}. (${p[0]}–${p[1]})`, { p: this.pl(t, s)!.id })
    }
    for (let n = 0; n < 5; n++) {
      kick(0, n)
      if (p[0] + (4 - n) < p[1] || p[1] + (5 - n) < p[0]) break
      kick(1, n)
      if (p[1] + (4 - n) < p[0] || p[0] + (4 - n) < p[1]) break
    }
    let n = 5
    while (p[0] === p[1] && n < 40) { kick(0, n); kick(1, n); n++ }
    this.pens = p
  }

  // ───────────────────────── management ─────────────────────────
  private pickBench(t: 0 | 1, s: number): number {
    const team = this.teams[t]
    const pos = this.slots[t][s].pos
    let best = -1
    let bv = -1e9
    team.players.forEach((p, i) => {
      const st = this.ps[t][i]
      if (st.played || !team.tactic.bench.includes(p.id)) return
      if ((pos === 'GK') !== (p.pos[0] === 'GK')) return
      const v = p.attrs.reduce((a, b) => a + b, 0) / 40 - positionPenalty(p.pos, pos) * 3 + this.energy[t][i] * 0.05
      if (v > bv) { bv = v; best = i }
    })
    return best
  }
  private doSub(t: 0 | 1, s: number, benchIdx: number) {
    const out = this.pl(t, s)!
    const inn = this.teams[t].players[benchIdx]
    const { min } = this.minute()
    this.st(t, s).on = false
    this.st(t, s).subOff = min
    this.on[t][s] = benchIdx
    // the tactic's lineup always mirrors who is on the pitch
    const lu = [...this.teams[t].tactic.lineup]
    lu[s] = inn.id
    this.teams[t].tactic = { ...this.teams[t].tactic, lineup: lu }
    this.ps[t][benchIdx].on = true
    this.ps[t][benchIdx].played = true
    this.ps[t][benchIdx].subOn = min
    this.ps[t][benchIdx].pos = this.slots[t][s].pos
    this.subsUsed[t]++
    this.mustSub[t] = this.mustSub[t].filter((id) => id !== out.id)
    this.ev('sub', t, `Substitution for ${this.teams[t].short}: ${inn.short} replaces ${out.short}.`, { p: inn.id, q: out.id })
    this.tick(25, true)
  }
  /** User command. Returns an error string or null. */
  substitute(t: 0 | 1, outId: number, inId: number): string | null {
    if (this.subsUsed[t] >= this.opts.subs) return 'No substitutions left.'
    const s = this.on[t].findIndex((i) => i >= 0 && this.teams[t].players[i].id === outId)
    const b = this.teams[t].players.findIndex((p) => p.id === inId)
    if (s < 0 || b < 0) return 'Player not available.'
    if (this.ps[t][b].played) return 'That player has already been used.'
    this.doSub(t, s, b)
    return null
  }
  /** Swap two on-pitch players' slots, or change sliders / formation / roles. */
  setTactic(t: 0 | 1, tac: Tactic) {
    const team = this.teams[t]
    // keep exactly the players who are on the pitch: put each where the new lineup wants him (once),
    // then drop anyone the lineup left out into the remaining slots. Slots stay empty only for
    // players who have been sent off or gone off injured without a replacement.
    const left = new Set(this.on[t].filter((i) => i >= 0))
    const next: number[] = tac.lineup.slice(0, 11).map((id) => {
      const i = id >= 0 ? team.players.findIndex((p) => p.id === id) : -1
      if (i < 0 || !left.has(i)) return -1
      left.delete(i)
      return i
    })
    while (next.length < 11) next.push(-1)
    // the goalkeeper's slot is filled first
    for (const s of [0, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
      if (!left.size) break
      if (next[s] >= 0) continue
      const i = left.values().next().value as number
      left.delete(i)
      next[s] = i
    }
    team.tactic = { ...tac, lineup: next.map((i) => (i >= 0 ? team.players[i].id : -1)) }
    this.on[t] = next
    this.applyTactic(t)
  }
  private aiManage() {
    const { min } = this.minute()
    for (const t of [0, 1] as const) {
      const team = this.teams[t]
      if (!team.ai) continue
      const o = (1 - t) as 0 | 1
      const marks = SUB_MARKS
      if (this.aiSubMarks[t] < marks.length && min >= marks[this.aiSubMarks[t]] && !this.restart) {
        this.aiSubMarks[t]++
        const lead = this.score[t] - this.score[o]
        // a comfortable lead is the time to give a prospect minutes: in friendlies from two goals up after
        // the break, in competitive matches only when it is truly over (four up, last quarter of an hour)
        const safe = this.opts.importance <= 0.3 ? (lead >= 3 && min >= 46) || (lead >= 2 && min >= 55) : lead >= 4 && min >= 75
        if (safe && this.subsUsed[t] < this.opts.subs && this.blooded[t] < 3 && this.bloodProspect(t)) continue
        // with another match days away and this one won, take the important players off before they tire further
        const won = (lead >= 3 && min >= 60) || (lead >= 2 && min >= 70)
        if (won && this.opts.rest?.[t] && this.subsUsed[t] < this.opts.subs && this.rested[t] < 3 && this.restKeyPlayer(t)) continue
        if (this.subsUsed[t] < this.opts.subs) {
          // replace the most tired / worst performing outfielder
          let worst = -1
          let wv = 1e9
          for (let s = 1; s < 11; s++) {
            const i = this.on[t][s]
            if (i < 0) continue
            const v = this.energy[t][i] * 0.6 + this.ps[t][i].rating * 6 + (this.yellowed[t].has(team.players[i].id) ? -6 : 0)
            if (v < wv && this.pickBench(t, s) >= 0) { wv = v; worst = s }
          }
          if (worst >= 0) this.doSub(t, worst, this.pickBench(t, worst))
        }
        const diff = this.score[t] - this.score[o]
        const base = team.tactic.mentality
        if (min >= 60 && diff < 0) team.tactic.mentality = Math.min(90, base + 12)
        if (min >= 72 && diff > 0) { team.tactic.mentality = Math.max(25, base - 12); team.tactic.timeWasting = 50 }
      }
    }
  }
  private rested: [number, number] = [0, 0]
  /**
   * Protect a key player: among the best five outfielders still on, take off the one who most needs it
   * (lowest energy, or carrying a yellow card) provided the bench has a real replacement for his position.
   */
  private restKeyPlayer(t: 0 | 1): boolean {
    const team = this.teams[t]
    const q = (i: number) => team.players[i].attrs.reduce((a, b) => a + b, 0)
    const onPitch: number[] = []
    for (let s = 1; s < 11; s++) if (this.on[t][s] >= 0) onPitch.push(s)
    const key = [...onPitch].sort((a, b) => q(this.on[t][b]) - q(this.on[t][a])).slice(0, 5)
    let best = -1
    let bv = -1
    for (const s of key) {
      const i = this.on[t][s]
      if (this.ps[t][i].subOn || this.pickBench(t, s) < 0) continue // do not hook a substitute; need cover
      const v = (100 - this.energy[t][i]) + (this.yellowed[t].has(team.players[i].id) ? 12 : 0)
      if (v > bv) { bv = v; best = s }
    }
    if (best < 0 || bv < 18) return false // everyone still fresh: no need
    this.doSub(t, best, this.pickBench(t, best))
    this.rested[t]++
    return true
  }
  private blooded: [number, number] = [0, 0]
  /**
   * Bring on the best unused prospect for an outfielder in a position he can genuinely play, taking off
   * whoever has least to gain from staying on (established, tired, or already booked). Never the goalkeeper.
   */
  private bloodProspect(t: 0 | 1): boolean {
    const team = this.teams[t]
    let best: { s: number; b: number; v: number } | null = null
    team.players.forEach((bp, b) => {
      if (this.ps[t][b].played || !team.tactic.bench.includes(bp.id) || bp.pos[0] === 'GK' || (bp.prospect ?? 0) < 0.25) return
      for (let s = 1; s < 11; s++) {
        const i = this.on[t][s]
        if (i < 0) continue
        const cur = team.players[i]
        const pen = positionPenalty(bp.pos, this.slots[t][s].pos)
        if (pen > 3 || (cur.prospect ?? 0) >= 0.25) continue // no square pegs, and do not hook another youngster
        const v = (bp.prospect ?? 0) * 10 - pen + (100 - this.energy[t][i]) * 0.06 + (this.yellowed[t].has(cur.id) ? 1.5 : 0) + Math.min(2, this.ps[t][i].mins / 45)
        if (!best || v > best.v) best = { s, b, v }
      }
    })
    if (!best) return false
    const pick = best as { s: number; b: number; v: number }
    this.doSub(t, pick.s, pick.b)
    this.blooded[t]++
    return true
  }
  needsSub(t: 0 | 1) { return this.mustSub[t] }
  /** Hand a side to its coach (substitutions and in-game adjustments) or take it back. */
  setAi(t: 0 | 1, on: boolean) {
    this.teams[t].ai = on
    if (!on) return
    const { min } = this.minute()
    // do not replay review points that have already gone by
    while (this.aiSubMarks[t] < SUB_MARKS.length && SUB_MARKS[this.aiSubMarks[t]] < min - 4) this.aiSubMarks[t]++
    for (const id of [...this.mustSub[t]]) {
      const s = this.on[t].findIndex((i) => i >= 0 && this.teams[t].players[i].id === id)
      if (s >= 0) this.forceSub(t, s)
    }
  }

  snapshot(): MatchSnapshot {
    const tot = this.possTime[0] + this.possTime[1] || 1
    const ts = this.ts.map((x, i) => ({ ...x, possession: i === 0 ? Math.round((this.possTime[0] / tot) * 100) : 100 - Math.round((this.possTime[0] / tot) * 100) })) as [TStats, TStats]
    const { min, plus } = this.minute()
    return {
      min, plus, period: this.period, done: this.done, score: [...this.score] as [number, number], pens: this.pens, stats: ts,
      players: this.ps, on: [this.on[0].map((i) => (i >= 0 ? this.teams[0].players[i].id : -1)), this.on[1].map((i) => (i >= 0 ? this.teams[1].players[i].id : -1))],
      energy: [this.energy[0].map(Math.round), this.energy[1].map(Math.round)],
      subsLeft: [this.opts.subs - this.subsUsed[0], this.opts.subs - this.subsUsed[1]],
      momentum: this.momentum, tactics: [this.teams[0].tactic, this.teams[1].tactic],
    }
  }
}
