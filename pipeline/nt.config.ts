// Which national teams get real squads, and their en.wikipedia article titles.
import { readJson, OUT } from './lib.ts'
import { join } from 'node:path'
const TITLE: Record<string, string> = {
  USA: "United States men's national soccer team", AUS: "Australia men's national soccer team", CAN: "Canada men's national soccer team",
  NZL: "New Zealand men's national football team", KOR: 'South Korea national football team', PRK: 'North Korea national football team',
  CHN: 'China national football team', TPE: 'Chinese Taipei national football team', HKG: 'Hong Kong national football team',
  CIV: 'Ivory Coast national football team', COD: 'DR Congo national football team', TUR: 'Turkey national football team',
  CZE: 'Czech Republic national football team', KGZ: 'Kyrgyzstan national football team', IRL: 'Republic of Ireland national football team',
  CPV: 'Cape Verde national football team', BRU: 'Brunei national football team', TLS: 'Timor-Leste national football team', MAC: 'Macau national football team',
  IRN: 'Iran national football team', NGA: 'Nigeria national football team', WAL: 'Wales national football team',
}
export function ntTeams(): { code: string; title: string }[] {
  const { nations } = readJson<{ nations: any[] }>(join(OUT, 'nations.json'))
  return nations.filter(n => n.confed === 'AFC' || n.fifaRank <= 50).map(n => ({ code: n.code, title: TITLE[n.code] ?? `${n.name} national football team` }))
}
export const IRAN_YOUTH = [
  { key: 'u23', title: 'Iran national under-23 football team' },
  { key: 'u20', title: 'Iran national under-20 football team' },
  { key: 'u17', title: 'Iran national under-17 football team' },
]
