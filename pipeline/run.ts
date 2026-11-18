// Runs the whole pipeline in order. Cached network responses (pipeline/.cache) make reruns cheap; delete that folder to refetch.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
// 04b (player articles, ~1,250 pages) and 04c (fa.wikipedia squads) are slow on a cold cache but resumable.
// Image steps are NOT run here (logos/photos now come from data/overrides); run 05-photos.ts / 05b-logos.ts by hand, then 06-build again.
const steps = ['01-nations', '02-leagues', '03-wikidata', '04-squads', '04b-player-pages', '04c-fa-squads', '06-build', '07-validate']
for (const s of steps) {
  console.log(`\n=== ${s} ===`)
  const r = spawnSync('npx', ['tsx', join(here, s + '.ts')], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`step ${s} failed`); process.exit(r.status ?? 1) }
}
