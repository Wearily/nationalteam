import * as Comlink from 'comlink'
import overrides from '../../data/overrides/ratings.json'
import { Game } from '../sim/game'
import type { RawData } from '../sim/data/raw'
import type { World } from '../sim/world/state'

let game: Game | null = null
const CMDS = new Set(['announceSquad', 'assignScout', 'hireCoach', 'approach', 'setControl', 'setTactic', 'setBudget', 'markRead', 'suggestSquad'])

const api = {
  newGame(raw: RawData, seed: number, name: string): World {
    game = Game.create(raw, seed, name, overrides as unknown as Record<string, [number, number] | string>)
    return game.w
  },
  load(w: World) { game = new Game(w); return true },
  advance(days: number) {
    const r = game!.advance(days)
    return { r, w: game!.w }
  },
  cmd(name: string, args: unknown[], wantWorld = true) {
    if (!CMDS.has(name)) throw new Error(`Unknown command ${name}`)
    const res = (game as unknown as Record<string, (...a: unknown[]) => unknown>)[name](...args)
    game!.save()
    return { res, w: wantWorld ? game!.w : null }
  },
  liveStart(fixtureId: number) { return game!.liveStart(fixtureId) },
  liveStep(n: number) { return game!.liveStep(n) },
  liveSub(outId: number, inId: number) { return game!.liveSub(outId, inId) },
  liveTactic(tac: Parameters<Game['liveTactic']>[0]) { game!.liveTactic(tac); return true },
  liveFinish() { const report = game!.liveFinish(); return { report, w: game!.w } },
}
export type SimApi = typeof api
Comlink.expose(api)
