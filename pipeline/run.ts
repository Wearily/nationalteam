// Runs the whole pipeline in order. Cached network responses (pipeline/.cache) make reruns cheap; delete that folder to refetch.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const steps = ['01-nations', '02-leagues', '03-wikidata', '04-squads', '06-build', '05-photos', '06-build', '07-validate']
for (const s of steps) {
  console.log(`\n=== ${s} ===`)
  const r = spawnSync('npx', ['tsx', join(here, s + '.ts')], { stdio: 'inherit' })
  if (r.status !== 0) { console.error(`step ${s} failed`); process.exit(r.status ?? 1) }
}
