// Merge all stages into public/data/world.json and write data/REPORT.md.
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { ROOT, OUT, AS_OF, readJson, writeJson, norm, slug, sha } from './lib.ts'
import { bulkPeople, refInfo, titlesInfo, titlesCountry, entities, type Person, type P54 } from './wd.ts'
import type { PageInfo } from './04b-player-pages.ts'
import { REP, OTHER_STRENGTH } from './rep.config.ts'
import { LEAGUES } from './leagues.config.ts'

type Pos = 'GK' | 'RB' | 'CB' | 'LB' | 'DM' | 'CM' | 'AM' | 'RW' | 'LW' | 'ST'
interface Player { id: string; name: string; dob: string; nat: string[]; pos: Pos[]; club: string | null; heightCm?: number; caps?: number; goals?: number; capTied?: boolean; born?: string; num?: number; photo?: string; photoCredit?: string; src?: string }
const report: string[] = []; const fails: string[] = []; const stats: Record<string, any> = {}
const NOW_YEAR = Number(AS_OF.slice(0, 4))
const hash = (s: string) => parseInt(sha(s).slice(0, 8), 16)

// ---------------------------------------------------------------- nations
const { nations: natStage, rankDate } = readJson<{ nations: any[]; rankDate: string }>(join(OUT, 'nations.json'))
const nations = natStage.map(n => ({ code: n.code, name: n.name, confed: n.confed, fifaPoints: n.fifaPoints, fifaRank: n.fifaRank, ...(n.colors ? { colors: n.colors } : {}), ...(n.region ? { region: n.region } : {}) }))
const natCodes = new Set(nations.map(n => n.code))
const natByName = new Map<string, string>()
for (const n of natStage) { natByName.set(norm(n.name), n.code); natByName.set(norm(n.fifaName), n.code) }
const NAME_ALIAS: Record<string, string> = { 'united kingdom': 'ENG', 'united states of america': 'USA', 'united states': 'USA', "people s republic of china": 'CHN', 'china': 'CHN', 'south korea': 'KOR', 'north korea': 'PRK', 'turkey': 'TUR', 'turkiye': 'TUR', 'kingdom of the netherlands': 'NED', 'netherlands': 'NED', 'czech republic': 'CZE', 'ivory coast': 'CIV', 'democratic republic of the congo': 'COD', 'republic of the congo': 'CGO', 'the gambia': 'GAM', 'gambia': 'GAM', 'cape verde': 'CPV', 'ireland': 'IRL', 'republic of ireland': 'IRL', 'kyrgyzstan': 'KGZ', 'taiwan': 'TPE', 'state of palestine': 'PLE', 'palestine': 'PLE', 'kingdom of denmark': 'DEN', 'iran': 'IRN', 'pahlavi iran': 'IRN', 'islamic republic of iran': 'IRN', 'hong kong': 'HKG', 'russia': 'RUS', 'syria': 'SYR', 'brunei': 'BRU', 'east timor': 'TLS', 'macau': 'MAC', 'north macedonia': 'MKD', 'eswatini': 'SWZ', 'germany': 'GER', 'england': 'ENG', 'scotland': 'SCO', 'wales': 'WAL', 'northern ireland': 'NIR', 'federated states of micronesia': '', 'soviet union': '', 'kurdistan region': 'IRQ', 'french guiana': 'FRA', 'reunion': 'FRA', 'guadeloupe': 'FRA', 'martinique': 'FRA' }
const nameToCode = (label?: string): string | undefined => { if (!label) return undefined; const k = norm(label); const c = NAME_ALIAS[k] ?? natByName.get(k); return c && natCodes.has(c) ? c : undefined }
// flag-template codes used on Wikipedia (mix of FIFA / IOC / ISO) → FIFA
const CODE_ALIAS: Record<string, string> = { IRI: 'IRN', DEU: 'GER', NLD: 'NED', UK: 'ENG', GBR: 'ENG', CHE: 'SUI', PRT: 'POR', DNK: 'DEN', HRV: 'CRO', GRC: 'GRE', SAU: 'KSA', ARE: 'UAE', UAE: 'UAE', JAP: 'JPN', KSA: 'KSA', TKL: '', ROC: 'TPE', TWN: 'TPE', MYS: 'MAS', IDN: 'IDN', INA: 'IDN', VNM: 'VIE', PHL: 'PHI', SIN: 'SGP', BHR: 'BHR', OMN: 'OMA', KWT: 'KUW', LBN: 'LBN', LIB: 'LBN', PSE: 'PLE', PAL: 'PLE', ZAF: 'RSA', NGR: 'NGA', URS: '', BGR: 'BUL', ROM: 'ROU', SVN: 'SVN', SLO: 'SVN', LVA: 'LVA', LAT: 'LVA', PRY: 'PAR', URY: 'URU', CHL: 'CHI', CRI: 'CRC', HND: 'HON', GTM: 'GUA', SLV: 'SLV', HTI: 'HAI', BGD: 'BAN', NPL: 'NEP', LKA: 'SRI', MMR: 'MYA', KHM: 'CAM', MNG: 'MNG', MGL: 'MNG', BRN: 'BRU', DZA: 'ALG', ZMB: 'ZAM', ZWE: 'ZIM', SDN: 'SDN', TZA: 'TAN', AGO: 'ANG', MOZ: 'MOZ', BFA: 'BFA', GNQ: 'EQG', COG: 'CGO', DRC: 'COD', GIN: 'GUI', GMB: 'GAM', MRT: 'MTN', NER: 'NIG', TGO: 'TOG', SCG: 'SRB', BIH: 'BIH', IRE: 'IRL', EIR: 'IRL', TUR: 'TUR', NZ: 'NZL', US: 'USA', HKG: 'HKG', MAC: 'MAC', TLS: 'TLS', TJK: 'TJK', KGZ: 'KGZ', TKM: 'TKM' }
function fifaCode(raw?: string): string | undefined {
  if (!raw) return undefined
  const t = raw.replace(/\{\{|\}\}/g, '').trim(); const up = t.toUpperCase()
  if (natCodes.has(up)) return up
  if (CODE_ALIAS[up] !== undefined) return CODE_ALIAS[up] || undefined
  return nameToCode(t)
}

// ---------------------------------------------------------------- leagues & clubs
const lg = readJson<{ leagues: any[]; clubs: any[]; notes: string[] }>(join(OUT, 'leagues.json'))
const sq = readJson<{ clubSquads: any[]; nts: any[]; notes: string[] }>(join(OUT, 'squads.json'))
const leagues = new Map<string, any>(lg.leagues.map(l => [l.id, { id: l.id, name: l.name, country: l.country, tier: l.tier, strength: l.strength, startMonth: l.startMonth }]))
interface Club { id: string; name: string; short?: string; country: string; league: string; city?: string; stadium?: string; rep?: number; colors?: [string, string]; _titles: string[] }
const clubs = new Map<string, Club>()
const clubByTitle = new Map<string, string>(); const clubByKey = new Map<string, string>()
const STOP = new Set(['fc', 'f', 'c', 's', 'k', 'a', 'j', 'd', 'u', 'sc', 'cf', 'afc', 'club', 'football', 'fk', 'sk', 'bk', 'if', 'ff', 'ac', 'as', 'cd', 'ud', 'rcd', 'sv', 'vfl', 'vfb', 'tsg', 'csc', 'kv', 'krc', 'kaa', 'rsc', 'ssc', 'us', 'ss', 'ca', 'rc', 'cfc', 'sfk', 'jk', 'pfc', 'de', 'the', 'futbol', 'futebol', 'clube', 'calcio', 'sport', 'sports', 'cultural', 'and', 'fotbal', '1'])
function clubKey(s: string) { const toks = norm(s).split(' ').filter(t => t && !STOP.has(t)); return toks.join(' ') }
function indexClub(c: Club, ...names: (string | undefined)[]) {
  for (const n of names) { if (!n) continue; clubByTitle.set(norm(n), c.id); const k = `${c.country}|${clubKey(n)}`; if (clubKey(n) && !clubByKey.has(k)) clubByKey.set(k, c.id) }
}
for (const c of lg.clubs) {
  const L = leagues.get(c.league)
  let rep = REP[c.id]
  if (rep === undefined) rep = Math.round(L.strength - 2 + (c.ppg !== undefined && c.played >= 8 ? Math.max(-5, Math.min(6, (c.ppg - 1.35) * 7)) : 0))
  const club: Club = { id: c.id, name: c.name, country: c.country, league: c.league, city: c.city, stadium: c.stadium, rep, _titles: [c.title] }
  clubs.set(club.id, club); indexClub(club, c.title, c.name)
}
for (const s of sq.clubSquads) { const c = clubs.get(s.clubId); if (!c) continue; if (s.colors) c.colors = s.colors; if (s.short && s.short.length <= 20) c.short = s.short; if (!c.stadium && s.ground) c.stadium = s.ground; indexClub(c, s.fullname) }
const coveredCountries = new Map<string, number>()
for (const L of LEAGUES) coveredCountries.set(L.country, Math.min(coveredCountries.get(L.country) ?? 999, L.strength))
function otherLeague(code: string): string {
  const id = `other-${code.toLowerCase()}`
  if (!leagues.has(id)) {
    const n = natStage.find(x => x.code === code)!
    const strength = coveredCountries.has(code) ? Math.max(20, coveredCountries.get(code)! - 12) : OTHER_STRENGTH[code] ?? Math.max(20, Math.min(60, Math.round(20 + (n.fifaPoints - 800) / 20)))
    leagues.set(id, { id, name: `${n.name} — other clubs`, country: code, tier: coveredCountries.has(code) ? 3 : 1, strength, startMonth: 8 })
  }
  return id
}
let createdClubs = 0
/** Resolve a club reference (wiki title and/or display label, country code) to a club id, creating a generic club when needed. */
function resolveClub(title: string | undefined, label: string | undefined, country: string | undefined): string | null {
  for (const n of [title, label]) { if (!n) continue; const id = clubByTitle.get(norm(n)); if (id && (!country || clubs.get(id)!.country === country || n === title)) return id }
  if (country) for (const n of [title, label]) { if (!n) continue; const id = clubByKey.get(`${country}|${clubKey(n)}`); if (id) return id }
  if (!country || !natCodes.has(country)) return null
  const name = (label && label.length <= 40 ? label : title ?? label ?? '').replace(/\s*\(.*?\)\s*$/, '').trim()
  if (!name || !slug(name)) return null
  let id = `${country.toLowerCase()}-${slug(name)}`
  if (clubs.has(id)) { const ex = clubs.get(id)!; if (ex.league.startsWith('other-')) { indexClub(ex, title, label); return id } id += '-x' }
  const club: Club = { id, name, country, league: otherLeague(country), _titles: [title ?? name] }
  clubs.set(id, club); indexClub(club, title, label, name); createdClubs++
  return id
}

// ---------------------------------------------------------------- wikidata people
const sets = readJson<any>(join(OUT, 'wd-sets.json'))
const fifaTeam: Record<string, string> = sets.fifa
const seedQ: string[] = sets.seed.map((s: any) => s.qid).filter(Boolean)
const baseQ: string[] = [...new Set([...sets.iran, ...sets.bornInIran, ...sets.ethnic, ...sets.persianSpeaking, ...seedQ, ...sets.coaches])]
const people = bulkPeople(baseQ)

// titles referenced on Wikipedia pages → QIDs (+positions, dob)
const personTitles = new Set<string>()
for (const s of sq.clubSquads) { for (const p of s.players) if (p.title) personTitles.add(p.title); if (s.manager?.title) personTitles.add(s.manager.title); for (const st of s.staff ?? []) if (st.title) personTitles.add(st.title) }
for (const t of sq.nts) { for (const p of t.players) if (p.title) personTitles.add(p.title); if (t.coach?.title) personTitles.add(t.coach.title); for (const st of t.staff ?? []) if (st.title) personTitles.add(st.title) }
for (const c of lg.clubs) if (c.country === 'IRN' && c.managerTitle) personTitles.add(c.managerTitle)
const tinfo = titlesInfo([...personTitles])
stats.titlesLinked = personTitles.size; stats.titlesResolved = tinfo.size

// extra people needing full Wikidata detail: Iranian-club squad members, Iran NT (all levels) players, staff
const extraQ = new Set<string>()
const want = (title?: string) => { const q = title && tinfo.get(title)?.qid; if (q && !people.has(q)) extraQ.add(q) }
for (const s of sq.clubSquads) { for (const p of s.players) want(p.title); want(s.manager?.title); for (const st of s.staff ?? []) want(st.title) }
for (const t of sq.nts) if (t.code === 'IRN') { for (const p of t.players) want(p.title); want(t.coach?.title); for (const st of t.staff ?? []) want(st.title) }
for (const c of lg.clubs) if (c.country === 'IRN') want(c.managerTitle)
const faStage: { squads: any[]; notes: string[] } = existsSync(join(OUT, 'fa-squads.json')) ? readJson(join(OUT, 'fa-squads.json')) : { squads: [], notes: [] }
const faCurrent = (season?: string) => !!season && /140[56]|^0?5\s*[–-]|[–-]\s*0?6$|2026/.test(season)
for (const s of faStage.squads) if (faCurrent(s.season)) for (const p of s.players) if (p.qid && p.en && p.dob && !people.has(p.qid)) extraQ.add(p.qid)
const extra = bulkPeople([...extraQ])
for (const [k, v] of extra) people.set(k, v)

const pages: Record<string, PageInfo | null> = existsSync(join(OUT, 'player-pages.json')) ? readJson(join(OUT, 'player-pages.json')) : {}
const pageOf = (title?: string): PageInfo | undefined => { const p = title ? pages[title] : undefined; return p && p.isFootballer ? p : undefined }
stats.pagesRead = Object.keys(pages).length; stats.pagesMissing = Object.values(pages).filter(p => !p).length
// clubs named in infoboxes / NT tables that are outside the covered leagues need a country
const clubTitleRefs = new Set<string>()
for (const p of Object.values(pages)) { if (p?.currentClub?.title) clubTitleRefs.add(p.currentClub.title); if (p?.lastClub?.title) clubTitleRefs.add(p.lastClub.title) }
const clubTitleCountry = titlesCountry([...clubTitleRefs].filter(tt => !clubByTitle.has(norm(tt))))
const refs = new Set<string>()
for (const v of clubTitleCountry.values()) if (v.country) refs.add(v.country)
for (const p of people.values()) { for (const x of p.p54) refs.add(x.team); for (const k of ['P27', 'P1532', 'P413']) for (const v of p.props[k] ?? []) refs.add(v); for (const c of p.birthCountries) refs.add(c) }
for (const v of tinfo.values()) for (const p of v.pos) refs.add(p)
for (const s of faStage.squads) for (const p of s.players) for (const x of p.wdPos ?? []) refs.add(x)
const info = refInfo([...refs])

{ const more = [...info.values()].map(v => v.country).filter(c => c && !info.has(c)) as string[]; if (more.length) for (const [k, v] of refInfo(more)) info.set(k, v) }
const countryCode = (q?: string) => q ? (q === 'Q794' ? 'IRN' : nameToCode(info.get(q)?.label)) : undefined
function mapPos(label: string | undefined, seed: string): Pos | undefined {
  const l = (label ?? '').toLowerCase()
  if (!l) return undefined
  if (/goalkeeper/.test(l)) return 'GK'
  if (/left[- ]?(back|wing-back|wingback)|left defender/.test(l)) return 'LB'
  if (/right[- ]?(back|wing-back|wingback)|right defender|full[- ]?back|wing-?back/.test(l)) return 'RB'
  if (/centre[- ]?back|center[- ]?back|central defender|defender|sweeper|libero|stopper/.test(l)) return 'CB'
  if (/defensive midfield/.test(l)) return 'DM'
  if (/attacking midfield|playmaker/.test(l)) return 'AM'
  if (/left (wing|midfield)/.test(l)) return 'LW'
  if (/right (wing|midfield)/.test(l)) return 'RW'
  if (/winger|wide midfielder|outside/.test(l)) return hash(seed) % 2 ? 'RW' : 'LW'
  if (/midfield/.test(l)) return 'CM'
  if (/forward|striker|attacker/.test(l)) return 'ST'
  return undefined
}
const GROUP: Record<string, Pos[]> = { GK: ['GK'], DF: ['CB', 'RB', 'LB'], MF: ['CM', 'DM', 'AM', 'RW', 'LW'], FW: ['ST', 'RW', 'LW'] }
function coarseDefault(coarse: string, seed: string): Pos | undefined {
  const h = hash(seed) % 4
  switch (coarse) {
    case 'GK': return 'GK'
    case 'DF': return (['CB', 'CB', 'RB', 'LB'] as Pos[])[h]
    case 'MF': return (['CM', 'CM', 'DM', 'AM'] as Pos[])[h]
    case 'FW': return (['ST', 'ST', 'RW', 'LW'] as Pos[])[h]
  }
  return undefined
}
let posFromCoarseOnly = 0
const posLabels = (qs: string[] = []) => qs.map(q => info.get(q)?.label ?? '')
const pagePos = (pg?: PageInfo) => pg?.position ? pg.position.split(/[,\/;]|\band\b|\bor\b/i).map(s => s.trim()).filter(Boolean) : []
function positions(labels: string[], coarse: string | undefined, seed: string): Pos[] {
  const wd = [...new Set(labels.map(l => mapPos(l, seed)).filter(Boolean) as Pos[])]
  const c = coarse && GROUP[coarse] ? coarse : undefined
  if (!c) return wd
  const inGroup = wd.filter(p => GROUP[c].includes(p))
  if (inGroup.length) return [...inGroup, ...wd.filter(p => !inGroup.includes(p))].slice(0, 3)
  const d = coarseDefault(c, seed)!
  if (!wd.length) posFromCoarseOnly++
  return c === 'GK' ? ['GK'] : [d, ...wd.filter(p => p !== 'GK')].slice(0, 3)
}
function wdDob(p: Person): string | undefined {
  const all = (p.props.P569 ?? []).map(d => d.slice(0, 10)).filter(d => /^\d{4}-\d\d-\d\d$/.test(d)).sort()
  if (!all.length) return undefined
  // WDQS gives year-precision dates as YYYY-01-01; prefer a full date when several values exist
  const full = all.find(d => !d.endsWith('-01-01')) ?? all[0]
  return full.endsWith('-01-01') ? `${full.slice(0, 4)}-07-01` : full
}
const isNT = (team: string) => fifaTeam[team] !== undefined || /national .*team|olympic/i.test(info.get(team)?.label ?? '')
const isSeniorNT = (team: string) => isNT(team) && !/under|u-?\d\d|olympic|youth|futsal|beach|\bB\b|students|amateur|military/i.test(info.get(team)?.label ?? '')
const ntCode = (team: string) => fifaTeam[team] ?? nameToCode((info.get(team)?.label ?? '').replace(/ (men's )?national.*$/i, ''))

// current club from P54 statements
const ambiguous: string[] = []
function currentClubWD(p: Person, age: number): { team?: string; how: string } {
  const clubSt = p.p54.filter(s => !isNT(s.team))
  if (!clubSt.length) return { how: 'no-statements' }
  const open = clubSt.filter(s => !s.end)
  if (!open.length) return { how: 'all-ended' }
  const dated = open.filter(s => s.start).sort((a, b) => a.start! < b.start! ? 1 : -1)
  const latestEnd = clubSt.map(s => s.end).filter(Boolean).sort().pop()
  if (dated.length) {
    const s = dated[0]
    if (latestEnd && latestEnd > s.start! && Number(latestEnd.slice(0, 4)) - Number(s.start!.slice(0, 4)) > 3) return { how: 'stale' }
    return { team: s.team, how: 'dated' }
  }
  const distinct = [...new Set(open.map(s => s.team))]
  if (distinct.length === 1 && !latestEnd) return { team: distinct[0], how: 'single-undated' }
  return { how: 'ambiguous' }
}
function teamToClub(team: string): string | null {
  const t = info.get(team); if (!t) return null
  return resolveClub(t.enwiki, t.label, countryCode(t.country))
}

// ---------------------------------------------------------------- players
const players = new Map<string, Player>()
const byNameDob = new Map<string, string>()
const meta = new Map<string, { clubSrc: string; diaspora?: string }>()
const dropped: Record<string, number> = {}
const drop = (why: string) => { dropped[why] = (dropped[why] ?? 0) + 1 }
const photoWanted: Record<string, string> = {}
function addPlayer(pl: Player, clubSrc: string) { players.set(pl.id, pl); byNameDob.set(`${norm(pl.name)}|${pl.dob}`, pl.id); meta.set(pl.id, { clubSrc }) }

const iranSet = new Set<string>(sets.iran); const bornIranSet = new Set<string>(sets.bornInIran); const persianSet = new Set<string>(sets.persianSpeaking); const seedSet = new Set<string>(seedQ)
const EXCLUDE_ELIG = new Set(['AFG', 'IRQ', 'TJK', 'PAK', 'TUR', 'AZE', 'ARM', 'TKM'])

interface Built { pl: Player; club: { team?: string; how: string }; iranLink: string }
function buildFromWD(p: Person, coarse?: string): Built | null {
  if (!(p.props.P31 ?? []).includes('Q5')) return null
  if ((p.props.P21 ?? []).includes('Q6581072')) return null
  if (p.props.P570?.length) return null
  const dob = wdDob(p); if (!dob || !p.label) return null
  const age = NOW_YEAR - Number(dob.slice(0, 4))
  const cit = [...new Set((p.props.P27 ?? []).map(countryCode).filter(Boolean) as string[])]
  const sport = [...new Set((p.props.P1532 ?? []).map(countryCode).filter(Boolean) as string[])]
  const bornC = p.birthCountries.map(countryCode).filter(Boolean) as string[]
  const born = bornC.includes('IRN') ? 'IRN' : bornC[0]
  const ntCodes = p.p54.filter(s => isNT(s.team)).map(s => ntCode(s.team)).filter(Boolean) as string[]
  const seniorIran = p.p54.filter(s => isSeniorNT(s.team) && ntCode(s.team) === 'IRN')
  const representedIran = ntCodes.includes('IRN') || sport.includes('IRN')
  const otherRep = sport.find(c => c !== 'IRN') ?? ntCodes.find(c => c !== 'IRN')
  let nat: string[]; let iranLink = 'citizen'
  const hasIranCit = cit.includes('IRN') || sport.includes('IRN')
  const others = [...new Set([...sport, ...cit])].filter(c => c !== 'IRN')
  if (hasIranCit) {
    if (representedIran || !others.length) nat = ['IRN', ...others]
    else if (otherRep) { nat = [otherRep, ...others.filter(c => c !== otherRep), 'IRN']; iranLink = 'dual-other-first' }
    else if (born && born !== 'IRN') { nat = [...others, 'IRN']; iranLink = 'dual-other-first' }
    else nat = ['IRN', ...others]
    if (nat[0] === 'IRN' && others.length) iranLink = 'dual-iran-first'
    else if (nat[0] === 'IRN' && born && born !== 'IRN') iranLink = 'born-abroad'
  } else if (seedSet.has(p.id)) { nat = [...(others.length ? others : []), 'IRN']; iranLink = 'seed' }
  else if (bornIranSet.has(p.id)) {
    if (!others.length) { nat = ['IRN']; iranLink = 'born-in-iran-no-citizenship-data' }
    else if (others.every(c => EXCLUDE_ELIG.has(c))) { nat = others; iranLink = 'none' }
    else { nat = [...others, 'IRN']; iranLink = 'born-in-iran-foreign' }
  } else if (persianSet.has(p.id)) {
    if (!others.length || others.every(c => EXCLUDE_ELIG.has(c))) { nat = others; iranLink = 'none' } else { nat = [...others, 'IRN']; iranLink = 'persian-speaking' }
  } else { nat = others.length ? others : []; iranLink = 'none' }
  const pos = positions([...pagePos(pageOf(p.enwiki)), ...posLabels(p.props.P413)], coarse, p.id)
  const pl: Player = { id: p.id, name: p.label, dob, nat, pos, club: null, src: 'wikidata' }
  const h = (p.props.P2048 ?? []).map(Number).filter(n => n > 0)[0]
  if (h) { const cm = h < 3 ? Math.round(h * 100) : Math.round(h); if (cm >= 150 && cm <= 215) pl.heightCm = cm }
  if (born && born !== nat[0]) pl.born = born
  if (seniorIran.length && nat[0] === 'IRN') {
    const caps = Math.max(...seniorIran.map(s => s.caps ?? -1)); const goals = Math.max(...seniorIran.map(s => s.goals ?? -1))
    if (caps >= 0) { pl.caps = caps; if (goals >= 0) pl.goals = goals; if (caps >= 5) pl.capTied = true }
  }
  if (p.props.P18?.[0] && nat.includes('IRN')) photoWanted[p.id] = p.props.P18[0]
  return { pl, club: currentClubWD(p, age), iranLink }
}

// 1) Wikidata Iranian + diaspora candidates
const pending: Built[] = []
for (const q of [...new Set([...sets.iran, ...sets.bornInIran, ...sets.persianSpeaking, ...seedQ])] as string[]) {
  const p = people.get(q); if (!p) continue
  const b = buildFromWD(p)
  if (!b) { drop('wikidata: not a living male human with label+DOB'); continue }
  const year = Number(b.pl.dob.slice(0, 4))
  if (year < 1986) { drop('wikidata: born before 1986'); continue }
  if (b.iranLink === 'none') { drop('wikidata: born in Iran / Persian-speaking but citizenship suggests no Iran eligibility (AFG/IRQ/… only)'); continue }
  if (!iranSet.has(q) && year < 1996 && !seedSet.has(q)) { drop('wikidata: diaspora candidate born before 1996'); continue }
  pending.push(b)
  if (b.club.how === 'ambiguous') ambiguous.push(q)
}
// resolve ambiguous (undated, several open statements) through statement order in the full entity
if (ambiguous.length) {
  const ents = entities(ambiguous)
  for (const b of pending) {
    if (b.club.how !== 'ambiguous') continue
    const e = ents.get(b.pl.id); const st = (e?.claims.P54 ?? []).filter(c => typeof c.v === 'string' && !isNT(c.v))
    const lastIdx = st.length - 1
    if (lastIdx >= 0 && !st[lastIdx].q.P582) b.club = { team: st[lastIdx].v, how: 'statement-order' }
    else b.club = { how: 'ambiguous-unresolved' }
  }
  const more = new Set<string>(); for (const b of pending) if (b.club.team && !info.has(b.club.team)) more.add(b.club.team)
  if (more.size) for (const [k, v] of refInfo([...more])) info.set(k, v)
}
const linkOf = new Map<string, string>(); const howOf = new Map<string, string>(); const wdTeamOf = new Map<string, string | undefined>()
{ const hc: Record<string, number> = {}; for (const b of pending) hc[b.club.how] = (hc[b.club.how] ?? 0) + 1; console.log('wikidata current-club method:', hc) }
for (const b of pending) { linkOf.set(b.pl.id, b.iranLink); howOf.set(b.pl.id, b.club.how); wdTeamOf.set(b.pl.id, b.club.team); addPlayer(b.pl, 'none') }

// 2) Iranian club squads (authoritative for club membership)
const inSquad = new Set<string>(); const squadClubsParsed = new Set<string>()
let squadNoDob = 0, squadTotal = 0; const squadNoDobNames: string[] = []
function findExisting(name: string, dob: string | undefined, title: string | undefined, iranOnly = false): Player | undefined {
  const q = title && tinfo.get(title)?.qid
  if (q && players.has(q)) return players.get(q)
  if (dob) { const id = byNameDob.get(`${norm(name)}|${dob}`); if (id) return players.get(id) }
  return undefined
}
// fuzzy index for Iranian players: same DOB + shared first or last name token
const byDob = new Map<string, string[]>()
const reindexDob = () => { byDob.clear(); for (const p of players.values()) { const a = byDob.get(p.dob) ?? []; a.push(p.id); byDob.set(p.dob, a) } }
reindexDob()
function fuzzy(name: string, dob: string): Player | undefined {
  const toks = norm(name).split(' '); const cands = (byDob.get(dob) ?? []).map(id => players.get(id)!).filter(p => { const t = norm(p.name).split(' '); return t[t.length - 1] === toks[toks.length - 1] || (t[0] === toks[0] && t.length > 1 && toks.length > 1 && (t[t.length - 1].slice(0, 4) === toks[toks.length - 1].slice(0, 4))) })
  return cands.length === 1 ? cands[0] : undefined
}
// unique-name index over Wikidata Iranians, for squad entries whose link is a redirect/red link
const byName = new Map<string, string[]>()
for (const p of players.values()) { const k = norm(p.name); byName.set(k, [...(byName.get(k) ?? []), p.id]) }

const pageFor = new Map<string, PageInfo>()
for (const s of sq.clubSquads) {
  if (s.players.length >= 14) squadClubsParsed.add(s.clubId)
  for (const sp of s.players) {
    squadTotal++
    const natCode = fifaCode(sp.nat)
    const pg = pageOf(sp.title)
    let q = sp.title ? tinfo.get(sp.title)?.qid : undefined
    // a link can point at a namesake: distrust the Wikidata item when its birth year disagrees with the article infobox
    if (q && pg?.dob && tinfo.get(sp.title)!.dob && Math.abs(Number(tinfo.get(sp.title)!.dob!.slice(0, 4)) - Number(pg.dob.slice(0, 4))) > 1) q = undefined
    let pl = q ? players.get(q) : undefined
    if (!pl && q && people.has(q)) { const b = buildFromWD(people.get(q)!, sp.pos); if (b) { pl = b.pl; if (!pl.nat.length && natCode) pl.nat = [natCode]; addPlayer(pl, 'none'); linkOf.set(pl.id, pl.nat.includes('IRN') ? 'citizen' : 'foreign') } }
    if (!pl && pg?.dob) {
      pl = (byNameDob.get(`${norm(sp.name)}|${pg.dob}`) ? players.get(byNameDob.get(`${norm(sp.name)}|${pg.dob}`)!) : undefined) ?? (natCode === 'IRN' ? fuzzy(sp.name, pg.dob) : undefined)
      if (pl && inSquad.has(pl.id)) pl = undefined
      if (!pl && natCode) {
        const id = q ?? `x:${slug(sp.name)}-${pg.dob.slice(0, 4)}`
        if (!players.has(id)) { pl = { id, name: sp.name, dob: pg.dob, nat: [natCode], pos: [], club: null, src: 'wp:club-squad' }; addPlayer(pl, 'none'); linkOf.set(id, natCode === 'IRN' ? 'wp-squad' : 'foreign'); (byDob.get(pg.dob) ?? byDob.set(pg.dob, []).get(pg.dob)!).push(id) }
      }
    }
    if (!pl && !pg) { const ids = byName.get(norm(sp.name)) ?? (sp.title ? byName.get(norm(sp.title)) : undefined); if (ids?.length === 1 && natCode === 'IRN') { const cand = players.get(ids[0])!; if (!inSquad.has(cand.id)) pl = cand } }
    if (pl) { const age = NOW_YEAR - Number(pl.dob.slice(0, 4)); if (age < 15 || age > 45) { if (meta.get(pl.id)?.clubSrc === 'none' && !iranSet.has(pl.id)) players.delete(pl.id); pl = undefined } }
    if (!pl) { squadNoDob++; squadNoDobNames.push(`${sp.name} (${s.clubId})`); continue }
    if (natCode && !pl.nat.includes(natCode)) pl.nat = [natCode, ...pl.nat]
    else if (natCode && pl.nat[0] !== natCode && natCode !== 'IRN') pl.nat = [natCode, ...pl.nat.filter(c => c !== natCode)]
    if (!pl.nat.length) { players.delete(pl.id); squadNoDob++; continue }
    const wdp = people.get(pl.id)
    pl.pos = positions([...pagePos(pg), ...posLabels(wdp?.props.P413)], sp.pos, pl.id); if (!pl.pos.length) pl.pos = positions([], sp.pos, pl.id)
    if (!pl.pos.length) { players.delete(pl.id); drop('club squad: unknown position'); continue }
    pl.club = s.clubId; if (sp.no) pl.num = sp.no; pl.src = pl.src === 'wikidata' ? 'wikidata+wp:club-squad' : pl.src!.includes('club-squad') ? pl.src : pl.src + '+wp:club-squad'
    if (pg) pageFor.set(pl.id, pg)
    meta.get(pl.id)!.clubSrc = 'wp:club-squad'; inSquad.add(pl.id)
  }
}
stats.squadTotal = squadTotal; stats.squadNoDob = squadNoDob
// 2b) fa.wikipedia squads of the same clubs: adds players whose English article is a red link.
let faAdded = 0, faSkipped = 0, faTotal = 0; const faClubsUsed: string[] = []; const faClubsStale: string[] = []
for (const s of faStage.squads) {
  if (!s.players.length) continue
  if (!faCurrent(s.season)) { faClubsStale.push(`${s.clubId}${s.season ? ` (season ${s.season})` : ' (no season stated)'}`); continue }
  faClubsUsed.push(s.clubId); if (s.players.length >= 14) squadClubsParsed.add(s.clubId)
  for (const fp of s.players) {
    faTotal++
    if (!(fp.qid && fp.en && fp.dob && /[A-Za-z]/.test(fp.en))) { faSkipped++; continue }
    let pl = players.get(fp.qid)
    if (pl && inSquad.has(pl.id)) continue
    const iranian = /ایران/.test(fp.natFa ?? '')
    if (!pl && people.has(fp.qid)) { const b = buildFromWD(people.get(fp.qid)!, fp.pos); if (b) { pl = b.pl; if (!pl.nat.length && iranian) pl.nat = ['IRN']; if (pl.nat.length) { addPlayer(pl, 'none'); linkOf.set(pl.id, pl.nat.includes('IRN') ? 'fa-squad' : 'foreign') } else pl = undefined } }
    if (!pl && iranian) { const dob = fp.dob.endsWith('-01-01') ? `${fp.dob.slice(0, 4)}-07-01` : fp.dob; pl = { id: fp.qid, name: fp.en, dob, nat: ['IRN'], pos: [], club: null, src: 'fa:club-squad' }; addPlayer(pl, 'none'); linkOf.set(pl.id, 'fa-squad') }
    if (!pl) { faSkipped++; continue }
    const age = NOW_YEAR - Number(pl.dob.slice(0, 4))
    const pos = positions(posLabels([...(people.get(pl.id)?.props.P413 ?? []), ...(fp.wdPos ?? [])]), fp.pos || undefined, pl.id)
    if (age < 15 || age > 45 || !pos.length) { if (meta.get(pl.id)?.clubSrc === 'none' && !iranSet.has(pl.id)) players.delete(pl.id); faSkipped++; continue }
    pl.pos = pos; pl.club = s.clubId; if (fp.no && pl.num === undefined) pl.num = fp.no
    if (!pl.src!.includes('fa:club-squad')) pl.src += '+fa:club-squad'
    meta.get(pl.id)!.clubSrc = 'fa:club-squad'; inSquad.add(pl.id); faAdded++
  }
}
reindexDob()

// 3) national-team squads
const ntStats: Record<string, { cur: number; rec: number; added: number; noDob: number }> = {}
const ntSeen = new Set<string>()
for (const t of sq.nts) {
  const key = `${t.code}:${t.level}`; const st = (ntStats[key] = { cur: 0, rec: 0, added: 0, noDob: 0 })
  for (const sp of t.players as any[]) {
    sp.current ? st.cur++ : st.rec++
    const ti = sp.title ? tinfo.get(sp.title) : undefined
    let dob: string | undefined = sp.dob
    if (!dob && ti?.dob && t.code === 'IRN' && t.level !== 'senior') { // only trust the link when the age fits the age group
      const y = Number(ti.dob.slice(0, 4)); const lim = t.level === 'u23' ? 2002 : t.level === 'u20' ? 2005 : 2008
      if (y >= lim) dob = ti.dob.endsWith('-01-01') ? `${y}-07-01` : ti.dob
    }
    if (!dob && t.code === 'IRN') { const pg = pageOf(sp.title); const lim = t.level === 'u23' ? 2002 : t.level === 'u20' ? 2005 : t.level === 'u17' ? 2008 : 1980; if (pg?.dob && Number(pg.dob.slice(0, 4)) >= lim) dob = pg.dob }
    let pl = findExisting(sp.name, dob, dob === sp.dob || !sp.dob ? sp.title : undefined)
    if (pl && sp.dob && Math.abs(Number(pl.dob.slice(0, 4)) - Number(sp.dob.slice(0, 4))) > 1) pl = undefined // link pointed at a namesake
    if (!pl && dob && t.code === 'IRN') pl = fuzzy(sp.name, dob)
    if (!pl) {
      if (!dob) { st.noDob++; continue }
      const idQ = ti && ti.dob && ti.dob.slice(0, 4) === dob.slice(0, 4) ? ti.qid : undefined
      const id = idQ ?? `x:${slug(sp.name)}-${dob.slice(0, 4)}`
      if (players.has(id)) pl = players.get(id)
      else {
        const pos = positions([...pagePos(pageOf(sp.title)), ...posLabels(idQ ? ti!.pos : [])], sp.pos, id); if (!pos.length) { drop('nt squad: unknown position'); continue }
        pl = { id, name: sp.name, dob, nat: [t.code], pos, club: null, src: 'wp:nt-squad' }
        addPlayer(pl, 'none'); st.added++; (byDob.get(dob) ?? byDob.set(dob, []).get(dob)!).push(id)
      }
    }
    // nationality: the team they are called up by goes first
    pl.nat = [t.code, ...pl.nat.filter(c => c !== t.code)]
    if (t.level === 'senior') {
      if (sp.caps !== undefined) { pl.caps = sp.caps; pl.goals = sp.goals ?? pl.goals; if (sp.caps >= 5) pl.capTied = true; else delete pl.capTied }
    }
    if (pl.born === pl.nat[0]) delete pl.born
    if (sp.no && pl.num === undefined) pl.num = sp.no
    const m = meta.get(pl.id)!
    // club: club-squad page wins; otherwise a *current* NT listing beats Wikidata; recent call-ups only fill gaps
    const cid = sp.clubTitle || sp.clubLabel ? resolveClub(sp.clubTitle, sp.clubLabel, fifaCode(sp.clubNat)) : null
    if (cid && m.clubSrc !== 'wp:club-squad' && (m.clubSrc !== 'wp:nt-squad' || (sp.current && !ntSeen.has(pl.id + ':cur')))) {
      const target = clubs.get(cid)!
      // an Iranian top-two-division club whose squad list we parsed, but the player is not on it → keep (NT page is usually fresher)
      pl.club = cid; m.clubSrc = 'wp:nt-squad'
    }
    { const pg = pageOf(sp.title); if (pg && !pageFor.has(pl.id) && (!pg.dob || pg.dob.slice(0, 4) === pl.dob.slice(0, 4))) pageFor.set(pl.id, pg) }
    if (sp.current) ntSeen.add(pl.id + ':cur')
    ntSeen.add(pl.id)
    if (!pl.src!.includes('wp:nt-squad')) pl.src += '+wp:nt-squad'
    if (pl.pos.length && sp.pos && GROUP[sp.pos] && !pl.pos.some(p => GROUP[sp.pos].includes(p)) && !inSquad.has(pl.id)) pl.pos = positions([...pagePos(pageOf(sp.title)), ...posLabels(people.get(pl.id)?.props.P413 ?? ti?.pos)], sp.pos, pl.id)
  }
}

// 4) clubs for the remaining Wikidata-only players + retention rules
let staleIranClub = 0; let pageClub = 0
function clubFromPage(pg: PageInfo): { cid: string | null; state: 'current' | 'ended' | 'unknown' } {
  const open = pg.lastClub && /[–-]\s*$|present/i.test(pg.lastClub.years)
  const ref = pg.currentClub ?? (open ? pg.lastClub : undefined)
  if (!ref) return { cid: null, state: pg.lastClub ? 'ended' : 'unknown' }
  if (/national|under-|U-?\d\d/i.test(ref.label)) return { cid: null, state: 'unknown' }
  const direct = (ref.title && clubByTitle.get(norm(ref.title))) || undefined
  if (direct) return { cid: direct, state: 'current' }
  const c = ref.title ? countryCode(clubTitleCountry.get(ref.title)?.country) : undefined
  // fall back to the Wikidata team with the same article title
  const viaWd = !c && ref.title ? [...info.values()].find(v => v.enwiki === ref.title) : undefined
  return { cid: resolveClub(ref.title, ref.label, c ?? countryCode(viaWd?.country)), state: 'current' }
}
for (const pl of [...players.values()]) {
  const m = meta.get(pl.id)!; if (m.clubSrc !== 'none') continue
  const how = howOf.get(pl.id) ?? 'none'; const team = wdTeamOf.get(pl.id)
  const year = Number(pl.dob.slice(0, 4)); const age = NOW_YEAR - year
  const p = people.get(pl.id)
  const pg = pageOf(p?.enwiki)
  if (pg && (!pg.dob || Math.abs(Number(pg.dob.slice(0, 4)) - year) <= 1)) {
    pageFor.set(pl.id, pg)
    const r = clubFromPage(pg)
    if (r.state !== 'unknown') {
      if (r.cid && squadClubsParsed.has(r.cid)) { // article says he is at an Iranian club whose current squad list omits him
        staleIranClub++
        if (year >= 1996) { pl.club = null; m.clubSrc = 'article-stale' } else { players.delete(pl.id); drop('article lists an Iranian club but he is absent from its current squad page, born before 1996') }
        continue
      }
      if (r.cid && age <= 42) { pl.club = r.cid; m.clubSrc = 'wp:player-article'; pl.src += '+wp:article'; pageClub++; continue }
      if (r.state === 'ended' || !r.cid) {
        if (year >= 1996) { pl.club = null; m.clubSrc = r.state === 'ended' ? 'article: no current club' : 'article: club country unknown' }
        else { players.delete(pl.id); drop(r.state === 'ended' ? 'article shows no current club, born before 1996 (retired / free agent)' : 'article club could not be placed in a country, born before 1996') }
        continue
      }
    }
  }
  if (team) {
    const startY = Math.max(0, ...(p?.p54 ?? []).filter(s => s.team === team && s.start).map(s => Number(s.start!.slice(0, 4))))
    if (age >= 36 && startY < 2023) { players.delete(pl.id); drop('wikidata-only: aged 36+ with no club spell starting 2023 or later (likely retired)'); continue }
    if (age >= 31 && how !== 'dated') { players.delete(pl.id); drop('wikidata-only: aged 31+ and current club not datable (likely stale)'); continue }
    if (how === 'dated' && startY < NOW_YEAR - 6) { players.delete(pl.id); drop('wikidata-only: "current" club spell started 7+ years ago with no later data (stale)'); continue }
    const cid = teamToClub(team)
    if (cid && squadClubsParsed.has(cid)) {
      staleIranClub++
      if (year >= 1996) { pl.club = null; m.clubSrc = 'wikidata-stale' } else { players.delete(pl.id); drop('wikidata-only: listed at an Iranian club but absent from its current squad page, born before 1996'); }
      continue
    }
    if (cid) { pl.club = cid; m.clubSrc = 'wikidata:' + how; continue }
  }
  if (year >= 1996) { pl.club = null; m.clubSrc = 'unknown' }
  else { players.delete(pl.id); drop('wikidata-only: no determinable current club, born before 1996 (likely retired)') }
}
// enrich from the player's own article (height, full DOB, senior caps, birthplace, photo)
for (const [id, pg] of pageFor) {
  const pl = players.get(id); if (!pl) continue
  if (pg.heightCm && !pl.heightCm) pl.heightCm = pg.heightCm
  if (pg.dob && pl.dob.endsWith('-07-01') && pg.dob.slice(0, 4) === pl.dob.slice(0, 4)) pl.dob = pg.dob
  if (pg.ntCaps !== undefined && pg.ntTeam && nameToCode(pg.ntTeam) === pl.nat[0] && !ntSeen.has(id) && (pl.caps === undefined || pg.ntCaps > pl.caps)) { pl.caps = pg.ntCaps; if (pg.ntGoals !== undefined) pl.goals = pg.ntGoals; if (pg.ntCaps >= 5) pl.capTied = true }
  if (pg.ntTeam && nameToCode(pg.ntTeam) && pl.nat.includes(nameToCode(pg.ntTeam)!) && pl.nat[0] !== nameToCode(pg.ntTeam) && (pg.ntCaps ?? 0) > 0 && !ntSeen.has(id)) pl.nat = [nameToCode(pg.ntTeam)!, ...pl.nat.filter(c => c !== nameToCode(pg.ntTeam))]
  if (!pl.born && pg.birthPlace) { const parts = pg.birthPlace.split(','); const bc = nameToCode(parts[parts.length - 1].trim()); if (bc && bc !== pl.nat[0]) pl.born = bc }
  if (pl.born === pl.nat[0]) delete pl.born
  if (pg.clubNumber && pl.num === undefined && pl.club) pl.num = pg.clubNumber
  if (pg.image && !photoWanted[id] && pl.nat.includes('IRN')) photoWanted[id] = pg.image
}
// positions are mandatory
for (const pl of [...players.values()]) {
  if (!pl.pos.length) { players.delete(pl.id); drop('no position known (Wikidata P413 empty, not in any squad list)'); delete photoWanted[pl.id] }
  else if (!pl.nat.length || !pl.nat.every(c => natCodes.has(c))) { players.delete(pl.id); drop('no mappable nationality') }
}
for (const id of Object.keys(photoWanted)) if (!players.has(id) || !players.get(id)!.nat.includes('IRN')) delete photoWanted[id]
writeJson(join(OUT, 'photo-wanted.json'), photoWanted)
const photos: Record<string, { photo: string; credit: string }> = existsSync(join(OUT, 'photos.json')) ? readJson(join(OUT, 'photos.json')) : {}
let photoCount = 0
for (const [id, ph] of Object.entries(photos)) { const pl = players.get(id); if (pl && existsSync(join(ROOT, 'public', ph.photo))) { pl.photo = ph.photo; pl.photoCredit = ph.credit; photoCount++ } }

// ---------------------------------------------------------------- staff
interface Staff { id: string; name: string; dob: string; nat: string; role: string; job: string | null; rep?: number }
const staff = new Map<string, Staff>(); let staffNoDob: string[] = []
function roleOf(r: string): Staff['role'] | undefined {
  if (/goalkeep/.test(r)) return 'gk'
  if (/fitness|condition|physical|athletic/.test(r)) return 'fitness'
  if (/physio|doctor|medic|masseur/.test(r)) return 'physio'
  if (/analy|scout/.test(r)) return 'scout'
  if (/assistant|first[- ]team coach|^coach(es)?$/.test(r)) return 'assistant'
  if (/head coach|manager|^coach/.test(r) && !/team manager|general manager|media|kit/.test(r)) return 'coach'
  return undefined
}
function addStaff(name: string, title: string | undefined, role: string, job: string | null, natHint?: string) {
  const pg = pageOf(title)
  let q = title ? tinfo.get(title)?.qid : undefined; let p = q ? people.get(q) : undefined
  let dob = p ? wdDob(p) : undefined
  if (pg?.dob && dob && Math.abs(Number(pg.dob.slice(0, 4)) - Number(dob.slice(0, 4))) > 1) { q = undefined; p = undefined; dob = undefined } // namesake
  if (pg?.dob && (!dob || dob.endsWith('-07-01'))) dob = pg.dob
  const y = dob ? Number(dob.slice(0, 4)) : 0
  if (!dob || y < 1940 || (y > 2000 && role === 'coach')) { staffNoDob.push(`${name} (${role}, ${job ?? 'no job'})`); return }
  const cit = (p?.props.P27 ?? []).map(countryCode).filter(Boolean) as string[]
  const bp = pg?.birthPlace ? nameToCode(pg.birthPlace.split(',').pop()!.trim()) : undefined
  const nat = cit.includes('IRN') ? 'IRN' : cit[0] ?? bp ?? natHint
  if (!nat) { staffNoDob.push(`${name} (${role}, nationality unknown)`); return }
  const id = q ?? `x:${slug(name)}-${y}`
  const ex = staff.get(id)
  if (ex) { if (!ex.job || (role === 'coach' && job)) { ex.job = job; ex.role = role as Staff['role'] } return }
  staff.set(id, { id, name: p?.label ?? name, dob, nat, role, job })
}
const levelJob = (lvl: string) => `nation:IRN:${lvl}`
for (const t of sq.nts) if (t.code === 'IRN') {
  let hasHead = false
  for (const st of t.staff ?? []) { const role = roleOf(st.role); if (!role) continue; if (role === 'coach') hasHead = true; addStaff(st.name, st.title, role, levelJob(t.level), 'IRN') }
  if (!hasHead && t.coach) addStaff(t.coach.name, t.coach.title, 'coach', levelJob(t.level), 'IRN')
}
const squadByClub = new Map<string, any>(sq.clubSquads.map(s => [s.clubId, s]))
let clubCoachKnown = 0
for (const c of lg.clubs) if (c.country === 'IRN') {
  const s = squadByClub.get(c.id)
  const name = c.manager ?? s?.manager?.name; const title = c.managerTitle ?? s?.manager?.title
  if (!name) continue
  const before = staff.size + staffNoDob.length
  addStaff(name.replace(/\s*\(.*\)$/, ''), title, 'coach', `club:${c.id}`)
  if ([...staff.values()].some(s => s.job === `club:${c.id}`)) clubCoachKnown++
}
let wdCoaches = 0
for (const q of sets.coaches as string[]) {
  if (staff.has(q)) continue
  const p = people.get(q); if (!p || !p.label) continue
  const dob = wdDob(p); if (!dob || p.props.P570?.length || Number(dob.slice(0, 4)) < 1955) continue
  staff.set(q, { id: q, name: p.label, dob, nat: 'IRN', role: 'coach', job: null }); wdCoaches++
}

// ---------------------------------------------------------------- output
const logos: Record<string, any> = existsSync(join(OUT, 'logos.json')) ? readJson(join(OUT, 'logos.json')) : {}
let logoCount = 0
// trust the files on disk (a download run may have been interrupted before logos.json was rewritten)
for (const c of clubs.values()) { const l = [`logos/${c.id}.png`, `logos/${c.id}.jpg`].find(x => existsSync(join(ROOT, 'public', x))); if (l) { (c as any).logo = l; logoCount++ } }
const logoMissing = lg.clubs.filter(c => !(clubs.get(c.id) as any)?.logo).map(c => `${c.id} (${logos[c.id]?.none ?? 'not attempted'})`)
const photoFailed: string[] = existsSync(join(OUT, 'photos-failed.json')) ? readJson(join(OUT, 'photos-failed.json')) : []
const usedClubs = new Set<string>(); for (const p of players.values()) if (p.club) usedClubs.add(p.club)
const outClubs = [...clubs.values()].filter(c => !c.league.startsWith('other-') || usedClubs.has(c.id) || [...staff.values()].some(s => s.job === `club:${c.id}`))
  .map(({ _titles, ...c }) => JSON.parse(JSON.stringify(c)))
const usedLeagues = new Set(outClubs.map(c => c.league))
const outLeagues = [...leagues.values()].filter(l => usedLeagues.has(l.id))
const clean = (p: Player) => { const o: any = { ...p }; for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o }
const outPlayers = [...players.values()].map(clean).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
const world = { version: 1, asOf: AS_OF, players: outPlayers, clubs: outClubs, leagues: outLeagues, nations, staff: [...staff.values()] }
mkdirSync(join(ROOT, 'public', 'data'), { recursive: true })
writeFileSync(join(ROOT, 'public', 'data', 'world.json'), JSON.stringify(world))

// ---------------------------------------------------------------- report
const P = outPlayers as Player[]
const iranFirst = P.filter(p => p.nat[0] === 'IRN'); const iranAny = P.filter(p => p.nat.includes('IRN'))
const clubCountry = (p: Player) => p.club ? clubs.get(p.club)!.country : undefined
const abroad: Record<string, number> = {}
for (const p of iranFirst) { const c = clubCountry(p); if (c && c !== 'IRN') abroad[c] = (abroad[c] ?? 0) + 1 }
const dual = iranAny.filter(p => p.nat.length > 1 || (p.born && p.born !== 'IRN'))
const perLeague: Record<string, number> = {}; for (const c of outClubs) perLeague[c.league] = (perLeague[c.league] ?? 0) + 1
const playersPerLeague: Record<string, number> = {}; for (const p of P) if (p.club) { const l = clubs.get(p.club)!.league; playersPerLeague[l] = (playersPerLeague[l] ?? 0) + 1 }
const srcCount: Record<string, number> = {}; for (const p of P) srcCount[p.src ?? '?'] = (srcCount[p.src ?? '?'] ?? 0) + 1
const clubSrcCount: Record<string, number> = {}; for (const p of P) { const k = meta.get(p.id)?.clubSrc ?? '?'; clubSrcCount[k] = (clubSrcCount[k] ?? 0) + 1 }
const ntReal = Object.entries(ntStats).filter(([k, v]) => k.endsWith(':senior') && v.cur + v.rec > 0)
const ntMissing = Object.entries(ntStats).filter(([k, v]) => k.endsWith(':senior') && v.cur + v.rec === 0).map(([k]) => k.split(':')[0])
const ntCodesWanted = sq.nts.filter(t => t.level === 'senior').map(t => t.code)
const linkCount: Record<string, number> = {}; for (const p of iranAny) { const k = linkOf.get(p.id) ?? (p.src?.includes('nt-squad') ? 'nt-squad' : 'other'); linkCount[k] = (linkCount[k] ?? 0) + 1 }
const tbl = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n')
const md = `# Data report — world.json

Snapshot \`asOf\` ${AS_OF}, generated ${new Date().toISOString().slice(0, 10)} by \`pipeline/\`. All bulk data comes from en.wikipedia raw wikitext (league season pages, club pages, national-team pages, ~${stats.pagesRead} individual player/coach articles) and Wikidata (SPARQL + entity JSON). Nothing in the player/staff lists is invented; records lacking a date of birth or a position were dropped, not estimated.

## Headline counts

| Item | Count |
|---|---|
| Players | ${P.length} |
| …with Iran as first nationality | ${iranFirst.length} |
| …Iran-eligible in any slot (\`nat\` contains IRN) | ${iranAny.length} |
| …dual-national / diaspora candidates (IRN plus another nationality, or born outside Iran) | ${dual.length} |
| …of which Iran is *not* the first nationality | ${iranAny.filter(p => p.nat[0] !== 'IRN').length} |
| Players with a club | ${P.filter(p => p.club).length} |
| Players with \`club: null\` (unknown / free agent) | ${P.filter(p => !p.club).length} |
| Clubs | ${outClubs.length} (${lg.clubs.length} from covered leagues, ${outClubs.length - lg.clubs.length} generic "other-<country>" clubs) |
| Leagues | ${outLeagues.length} (${lg.leagues.length} covered + ${outLeagues.length - lg.leagues.length} catch-all) |
| Nations | ${nations.length} (FIFA ranking of ${rankDate}) |
| National teams with a real squad | ${ntReal.length} of ${ntCodesWanted.length} attempted |
| Staff | ${staff.size} (${[...staff.values()].filter(s => s.job).length} with a current job) |
| Club logos | ${logoCount} of ${lg.clubs.length} covered-league clubs (Iranian clubs: ${lg.clubs.filter(c => c.country === 'IRN' && (clubs.get(c.id) as any)?.logo).length} of ${lg.clubs.filter(c => c.country === 'IRN').length}) |
| Photos | ${photoCount} downloaded (of ${Object.keys(photoWanted).length} Iran-eligible players with a Wikidata image) |

### Iranian players abroad (first nationality IRN, by country of club)

| Country | Players |
|---|---|
${tbl(abroad) || '| – | 0 |'}

Iran-first players at Iranian clubs: ${iranFirst.filter(p => clubCountry(p) === 'IRN').length}; without a known club: ${iranFirst.filter(p => !p.club).length}.

### How Iran-eligible players were identified

| Link | Players |
|---|---|
${tbl(linkCount)}

Legend: \`citizen\` = Wikidata citizenship/sporting country Iran only; \`dual-iran-first\` = Iranian plus other citizenship and has represented Iran (or born in Iran); \`dual-other-first\` = several citizenships, no Iran appearance recorded, other country listed first; \`born-abroad\` = Iranian citizenship only but born outside Iran; \`born-in-iran-foreign\` = born in Iran, Wikidata citizenship is another country (eligibility **unverified**); \`born-in-iran-no-citizenship-data\` = born in Iran, no citizenship recorded, treated as Iranian; \`persian-speaking\` = Persian listed as language, non-Iranian citizenship (eligibility **unverified**); \`seed\` = hand-kept list in \`pipeline/diaspora.seed.ts\`; \`wp-squad\` = Iranian found only through a club squad page + own article; \`fa-squad\` = found through the Persian club page; \`foreign\`/\`nt-squad\`/\`other\` = reached through squad pages.

### Clubs per league (and players attached)

| League | Clubs | Players | Source page |
|---|---|---|---|
${outLeagues.map(l => `| ${l.id} ${l.name} | ${perLeague[l.id] ?? 0} | ${playersPerLeague[l.id] ?? 0} | ${lg.leagues.find(x => x.id === l.id)?.sourcePage ?? 'generated'} |`).filter(r => !r.startsWith('| other-')).join('\n')}

Catch-all leagues (\`other-<country>\`): ${outLeagues.filter(l => l.id.startsWith('other-')).length} leagues, ${outClubs.filter(c => c.league.startsWith('other-')).length} clubs, ${P.filter(p => p.club && clubs.get(p.club)!.league.startsWith('other-')).length} players.

### Player record sources

| src | Players |
|---|---|
${tbl(srcCount)}

Where each player's **club** came from:

| Club source | Players |
|---|---|
${tbl(clubSrcCount)}

### Iranian club squads (en.wikipedia club articles)

${squadTotal} squad entries read from ${sq.clubSquads.filter(s => s.players.length).length} of ${lg.clubs.filter(c => c.country === 'IRN').length} Iranian club pages; ${squadTotal - squadNoDob} had a date of birth (from the player's own article infobox or a matched Wikidata item) and were kept, **${squadNoDob} skipped** — almost all are red links (no English article), so no DOB is obtainable and \`dob\` is mandatory. Player articles requested: ${stats.pagesRead}, of which ${stats.pagesMissing} do not exist.

${sq.notes.filter(n => n.startsWith('club ')).map(n => '- ' + n).join('\n')}

### fa.wikipedia squads (coverage booster)

${faStage.squads.length ? `Read ${faStage.squads.filter(s => s.players.length).length} Persian club articles; ${faClubsUsed.length} state the current season and were used. ${faTotal} squad entries on those pages → **${faAdded} extra players placed** at their club (not already placed via the English page); ${faSkipped} skipped (no Wikidata item, no English label to romanise with, no DOB, or no position). Names come only from the Wikidata English label.${faClubsStale.length ? ` Not used (squad list not for the current season): ${faClubsStale.join(', ')}.` : ''}` : 'Not run.'}

### National squads

Senior squads parsed (current squad + recent call-ups; players without DOB skipped):

${Object.entries(ntStats).map(([k, v]) => `${k.replace(':senior', '')} ${v.cur}+${v.rec}${v.noDob ? ` (−${v.noDob} no DOB)` : ''}`).join(' · ')}

${ntMissing.length ? `No squad templates found for: ${ntMissing.join(', ')}.` : 'Every attempted national team page yielded a squad.'}

Positions: ${posFromCoarseOnly} squad players had no Wikidata position; their GK/DF/MF/FW label was expanded deterministically (DF→CB/RB/LB, MF→CM/DM/AM, FW→ST/RW/LW, weighted towards the central role). These are placeholders, not facts.

### Staff

- Iran national-team staff and Iranian club head coaches come from Wikipedia tables/infoboxes; DOB and nationality from the person's article infobox or Wikidata.
- Iranian club head coaches placed: ${clubCoachKnown} of ${lg.clubs.filter(c => c.country === 'IRN').length} clubs.
- ${wdCoaches} further Iranian managers from Wikidata (occupation football manager, born 1955+, alive) are included with \`job: null\`.
- Skipped for lack of a DOB (no article / no Wikidata item) (${staffNoDob.length}): ${staffNoDob.join('; ') || 'none'}.

## Fallbacks and assumptions

- **FIFA ranking**: parsed from en.wikipedia \`Module:SportsRankings/data/FIFA World Rankings\` (edition of ${rankDate}); confederations and AFC sub-regions from the same module. Kit colours are hand-entered for ~65 nations only.
- **League strengths** are the hand-set values in \`pipeline/leagues.config.ts\`. **Club \`rep\`** is hand-set for well-known clubs (\`pipeline/rep.config.ts\`); other clubs get league strength − 2, nudged by current points-per-game on the few season pages that expose a results table inline. Clubs in catch-all leagues have no \`rep\`.
- **Catch-all leagues**: any club outside the 25 covered leagues is created as \`<country>-<slug>\` inside \`other-<country>\` (tier 1 for uncovered countries, tier 3 for lower divisions of covered countries). Their strength is a hand-set/FIFA-points-derived guess. Lower-division and top-division clubs of an uncovered country share one bucket.
- **Season pages**: ${lg.notes.map(n => n.replace(/; standings.*$/, '')).join('; ')}.
- **Current club from Wikidata** = the P54 statement without an end date that has the latest start date. Undated statements are only trusted when unambiguous or (via statement order) last in the list. Wikidata club data for Iranian players is frequently years out of date, so: players aged 36+ without a spell starting 2023+, players aged 31+ with undatable clubs, and "current" spells that began 7+ years ago are dropped; players Wikidata places at an Iranian top-two-tier club whose current Wikipedia squad list does not contain them (${staleIranClub}) are set to \`club: null\` (born 1996+) or dropped.
- Wikidata-only players with no determinable club are kept with \`club: null\` only when born 1996 or later.
- **Club precedence**: Iranian club squad page > national-team squad page > the player's own article infobox (\`currentclub\`, or the last career row with an open-ended year range) > Wikidata. ${pageClub} players got their club from their article. An article club outside the covered leagues is only usable when Wikidata gives the club a country.
- **Year-only birth dates** become YYYY-07-01. WDQS returns year-precision dates as 1 January, so a genuine 1 January birthday is also rewritten to 1 July.
- **\`capTied\`** is set when senior caps ≥ 5 (proxy for having played a competitive match); it is omitted otherwise. Caps/goals come from national-team pages where available, else from Wikidata qualifiers (often stale).
- **Nationality from Wikidata** maps "United Kingdom" to ENG. Squad-page flags override Wikidata ordering.
- **Diaspora detection is weak**: Wikipedia categories ("… of Iranian descent") cannot be read without the API, and Wikidata has no ethnic-group data for footballers (0 hits). Candidates come only from multi-citizenship, birthplace, language statements and a 4-name seed list. Many real dual nationals are therefore missing, and the \`born-in-iran-foreign\` / \`persian-speaking\` groups are unverified.
- **Photos**: 250px-wide thumbnails (Wikimedia only serves fixed thumbnail widths; 256 is refused, and \`Special:FilePath\` redirects to thumb.wikimedia.org which is unreachable here, so upload.wikimedia.org thumbnail URLs are built directly). Source is Wikidata P18, else the image in the player's en.wikipedia infobox. Saved as \`public/faces/<id>.jpg|png\`. Credit lines are parsed from the Commons file page (author + licence) and fall back to "Wikimedia Commons: <file>". ${Object.keys(photoWanted).length - photoCount} wanted photos are missing (download run stopped on request; credit lookup on Commons was not run, so all credits are the generic \"Wikimedia Commons: <file>\" form).
- **Club logos**: the infobox image of the club's en.wikipedia article, as a 120px-wide thumbnail (closest served step to 128) in \`public/logos/<clubId>.png|jpg\`; tried on en.wikipedia first (non-free crests), then Commons. Not attempted for \`other-*\` clubs. No Wikidata P154 fallback was needed/used. Most crests are non-free images used on Wikipedia under fair use — fine for a private hobby build, but they are **not** freely licensed. The logo run was **stopped early on request** (logos and photos are now supplied from other sources via \`data/overrides/\`), so only ${logoCount} clubs have one; \`npx tsx pipeline/05b-logos.ts\` would resume. Iranian clubs without a crest: ${logoMissing.filter(x => x.startsWith('irn-')).join('; ') || 'none'}.
- **Nation codes** are the ones used by Wikipedia's ranking module. Checked against FIFA's list: the only non-FIFA code is **SGP** (FIFA: SIN) for Singapore.
- \`foot\` and \`valueEur\` are never set (no source reachable).

## Dropped records

| Reason | Count |
|---|---|
${tbl(dropped)}

## Things that failed or are incomplete

${[...fails, ...sq.notes.filter(n => /missing/i.test(n)), ...lg.notes.filter(n => /NO TEAM/.test(n))].map(f => '- ' + f).join('\n') || '- (none recorded)'}
- **Player-article crawl incomplete**: ${stats.pagesRead} of ~1,258 queued articles were read before the run was stopped (all Wikimedia hosts share a tight per-IP budget here, ~20 requests/min). Missing: most Wikidata-listed Iranians outside current squads (so their clubs still rest on stale Wikidata, or are \`null\`) and Azadegan squad members. Resume with \`npx tsx pipeline/04b-player-pages.ts\` then \`06-build\`.
- **fa.wikipedia squads** (\`pipeline/04c-fa-squads.ts\`): ${faStage.squads.length ? 'run, see above' : 'written and wired into the build but **not run** — untested beyond one page probe'}. It would raise Iranian club-squad coverage, which is currently limited by red links on en.wikipedia.
- Wikipedia \`api.php\`/REST and Wikidata \`wbgetentities\` return 429 from this network; WDQS was limited to roughly one query per minute. The pipeline therefore uses raw wikitext, a handful of large SPARQL queries, and \`Special:EntityData\` for the few entities where statement order matters.
- Wikipedia links that are redirects are not resolved to Wikidata items (no API), so some squad players/clubs fail to match by title and fall back to name matching.
- ${squadNoDob} Iranian-club squad entries without DOB (first 60): ${squadNoDobNames.slice(0, 60).join(', ')}${squadNoDobNames.length > 60 ? ', …' : ''}
- Iran youth squads: ${['u23', 'u20', 'u17'].map(l => `${l.toUpperCase()} ${ntStats['IRN:' + l] ? `${ntStats['IRN:' + l].cur + ntStats['IRN:' + l].rec - ntStats['IRN:' + l].noDob} kept / ${ntStats['IRN:' + l].noDob} skipped (no DOB)` : 'page not parsed'}`).join('; ')}.

## Rerun

\`\`\`
npx tsx pipeline/run.ts          # everything (cached responses in pipeline/.cache are reused)
npx tsx pipeline/07-validate.ts  # validate public/data/world.json
\`\`\`
`
mkdirSync(join(ROOT, 'data'), { recursive: true })
writeFileSync(join(ROOT, 'data', 'REPORT.md'), md)
console.log(`world.json: ${P.length} players (${iranFirst.length} IRN-first, ${iranAny.length} IRN-any, ${dual.length} dual/diaspora), ${outClubs.length} clubs, ${outLeagues.length} leagues, ${nations.length} nations, ${staff.size} staff, ${photoCount} photos, ${logoCount} logos`)
console.log('squad entries', squadTotal, 'unmatched', squadNoDob, 'unmatched with link', sq.clubSquads.flatMap((s: any) => s.players).filter((p: any) => p.title && !tinfo.get(p.title)).length)
console.log('dropped:', dropped)
console.log('club src:', clubSrcCount)
