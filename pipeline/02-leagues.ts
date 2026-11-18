// Leagues + clubs from en.wikipedia season pages (team/stadium tables, current standings from the Sports table module).
import { join } from 'node:path'
import { wikitext, section, stripRefs, splitTop, firstLink, plain, findTemplates, writeJson, OUT, slug } from './lib.ts'
import { LEAGUES } from './leagues.config.ts'
const slugEq = 0

export interface StageClub { id: string; name: string; title: string; country: string; league: string; city?: string; stadium?: string; ppg?: number; played?: number; manager?: string; managerTitle?: string }

function tables(text: string): string[] {
  const out: string[] = []; const re = /^[ \t:]*(\{\||\|\})/gm; let depth = 0, start = -1, m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m[1] === '{|') { if (depth === 0) start = m.index; depth++ }
    else if (depth > 0) { depth--; if (depth === 0) out.push(text.slice(start, m.index + m[0].length)) }
  }
  return out
}
function rows(table: string): string[][] {
  return table.split(/\n\|-[^\n]*/).map(r => {
    const cells: string[] = []
    for (const line of r.split('\n')) {
      if (/^\{\||^\|\}|^\|\+/.test(line)) continue
      if (/^[|!]/.test(line)) { for (const c of splitTop(line.slice(1), line[0] === '!' ? '!!' : '||')) cells.push(c) }
      else if (cells.length) cells[cells.length - 1] += '\n' + line
    }
    // strip cell attributes ("style=... | content")
    return cells.map(c => { const parts = splitTop(c, '|'); return (parts.length > 1 && /=/.test(parts[0]) && !/\[\[|\{\{/.test(parts[0]) ? parts.slice(1).join('|') : c).trim() })
  }).filter(r => r.length)
}
function teamLink(cell: string): { target: string; label: string } | null {
  // skip flag/file links
  const c = cell.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
  const l = firstLink(c); if (!l) return null
  if (/^(Category|File):/i.test(l.target)) return null
  return l
}
const all: StageClub[] = []; const leaguesOut: any[] = []; const notes: string[] = []
for (const L of LEAGUES) {
  let used: string | null = null; let best: StageClub[] = []; let pageText = ''
  for (const title of L.titles) {
    const raw = wikitext(title); if (!raw) continue
    const text = stripRefs(raw)
    const sec = section(text, /^(teams|clubs|team changes|participating (teams|clubs)|stadiums? and locations|stadia and locations|teams? (overview|information)|overview)$/i) ?? text
    let cand: StageClub[] = []
    for (const scope of [sec, text]) {
      for (const t of tables(scope)) {
        const rs = rows(t); if (rs.length < 6) continue
        const head = rs[0].map(h => plain(h).toLowerCase())
        const iT = head.findIndex(h => /^(team|club)s?\b/.test(h)); if (iT < 0 || iT > 2) continue
        const iCity = head.findIndex(h => /location|city|home city|town|hometown/.test(h)); const iStad = head.findIndex(h => /stadium|ground|venue|arena/.test(h))
        const clubs: StageClub[] = []
        for (const r of rs.slice(1)) {
          const l = teamLink(r[iT] ?? ''); if (!l) continue
          const name = plain(r[iT]).replace(/\s*\(.*$/, '').replace(/[†‡*^]+$/, '').trim() || l.label
          clubs.push({ id: '', name, title: l.target, country: L.country, league: L.id, city: iCity >= 0 && r[iCity] ? plain(r[iCity]).split(/[,(]/)[0].trim() || undefined : undefined, stadium: iStad >= 0 && r[iStad] ? plain(r[iStad]).split(/[،(]/)[0].trim() || undefined : undefined })
        }
        const uniq = clubs.filter((c, i) => clubs.findIndex(x => x.title === c.title) === i)
        if (Math.abs(uniq.length - L.expect) < Math.abs(cand.length - L.expect) || !cand.length) cand = uniq
        if (cand.length === L.expect) break
      }
      if (cand.length >= L.expect - 2 && cand.length <= L.expect + 4) break
    }
    if (cand.length >= 8 && (cand.length > best.length || !best.length)) { best = cand; used = title; pageText = text }
    if (best.length >= L.expect - 2) break
  }
  if (!used) { notes.push(`${L.id}: NO TEAM LIST FOUND (${L.titles.join(' / ')})`); continue }
  // current standings: {{#invoke:Sports table|main|...|win_XXX=..|draw_XXX=..|loss_XXX=..|name_XXX=[[...]]}}
  const st: Record<string, { w?: number; d?: number; l?: number; name?: string }> = {}
  for (const m of pageText.matchAll(/\|\s*(win|draw|loss|name)_([A-Za-z0-9]+)\s*=\s*([^|\n]*)/g)) {
    const o = (st[m[2]] ??= {}); if (m[1] === 'name') o.name ??= firstLink(m[3])?.target ?? plain(m[3]); else { const k = m[1][0] as 'w' | 'd' | 'l'; if (o[k] === undefined) o[k] = Number(m[3]) || 0 }
  }
  for (const o of Object.values(st)) {
    const c = best.find(c => c.title === o.name || c.name === o.name); const pl = (o.w ?? 0) + (o.d ?? 0) + (o.l ?? 0)
    if (c && pl >= 5) { c.played = pl; c.ppg = Math.round(((o.w ?? 0) * 3 + (o.d ?? 0)) / pl * 100) / 100 }
  }
  // managers table ("Personnel and kits" / "Managers")
  const pers = section(pageText, /personnel|^managers$|coaches/i)
  if (pers) for (const t of tables(pers)) {
    const rs = rows(t); const head = (rs[0] ?? []).map(h => plain(h).toLowerCase())
    const iM = head.findIndex(h => /manager|head coach|coach/.test(h)); if (iM < 0) continue
    const iT = Math.max(0, head.findIndex(h => /^(team|club)s?\b/.test(h)))
    for (const r of rs.slice(1)) {
      const tl = teamLink(r[iT] ?? ''); const tn = plain(r[iT] ?? '')
      const c = best.find(c => (tl && c.title === tl.target) || c.name === tn || c.name === tl?.label || slug(c.name) === slug(tn)); if (!c || !r[iM]) continue
      const ml = firstLink(r[iM].replace(/\{\{[^{}]*\}\}/g, '')); const mn = plain(r[iM])
      if (mn) { c.manager = mn; c.managerTitle = ml?.target }
    }
    break
  }
  const pref = L.country.toLowerCase()
  for (const c of best) { c.id = `${pref}-${slug(c.name)}`; all.push(c) }
  leaguesOut.push({ id: L.id, name: L.name, country: L.country, tier: L.tier, strength: L.strength, startMonth: L.startMonth, sourcePage: used })
  notes.push(`${L.id}: ${best.length} clubs (expected ${L.expect}) from "${used}"; standings for ${best.filter(c => c.ppg !== undefined).length}; managers ${best.filter(c => c.manager).length}`)
}
// duplicate ids?
const seen = new Map<string, number>()
for (const c of all) { const n = (seen.get(c.id) ?? 0) + 1; seen.set(c.id, n); if (n > 1) c.id += '-' + n }
console.log(notes.join('\n'))
writeJson(join(OUT, 'leagues.json'), { leagues: leaguesOut, clubs: all, notes })
