// Wikidata candidate sets: Iranian footballers, diaspora candidates, Iranian managers. Downloads entity JSON for each.
import { join } from 'node:path'
import { sparql, qid, val, writeJson, OUT, wikitext } from './lib.ts'
import { bulkPeople, refInfo, ids, titlesToQids } from './wd.ts'
import { DIASPORA_SEED } from './diaspora.seed.ts'

const FB = 'wd:Q937857'
const iran = ids(`SELECT DISTINCT ?p WHERE { ?p wdt:P106 ${FB} . { ?p wdt:P27 wd:Q794 } UNION { ?p wdt:P1532 wd:Q794 } FILTER NOT EXISTS { ?p wdt:P21 wd:Q6581072 } }`)
const bornInIran = ids(`SELECT DISTINCT ?p WHERE { ?p wdt:P106 ${FB} ; wdt:P19 ?pl ; wdt:P569 ?dob . ?pl wdt:P17 wd:Q794 . FILTER(YEAR(?dob) >= 1996) FILTER NOT EXISTS { ?p wdt:P21 wd:Q6581072 } }`)
const ethnic = ids(`SELECT DISTINCT ?p WHERE { ?p wdt:P106 ${FB} ; wdt:P172 ?e ; wdt:P569 ?dob . ?e rdfs:label ?l . FILTER(LANG(?l) = "en" && REGEX(?l, "Persian|Iranian", "i")) FILTER(YEAR(?dob) >= 1996) FILTER NOT EXISTS { ?p wdt:P21 wd:Q6581072 } }`)
const persianSpeaking = ids(`SELECT DISTINCT ?p WHERE { ?p wdt:P106 ${FB} ; wdt:P569 ?dob . { ?p wdt:P103 wd:Q9168 } UNION { ?p wdt:P1412 wd:Q9168 } FILTER(YEAR(?dob) >= 1996) FILTER NOT EXISTS { ?p wdt:P27 wd:Q889 } FILTER NOT EXISTS { ?p wdt:P27 wd:Q863 } FILTER NOT EXISTS { ?p wdt:P21 wd:Q6581072 } }`)
const seedMap = titlesToQids(DIASPORA_SEED.map(s => s.title))
const seed = DIASPORA_SEED.map(s => ({ ...s, qid: seedMap.get(s.title) }))
const coaches = ids(`SELECT DISTINCT ?p WHERE { ?p wdt:P106 wd:Q628099 . { ?p wdt:P27 wd:Q794 } UNION { ?p wdt:P1532 wd:Q794 } ?p wdt:P569 ?dob . FILTER(YEAR(?dob) >= 1955) FILTER NOT EXISTS { ?p wdt:P21 wd:Q6581072 } FILTER NOT EXISTS { ?p wdt:P570 ?dod } }`)
// country QID → FIFA code
const fifa: Record<string, string> = {}
for (const r of sparql(`SELECT ?c ?code WHERE { ?c wdt:P3441 ?code }`)) { const c = qid(val(r, 'c'))!; if (!fifa[c]) fifa[c] = val(r, 'code')! }
console.log({ iran: iran.length, bornInIran: bornInIran.length, ethnic: ethnic.length, persianSpeaking: persianSpeaking.length, seed: seed.map(s => `${s.title}:${s.qid}`), coaches: coaches.length, fifaCodes: Object.keys(fifa).length })
// one query for birth years so that we only download entities we can use (born 1986+)
const young = new Set(ids(`SELECT DISTINCT ?p WHERE { ?p wdt:P106 ${FB} . { ?p wdt:P27 wd:Q794 } UNION { ?p wdt:P1532 wd:Q794 } ?p wdt:P569 ?dob . FILTER(YEAR(?dob) >= 1986) }`))
const iranYoung = iran.filter(q => young.has(q))
console.log('iran born 1986+:', iranYoung.length, '(older or no DOB skipped:', iran.length - iranYoung.length, ')')
const all = [...new Set([...iranYoung, ...bornInIran, ...ethnic, ...persianSpeaking, ...seed.map(s => s.qid!).filter(Boolean), ...coaches])]
writeJson(join(OUT, 'wd-sets.json'), { iran: iranYoung, iranAll: iran.length, bornInIran, ethnic, persianSpeaking, seed, coaches, fifa })
const people = bulkPeople(all)
const refs = new Set<string>()
for (const p of people.values()) { for (const x of p.p54) refs.add(x.team); for (const k of ['P27', 'P1532', 'P413']) for (const v of p.props[k] ?? []) refs.add(v); for (const c of p.birthCountries) refs.add(c) }
const info = refInfo([...refs])
console.log('people:', people.size, 'with label:', [...people.values()].filter(p => p.label).length, 'refs:', info.size)
