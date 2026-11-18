// Fetches (and caches) the en.wikipedia article of every Iran-related player so their infobox can be read:
// Iranian club squad members, Iran national-team (all levels) call-ups, and Wikidata Iranians with an article.
// Slow on a cold cache (~2.5 s per page); instant afterwards.
import { join } from 'node:path'
import { wikitext, readJson, writeJson, OUT, stripRefs, findTemplates, plain, parseDob, firstLink, existsSync } from './lib.ts'
import { bulkPeople } from './wd.ts'

export interface PageInfo { title: string; resolved?: boolean; name?: string; dob?: string; heightCm?: number; position?: string; currentClub?: { title?: string; label: string }; lastClub?: { title?: string; label: string; years: string }; ntCaps?: number; ntGoals?: number; ntTeam?: string; image?: string; birthPlace?: string; clubNumber?: number; isFootballer: boolean }
export function parsePlayerPage(title: string, raw: string): PageInfo {
  const text = stripRefs(raw)
  const ib = findTemplates(text, /^infobox (football biography|football biography 2|footballer|soccer biography|football player)/i)[0]
  if (!ib) return { title, isFootballer: false }
  const n: Record<string, string> = {}; for (const [k, v] of Object.entries(ib.named)) n[k.replace(/[_ ]/g, '')] = v
  const out: PageInfo = { title, isFootballer: true }
  out.name = plain(n.name ?? '') || undefined
  out.dob = n.birthdate ? parseDob(n.birthdate) : undefined
  if (!out.dob && n.birthdate) { const m = plain(n.birthdate).match(/(\d{1,2}) (\w+) (\d{4})/); if (m) { const d = Date.parse(`${m[1]} ${m[2]} ${m[3]} UTC`); if (!isNaN(d)) out.dob = new Date(d).toISOString().slice(0, 10) } }
  const h = n.height ?? ''
  const hm = h.match(/\{\{\s*(?:height|convert)\s*\|\s*(?:m\s*=\s*)?([\d.]+)\s*(?:\|\s*(m|cm))?/i) ?? h.match(/([\d.]+)\s*(m|cm)\b/)
  if (hm) { const v = Number(hm[1]); const cm = v < 3 ? Math.round(v * 100) : Math.round(v); if (cm >= 150 && cm <= 215) out.heightCm = cm }
  out.position = plain(n.position ?? '') || undefined
  if (n.currentclub && plain(n.currentclub) && !/free agent|retired|unattached|without club/i.test(plain(n.currentclub))) { const l = firstLink(n.currentclub); out.currentClub = { title: l?.target, label: plain(n.currentclub) } }
  // senior career rows: last one with an open-ended year range
  let last = 0; for (let i = 1; i <= 40; i++) if (n['clubs' + i]) last = i
  if (last) { const l = firstLink(n['clubs' + last]); out.lastClub = { title: l?.target, label: plain(n['clubs' + last]).replace(/^→\s*/, '').replace(/\s*\(loan\)\s*$/i, ''), years: plain(n['years' + last] ?? '') } }
  let ln = 0; for (let i = 1; i <= 12; i++) if (n['nationalteam' + i]) ln = i
  for (let i = ln; i >= 1; i--) { const team = plain(n['nationalteam' + i]); if (!/U-?\d\d|under|olympic|B$|futsal|beach|student/i.test(team)) { out.ntTeam = team; const c = parseInt(plain(n['nationalcaps' + i] ?? '')); const g = parseInt(plain(n['nationalgoals' + i] ?? '')); if (!isNaN(c)) out.ntCaps = c; if (!isNaN(g)) out.ntGoals = g; break } }
  const img = (n.image ?? '').replace(/^\s*\[\[(?:File|Image):/i, '').split('|')[0].replace(/\]\]\s*$/, '').replace(/^(File|Image):/i, '').trim()
  if (img && /\.(jpe?g|png|webp)$/i.test(img)) out.image = img
  out.birthPlace = plain(n.birthplace ?? '') || undefined
  const cn = parseInt(plain(n.clubnumber ?? '')); if (!isNaN(cn)) out.clubNumber = cn
  return out
}
if (process.argv[1]?.includes('04b-player-pages')) {
  const sq = readJson<any>(join(OUT, 'squads.json')); const sets = readJson<any>(join(OUT, 'wd-sets.json')); const lg = readJson<any>(join(OUT, 'leagues.json'))
  const tier = new Map<string, number>(lg.clubs.map((c: any) => [c.id, c.league === 'irn-1' ? 1 : 2]))
  const order: string[] = []
  const push = (t?: string) => { if (t && !order.includes(t)) order.push(t) }
  for (const s of sq.clubSquads) if (tier.get(s.clubId) === 1) for (const p of s.players) push(p.title)
  for (const t of sq.nts) if (t.code === 'IRN') { for (const p of t.players) push(p.title); push(t.coach?.title); for (const st of t.staff ?? []) push(st.title) }
  for (const c of lg.clubs) if (c.country === 'IRN') push(c.managerTitle)
  for (const s of sq.clubSquads) push(s.manager?.title)
  // Wikidata Iranians / diaspora with an article, youngest first
  const people = bulkPeople([...new Set([...sets.iran, ...sets.bornInIran, ...sets.persianSpeaking, ...sets.seed.map((s: any) => s.qid).filter(Boolean)])] as string[])
  const wd = [...people.values()].filter(p => p.enwiki && (p.props.P569 ?? []).some(d => Number(d.slice(0, 4)) >= 1988)).sort((a, b) => (b.props.P569![0] > a.props.P569![0] ? 1 : -1))
  for (const p of wd) push(p.enwiki)
  for (const s of sq.clubSquads) if (tier.get(s.clubId) === 2) for (const p of s.players) push(p.title)
  console.log('player pages to read:', order.length)
  const out: Record<string, PageInfo | null> = {}; let n = 0, miss = 0
  for (const t of order) {
    const raw = wikitext(t); if (!raw) { out[t] = null; miss++ } else out[t] = parsePlayerPage(t, raw)
    if (++n % 50 === 0) { console.error(`  pages ${n}/${order.length} (missing ${miss})`); writeJson(join(OUT, 'player-pages.json'), out, false) }
  }
  writeJson(join(OUT, 'player-pages.json'), out, false)
  const v = Object.values(out)
  console.log(`pages: ${v.length}, missing/red links: ${miss}, footballer infobox: ${v.filter(x => x?.isFootballer).length}, with DOB: ${v.filter(x => x?.dob).length}, with current club: ${v.filter(x => x?.currentClub).length}`)
}
