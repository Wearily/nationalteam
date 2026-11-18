// Club crests: infobox image of each covered club's en.wikipedia article → ~120px thumbnail in public/logos/<clubId>.<ext>.
// (Special:FilePath redirects to thumb.wikimedia.org, which is unreachable here, so thumbnail URLs on upload.wikimedia.org
// are built directly; Wikimedia only serves fixed widths, 120px being the closest step to the requested 128.)
// Usage: npx tsx pipeline/05b-logos.ts [countryCode ...]   (no args = all covered leagues, Iran first)
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { ROOT, OUT, wikitext, readJson, writeJson, findTemplates, stripRefs, fetchThumb } from './lib.ts'

const only = process.argv.slice(2).map(s => s.toUpperCase())
const { clubs } = readJson<{ clubs: any[] }>(join(OUT, 'leagues.json'))
const PRIO = ['IRN', 'UAE', 'QAT', 'KSA', 'IRQ', 'TUR', 'UZB']
const list = clubs.filter(c => !only.length || only.includes(c.country)).sort((a, b) => (PRIO.indexOf(a.country) + 99) % 99 - (PRIO.indexOf(b.country) + 99) % 99)
const dir = join(ROOT, 'public', 'logos'); mkdirSync(dir, { recursive: true })
const f = join(OUT, 'logos.json')
const done: Record<string, { logo: string; file: string } | { none: string }> = existsSync(f) ? readJson(f) : {}
export function logoFile(raw: string): string | undefined {
  const ib = findTemplates(stripRefs(raw), /^infobox (football club|sports team|football team)/i)[0]; if (!ib) return undefined
  for (const k of ['image', 'logo', 'crest']) {
    const v = ib.named[k]; if (!v) continue
    const m = v.match(/(?:\[\[)?(?:File:|Image:)?\s*([^|\]\n{}]+\.(?:svg|png|jpe?g|gif|webp))/i)
    if (m) return m[1].trim()
  }
  return undefined
}
let ok = 0
// resolve file names first (club article + existence of a local File: page), then download in passes
const todo: { id: string; file: string; site: string }[] = []
for (const c of list) {
  const prev = done[c.id] as any
  if (prev?.logo && existsSync(join(ROOT, 'public', prev.logo))) { ok++; continue }
  if (prev?.none && !/HTTP 429/.test(prev.none) && !process.env.RETRY) continue
  const raw = wikitext(c.title); if (!raw) { done[c.id] = { none: 'no article' }; continue }
  const file = logoFile(raw)?.replace(/ /g, '_'); if (!file) { done[c.id] = { none: 'no infobox image' }; continue }
  todo.push({ id: c.id, file, site: 'en' }) // non-free crests live on en.wikipedia; free ones on Commons (tried second)
  if (todo.length % 20 === 0) console.error(`  logo files resolved: ${todo.length}`)
}
let queue = todo
for (let pass = 1; pass <= 5 && queue.length; pass++) {
  const next: typeof todo = []
  for (const t of queue) {
    const tmp = join(dir, `${t.id}.tmp`)
    const r = fetchThumb(t.file, 120, tmp, ['en', 'commons'])
    if (r.kind) { const rel = `logos/${t.id}.${r.kind}`; spawnSync('mv', [tmp, join(ROOT, 'public', rel)]); done[t.id] = { logo: rel, file: t.file }; ok++ }
    else { done[t.id] = { none: `${r.why}: ${t.file}` }; if (r.why === 'HTTP 429') next.push(t) }
  }
  writeJson(f, done); console.error(`  logos pass ${pass}: ok ${ok}, still outstanding ${next.length}`)
  queue = next; if (queue.length) spawnSync('sleep', ['20'])
}
writeJson(f, done)
console.log(`logos: ${ok} of ${list.length} clubs`)
