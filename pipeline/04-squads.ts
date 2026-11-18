// Squads from en.wikipedia: Iranian club pages (first-team squads, infobox), national team pages (current squad + recent call-ups),
// Iran youth teams, and coaching staff tables.
import { join } from 'node:path'
import { wikitext, section, stripRefs, findTemplates, firstLink, plain, parseDob, readJson, writeJson, OUT } from './lib.ts'
import { ntTeams, IRAN_YOUTH } from './nt.config.ts'

export interface SqPlayer { name: string; title?: string; pos: string; nat?: string; no?: number; dob?: string; caps?: number; goals?: number; clubTitle?: string; clubLabel?: string; clubNat?: string; current?: boolean }
const PLAYER_RE = /^(nat fs (g |r )?player( no caps)?|fs player|football squad player|fs2 player|football squad player2)$/i
const num = (s?: string) => { const n = parseInt((s ?? '').replace(/[^\d]/g, ''), 10); return isNaN(n) ? undefined : n }

function parsePlayers(text: string): SqPlayer[] {
  const out: SqPlayer[] = []
  for (const t of findTemplates(text, PLAYER_RE)) {
    const n = t.named; const rawName = n.name ?? ''
    const link = firstLink(rawName); const name = (link ? plain(link.label).replace(/\s*\((footballer|soccer|born|[^)]*\d{4})[^)]*\)\s*$/i, '') : plain(rawName).replace(/\s*\((captain|vice[- ]captain|c|vc|3rd captain)\)\s*/gi, '')).trim()
    if (!name || /^(tba|vacant)$/i.test(name)) continue
    const club = n.club ? firstLink(n.club) : null
    out.push({ name: link?.label && plain(link.label) === name ? name : name, title: link?.target, pos: (n.pos ?? '').toUpperCase().trim(), nat: (n.nat ?? '').trim() || undefined, no: num(n.no),
      dob: n.age ? parseDob(n.age) : undefined, caps: n.caps !== undefined ? num(n.caps) : undefined, goals: n.goals !== undefined ? num(n.goals) : undefined,
      clubTitle: club?.target, clubLabel: n.club ? plain(n.club) || undefined : undefined, clubNat: (n.clubnat ?? '').trim() || undefined })
  }
  return out
}
function staffTable(text: string): { role: string; name: string; title?: string }[] {
  const sec = section(text, /coaching staff|technical staff|current coaching staff|^personnel$|^staff$/i); if (!sec) return []
  const out: { role: string; name: string; title?: string }[] = []
  const tbl = sec.match(/\{\|[\s\S]*?\n\|\}/)?.[0]; if (!tbl) return []
  for (const row of tbl.split(/\n\|-[^\n]*/)) {
    const cells = row.split(/\n[|!]|\|\||!!/).map(c => c.trim()).filter(c => c && !/^\{\|/.test(c) && !/^class=|^style=/.test(c))
    if (cells.length < 2) continue
    const role = plain(cells[0].replace(/^\|/, '')).toLowerCase(); if (!role || /position|name/.test(role)) continue
    for (const part of cells.slice(1).join(' ').split(/<br\s*\/?>/i)) {
      const clean = part.replace(/\{\{#invoke:flag[^{}]*\}\}/gi, ''); const name = plain(clean); if (!name || name.length > 50) continue
      out.push({ role, name, title: firstLink(clean)?.target })
    }
  }
  return out
}
const { clubs } = readJson<{ clubs: any[] }>(join(OUT, 'leagues.json'))
const notes: string[] = []

// --- Iranian clubs
const clubSquads: any[] = []
for (const c of clubs.filter(c => c.country === 'IRN')) {
  const raw = wikitext(c.title); if (!raw) { notes.push(`club page missing: ${c.title}`); continue }
  const text = stripRefs(raw)
  const sec = section(text, /^(current squad|first[- ]team squad|current players|squad|first team)$/i) ?? section(text, /^players$/i) ?? ''
  // drop loaned-out / reserve / retired sub-sections
  const main = sec.split(/^={3,5}\s*(?:out on loan|reserve|retired|notable|youth|under|u-?\d\d|former)[^=]*={3,5}\s*$/im)[0]
  const players = parsePlayers(main)
  const ib = findTemplates(text, /^infobox football club$/i)[0]?.named ?? {}
  const upd = main.match(/\{\{updated\|([^}]*)\}\}/i)?.[1] ?? main.match(/As of ([^.<\n]*\d{4})/i)?.[1]
  const hex = (s?: string) => s && /^[0-9A-Fa-f]{6}$/.test(s.trim()) ? '#' + s.trim().toUpperCase() : undefined
  const mgr = ib.manager ? { name: plain(ib.manager).replace(/\s*https?:.*$/, ''), title: firstLink(ib.manager)?.target } : undefined
  clubSquads.push({ clubId: c.id, title: c.title, updated: upd, players, manager: mgr?.name ? mgr : undefined,
    ground: ib.ground ? plain(ib.ground) : undefined, fullname: ib.fullname ? plain(ib.fullname) : undefined, short: ib['short name'] ? plain(ib['short name']) : undefined,
    colors: hex(ib.body1) ? [hex(ib.body1), hex(ib.shorts1) ?? hex(ib.socks1) ?? hex(ib.leftarm1) ?? '#FFFFFF'] : undefined, staff: staffTable(text) })
  notes.push(`club ${c.id}: ${players.length} squad players${upd ? ` (updated ${upd})` : ''}${mgr?.name ? `, manager ${mgr.name}` : ''}`)
}
// --- national teams
const nts: any[] = []
function ntPage(code: string, level: string, title: string) {
  let raw = wikitext(title)
  if (raw && /\{\{\s*(disambig|disambiguation|dab)/i.test(raw)) raw = wikitext(title.replace(' national ', " men's national "))
  if (!raw) { notes.push(`NT page missing: ${title}`); return }
  const text = stripRefs(raw)
  let cur = section(text, /^(current|latest) squad$/i) ?? ''
  if (!cur) { const pl = section(text, /^players$/i) ?? ''; cur = pl.split(/^={3,5}[^=\n]+={3,5}\s*$/m)[0] }
  const rec = section(text, /^recent call[- ]?ups$/i) ?? ''
  const curMain = rec && cur.includes(rec) ? cur.replace(rec, '') : cur
  const players = [...parsePlayers(curMain).map(p => ({ ...p, current: true })), ...parsePlayers(rec).map(p => ({ ...p, current: false }))]
  const ib = findTemplates(text, /^infobox national football team$/i)[0]?.named ?? {}
  const coach = ib.coach ? { name: plain(ib.coach), title: firstLink(ib.coach.replace(/\{\{[^{}]*\}\}/g, ''))?.target } : undefined
  nts.push({ code, level, title, players, coach: coach?.name ? coach : undefined, staff: level !== 'senior' || code === 'IRN' ? staffTable(text) : [] })
  notes.push(`NT ${code} ${level}: ${players.filter(p => p.current).length} current + ${players.filter(p => !p.current).length} recent; with DOB ${players.filter(p => p.dob).length}${coach?.name ? `; coach ${coach.name}` : ''}`)
}
for (const t of ntTeams()) ntPage(t.code, 'senior', t.title)
for (const y of IRAN_YOUTH) ntPage('IRN', y.key, y.title)
console.log(notes.join('\n'))
writeJson(join(OUT, 'squads.json'), { clubSquads, nts, notes })
