// Optional coverage booster: current squads of Iranian clubs from fa.wikipedia (which lists far more players as real articles).
// Names are romanised ONLY through the Wikidata English label of the linked article; players without a Wikidata item,
// English label or date of birth are skipped.
import { join } from 'node:path'
import { wikitext, sparql, val, qid, readJson, writeJson, OUT, stripRefs, findTemplates, firstLink, section } from './lib.ts'

const { clubs } = readJson<{ clubs: any[] }>(join(OUT, 'leagues.json'))
const ir = clubs.filter(c => c.country === 'IRN')
const esc = (t: string) => `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
const rows = sparql(`SELECT ?name ?item ?fa WHERE { VALUES ?name { ${ir.map(c => esc(c.title) + '@en').join(' ')} } ?a schema:name ?name ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?item . OPTIONAL { ?b schema:about ?item ; schema:isPartOf <https://fa.wikipedia.org/> ; schema:name ?fa } }`)
const faTitle = new Map<string, string>(); for (const r of rows) if (val(r, 'fa')) faTitle.set(val(r, 'name')!, val(r, 'fa')!)
const digits = (s: string) => s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
const posOf = (s: string) => /دروازه/.test(s) || /^GK$/i.test(s) ? 'GK' : /مدافع|دفاع/.test(s) || /^DF$/i.test(s) ? 'DF' : /هافبک|میانی/.test(s) || /^MF$/i.test(s) ? 'MF' : /مهاجم|حمله/.test(s) || /^FW$/i.test(s) ? 'FW' : ''
const out: any[] = []; const notes: string[] = []; const allTitles = new Set<string>()
for (const c of ir) {
  const ft = faTitle.get(c.title); if (!ft) { notes.push(`${c.id}: no fa.wikipedia article linked on Wikidata`); continue }
  const raw = wikitext(ft, 0, 'fa'); if (!raw) { notes.push(`${c.id}: fa page missing`); continue }
  const text = stripRefs(raw)
  const sec = section(text, /بازیکنان|ترکیب|فهرست بازیکن/) ?? ''
  const main = sec.split(/^={3,5}[^=\n]*(?:قرضی|امانت|جوانان|امید|سابق|بازنشسته|پیشین)[^=\n]*={3,5}\s*$/m)[0]
  const season = digits(main.slice(0, 400)).match(/(\d{2,4})\s*[–-]\s*(\d{2,4})/)?.[0]
  const players: any[] = []
  for (const t of findTemplates(main, /^(بازیکن|بازیکن فوتبال|fs player|football squad player|بازیکن ف‌ب)$/i)) {
    const n = t.named; const nameRaw = n['نام'] ?? n.name ?? ''; const l = firstLink(nameRaw); if (!l) continue
    const no = parseInt(digits(n['شماره'] ?? n.no ?? ''), 10)
    players.push({ faTitle: l.target.replace(/_/g, ' '), no: isNaN(no) ? undefined : no, pos: posOf(n['نقش'] ?? n.pos ?? ''), natFa: (n['ملیت'] ?? n.nat ?? '').trim() })
    allTitles.add(l.target.replace(/_/g, ' '))
  }
  out.push({ clubId: c.id, faTitle: ft, season, players })
  notes.push(`${c.id}: ${players.length} players on fa.wikipedia${season ? ` (season ${season})` : ''}`)
}
// resolve fa titles → Wikidata (English label, DOB, positions)
const info = new Map<string, { qid: string; en?: string; dob?: string; pos: string[] }>()
const list = [...allTitles].sort()
for (let i = 0; i < list.length; i += 300) {
  const batch = list.slice(i, i + 300)
  for (const r of sparql(`SELECT ?name ?item ?l ?dob ?pos WHERE { VALUES ?name { ${batch.map(t => esc(t) + '@fa').join(' ')} } ?a schema:name ?name ; schema:isPartOf <https://fa.wikipedia.org/> ; schema:about ?item . OPTIONAL { ?item rdfs:label ?l FILTER(LANG(?l) = "en") } OPTIONAL { ?item wdt:P569 ?dob } OPTIONAL { ?item wdt:P413 ?pos } }`)) {
    const n = val(r, 'name')!; const o = info.get(n) ?? { qid: qid(val(r, 'item'))!, en: val(r, 'l'), dob: val(r, 'dob')?.slice(0, 10), pos: [] as string[] }
    const p = qid(val(r, 'pos')); if (p && !o.pos.includes(p)) o.pos.push(p); info.set(n, o)
  }
}
let usable = 0, total = 0
for (const c of out) for (const p of c.players) { total++; const i = info.get(p.faTitle); if (i) { p.qid = i.qid; p.en = i.en; p.dob = i.dob; p.wdPos = i.pos; if (i.en && i.dob) usable++ } }
notes.push(`fa squads: ${total} entries, ${[...info.keys()].length} linked to Wikidata, ${usable} usable (English label + DOB)`)
console.log(notes.join('\n'))
writeJson(join(OUT, 'fa-squads.json'), { squads: out, notes })
