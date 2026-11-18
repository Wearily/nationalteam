import { clamp } from '../core/rng'
import type { Player } from '../world/types'

export interface DynOvr {
  /** Baseline (true ability) overall. */
  base: number
  form: number
  morale: number
  fitness: number
  total: number
  /** Current overall after form, morale and fitness. */
  ovr: number
  /** Short labels for the UI. */
  formLabel: string
  moraleLabel: string
  fitnessLabel: string
}

/**
 * Dynamic overall: a player's rating moves with recent club ratings, morale, and match fitness
 * (sharpness from playing time plus current condition). The same deltas feed squad selection,
 * line-ups and the match engine, so an in-form 74 can genuinely outplay a rusty 77.
 */
export function dynOvr(p: Player): DynOvr {
  let form = 0
  let formLabel = 'No recent matches'
  if (p.form.length >= 3) {
    const recent = p.form.slice(-5)
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length
    form = clamp(Math.round((avg - 7.0) * 2.2), -3, 3)
    formLabel = avg >= 7.7 ? 'Excellent' : avg >= 7.25 ? 'Good' : avg >= 6.75 ? 'Steady' : avg >= 6.3 ? 'Poor' : 'Very poor'
  }
  const morale = p.morale >= 85 ? 1 : p.morale >= 40 ? 0 : p.morale >= 22 ? -1 : -2
  const moraleLabel = p.morale >= 85 ? 'Delighted' : p.morale >= 65 ? 'Happy' : p.morale >= 40 ? 'Content' : p.morale >= 22 ? 'Unhappy' : 'Miserable'
  let fitness = p.sharp >= 97 ? 1 : p.sharp >= 58 ? 0 : p.sharp >= 38 ? -1 : -2
  if (p.cond < 60) fitness -= 2
  else if (p.cond < 78) fitness -= 1
  if (p.injury) fitness = Math.min(fitness, -3)
  fitness = clamp(fitness, -4, 1)
  const fitnessLabel = p.injury ? 'Injured' : p.cond < 60 ? 'Exhausted' : p.cond < 78 ? 'Tired' : p.sharp >= 90 ? 'Match sharp' : p.sharp >= 58 ? 'Fit' : p.sharp >= 38 ? 'Lacking minutes' : 'Rusty'
  const total = clamp(form + morale + fitness, -7, 5)
  return { base: p.ovr, form, morale, fitness, total, ovr: clamp(p.ovr + total, 1, 99), formLabel, moraleLabel, fitnessLabel }
}

/** The part applied inside the match engine: tiredness is already modelled there as energy. */
export function engineDelta(p: Player): number {
  const d = dynOvr(p)
  const sharpOnly = p.sharp >= 97 ? 1 : p.sharp >= 58 ? 0 : p.sharp >= 38 ? -1 : -2
  return clamp(d.form + d.morale + sharpOnly, -6, 5)
}
