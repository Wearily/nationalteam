// Wikidata helpers: per-entity cache via wbgetentities, simplified claims.
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { CACHE, curl, sparql, qid, val } from './lib.ts'
import { spawnSync } from 'node:child_process'

export interface Claim { v: any; q: Record<string, any>; rank: string }
export interface Ent { id: string; label?: string; enwiki?: string; claims: Record<string, Claim[]>; missing?: boolean }
const KEEP = ['P31', 'P106', 'P21', 'P27', 'P1532', 'P569', 'P19', 'P413', 'P2048', 'P54', 'P18', 'P172', 'P286', 'P6087', 'P17', 'P118', 'P131', 'P115', 'P1448', 'P570']
const LANGS = ['en', 'mul', 'en-gb', 'de', 'fr', 'es', 'it', 'nl', 'sv', 'da', 'nb', 'pt', 'tr']
const dir = join(CACHE, 'wd'); mkdirSync(dir, { recursive: true })

function snakVal(s: any): any {
  if (!s || s.snaktype !== 'value') return null
  const d = s.datavalue
  switch (d.type) {
    case 'wikibase-entityid': return d.value.id
    case 'time': return { t: d.value.time, p: d.value.precision }
    case 'quantity': return { n: Number(d.value.amount), u: (d.value.unit || '').replace(/^.*\//, '') }
    case 'monolingualtext': return d.value.text
    default: return d.value
  }
}
function simplify(e: any): Ent {
  if (!e || e.missing !== undefined) return { id: e?.id ?? '?', claims: {}, missing: true }
  const label = LANGS.map(l => e.labels?.[l]?.value).find(Boolean) ?? (Object.values(e.labels ?? {})[0] as any)?.value
  const claims: Record<string, Claim[]> = {}
  for (const p of KEEP) {
    const arr = e.claims?.[p]; if (!arr) continue
    claims[p] = arr.filter((c: any) => c.rank !== 'deprecated').map((c: any) => {
      const q: Record<string, any> = {}
      for (const qp of ['P580', 'P582', 'P1350', 'P1351', 'P585']) { const s = c.qualifiers?.[qp]?.[0]; if (s) q[qp] = snakVal(s) }
      return { v: snakVal(c.mainsnak), q, rank: c.rank }
    }).filter((c: Claim) => c.v !== null)
  }
  return { id: e.id, label, enwiki: e.sitelinks?.enwiki?.title, claims }
}
let last = 0
/** Fetch (cached) simplified entities for the given QIDs. */
export function entities(ids: string[]): Map<string, Ent> {
  const res = new Map<string, Ent>(); const need: string[] = []
  for (const id of new Set(ids)) {
    if (!/^Q\d+$/.test(id)) continue
    const f = join(dir, id + '.json')
    if (existsSync(f)) res.set(id, JSON.parse(readFileSync(f, 'utf8'))); else need.push(id)
  }
  // wbgetentities (batch API) is 429-blocked from this network, so fetch one entity at a time via Special:EntityData.
  let n = 0
  for (const id of need) {
    let done = false
    for (let a = 0; a < 7 && !done; a++) {
      const wait = last + 450 - Date.now(); if (wait > 0) spawnSync('sleep', [String(wait / 1000)])
      last = Date.now()
      const r = curl(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`)
      if (r.status === 200 && r.body.startsWith('{')) {
        const j = JSON.parse(r.body); const e: any = j.entities?.[id] ?? Object.values(j.entities ?? {})[0]
        const s = simplify(e ?? { id, missing: '' }); s.id = id
        writeFileSync(join(dir, id + '.json'), JSON.stringify(s)); res.set(id, s); done = true
      } else if (r.status === 404) {
        const s: Ent = { id, claims: {}, missing: true }; writeFileSync(join(dir, id + '.json'), JSON.stringify(s)); res.set(id, s); done = true
      } else { spawnSync('sleep', [String(Math.min(60, 1.5 * 2 ** a))]) }
    }
    if (!done) console.error('  wd: gave up on', id)
    if (++n % 100 === 0) console.error(`  wd entities ${n}/${need.length}`)
  }
  return res
}
export function time2iso(t?: { t: string; p: number }): string | undefined {
  if (!t) return undefined
  const m = t.t.match(/^\+(\d{4})-(\d\d)-(\d\d)/); if (!m) return undefined
  if (t.p >= 11) return `${m[1]}-${m[2]}-${m[3]}`
  if (t.p === 10) return `${m[1]}-${m[2]}-15`
  if (t.p === 9) return `${m[1]}-07-01`
  return undefined
}
/** enwiki titles → QIDs via sitelinks (exact titles only; redirects not resolved). */
export function titlesToQids(titles: string[]): Map<string, string> {
  const out = new Map<string, string>(); const uniq = [...new Set(titles)].sort()
  for (let i = 0; i < uniq.length; i += 400) {
    const batch = uniq.slice(i, i + 400)
    const values = batch.map(t => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@en`).join(' ')
    const rows = sparql(`SELECT ?item ?name WHERE { VALUES ?name { ${values} } ?a schema:name ?name ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?item . }`)
    for (const r of rows) out.set(val(r, 'name')!, qid(val(r, 'item'))!)
  }
  return out
}
export function ids(query: string, v = 'p'): string[] { return [...new Set(sparql(query).map(r => qid(val(r, v))!))] }

/** enwiki titles → { qid, positions[], dob } in one pass (used for bulk position refinement of national squads). */
export function titlesInfo(titles: string[]): Map<string, { qid: string; pos: string[]; dob?: string }> {
  const out = new Map<string, { qid: string; pos: string[]; dob?: string }>(); const uniq = [...new Set(titles)].sort()
  for (let i = 0; i < uniq.length; i += 400) {
    const batch = uniq.slice(i, i + 400)
    const values = batch.map(t => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@en`).join(' ')
    const rows = sparql(`SELECT ?item ?name ?pos ?dob WHERE { VALUES ?name { ${values} } ?a schema:name ?name ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?item . OPTIONAL { ?item wdt:P413 ?pos } OPTIONAL { ?item wdt:P569 ?dob } }`)
    for (const r of rows) {
      const n = val(r, 'name')!; const o = out.get(n) ?? { qid: qid(val(r, 'item'))!, pos: [] as string[], dob: val(r, 'dob')?.slice(0, 10) }
      const p = qid(val(r, 'pos')); if (p && !o.pos.includes(p)) o.pos.push(p)
      out.set(n, o)
    }
    console.error(`  titlesInfo ${Math.min(i + 400, uniq.length)}/${uniq.length}`)
  }
  return out
}

// ---------- bulk people via SPARQL (few big queries; WDQS is limited to ~1 request/minute from this network) ----------
export interface P54 { team: string; start?: string; end?: string; caps?: number; goals?: number }
export interface Person { id: string; label?: string; enwiki?: string; props: Record<string, string[]>; p54: P54[]; birthCountries: string[] }
export interface RefInfo { label?: string; country?: string; enwiki?: string }
const chunk = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))
export function bulkPeople(qids: string[]): Map<string, Person> {
  const out = new Map<string, Person>()
  const list = [...new Set(qids)].filter(q => /^Q\d+$/.test(q)).sort()
  for (const part of chunk(list, 1200)) {
    const V = `VALUES ?p { ${part.map(q => 'wd:' + q).join(' ')} }`
    for (const q of part) out.set(q, { id: q, props: {}, p54: [], birthCountries: [] })
    for (const r of sparql(`SELECT ?p ?prop ?v WHERE { ${V} VALUES ?prop { wdt:P27 wdt:P1532 wdt:P569 wdt:P413 wdt:P2048 wdt:P18 wdt:P19 wdt:P21 wdt:P570 wdt:P31 wdt:P106 } ?p ?prop ?v }`)) {
      const o = out.get(qid(val(r, 'p'))!)!; const prop = qid(val(r, 'prop'))!; const v = r.v.type === 'uri' ? (r.v.value.includes('/entity/') ? qid(r.v.value)! : decodeURIComponent(r.v.value.replace(/^.*Special:FilePath\//, ''))) : r.v.value
      ;(o.props[prop] ??= []).includes(v) || o.props[prop].push(v)
    }
    for (const r of sparql(`SELECT ?p ?l ?title WHERE { ${V} OPTIONAL { ?p rdfs:label ?l FILTER(LANG(?l) = "en") } OPTIONAL { ?a schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title } }`)) {
      const o = out.get(qid(val(r, 'p'))!)!; o.label ??= val(r, 'l'); o.enwiki ??= val(r, 'title')
    }
    for (const r of sparql(`SELECT ?p ?t ?start ?end ?caps ?goals WHERE { ${V} ?p p:P54 ?s . ?s ps:P54 ?t . OPTIONAL { ?s pq:P580 ?start } OPTIONAL { ?s pq:P582 ?end } OPTIONAL { ?s pq:P1350 ?caps } OPTIONAL { ?s pq:P1351 ?goals } }`)) {
      const o = out.get(qid(val(r, 'p'))!)!
      o.p54.push({ team: qid(val(r, 't'))!, start: val(r, 'start')?.slice(0, 10), end: val(r, 'end')?.slice(0, 10), caps: val(r, 'caps') ? Number(val(r, 'caps')) : undefined, goals: val(r, 'goals') ? Number(val(r, 'goals')) : undefined })
    }
    for (const r of sparql(`SELECT ?p ?c WHERE { ${V} ?p wdt:P19 ?pl . ?pl wdt:P17 ?c }`)) out.get(qid(val(r, 'p'))!)!.birthCountries.push(qid(val(r, 'c'))!)
  }
  return out
}
/** Labels / country / enwiki title for arbitrary referenced items (teams, countries, positions). */
export function refInfo(qids: string[]): Map<string, RefInfo> {
  const out = new Map<string, RefInfo>()
  const list = [...new Set(qids)].filter(q => /^Q\d+$/.test(q)).sort()
  for (const part of chunk(list, 1500)) {
    const V = `VALUES ?t { ${part.map(q => 'wd:' + q).join(' ')} }`
    for (const r of sparql(`SELECT ?t ?l ?c ?title WHERE { ${V} OPTIONAL { ?t rdfs:label ?l FILTER(LANG(?l) = "en") } OPTIONAL { ?t wdt:P17 ?c } OPTIONAL { ?a schema:about ?t ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title } }`)) {
      const id = qid(val(r, 't'))!; const o = out.get(id) ?? {}; o.label ??= val(r, 'l'); o.country ??= qid(val(r, 'c')); o.enwiki ??= val(r, 'title'); out.set(id, o)
    }
  }
  return out
}

/** enwiki titles of clubs → country QID (P17), for clubs that only appear in infoboxes / squad tables. */
export function titlesCountry(titles: string[]): Map<string, { qid: string; country?: string }> {
  const out = new Map<string, { qid: string; country?: string }>(); const uniq = [...new Set(titles)].sort()
  for (let i = 0; i < uniq.length; i += 400) {
    const batch = uniq.slice(i, i + 400)
    const values = batch.map(t => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@en`).join(' ')
    for (const r of sparql(`SELECT ?item ?name ?c WHERE { VALUES ?name { ${values} } ?a schema:name ?name ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?item . OPTIONAL { ?item wdt:P17 ?c } }`)) {
      const n = val(r, 'name')!; if (!out.has(n)) out.set(n, { qid: qid(val(r, 'item'))!, country: qid(val(r, 'c')) })
    }
  }
  return out
}
