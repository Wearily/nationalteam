// Club crests: infobox image of each covered club's en.wikipedia article → ~120px thumbnail in public/logos/<clubId>.<ext>.
// (Special:FilePath redirects to thumb.wikimedia.org, which is unreachable here, so thumbnail URLs on upload.wikimedia.org
// are built directly; Wikimedia only serves fixed widths, 120px being the closest step to the requested 128.)
// Usage: npx tsx pipeline/05b-logos.ts [countryCode ...]   (no args = all covered leagues, Iran first)
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { ROOT, OUT, curl, wikitext, readJson, writeJson, findTemplates, stripRefs } from './lib.ts'

const only = process.argv.slice(2).map(s => s.toUpperCase())
const { clubs } = readJson<{ clubs: any[] }>(join(OUT, 'leagues.json'))
const PRIO = ['IRN', 'UAE', 'QAT', 'KSA', 'IRQ', 'TUR', 'UZB']
const list = clubs.filter(c => !only.length || only.includes(c.country)).sort((a, b) => (PRIO.indexOf(a.country) + 99) % 99 - (PRIO.indexOf(b.country) + 99) % 99)
const dir = join(ROOT, 'public', 'logos'); mkdirSync(dir, { recursive: true })
const f = join(OUT, 'logos.json')
const done: Record<string, { logo: string; file: string } | { none: string }> = existsSync(f) ? readJson(f) : {}
function magic(path: string): 'png' | 'jpg' | null {
  if (!existsSync(path)) return null
  const b = readFileSync(path); if (b.length <= 500) return null
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpg'
  return null
}
export function logoFile(raw: string): string | undefined {
  const ib = findTemplates(stripRefs(raw), /^infobox (football club|sports team|football team)/i)[0]; if (!ib) return undefined
  for (const k of ['image', 'logo', 'crest']) {
    const v = ib.named[k]; if (!v) continue
    const m = v.match(/(?:\[\[)?(?:File:|Image:)?\s*([^|\]\n{}]+\.(?:svg|png|jpe?g|gif|webp))/i)
    if (m) return m[1].trim()
  }
  return undefined
}
let last = 0, ok = 0, n = 0
for (const c of list) {
  n++
  const prev = done[c.id] as any
  if (prev?.logo && existsSync(join(ROOT, 'public', prev.logo))) { ok++; continue }
  if (prev?.none && !process.env.RETRY) continue
  const raw = wikitext(c.title); if (!raw) { done[c.id] = { none: 'no article' }; continue }
  const file = logoFile(raw)?.replace(/ /g, '_'); if (!file) { done[c.id] = { none: 'no infobox image' }; continue }
  const fileU = file[0].toUpperCase() + file.slice(1)
  const md5 = createHash('md5').update(fileU).digest('hex'); const enc = encodeURIComponent(fileU)
  const ext = fileU.split('.').pop()!.toLowerCase()
  const thumbName = `120px-${enc}${ext === 'svg' ? '.png' : ''}`
  const tmp = join(dir, `${c.id}.tmp`); let saved: string | undefined; let rateLimited = false
  for (const site of ['en', 'commons']) {
    for (const url of [`https://upload.wikimedia.org/wikipedia/${site}/thumb/${md5[0]}/${md5.slice(0, 2)}/${enc}/${thumbName}`, ...(ext === 'svg' ? [] : [`https://upload.wikimedia.org/wikipedia/${site}/${md5[0]}/${md5.slice(0, 2)}/${enc}`])]) {
      for (let a = 0; a < 4; a++) {
        const wait = last + 1500 - Date.now(); if (wait > 0) spawnSync('sleep', [String(wait / 1000)]); last = Date.now()
        const r = curl(url, { out: tmp })
        if (r.status === 429) { rateLimited = true; spawnSync('sleep', [String(8 * (a + 1))]); continue }
        rateLimited = false
        const kind = r.status === 200 ? magic(tmp) : null
        if (kind) { const rel = `logos/${c.id}.${kind}`; spawnSync('mv', [tmp, join(ROOT, 'public', rel)]); saved = rel }
        break
      }
      if (saved) break
    }
    if (saved) break
  }
  if (existsSync(tmp)) unlinkSync(tmp)
  if (saved) { done[c.id] = { logo: saved, file: fileU }; ok++ } else if (!rateLimited) done[c.id] = { none: `download failed: ${fileU}` }
  if (n % 10 === 0) { writeJson(f, done); console.error(`  logos ${n}/${list.length} ok ${ok}`) }
}
writeJson(f, done)
console.log(`logos: ${ok} of ${list.length} clubs`)
