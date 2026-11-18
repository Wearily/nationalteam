// Validates public/data/world.json against the RawData contract (referential integrity + basic field sanity).
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { ROOT, readJson } from './lib.ts'
const w = readJson<any>(join(ROOT, 'public', 'data', 'world.json'))
const errs: string[] = []; const err = (s: string) => { if (errs.length < 200) errs.push(s) }
const POS = new Set(['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'])
const CONF = new Set(['AFC', 'UEFA', 'CAF', 'CONMEBOL', 'CONCACAF', 'OFC'])
const ROLE = new Set(['coach', 'assistant', 'gk', 'fitness', 'scout', 'physio'])
const isDate = (s: any) => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(Date.parse(s))
if (w.version !== 1) err('version'); if (!isDate(w.asOf)) err('asOf')
const nat = new Set<string>(); for (const n of w.nations) { if (nat.has(n.code)) err('dup nation ' + n.code); nat.add(n.code); if (!CONF.has(n.confed)) err('confed ' + n.code); if (typeof n.fifaPoints !== 'number' || typeof n.fifaRank !== 'number') err('rank ' + n.code); if (!n.name) err('nation name ' + n.code) }
const lg = new Set<string>(); for (const l of w.leagues) { if (lg.has(l.id)) err('dup league ' + l.id); lg.add(l.id); if (!nat.has(l.country)) err('league country ' + l.id); if (!(l.strength >= 0 && l.strength <= 100)) err('league strength ' + l.id); if (!(l.startMonth >= 1 && l.startMonth <= 12)) err('startMonth ' + l.id); if (!(l.tier >= 1)) err('tier ' + l.id) }
const cl = new Set<string>(); for (const c of w.clubs) { if (cl.has(c.id)) err('dup club ' + c.id); cl.add(c.id); if (!lg.has(c.league)) err(`club ${c.id} league ${c.league}`); if (!nat.has(c.country)) err(`club ${c.id} country ${c.country}`); if (!c.name) err('club name ' + c.id); if (c.rep !== undefined && !(c.rep >= 0 && c.rep <= 100)) err('rep ' + c.id); if (c.colors && !(c.colors.length === 2 && c.colors.every((x: string) => /^#[0-9A-F]{6}$/i.test(x)))) err('colors ' + c.id) }
const pid = new Set<string>(); const nd = new Set<string>()
for (const p of w.players) {
  if (pid.has(p.id)) err('dup player ' + p.id); pid.add(p.id)
  if (!/^(Q\d+|x:[a-z0-9-]+)$/.test(p.id)) err('player id ' + p.id)
  if (!p.name) err('name ' + p.id); if (!isDate(p.dob)) err(`dob ${p.id} ${p.dob}`)
  const y = Number(String(p.dob).slice(0, 4)); if (y < 1980 || y > 2012) err(`dob range ${p.id} ${p.name} ${p.dob}`)
  if (!Array.isArray(p.nat) || !p.nat.length || !p.nat.every((c: string) => nat.has(c))) err(`nat ${p.id} ${p.nat}`)
  if (new Set(p.nat).size !== p.nat.length) err('dup nat ' + p.id)
  if (!Array.isArray(p.pos) || !p.pos.length || !p.pos.every((x: string) => POS.has(x))) err(`pos ${p.id} ${p.pos}`)
  if (p.club !== null && !cl.has(p.club)) err(`club ${p.id} ${p.club}`)
  if (p.born !== undefined && !nat.has(p.born)) err('born ' + p.id)
  if (p.heightCm !== undefined && !(p.heightCm >= 150 && p.heightCm <= 215)) err('height ' + p.id)
  if (p.caps !== undefined && !(Number.isInteger(p.caps) && p.caps >= 0)) err('caps ' + p.id)
  if (p.photo && !existsSync(join(ROOT, 'public', p.photo))) err('photo file ' + p.id)
  const k = p.name.toLowerCase() + '|' + p.dob; if (nd.has(k)) err(`dup name+dob ${p.name} ${p.dob}`); nd.add(k)
}
const sid = new Set<string>(); for (const s of w.staff) { if (sid.has(s.id)) err('dup staff ' + s.id); sid.add(s.id); if (!isDate(s.dob)) err('staff dob ' + s.id); if (!nat.has(s.nat)) err('staff nat ' + s.id); if (!ROLE.has(s.role)) err('staff role ' + s.id); if (s.job !== null && !(/^nation:[A-Z]{3}:\w+$/.test(s.job) || (s.job.startsWith('club:') && cl.has(s.job.slice(5))))) err(`staff job ${s.id} ${s.job}`) }
console.log(`players ${w.players.length}, clubs ${w.clubs.length}, leagues ${w.leagues.length}, nations ${w.nations.length}, staff ${w.staff.length}`)
if (errs.length) { console.log(`INVALID: ${errs.length}${errs.length >= 200 ? '+' : ''} problems`); console.log(errs.slice(0, 60).join('\n')); process.exit(1) }
console.log('world.json OK')
