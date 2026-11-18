import { readFileSync, existsSync } from 'node:fs'
import { Game } from '../src/sim/game'
import { fmtDay } from '../src/sim/core/date'
import { synthRaw } from './synthRaw'
const days = +(process.argv[2] ?? 120)
const raw = existsSync('public/data/world.json') && process.argv[3] !== 'synth' ? JSON.parse(readFileSync('public/data/world.json', 'utf8')) : synthRaw()
let t0 = Date.now()
const g = Game.create(raw, 12345, 'Tester')
console.log(`created in ${Date.now() - t0}ms: players ${g.w.players.length}, clubs ${g.w.clubs.length}, fixtures ${g.w.fixtures.length}, comps ${g.w.comps.length}, Iran rank ${g.w.nations.IRN.rank}`)
for (const t of Object.values(g.w.teams)) t.control = 'auto'
t0 = Date.now()
let total = 0
let r = g.advance(days)
total += r.days
while (total < days) { r = g.advance(days - total); total += r.days; if (r.stop === 'days') break }
console.log(`advanced ${total} days in ${Date.now() - t0}ms → ${fmtDay(g.w.day)} stop=${r.stop}`)
const iran = g.w.fixtures.filter((f) => f.played && (f.home.startsWith('n:IRN:senior') || f.away.startsWith('n:IRN:senior')))
for (const f of iran) console.log(fmtDay(f.day), g.w.comps[f.compId].short, f.home, f.hg, '-', f.ag, f.away, f.pens ? `pens ${f.pens}` : '')
const ac = g.w.comps.find((c) => c.key.startsWith('afc-asian-cup'))!
console.log('Asian Cup done', ac.done, 'winner', ac.winner, 'placing IRN', ac.placings?.['n:IRN:senior'])
console.log('inbox', g.w.inbox.length, 'pathway', g.w.fed.pathway, 'budget', g.w.fed.budget, 'board', g.w.fed.board.toFixed(0), 'rank', g.w.nations.IRN.rank)
console.log(g.w.inbox.slice(-8).map((m) => `[${m.cat}] ${m.title}`).join('\n'))
console.log('save size MB', (JSON.stringify(g.w).length / 1e6).toFixed(2))
