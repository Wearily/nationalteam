// Downloads face thumbnails for Iran-eligible players that have a Wikidata P18 image, and looks up credit lines on Commons.
// Input: .cache/stage/photo-wanted.json (written by 06-build). Output: public/faces/<id>.<ext>, .cache/stage/photos.json
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, statSync, unlinkSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { ROOT, OUT, commonsText, readJson, writeJson, findTemplates, plain, fetchThumb } from './lib.ts'

const wanted = readJson<Record<string, string>>(join(OUT, 'photo-wanted.json'))
const faces = join(ROOT, 'public', 'faces'); mkdirSync(faces, { recursive: true })
const done: Record<string, { photo: string; credit: string; file: string }> = existsSync(join(OUT, 'photos.json')) ? readJson(join(OUT, 'photos.json')) : {}
const failed: string[] = []
const WIDTH = 250 // Wikimedia only serves standard thumbnail steps; 250px is the closest to the requested 256
let queue = Object.entries(wanted).filter(([id, fileRaw]) => { const d = done[id]; return !(d && d.file === fileRaw.replace(/ /g, '_') && existsSync(join(ROOT, 'public', d.photo))) })
const why: Record<string, string> = {}
for (let pass = 1; pass <= 5 && queue.length; pass++) {
  const next: [string, string][] = []
  for (const [id, fileRaw] of queue) {
    const file = fileRaw.replace(/ /g, '_')
    const ext = (file.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? '').toLowerCase()
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) { why[id] = `unsupported type ${file}`; continue }
    const base = join(faces, id.replace(/[^A-Za-z0-9_-]/g, '_'))
    const r = fetchThumb(file, WIDTH, base + '.tmp', ['commons'])
    if (!r.kind) { why[id] = `${r.why} — ${file}`; if (r.why === 'HTTP 429') next.push([id, fileRaw]); continue }
    delete why[id]
    const rel = `faces/${id.replace(/[^A-Za-z0-9_-]/g, '_')}.${r.kind}`; spawnSync('mv', [base + '.tmp', join(ROOT, 'public', rel)])
    done[id] = { photo: rel, credit: `Wikimedia Commons: ${fileRaw}`, file }
  }
  writeJson(join(OUT, 'photos.json'), done); console.error(`  photos pass ${pass}: have ${Object.keys(done).length}, outstanding ${next.length}`)
  queue = next; if (queue.length) spawnSync('sleep', ['20'])
}
for (const [id, w] of Object.entries(why)) failed.push(`${id}: ${w}`)
// credit lines from the Commons file page (author + licence)
if (!process.env.NO_CREDITS) for (const [id, d] of Object.entries(done)) {
  if (!wanted[id] || !d.credit.startsWith('Wikimedia Commons: ')) continue
  const fileRaw = wanted[id]
  const txt = commonsText(fileRaw)
  if (txt) {
    const info = findTemplates(txt, /^(information|artwork|photograph)$/i)[0]
    let author = info ? plain(info.named.author ?? info.named.photographer ?? info.named.artist ?? '') : ''
    author = author.replace(/\s+/g, ' ').slice(0, 80)
    const lic = txt.match(/\{\{\s*(?:self\s*\|\s*)?((?:cc-(?:by(?:-sa)?|zero)[-\d.a-z]*)|pd-[a-z0-9 -]+|gfdl|cc0)\s*[|}]/i)?.[1]
    const agency = txt.match(/\{\{\s*(tasnim|fars|mehr(?:news)?|khamenei\.ir|irna|ypa\.ir|farsnews|mojnews|snn\.ir|varzesh3|hamshahri)[^}]*\}\}/i)?.[1]
    const parts = [author || agency || '', lic ? lic.toUpperCase().replace(/^CC-/, 'CC ').replace(/-/g, ' ') : agency ? 'CC BY 4.0' : '', 'via Wikimedia Commons'].filter(Boolean)
    if (parts.length > 1) d.credit = parts.join(', ')
  }
}
for (const id of Object.keys(done)) if (!wanted[id]) delete done[id]
writeJson(join(OUT, 'photos.json'), done)
writeJson(join(OUT, 'photos-failed.json'), failed)
console.log(`photos ok: ${Object.keys(done).length}, failed: ${failed.length}`)
