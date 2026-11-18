// Shared helpers: polite cached fetching through curl (Node fetch ignores the HTTPS proxy), wikitext utils.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const CACHE = join(ROOT, 'pipeline', '.cache')
export const UA = 'TeamMelliManagerBot/0.1 (personal hobby project)'
export const AS_OF = '2026-11-18'

const lastHit: Record<string, number> = {}
function sleep(ms: number) { spawnSync('sleep', [String(ms / 1000)]) }
function throttle(host: string, gap: number) {
  const now = Date.now(); const wait = (lastHit[host] ?? 0) + gap - now
  if (wait > 0) sleep(wait)
  lastHit[host] = Date.now()
}
export function sha(s: string) { return createHash('sha1').update(s).digest('hex') }

/** GET with curl. Returns {status, body}. Body written to `out` if given (binary safe). */
export function curl(url: string, opts: { out?: string; post?: string; accept?: string } = {}): { status: number; body: string } {
  const args = ['-sS', '-L', '--max-time', '120', '-A', UA, '-w', '\n%{http_code}']
  if (opts.accept) args.push('-H', `Accept: ${opts.accept}`)
  if (opts.post !== undefined) args.push('--data-binary', opts.post, '-H', 'Content-Type: application/x-www-form-urlencoded')
  if (opts.out) args.push('-o', opts.out)
  args.push(url)
  const r = spawnSync('curl', args, { encoding: 'utf8', maxBuffer: 1 << 30 })
  const out = r.stdout ?? ''
  const i = out.lastIndexOf('\n')
  const status = Number(out.slice(i + 1)) || 0
  return { status, body: out.slice(0, i) }
}

function cached(kind: string, key: string, gap: number, host: string, doFetch: () => { status: number; body: string }, okEmpty = false): string | null {
  const f = join(CACHE, kind, key)
  if (existsSync(f)) { const s = readFileSync(f, 'utf8'); return s === '\u0000MISSING' ? null : s }
  mkdirSync(dirname(f), { recursive: true })
  for (let attempt = 0; attempt < 6; attempt++) {
    throttle(host, gap)
    const r = doFetch()
    if (r.status === 200 && (okEmpty || r.body.length > 0) && !r.body.startsWith('<!DOCTYPE html>')) { writeFileSync(f, r.body); return r.body }
    if (r.status === 404) { writeFileSync(f, '\u0000MISSING'); return null }
    const back = Math.min(180000, 15000 * 2 ** attempt)
    console.error(`  [${host}] status ${r.status}, backing off ${back / 1000}s (${key.slice(0, 60)})`)
    sleep(back)
  }
  console.error(`  [${host}] GAVE UP ${key}`)
  return null
}

function safeName(t: string) { return t.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) + '.' + sha(t).slice(0, 8) }

/** Raw wikitext of an en.wikipedia page (follows #REDIRECT). null if missing. */
export function wikitext(title: string, depth = 0): string | null {
  const t = title.replace(/ /g, '_')
  const body = cached('wp', safeName(t) + '.wiki', 2500, 'en.wikipedia.org',
    () => curl(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(t)}&action=raw`))
  if (body == null) return null
  const m = body.match(/^\s*#REDIRECT\s*\[\[([^\]|#]+)/i)
  if (m && depth < 3) return wikitext(m[1].trim(), depth + 1)
  return body
}
export function commonsText(file: string): string | null {
  const t = 'File:' + file.replace(/ /g, '_')
  return cached('commons', safeName(t) + '.wiki', 1200, 'commons.wikimedia.org',
    () => curl(`https://commons.wikimedia.org/w/index.php?title=${encodeURIComponent(t)}&action=raw`))
}
export function sparql(query: string): any[] {
  const body = cached('sparql', sha(query) + '.json', 6000, 'query.wikidata.org',
    () => curl('https://query.wikidata.org/sparql', { post: 'query=' + encodeURIComponent(query), accept: 'application/sparql-results+json' }))
  if (body == null) throw new Error('SPARQL failed: ' + query.slice(0, 200))
  return JSON.parse(body).results.bindings
}
export const qid = (uri?: string) => uri ? uri.replace(/^.*\//, '') : undefined
export const val = (b: any, k: string): string | undefined => b[k]?.value

// ---------- wikitext utils ----------
export function stripRefs(s: string) {
  return s.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
}
/** Split on top-level `sep`, ignoring those nested in [[ ]] or {{ }}. */
export function splitTop(s: string, sep = '|'): string[] {
  const out: string[] = []; let depth = 0, cur = ''
  for (let i = 0; i < s.length; i++) {
    const two = s.substr(i, 2)
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue }
    if (two === '}}' || two === ']]') { depth--; cur += two; i++; continue }
    if (depth === 0 && s.startsWith(sep, i)) { out.push(cur); cur = ''; i += sep.length - 1; continue }
    cur += s[i]
  }
  out.push(cur); return out
}
export interface Tpl { name: string; pos: string[]; named: Record<string, string>; raw: string; index: number }
/** Find all templates (any nesting level) whose name matches `re`. */
export function findTemplates(text: string, re: RegExp): Tpl[] {
  const res: Tpl[] = []
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] !== '{' || text[i + 1] !== '{') continue
    // find matching close
    let depth = 0, j = i
    for (; j < text.length - 1; j++) {
      const two = text.substr(j, 2)
      if (two === '{{') { depth++; j++ } else if (two === '}}') { depth--; j++; if (depth === 0) break }
    }
    if (depth !== 0) break
    const inner = text.slice(i + 2, j - 1)
    const parts = splitTop(inner)
    const name = parts[0].trim().replace(/_/g, ' ')
    if (re.test(name)) {
      const t: Tpl = { name, pos: [], named: {}, raw: text.slice(i, j + 1), index: i }
      for (const p of parts.slice(1)) {
        const eq = topEq(p)
        if (eq > 0 && /^[\w\s-]+$/.test(p.slice(0, eq))) t.named[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim()
        else t.pos.push(p.trim())
      }
      res.push(t)
    }
  }
  return res
}
function topEq(p: string) {
  let depth = 0
  for (let i = 0; i < p.length; i++) {
    const two = p.substr(i, 2)
    if (two === '{{' || two === '[[') { depth++; i++ } else if (two === '}}' || two === ']]') { depth--; i++ } else if (p[i] === '=' && depth === 0) return i
  }
  return -1
}
/** First wikilink in a string → {target, label}. */
export function firstLink(s: string): { target: string; label: string } | null {
  const m = s.match(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/)
  if (!m) return null
  const target = m[1].split('#')[0].trim()
  return { target, label: (m[2] ?? m[1]).trim() }
}
export function plain(s: string): string {
  let t = stripRefs(s)
  // resolve innermost templates repeatedly; keep visible text of wrappers, drop the rest
  for (let i = 0; i < 8 && /\{\{[^{}]*\}\}/.test(t); i++) {
    t = t.replace(/\{\{([^{}]*)\}\}/g, (_m, inner: string) => {
      const parts = inner.split('|'); const name = parts[0].trim().toLowerCase()
      const args = parts.slice(1).filter(p => !/^\s*[a-z0-9_ -]+\s*=/i.test(p) || /\[\[/.test(p))
      if (name === 'sortname' || name === 'sort name') return `${args[0] ?? ''} ${args[1] ?? ''}`
      if (name === 'sort' || name === 'hs') return args.slice(1).join('|')
      if (['nowrap', 'nobreak', 'nobr', 'center', 'left', 'nw'].includes(name)) return args.join('|')
      if (name === 'lang' || name === 'transl' || name === 'transliteration') return args.slice(1).join('|')
      return ''
    })
  }
  return t.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/'{2,}/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}
/** Text of a section by heading regexp (up to next heading of same or higher level). */
export function section(text: string, headRe: RegExp): string | null {
  const re = /^(={2,5})\s*(.*?)\s*\1\s*$/gm
  let m: RegExpExecArray | null; let start = -1, level = 0
  while ((m = re.exec(text))) {
    if (start < 0) { if (headRe.test(plain(m[2]))) { start = m.index + m[0].length; level = m[1].length } }
    else if (m[1].length <= level) return text.slice(start, m.index)
  }
  return start >= 0 ? text.slice(start) : null
}
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ıİ]/g, 'i').replace(/ø/gi, 'o').replace(/ß/g, 'ss').replace(/æ/gi, 'ae').replace(/đ/gi, 'd').replace(/ł/gi, 'l')
    .toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}
export function slug(s: string) { return norm(s).replace(/ /g, '-') }
/** {{birth date and age|1992|7|18|df=y}} etc → ISO. */
export function parseDob(s: string): string | undefined {
  const t = findTemplates(s, /^(birth date|birth date and age|bda|birth date and age2|age2|dob|birth year and age|birth-date and age|birth based on age as of date)$/i)[0]
  if (t) {
    if (/age2$/i.test(t.name)) { const n = t.pos.map(Number).filter(x => !isNaN(x)); return n.length >= 6 && n[3] > 1900 ? `${n[3]}-${String(n[4]).padStart(2, '0')}-${String(n[5]).padStart(2, '0')}` : undefined }
    if (/year/i.test(t.name)) { const y = Number(t.pos[0]); return y > 1900 ? `${y}-07-01` : undefined }
    if (/based on age/i.test(t.name)) return undefined
    const nums = t.pos.map(x => Number(x)).filter(n => !isNaN(n))
    if (nums.length >= 3 && nums[0] > 1900) return `${nums[0]}-${String(nums[1]).padStart(2, '0')}-${String(nums[2]).padStart(2, '0')}`
    if (nums.length >= 1 && nums[0] > 1900) return `${nums[0]}-07-01`
    const d = Date.parse(t.pos[0] ?? ''); if (!isNaN(d)) return new Date(d).toISOString().slice(0, 10)
  }
  return undefined
}
export function readJson<T>(f: string): T { return JSON.parse(readFileSync(f, 'utf8')) }
export function writeJson(f: string, v: unknown, pretty = true) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, pretty ? JSON.stringify(v, null, 1) : JSON.stringify(v)) }
export const OUT = join(CACHE, 'stage')
export { existsSync, statSync }
