import * as Comlink from 'comlink'
import positions from '../../data/overrides/positions.json'
import overrides from '../../data/overrides/ratings.json'
import { Game } from '../sim/game'
import type { RawData, RawExtra } from '../sim/data/raw'
import type { World } from '../sim/world/state'
import type { Pos } from '../sim/world/types'

let game: Game | null = null
const CMDS = new Set(['announceSquad', 'assignScout', 'hireCoach', 'approach', 'setControl', 'setOverage', 'setTactic', 'setBudget', 'markRead', 'markAllRead', 'lastSquadFor', 'askReturn', 'suggestSquad', 'arrangeFriendly', 'bookFriendly', 'cancelFriendly'])

const api = {
  newGame(raw: RawData, seed: number, name: string, extra?: RawExtra | null): World {
    game = Game.create(raw, seed, name, overrides as unknown as Record<string, [number, number] | string>, extra, positions as unknown as Record<string, Pos[] | string>)
    return game.w
  },
  load(w: World, extra?: RawExtra | null) {
    game = new Game(w)
    game.applyPositionFixes(extra, positions as unknown as Record<string, Pos[] | string>)
    game.resolveClashes()
    game.planAhead()
    game.restoreTournamentSquads()
    return game.w
  },
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
  liveResume(fixtureId: number) { return game!.liveResume(fixtureId) },
  liveStep(n: number) { return game!.liveStep(n) },
  liveCoach(on: boolean) { return game!.liveCoach(on) },
  liveSub(outId: number, inId: number) { return game!.liveSub(outId, inId) },
  liveTactic(tac: Parameters<Game['liveTactic']>[0]) { game!.liveTactic(tac); return true },
  liveFinish() { const report = game!.liveFinish(); return { report, w: game!.w } },
}
export type SimApi = typeof api
Comlink.expose(api)
