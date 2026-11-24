import * as Comlink from 'comlink'
import { openDB } from 'idb'
import { create } from 'zustand'
import type { RawData, RawExtra } from '../sim/data/raw'
import type { AdvanceResult } from '../sim/game'
import type { World } from '../sim/world/state'
import type { SimApi } from '../worker/sim.worker'

const worker = new Worker(new URL('../worker/sim.worker.ts', import.meta.url), { type: 'module' })
export const sim = Comlink.wrap<SimApi>(worker)

const db = openDB('team-melli', 1, { upgrade(d) { d.createObjectStore('saves') } })
// Slots: 'main' is the career in progress; 'backup' is an older copy of it (taken when a career is opened and
// about once every in-game month); 'previous' is the career a new one replaced. Nothing is ever simply deleted.
export type Slot = 'main' | 'backup' | 'previous'
let lastBackupDay = -1e9
/** Ask the browser not to evict the save when it is short of space. */
export function keepStorage() { try { void navigator.storage?.persist?.() } catch { /* not supported */ } }
export async function saveWorld(w: World) {
  const d = await db
  if (w.day - lastBackupDay >= 28) {
    // the copy that was good until now becomes the backup before it is overwritten
    const cur = (await d.get('saves', 'main')) as World | undefined
    if (cur && cur.seed === w.seed) await d.put('saves', cur, 'backup')
    lastBackupDay = w.day
  }
  await d.put('saves', w, 'main')
}
export async function loadSaved(slot: Slot = 'main'): Promise<World | undefined> { return (await db).get('saves', slot) as Promise<World | undefined> }
export async function savedSlots(): Promise<{ slot: Slot; day: number; name: string }[]> {
  const d = await db
  const out: { slot: Slot; day: number; name: string }[] = []
  for (const slot of ['main', 'backup', 'previous'] as Slot[]) {
    try { const w = (await d.get('saves', slot)) as World | undefined; if (w) out.push({ slot, day: w.day, name: w.managerName }) } catch { /* unreadable slot: skip it */ }
  }
  return out
}
/** Starting afresh: the current career is kept as 'previous' rather than thrown away. */
export async function shelveSave() {
  const d = await db
  const cur = await d.get('saves', 'main')
  if (cur) await d.put('saves', cur, 'previous')
  await d.delete('saves', 'main')
  await d.delete('saves', 'backup')
}
/** Download the career as a file, the one copy the browser cannot lose. */
export function exportSave(w: World) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(w)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `team-melli-${new Date((w.day as number) * 86400000).toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
export async function importSave(file: File): Promise<World> {
  const w = JSON.parse(await file.text()) as World
  if (!w || !Array.isArray(w.players) || !Array.isArray(w.fixtures) || typeof w.day !== 'number' || !w.teams) throw new Error('That file is not a Team Melli save.')
  return w
}

export type Route =
  | { name: 'home' } | { name: 'inbox' } | { name: 'teams'; level?: string; tab?: string } | { name: 'pool' } | { name: 'scouting' }
  | { name: 'calendar' } | { name: 'comps'; id?: number } | { name: 'world'; league?: number } | { name: 'rankings' } | { name: 'staff' }
  | { name: 'federation' } | { name: 'match'; fixtureId: number } | { name: 'report'; id: number } | { name: 'transfers' }

interface State {
  w: World | null
  route: Route
  playerId: number | null
  busy: string | null
  toast: string | null
  /** Call-up selections in progress, per team level, kept while you look at other screens (and across reloads). */
  drafts: Record<string, number[]>
  setDraft: (level: string, ids: number[] | null) => void
  go: (r: Route) => void
  openPlayer: (id: number | null) => void
  setWorld: (w: World) => void
  /** The fixture being played on screen, if any: leaving the match screen must not lose it. */
  liveFixture: number | null
  setLive: (id: number | null) => void
  notify: (t: string | null) => void
  newGame: (name: string) => Promise<void>
  resume: (slot?: Slot, from?: World) => Promise<boolean>
  cont: (days?: number) => Promise<void>
  cmd: <T = unknown>(name: string, ...args: unknown[]) => Promise<T>
  link: (l?: string) => void
}

export const useGame = create<State>((set, get) => ({
  w: null,
  route: { name: 'home' },
  playerId: null,
  busy: null,
  toast: null,
  drafts: (() => { try { return JSON.parse(localStorage.getItem('tm-drafts') ?? '{}') as Record<string, number[]> } catch { return {} } })(),
  setDraft: (level, ids) => {
    const drafts = { ...get().drafts }
    if (ids) drafts[level] = ids
    else delete drafts[level]
    set({ drafts })
    try { localStorage.setItem('tm-drafts', JSON.stringify(drafts)) } catch { /* private mode: the draft still lives for this session */ }
  },
  liveFixture: null,
  setLive: (liveFixture) => set({ liveFixture }),
  go: (route) => set({ route, playerId: null }),
  openPlayer: (playerId) => set({ playerId }),
  setWorld: (w) => { set({ w }); saveWorld(w).catch((e) => get().notify(`Could not save: ${(e as Error).message}. Export the career from Federation to keep it safe.`)) },
  notify: (toast) => { set({ toast }); if (toast) setTimeout(() => get().toast === toast && set({ toast: null }), 4200) },
  newGame: async (name) => {
    set({ busy: 'Building the football world…' })
    keepStorage()
    const raw = (await (await fetch(`${import.meta.env.BASE_URL}data/world.json`)).json()) as RawData
    const extra = (await fetch(`${import.meta.env.BASE_URL}data/fotmob.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as RawExtra | null
    const w = await sim.newGame(raw, Math.floor(Math.random() * 2 ** 31), name, extra)
    get().setWorld(w)
    set({ busy: null, route: { name: 'home' }, drafts: {} })
    try { localStorage.removeItem('tm-drafts') } catch { /* ignore */ }
  },
  resume: async (slot = 'main', from) => {
    const w = from ?? (await loadSaved(slot))
    if (!w) return false
    keepStorage()
    // keep the save exactly as it was found until the updated game has opened it successfully
    if (slot === 'main' && !from) { try { await (await db).put('saves', w, 'backup') } catch { /* no room for a copy */ } }
    lastBackupDay = w.day
    const extra = (await fetch(`${import.meta.env.BASE_URL}data/fotmob.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as RawExtra | null
    const fixed = await sim.load(w, extra)
    set({ w: fixed })
    await saveWorld(fixed)
    return true
  },
  cont: async (days = 31) => {
    if (get().busy) return
    set({ busy: 'Advancing…' })
    const { r, w } = await sim.advance(days)
    get().setWorld(w)
    set({ busy: null })
    const res = r as AdvanceResult
    if (res.stop === 'squad') set({ route: { name: 'teams', level: res.level, tab: 'callup' } })
    else if (res.stop === 'match') set({ route: { name: 'match', fixtureId: res.fixtureId! } })
    else if (res.stop === 'news') set({ route: { name: 'inbox' } })
  },
  cmd: async (name, ...args) => {
    const { res, w } = await sim.cmd(name, args)
    if (w) get().setWorld(w)
    return res as never
  },
  link: (l) => {
    if (!l) return
    const [k, v] = l.split(':')
    if (k === 'player') set({ playerId: +v })
    else if (k === 'comp') set({ route: { name: 'comps', id: +v }, playerId: null })
    else if (k === 'team') set({ route: { name: 'teams', level: v }, playerId: null })
    else if (k === 'fixture') {
      const f = get().w?.fixtures.find((x) => x.id === +v)
      if (f?.report != null) set({ route: { name: 'report', id: f.report }, playerId: null })
    }
  },
}))
