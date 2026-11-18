import { clamp, type Rng } from '../core/rng'
import type { Pos } from '../data/raw'

/** The 33 underlying attributes (1–99) the match engine reads. Order is the storage order. */
export const ATTRS = [
  // technical
  'finishing', 'longShots', 'firstTouch', 'dribbling', 'passing', 'crossing', 'technique', 'heading',
  'tackling', 'marking', 'setPieces', 'penalties',
  // mental
  'decisions', 'anticipation', 'composure', 'vision', 'offTheBall', 'positioning', 'workRate',
  'aggression', 'leadership', 'teamwork',
  // physical
  'pace', 'acceleration', 'agility', 'strength', 'stamina', 'jumping',
  // goalkeeping
  'handling', 'reflexes', 'command', 'oneOnOnes', 'kicking',
] as const
export type Attr = (typeof ATTRS)[number]
export const A = Object.fromEntries(ATTRS.map((a, i) => [a, i])) as Record<Attr, number>
export const N_ATTR = ATTRS.length

export const ATTR_LABEL: Record<Attr, string> = {
  finishing: 'Finishing', longShots: 'Long shots', firstTouch: 'First touch', dribbling: 'Dribbling',
  passing: 'Passing', crossing: 'Crossing', technique: 'Technique', heading: 'Heading',
  tackling: 'Tackling', marking: 'Marking', setPieces: 'Set pieces', penalties: 'Penalties',
  decisions: 'Decisions', anticipation: 'Anticipation', composure: 'Composure', vision: 'Vision',
  offTheBall: 'Off the ball', positioning: 'Positioning', workRate: 'Work rate', aggression: 'Aggression',
  leadership: 'Leadership', teamwork: 'Teamwork', pace: 'Pace', acceleration: 'Acceleration',
  agility: 'Agility', strength: 'Strength', stamina: 'Stamina', jumping: 'Jumping',
  handling: 'Handling', reflexes: 'Reflexes', command: 'Command of area', oneOnOnes: 'One on ones',
  kicking: 'Kicking',
}
export const ATTR_GROUPS: { name: string; attrs: Attr[] }[] = [
  { name: 'Technical', attrs: ATTRS.slice(0, 12) as unknown as Attr[] },
  { name: 'Mental', attrs: ATTRS.slice(12, 22) as unknown as Attr[] },
  { name: 'Physical', attrs: ATTRS.slice(22, 28) as unknown as Attr[] },
  { name: 'Goalkeeping', attrs: ATTRS.slice(28) as unknown as Attr[] },
]

type W = Partial<Record<Attr, number>>
/** How much each attribute matters for the overall at a position. */
export const POS_WEIGHTS: Record<Pos, W> = {
  GK: { handling: 5, reflexes: 6, command: 3, oneOnOnes: 4, kicking: 2, positioning: 3, composure: 2, agility: 2, decisions: 2, jumping: 1 },
  CB: { tackling: 5, marking: 5, positioning: 5, heading: 4, strength: 4, anticipation: 4, jumping: 3, pace: 2, composure: 2, decisions: 3, passing: 2, aggression: 1 },
  RB: { tackling: 4, marking: 3, positioning: 3, pace: 4, acceleration: 3, stamina: 4, crossing: 3, passing: 2, anticipation: 3, workRate: 3, dribbling: 2, decisions: 2 },
  LB: { tackling: 4, marking: 3, positioning: 3, pace: 4, acceleration: 3, stamina: 4, crossing: 3, passing: 2, anticipation: 3, workRate: 3, dribbling: 2, decisions: 2 },
  DM: { tackling: 5, positioning: 5, anticipation: 4, passing: 4, decisions: 4, workRate: 3, stamina: 3, strength: 3, marking: 3, composure: 3, firstTouch: 2, teamwork: 2 },
  CM: { passing: 5, decisions: 4, vision: 4, firstTouch: 4, workRate: 3, stamina: 3, technique: 3, tackling: 2, composure: 3, anticipation: 3, offTheBall: 2, longShots: 2, teamwork: 2 },
  AM: { passing: 4, vision: 5, technique: 4, firstTouch: 4, dribbling: 4, composure: 3, decisions: 3, offTheBall: 3, longShots: 3, finishing: 2, agility: 2, acceleration: 2 },
  RW: { dribbling: 5, pace: 4, acceleration: 4, crossing: 3, technique: 3, firstTouch: 3, offTheBall: 3, finishing: 3, agility: 3, passing: 2, vision: 2, composure: 2 },
  LW: { dribbling: 5, pace: 4, acceleration: 4, crossing: 3, technique: 3, firstTouch: 3, offTheBall: 3, finishing: 3, agility: 3, passing: 2, vision: 2, composure: 2 },
  ST: { finishing: 6, offTheBall: 5, composure: 4, heading: 3, firstTouch: 3, anticipation: 3, pace: 3, acceleration: 3, strength: 2, technique: 2, dribbling: 2, longShots: 1, penalties: 1 },
}

const weightVecs = {} as Record<Pos, Float32Array>
for (const p of Object.keys(POS_WEIGHTS) as Pos[]) {
  const v = new Float32Array(N_ATTR)
  let sum = 0
  for (const [k, w] of Object.entries(POS_WEIGHTS[p])) {
    v[A[k as Attr]] = w as number
    sum += w as number
  }
  for (let i = 0; i < N_ATTR; i++) v[i] /= sum
  weightVecs[p] = v
}

export function overallAt(attrs: ArrayLike<number>, pos: Pos): number {
  const w = weightVecs[pos]
  let s = 0
  for (let i = 0; i < N_ATTR; i++) s += attrs[i] * w[i]
  return Math.round(s)
}

/** Overall when played at `at`, given the positions the player is natural in. */
const GROUP: Record<Pos, number> = { GK: 0, CB: 1, RB: 2, LB: 2, DM: 3, CM: 4, AM: 5, RW: 6, LW: 6, ST: 7 }
const ADJ: [Pos, Pos, number][] = [
  ['CB', 'DM', 5], ['CB', 'RB', 6], ['CB', 'LB', 6], ['RB', 'LB', 3], ['RB', 'RW', 6], ['LB', 'LW', 6],
  ['DM', 'CM', 3], ['CM', 'AM', 4], ['AM', 'RW', 4], ['AM', 'LW', 4], ['AM', 'ST', 5], ['RW', 'LW', 2],
  ['RW', 'ST', 5], ['LW', 'ST', 5], ['DM', 'RB', 7], ['DM', 'LB', 7], ['CM', 'RW', 7], ['CM', 'LW', 7],
]
export function positionPenalty(natural: Pos[], at: Pos): number {
  if (natural.includes(at)) return 0
  let best = at === 'GK' || natural[0] === 'GK' ? 40 : 12
  for (const n of natural) {
    if (GROUP[n] === GROUP[at]) best = Math.min(best, 2)
    for (const [a, b, c] of ADJ) if ((a === n && b === at) || (b === n && a === at)) best = Math.min(best, c)
  }
  return best
}
export function effectiveOverall(attrs: ArrayLike<number>, natural: Pos[], at: Pos): number {
  return overallAt(attrs, at) - positionPenalty(natural, at)
}

export interface FaceStats { labels: string[]; values: number[] }
const mix = (attrs: ArrayLike<number>, parts: [Attr, number][]) =>
  Math.round(parts.reduce((s, [k, w]) => s + attrs[A[k]] * w, 0))
/** FC-style six-number summary for the player card. */
export function faceStats(attrs: ArrayLike<number>, pos: Pos): FaceStats {
  if (pos === 'GK')
    return {
      labels: ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'],
      values: [
        mix(attrs, [['reflexes', 0.5], ['agility', 0.5]]),
        mix(attrs, [['handling', 0.8], ['command', 0.2]]),
        mix(attrs, [['kicking', 1]]),
        mix(attrs, [['reflexes', 0.7], ['oneOnOnes', 0.3]]),
        mix(attrs, [['pace', 0.5], ['acceleration', 0.5]]),
        mix(attrs, [['positioning', 0.7], ['command', 0.3]]),
      ],
    }
  return {
    labels: ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'],
    values: [
      mix(attrs, [['pace', 0.55], ['acceleration', 0.45]]),
      mix(attrs, [['finishing', 0.45], ['longShots', 0.2], ['technique', 0.15], ['composure', 0.1], ['penalties', 0.1]]),
      mix(attrs, [['passing', 0.5], ['vision', 0.25], ['crossing', 0.15], ['setPieces', 0.1]]),
      mix(attrs, [['dribbling', 0.5], ['firstTouch', 0.25], ['agility', 0.15], ['technique', 0.1]]),
      mix(attrs, [['tackling', 0.35], ['marking', 0.3], ['positioning', 0.2], ['anticipation', 0.15]]),
      mix(attrs, [['strength', 0.4], ['stamina', 0.3], ['jumping', 0.15], ['aggression', 0.15]]),
    ],
  }
}

/**
 * Create a plausible attribute set whose overall at `pos` equals `target`.
 * Attributes that matter for the position cluster near the target; others fall away,
 * with per-player noise so two 70-rated strikers still differ.
 */
export function generateAttrs(rng: Rng, pos: Pos, target: number, age: number, heightCm = 180): number[] {
  const w = POS_WEIGHTS[pos]
  const maxW = Math.max(...(Object.values(w) as number[]))
  const out: number[] = new Array(N_ATTR)
  const isGk = pos === 'GK'
  for (let i = 0; i < N_ATTR; i++) {
    const k = ATTRS[i]
    const imp = ((w[k] as number) ?? 0) / maxW
    const gkAttr = i >= A.handling
    let base: number
    if (gkAttr && !isGk) base = 8 + rng.range(0, 10)
    else if (isGk && !gkAttr && imp === 0) base = target * 0.45 + rng.normal(0, 7)
    else base = target - (1 - imp) * (16 + rng.range(0, 10)) + rng.normal(0, 5.5)
    out[i] = base
  }
  // physical shaping by age and build
  const youth = clamp((23 - age) / 6, 0, 1)
  const old = clamp((age - 30) / 7, 0, 1)
  out[A.pace] -= old * 9; out[A.acceleration] -= old * 10; out[A.stamina] -= old * 5; out[A.agility] -= old * 5
  out[A.strength] -= youth * 7; out[A.decisions] -= youth * 5; out[A.composure] -= youth * 4; out[A.positioning] -= youth * 4
  out[A.decisions] += old * 5; out[A.positioning] += old * 4; out[A.leadership] += old * 10 - youth * 10
  const tall = (heightCm - 180) / 10
  out[A.jumping] += tall * 6; out[A.heading] += tall * 4; out[A.strength] += tall * 3
  out[A.agility] -= tall * 3; out[A.acceleration] -= tall * 2
  for (let i = 0; i < N_ATTR; i++) out[i] = clamp(Math.round(out[i]), 5, 99)
  return fitToOverall(out, pos, target)
}

/** Nudge weighted attributes until the overall matches exactly. */
export function fitToOverall(attrs: number[], pos: Pos, target: number): number[] {
  const wv = weightVecs[pos]
  for (let iter = 0; iter < 60; iter++) {
    const diff = target - overallAt(attrs, pos)
    if (diff === 0) break
    const step = diff > 0 ? 1 : -1
    for (let i = 0; i < N_ATTR; i++) if (wv[i] > 0) attrs[i] = clamp(attrs[i] + step * (Math.abs(diff) > 3 ? 2 : 1), 5, 99)
  }
  // fine adjust one attribute at a time
  let guard = 0
  while (overallAt(attrs, pos) !== target && guard++ < 200) {
    const step = target > overallAt(attrs, pos) ? 1 : -1
    let i = guard % N_ATTR
    while (wv[i] === 0) i = (i + 1) % N_ATTR
    attrs[i] = clamp(attrs[i] + step, 5, 99)
  }
  return attrs
}

export const POS_LIST: Pos[] = ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST']
export const POS_NAME: Record<Pos, string> = {
  GK: 'Goalkeeper', RB: 'Right back', CB: 'Centre back', LB: 'Left back', DM: 'Defensive mid',
  CM: 'Central mid', AM: 'Attacking mid', RW: 'Right wing', LW: 'Left wing', ST: 'Striker',
}
export const posLine = (p: Pos): 'GK' | 'DEF' | 'MID' | 'ATT' =>
  p === 'GK' ? 'GK' : p === 'CB' || p === 'RB' || p === 'LB' ? 'DEF' : p === 'ST' || p === 'RW' || p === 'LW' ? 'ATT' : 'MID'
