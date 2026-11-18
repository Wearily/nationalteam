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
export async function saveWorld(w: World) { await (await db).put('saves', w, 'main') }
export async function loadSaved(): Promise<World | undefined> { try { return await (await db).get('saves', 'main') } catch { return undefined } }
export async function clearSave() { await (await db).delete('saves', 'main') }

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
  go: (r: Route) => void
  openPlayer: (id: number | null) => void
  setWorld: (w: World) => void
  notify: (t: string | null) => void
  newGame: (name: string) => Promise<void>
  resume: () => Promise<boolean>
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
  go: (route) => set({ route, playerId: null }),
  openPlayer: (playerId) => set({ playerId }),
  setWorld: (w) => { set({ w }); void saveWorld(w) },
  notify: (toast) => { set({ toast }); if (toast) setTimeout(() => get().toast === toast && set({ toast: null }), 4200) },
  newGame: async (name) => {
    set({ busy: 'Building the football world…' })
    const raw = (await (await fetch(`${import.meta.env.BASE_URL}data/world.json`)).json()) as RawData
    const extra = (await fetch(`${import.meta.env.BASE_URL}data/fotmob.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as RawExtra | null
    const w = await sim.newGame(raw, Math.floor(Math.random() * 2 ** 31), name, extra)
    get().setWorld(w)
    set({ busy: null, route: { name: 'home' } })
  },
  resume: async () => {
    const w = await loadSaved()
    if (!w) return false
    const extra = (await fetch(`${import.meta.env.BASE_URL}data/fotmob.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as RawExtra | null
    const fixed = await sim.load(w, extra)
    set({ w: fixed })
    void saveWorld(fixed)
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
