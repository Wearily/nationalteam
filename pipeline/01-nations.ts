// Nations: FIFA codes, confederations, AFC sub-regions and latest ranking, all parsed from
// en.wikipedia Module:SportsRankings/data/FIFA World Rankings (which mirrors FIFA's published table).
import { wikitext, writeJson, OUT } from './lib.ts'
import { join } from 'node:path'

const src = wikitext('Module:SportsRankings/data/FIFA World Rankings')
if (!src) throw new Error('rankings module unavailable')
const upd = src.match(/data\.updated\s*=\s*\{\s*day\s*=\s*(\d+),\s*month\s*=\s*'(\w+)',\s*year\s*=\s*(\d+)/)
const rankDate = upd ? `${upd[1]} ${upd[2]} ${upd[3]}` : 'unknown'

const rankBlock = src.slice(src.indexOf('data.rankings'), src.indexOf('data.alias'))
const ranks = new Map<string, { rank: number; pts: number }>()
for (const m of rankBlock.matchAll(/\{\s*"([^"]+)",\s*(\d+),\s*-?\d+,\s*([\d.]+)\s*\}/g)) ranks.set(m[1], { rank: +m[2], pts: +m[3] })

const aliasBlock = src.slice(src.indexOf('data.alias'), src.indexOf('data.confederation') > 0 ? src.indexOf('data.confederation') : undefined)
const codeNames = new Map<string, string[]>()
for (const m of aliasBlock.matchAll(/\{\s*"([A-Z]{3})",\s*"([^"]+)"\s*\}/g)) codeNames.set(m[1], [...(codeNames.get(m[1]) ?? []), m[2]])
const codeName = new Map([...codeNames].map(([c, ns]) => [c, ns.find(n => ranks.has(n)) ?? ns[0]] as [string, string]))

function group(name: string): string[] {
  const m = src!.match(new RegExp(`\\b${name}\\s*=\\s*\\{([^}]*)\\}`))
  return m ? [...m[1].matchAll(/"([A-Z]{3})"/g)].map(x => x[1]) : []
}
const confedOf = new Map<string, string>()
for (const c of ['AFC', 'CAF', 'CONCACAF', 'CONMEBOL', 'OFC', 'UEFA']) for (const code of group(c)) confedOf.set(code, c)
const regionOf = new Map<string, string>()
for (const r of ['WAFF', 'CAFA', 'SAFF', 'AFF', 'EAFF']) for (const code of group(r)) regionOf.set(code, r)

// Friendlier display names than FIFA's official ones.
const DISPLAY: Record<string, string> = { IRN: 'Iran', KOR: 'South Korea', PRK: 'North Korea', CHN: 'China', USA: 'United States', TUR: 'Turkey', CIV: 'Ivory Coast', COD: 'DR Congo', CPV: 'Cape Verde', KGZ: 'Kyrgyzstan', HKG: 'Hong Kong', BRU: 'Brunei', GAM: 'Gambia', CZE: 'Czech Republic', SKN: 'Saint Kitts and Nevis', LCA: 'Saint Lucia', VIN: 'Saint Vincent and the Grenadines', IRL: 'Republic of Ireland', TPE: 'Chinese Taipei' }
// Home kit primary/secondary colours — hand-entered for nations most likely to appear on screen.
const COLORS: Record<string, [string, string]> = {
  IRN: ['#FFFFFF', '#DA0000'], JPN: ['#1B2A6B', '#FFFFFF'], KOR: ['#E0002B', '#111111'], AUS: ['#FFCD00', '#00843D'], KSA: ['#006C35', '#FFFFFF'], QAT: ['#8A1538', '#FFFFFF'], IRQ: ['#007A3D', '#FFFFFF'], UAE: ['#FFFFFF', '#CE1126'], UZB: ['#FFFFFF', '#0099B5'], JOR: ['#FFFFFF', '#CE1126'], OMA: ['#DB161B', '#FFFFFF'], BHR: ['#CE1126', '#FFFFFF'], SYR: ['#CE1126', '#FFFFFF'], CHN: ['#DE2910', '#FFDE00'], PRK: ['#ED1C27', '#FFFFFF'], KUW: ['#0057B8', '#FFFFFF'], LBN: ['#ED1C24', '#FFFFFF'], PLE: ['#FFFFFF', '#149954'], TJK: ['#CC0000', '#FFFFFF'], KGZ: ['#E8112D', '#FFEF00'], TKM: ['#00843D', '#FFFFFF'], AFG: ['#D32011', '#FFFFFF'], IND: ['#1E90FF', '#FF9933'], THA: ['#1C3F94', '#FFFFFF'], VIE: ['#DA251D', '#FFFF00'], IDN: ['#CE1126', '#FFFFFF'], MAS: ['#FFD700', '#111111'], YEM: ['#CE1126', '#FFFFFF'], HKG: ['#DE2910', '#FFFFFF'],
  ESP: ['#C60B1E', '#FFC400'], ARG: ['#75AADB', '#FFFFFF'], FRA: ['#21304D', '#FFFFFF'], ENG: ['#FFFFFF', '#1B2A6B'], POR: ['#C8102E', '#046A38'], BRA: ['#FFDF00', '#009C3B'], MAR: ['#C1272D', '#006233'], BEL: ['#E30613', '#111111'], NED: ['#F36C21', '#FFFFFF'], MEX: ['#006847', '#FFFFFF'], COL: ['#FCD116', '#003893'], SUI: ['#D52B1E', '#FFFFFF'], GER: ['#FFFFFF', '#111111'], CRO: ['#FFFFFF', '#ED1C24'], ITA: ['#0066B2', '#FFFFFF'], USA: ['#FFFFFF', '#1F2742'], SEN: ['#FFFFFF', '#00853F'], NOR: ['#BA0C2F', '#00205B'], URU: ['#5CBFEB', '#111111'], DEN: ['#C60C30', '#FFFFFF'], AUT: ['#ED2939', '#FFFFFF'], ECU: ['#FFD100', '#034EA2'], EGY: ['#CE1126', '#FFFFFF'], CAN: ['#D52B1E', '#FFFFFF'], ALG: ['#FFFFFF', '#006233'], CIV: ['#F77F00', '#FFFFFF'], NGA: ['#008751', '#FFFFFF'], TUR: ['#E30A17', '#FFFFFF'], PAR: ['#D52B1E', '#FFFFFF'], SWE: ['#FECC02', '#006AA7'], RUS: ['#D52B1E', '#FFFFFF'], UKR: ['#FFD500', '#005BBB'], POL: ['#FFFFFF', '#DC143C'], WAL: ['#C8102E', '#FFFFFF'], SCO: ['#0A1E4B', '#FFFFFF'], GRE: ['#FFFFFF', '#0D5EAF'], SRB: ['#C6363C', '#FFFFFF'],
}

const nations = [...codeName].map(([code, fifaName]) => {
  const r = ranks.get(fifaName)
  return { code, name: DISPLAY[code] ?? fifaName, fifaName, confed: confedOf.get(code), fifaPoints: r?.pts, fifaRank: r?.rank, colors: COLORS[code], region: regionOf.get(code) }
})
const ranked = nations.filter(n => n.fifaRank && n.confed)
const dropped = nations.filter(n => !(n.fifaRank && n.confed))
console.log(`ranking date ${rankDate}; ${ranked.length} ranked FIFA members; dropped ${dropped.length}: ${dropped.map(d => d.code + ':' + d.fifaName).join(', ')}`)
const unusedRank = [...ranks.keys()].filter(k => !nations.some(n => n.fifaName === k))
if (unusedRank.length) console.log('ranking rows without code:', unusedRank.join(', '))
ranked.sort((a, b) => a.fifaRank! - b.fifaRank!)
writeJson(join(OUT, 'nations.json'), { rankDate, nations: ranked })
