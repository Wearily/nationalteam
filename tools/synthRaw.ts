import type { RawData } from '../src/sim/data/raw'
/** Tiny made-up dataset for headless tests only (never shipped). */
export function synthRaw(): RawData {
  const afc = 'IRN JPN KOR AUS KSA QAT UAE IRQ UZB JOR OMA BHR SYR CHN PLE KGZ VIE LBN TJK THA PRK IDN MAS IND KUW TKM HKG YEM'.split(' ')
  const uefa = 'ESP FRA ENG GER ITA NED POR BEL CRO DEN SWE AUT GRE RUS TUR SRB'.split(' ')
  const other = 'BRA ARG USA CAN MAR SEN NGA EGY GHA CMR MLI GEO ARM'.split(' ')
  const nations = [
    ...afc.map((c, i) => ({ code: c, name: c, confed: 'AFC' as const, fifaPoints: [1620, 1650, 1590, 1570, 1420, 1450, 1380, 1400, 1440, 1390][i] ?? 1320 - i * 9, fifaRank: 0, region: ['IRN', 'UZB', 'KGZ', 'TJK', 'TKM'].includes(c) ? 'CAFA' : undefined })),
    ...uefa.map((c, i) => ({ code: c, name: c, confed: 'UEFA' as const, fifaPoints: 1870 - i * 22, fifaRank: 0 })),
    ...other.map((c, i) => ({ code: c, name: c, confed: (i < 2 ? 'CONMEBOL' : i < 4 ? 'CONCACAF' : i < 11 ? 'CAF' : 'UEFA') as 'CAF', fifaPoints: i < 2 ? 1850 : 1560 - i * 15, fifaRank: 0 })),
  ]
  nations.sort((a, b) => b.fifaPoints - a.fifaPoints).forEach((n, i) => (n.fifaRank = i + 1))
  const lgs: [string, string, string, number, number, number, number][] = [
    ['irn-pgpl', 'Persian Gulf Pro League', 'IRN', 1, 58, 8, 16], ['irn-azadegan', 'Azadegan League', 'IRN', 2, 40, 8, 18],
    ['uae-pro', 'UAE Pro League', 'UAE', 1, 62, 8, 14], ['bel-pro', 'Belgian Pro League', 'BEL', 1, 74, 7, 16], ['ned-ere', 'Eredivisie', 'NED', 1, 76, 8, 18],
    ['ita-a', 'Serie A', 'ITA', 1, 87, 8, 20], ['swe-all', 'Allsvenskan', 'SWE', 1, 62, 4, 16], ['other-usa', 'USA', 'USA', 1, 60, 3, 1],
  ]
  const leagues = lgs.map(([id, name, country, tier, strength, startMonth]) => ({ id, name, country, tier, strength, startMonth }))
  const clubs = lgs.flatMap(([id, , country, , strength, , n]) => Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, name: `${id.toUpperCase()} Club ${i + 1}`, country, league: id, rep: Math.round(strength + 10 - (i * 20) / n) })))
  const players = [
    { id: 'Q1', name: 'Test Striker', dob: '1992-07-18', nat: ['IRN'], pos: ['ST' as const], club: 'ita-a-3', caps: 90, goals: 50 },
    { id: 'Q2', name: 'Test Winger', dob: '1999-03-02', nat: ['IRN'], pos: ['RW' as const], club: 'ned-ere-2', caps: 30, goals: 6 },
    { id: 'Q3', name: 'Dual National', dob: '2004-05-05', nat: ['SWE', 'IRN'], pos: ['CM' as const], club: 'swe-all-1', born: 'SWE' },
  ]
  return { version: 1, asOf: '2026-11-18', players, clubs, leagues, nations, staff: [] }
}
