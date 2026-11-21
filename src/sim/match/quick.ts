/**
 * Expected goals for each side in a quick-result match, from the strength gap (home minus away, on the
 * same scale as player overalls). Used for club matches and age-group matches between other nations.
 * The constants are fitted to the full match engine so that all paths give the same kind of scoreline
 * for the same match-up: see tools/parity.ts.
 */
export const QUICK = { base: 1.28, slope: 0.052, home: 1.1, away: 0.91 }
export function expectedGoals(gap: number, neutral: boolean): [number, number] {
  const h = QUICK.base * Math.exp(QUICK.slope * gap)
  const a = QUICK.base * Math.exp(-QUICK.slope * gap)
  return neutral ? [h, a] : [h * QUICK.home, a * QUICK.away]
}
