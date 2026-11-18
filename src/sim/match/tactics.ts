import type { Pos } from '../data/raw'

export interface Slot {
  pos: Pos
  /** 0 = own goal line, 1 = opponent goal line. */
  x: number
  /** 0 = left touchline, 1 = right. */
  y: number
}

const S = (pos: Pos, x: number, y: number): Slot => ({ pos, x, y })
const GK = S('GK', 0.04, 0.5)
export const FORMATIONS: Record<string, Slot[]> = {
  '4-3-3': [GK, S('RB', 0.24, 0.86), S('CB', 0.2, 0.62), S('CB', 0.2, 0.38), S('LB', 0.24, 0.14), S('DM', 0.36, 0.5), S('CM', 0.48, 0.68), S('CM', 0.48, 0.32), S('RW', 0.7, 0.86), S('LW', 0.7, 0.14), S('ST', 0.78, 0.5)],
  '4-2-3-1': [GK, S('RB', 0.24, 0.86), S('CB', 0.2, 0.62), S('CB', 0.2, 0.38), S('LB', 0.24, 0.14), S('DM', 0.38, 0.62), S('DM', 0.38, 0.38), S('RW', 0.62, 0.86), S('AM', 0.6, 0.5), S('LW', 0.62, 0.14), S('ST', 0.78, 0.5)],
  '4-4-2': [GK, S('RB', 0.24, 0.86), S('CB', 0.2, 0.62), S('CB', 0.2, 0.38), S('LB', 0.24, 0.14), S('RW', 0.52, 0.86), S('CM', 0.44, 0.62), S('CM', 0.44, 0.38), S('LW', 0.52, 0.14), S('ST', 0.76, 0.6), S('ST', 0.76, 0.4)],
  '4-1-4-1': [GK, S('RB', 0.24, 0.86), S('CB', 0.2, 0.62), S('CB', 0.2, 0.38), S('LB', 0.24, 0.14), S('DM', 0.34, 0.5), S('RW', 0.54, 0.86), S('CM', 0.5, 0.64), S('CM', 0.5, 0.36), S('LW', 0.54, 0.14), S('ST', 0.78, 0.5)],
  '4-4-2 diamond': [GK, S('RB', 0.26, 0.86), S('CB', 0.2, 0.62), S('CB', 0.2, 0.38), S('LB', 0.26, 0.14), S('DM', 0.34, 0.5), S('CM', 0.46, 0.7), S('CM', 0.46, 0.3), S('AM', 0.6, 0.5), S('ST', 0.76, 0.6), S('ST', 0.76, 0.4)],
  '3-5-2': [GK, S('CB', 0.2, 0.72), S('CB', 0.18, 0.5), S('CB', 0.2, 0.28), S('RB', 0.42, 0.9), S('LB', 0.42, 0.1), S('DM', 0.36, 0.5), S('CM', 0.5, 0.66), S('CM', 0.5, 0.34), S('ST', 0.76, 0.6), S('ST', 0.76, 0.4)],
  '3-4-3': [GK, S('CB', 0.2, 0.72), S('CB', 0.18, 0.5), S('CB', 0.2, 0.28), S('RB', 0.44, 0.9), S('LB', 0.44, 0.1), S('CM', 0.42, 0.62), S('CM', 0.42, 0.38), S('RW', 0.7, 0.8), S('LW', 0.7, 0.2), S('ST', 0.78, 0.5)],
  '5-3-2': [GK, S('RB', 0.28, 0.9), S('CB', 0.2, 0.7), S('CB', 0.17, 0.5), S('CB', 0.2, 0.3), S('LB', 0.28, 0.1), S('DM', 0.36, 0.5), S('CM', 0.46, 0.68), S('CM', 0.46, 0.32), S('ST', 0.74, 0.6), S('ST', 0.74, 0.4)],
  '5-4-1': [GK, S('RB', 0.26, 0.9), S('CB', 0.2, 0.7), S('CB', 0.17, 0.5), S('CB', 0.2, 0.3), S('LB', 0.26, 0.1), S('RW', 0.5, 0.84), S('CM', 0.42, 0.62), S('CM', 0.42, 0.38), S('LW', 0.5, 0.16), S('ST', 0.76, 0.5)],
  '4-3-1-2': [GK, S('RB', 0.26, 0.86), S('CB', 0.2, 0.62), S('CB', 0.2, 0.38), S('LB', 0.26, 0.14), S('DM', 0.36, 0.5), S('CM', 0.46, 0.7), S('CM', 0.46, 0.3), S('AM', 0.62, 0.5), S('ST', 0.76, 0.6), S('ST', 0.76, 0.4)],
}
export const FORMATION_KEYS = Object.keys(FORMATIONS)

export interface RoleDef {
  key: string
  name: string
  for: Pos[]
  blurb: string
  /** Positional shift when attacking (metres forward / toward centre). */
  fwd: number
  inside: number
  /** Multipliers on action choice. */
  shoot: number
  dribble: number
  cross: number
  risk: number
  press: number
  /** Likelihood of being targeted by long balls / crosses. */
  target: number
}
const R = (key: string, name: string, f: Pos[], blurb: string, m: Partial<RoleDef> = {}): RoleDef => ({
  key, name, for: f, blurb, fwd: 0, inside: 0, shoot: 1, dribble: 1, cross: 1, risk: 1, press: 1, target: 1, ...m,
})
export const ROLES: RoleDef[] = [
  R('gk', 'Goalkeeper', ['GK'], 'Stays on the line and distributes safely.'),
  R('sk', 'Sweeper keeper', ['GK'], 'Starts higher and plays out from the back.', { fwd: 6, risk: 1.2 }),
  R('cd', 'Central defender', ['CB'], 'Defends first, keeps passes simple.', { risk: 0.8 }),
  R('bpd', 'Ball-playing defender', ['CB'], 'Steps out and looks for progressive passes.', { risk: 1.3, fwd: 2 }),
  R('fb', 'Full back', ['RB', 'LB'], 'Balanced: supports attacks, holds the line.', { fwd: 4 }),
  R('wb', 'Wing back', ['RB', 'LB'], 'Bombs forward and delivers crosses.', { fwd: 12, cross: 1.5, dribble: 1.2 }),
  R('ifb', 'Inverted full back', ['RB', 'LB'], 'Tucks into midfield in possession.', { fwd: 6, inside: 12, cross: 0.4, risk: 1.1 }),
  R('anc', 'Anchor', ['DM'], 'Screens the defence and rarely leaves position.', { fwd: -4, risk: 0.7, shoot: 0.5 }),
  R('bwm', 'Ball winner', ['DM', 'CM'], 'Hunts the ball aggressively.', { press: 1.5, risk: 0.9 }),
  R('dlp', 'Deep playmaker', ['DM', 'CM'], 'Dictates play from deep with range.', { risk: 1.4, fwd: -2, shoot: 0.7 }),
  R('b2b', 'Box to box', ['CM'], 'Covers ground at both ends.', { fwd: 5, press: 1.2, shoot: 1.2 }),
  R('ap', 'Advanced playmaker', ['CM', 'AM'], 'Finds pockets and plays the final ball.', { fwd: 4, risk: 1.5 }),
  R('ss', 'Shadow striker', ['AM'], 'Arrives late in the box to finish.', { fwd: 9, shoot: 1.6, risk: 0.9 }),
  R('w', 'Winger', ['RW', 'LW'], 'Hugs the touchline, beats his man, crosses.', { cross: 1.6, dribble: 1.3, inside: -3 }),
  R('if', 'Inside forward', ['RW', 'LW'], 'Cuts inside to shoot or combine.', { inside: 10, shoot: 1.5, cross: 0.5, dribble: 1.3, fwd: 3 }),
  R('af', 'Advanced forward', ['ST'], 'Leads the line and runs in behind.', { fwd: 3, shoot: 1.2 }),
  R('tf', 'Target forward', ['ST'], 'Holds the ball up and wins headers.', { target: 2.2, dribble: 0.6, fwd: 1 }),
  R('f9', 'False nine', ['ST'], 'Drops deep to link play.', { fwd: -9, risk: 1.4, shoot: 0.8 }),
  R('poa', 'Poacher', ['ST'], 'Lives on the last shoulder; shoots on sight.', { fwd: 5, shoot: 1.5, risk: 0.7, press: 0.6 }),
]
export const ROLE: Record<string, RoleDef> = Object.fromEntries(ROLES.map((r) => [r.key, r]))
export const rolesFor = (pos: Pos) => ROLES.filter((r) => r.for.includes(pos))
export const defaultRole = (pos: Pos) => rolesFor(pos)[0].key

export interface Tactic {
  formation: string
  /** Role key per slot (11). */
  roles: string[]
  /** Player id per slot (11); -1 = empty. */
  lineup: number[]
  bench: number[]
  /** Sliders 0–100. */
  mentality: number
  tempo: number
  width: number
  pressing: number
  line: number
  directness: number
  tackling: number
  timeWasting: number
  captain: number
  pens: number
  freeKicks: number
  corners: number
}
export const SLIDERS: { key: keyof Tactic; name: string; lo: string; hi: string; blurb: string }[] = [
  { key: 'mentality', name: 'Mentality', lo: 'Defensive', hi: 'Attacking', blurb: 'How many players commit forward and how much risk the team takes.' },
  { key: 'tempo', name: 'Tempo', lo: 'Patient', hi: 'Fast', blurb: 'How quickly the ball is moved. Fast creates more chances and more turnovers.' },
  { key: 'width', name: 'Width', lo: 'Narrow', hi: 'Wide', blurb: 'How far apart the team spreads when it has the ball.' },
  { key: 'pressing', name: 'Pressing', lo: 'Stand off', hi: 'Intense', blurb: 'How hard players close down. Intense wins the ball higher but tires the team.' },
  { key: 'line', name: 'Defensive line', lo: 'Deep', hi: 'High', blurb: 'Where the back line holds. High squeezes space but risks balls in behind.' },
  { key: 'directness', name: 'Passing', lo: 'Short', hi: 'Direct', blurb: 'Short keeps the ball; direct goes forward early and long.' },
  { key: 'tackling', name: 'Tackling', lo: 'Stay on feet', hi: 'Get stuck in', blurb: 'Harder tackling wins more duels and concedes more fouls and cards.' },
  { key: 'timeWasting', name: 'Time wasting', lo: 'Never', hi: 'Often', blurb: 'Slows restarts and keeps the ball in safe areas to protect a lead.' },
]

export function emptyTactic(formation = '4-3-3'): Tactic {
  return {
    formation,
    roles: FORMATIONS[formation].map((s) => defaultRole(s.pos)),
    lineup: new Array(11).fill(-1),
    bench: [],
    mentality: 50, tempo: 50, width: 50, pressing: 50, line: 50, directness: 45, tackling: 50, timeWasting: 0,
    captain: -1, pens: -1, freeKicks: -1, corners: -1,
  }
}
