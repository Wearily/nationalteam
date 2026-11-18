// Downloads face thumbnails for Iran-eligible players that have a Wikidata P18 image, and looks up credit lines on Commons.
// Input: .cache/stage/photo-wanted.json (written by 06-build). Output: public/faces/<id>.<ext>, .cache/stage/photos.json
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { ROOT, OUT, curl, commonsText, readJson, writeJson, findTemplates, plain } from './lib.ts'

const wanted = readJson<Record<string, string>>(join(OUT, 'photo-wanted.json'))
const faces = join(ROOT, 'public', 'faces'); mkdirSync(faces, { recursive: true })
const done: Record<string, { photo: string; credit: string; file: string }> = existsSync(join(OUT, 'photos.json')) ? readJson(join(OUT, 'photos.json')) : {}
const failed: string[] = []
const WIDTH = 250 // Wikimedia only serves standard thumbnail steps; 250px is the closest to the requested 256
let n = 0
for (const [id, fileRaw] of Object.entries(wanted)) {
  const file = fileRaw.replace(/ /g, '_')
  const ext = (file.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? '').toLowerCase()
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) { failed.push(`${id}: unsupported type ${file}`); continue }
  const outExt = ext === 'jpeg' ? 'jpg' : ext
  const rel = `faces/${id.replace(/[^A-Za-z0-9_-]/g, '_')}.${outExt}`; const dest = join(ROOT, 'public', rel)
  if (!(done[id]?.file === file && existsSync(dest))) {
    const md5 = createHash('md5').update(file).digest('hex')
    const enc = encodeURIComponent(file)
    const urls = [`https://upload.wikimedia.org/wikipedia/commons/thumb/${md5[0]}/${md5.slice(0, 2)}/${enc}/${WIDTH}px-${enc}`, `https://commons.wikimedia.org/wiki/Special:FilePath/${enc}?width=${WIDTH}`]
    let ok = false
    for (const u of urls) {
      for (let a = 0; a < 3 && !ok; a++) {
        spawnSync('sleep', ['0.7'])
        const r = curl(u, { out: dest })
        if (r.status === 200 && existsSync(dest) && statSync(dest).size > 1500) ok = true
        else if (r.status === 429) spawnSync('sleep', [String(10 * (a + 1))]); else break
      }
      if (ok) break
    }
    if (!ok) { if (existsSync(dest)) unlinkSync(dest); failed.push(`${id}: download failed ${file}`); continue }
    // credit
    let credit = `Wikimedia Commons: ${fileRaw}`
    const txt = commonsText(fileRaw)
    if (txt) {
      const info = findTemplates(txt, /^(information|artwork|photograph)$/i)[0]
      let author = info ? plain(info.named.author ?? info.named.photographer ?? info.named.artist ?? '') : ''
      author = author.replace(/\s+/g, ' ').slice(0, 80)
      const lic = txt.match(/\{\{\s*(?:self\s*\|\s*)?((?:cc-(?:by(?:-sa)?|zero)[-\d.a-z]*)|pd-[a-z0-9 -]+|gfdl|tasnim|fars|mehr(?:news)?|khamenei\.ir|irna|attribution|licensereview[^|}]*|youtube cc-by|cc0)\s*[|}]/i)?.[1]
      const agency = txt.match(/\{\{\s*(tasnim|fars|mehr(?:news)?|khamenei\.ir|irna|ypa\.ir|farsnews|mojnews|snn\.ir|varzesh3|hamshahri)[^}]*\}\}/i)?.[1]
      const parts = [author || (agency ? agency : ''), lic && !/licensereview/i.test(lic) ? lic.toUpperCase().replace(/^CC-/, 'CC ').replace(/-/g, ' ') : agency ? `${agency} (CC BY 4.0)` : '', 'via Wikimedia Commons'].filter(Boolean)
      if (parts.length > 1) credit = parts.join(', ')
    }
    done[id] = { photo: rel, credit, file }
    if (++n % 25 === 0) { console.error(`  photos ${n}`); writeJson(join(OUT, 'photos.json'), done) }
  }
}
for (const id of Object.keys(done)) if (!wanted[id]) delete done[id]
writeJson(join(OUT, 'photos.json'), done)
writeJson(join(OUT, 'photos-failed.json'), failed)
console.log(`photos ok: ${Object.keys(done).length}, failed: ${failed.length}`)
