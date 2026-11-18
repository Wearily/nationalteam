import { fmtDay, toDay, ymd, type Day } from './core/date'
import { Rng, clamp } from './core/rng'
import { A, fitToOverall, overallAt } from './ratings/attributes'
import { mergeExtra, type RawData, type RawExtra } from './data/raw'
import { campLift, developAll, matchLift, revalue, reviewPotential, seasonRollover } from './career/develop'
import { seasonYearFor, simClubFixture, startLeagueSeason } from './clubs/season'
import { transferWeek } from './clubs/transfers'
import { progress } from './comps/engine'
import type { Comp, GroupStage, KoStage } from './comps/types'
import { addFriendly, ASIAN_CUP_2027, cancelClashingFriendlies, openSlots, planYear, rebuildCamps, scheduleYear, setupAsianCup, setupWorldCup } from './intl/calendar'
import { applyRanking, rerank } from './intl/ranking'
import { aiTactic, buildMTeam, eligible, pickSquad, selectionScore, teamName } from './intl/select'
import { MatchSim } from './match/engine'
import type { Tactic } from './match/tactics'
import type { Frame, MatchReport, MatchSnapshot, MEvent, ShotRec } from './match/types'
import { buildWorld } from './world/build'
import { buildIndex, type Camp, type Index, type Message, type NewsItem, type ScoutScope, type World } from './world/state'
import { LEVEL_NAME, LEVELS, natRef, parseRef, type Fixture, type Level, type Player, type Pos } from './world/types'

export interface AdvanceResult {
  stop: 'squad' | 'match' | 'days' | 'news'
  level?: Level
  campId?: number
  fixtureId?: number
  days: number
}
export interface LiveChunk { frames: Frame[]; events: MEvent[]; shots: ShotRec[]; snap: MatchSnapshot; frameBase: number }

export class Game {
  w: World
  idx: Index
  rng: Rng
  live: { sim: MatchSim; fixture: Fixture; side: 0 | 1; sentFrames: number; sentEvents: number; sentShots: number } | null = null

  constructor(w: World) {
    this.w = w
    this.rng = new Rng(w.rng)
    this.idx = buildIndex(w)
  }

  static create(raw: RawData, seed: number, name: string, overrides: Record<string, [number, number] | string> = {}, extra?: RawExtra | null, positions: Record<string, Pos[] | string> = {}): Game {
    const g = new Game(buildWorld(mergeExtra(raw, extra), seed, name, overrides, positions))
    g.init()
    return g
  }

  private init() {
    const w = this.w
    // club seasons already under way: create them and play everything before today
    for (const lg of w.leagues) startLeagueSeason(w, lg, seasonYearFor(w.day, lg.startMonth))
    this.idx = buildIndex(w)
    const past = w.fixtures.filter((f) => f.day < w.day).sort((a, b) => a.day - b.day)
    const none = new Set<number>()
    for (const f of past) simClubFixture(w, this.idx, f, this.rng, none)
    for (const p of w.players) { p.injury = p.injury && p.injury.until > w.day ? p.injury : null; p.cond = 92 }
    for (const c of w.comps) progress(w, c, this.rng)
    this.formNews()
    const ac = setupAsianCup(w, this.rng, 2027, toDay(2027, 12, 23), 'KSA', ASIAN_CUP_2027)
    planYear(w, this.rng, 2027, w.day)
    rerank(w)
    w.rankHist.push([w.day, w.nations.IRN.rank])
    this.idx = buildIndex(w)
    this.msg('board', `Welcome, ${w.managerName}`, `You have been elected head of the federation. The senior side is ranked ${w.nations.IRN.rank}${ordSuffix(w.nations.IRN.rank)} in the world and the ${ac.name} begins on ${fmtDay((ac.stages[0] as { days: Day[] }).days[0])}.\n\nBefore then come the 2027 international windows: the dates are open, and arranging the senior team's friendlies is up to you (Home → Calendar). The board expects a place in the semi-finals. You manage the senior team directly; the youth sides are run by their coaches unless you take control from the Teams screen.`, true)
    this.save()
  }
  /**
   * Bring an existing career's players up to date with corrected positions (FotMob data and hand-set
   * overrides). When a player's main position changes his attributes are refitted so his overall holds.
   */
  applyPositionFixes(extra: RawExtra | null | undefined, positions: Record<string, Pos[] | string>): number {
    let n = 0
    for (const p of this.w.players) {
      if (!p.real || p.retired) continue
      const hand = positions[p.name]
      const next = Array.isArray(hand) ? hand : p.rid ? extra?.patches[p.rid]?.pos : undefined
      if (!next?.length || next.join() === p.pos.join()) continue
      if (next[0] !== p.pos[0] && (next[0] === 'GK') !== (p.pos[0] === 'GK')) continue
      if (next[0] !== p.pos[0]) { const keep = p.ovr; p.attrs = fitToOverall([...p.attrs], next[0], keep); p.ovr = overallAt(p.attrs, next[0]) }
      p.pos = [...next]
      n++
    }
    return n
  }
  save() { this.w.rng = this.rng.s }

  msg(cat: Message['cat'], title: string, body: string, important = false, link?: string) {
    this.w.inbox.push({ id: this.w.nextId.msg++, day: this.w.day, cat, title, body, read: false, important, link })
    if (this.w.inbox.length > 400) this.w.inbox.splice(0, this.w.inbox.length - 400)
  }

  news(kind: NewsItem['kind'], text: string, playerId?: number, link?: string) {
    const n = (this.w.news ??= [])
    n.push({ day: this.w.day, kind, text, playerId, link: link ?? (playerId != null ? `player:${playerId}` : undefined) })
    if (n.length > 160) n.splice(0, n.length - 160)
  }
  /** Weekly round-up of Iranian players on hot or cold streaks at their clubs. */
  private formNews() {
    const w = this.w
    const out: [number, Player, string][] = []
    for (const p of w.players) {
      if (p.retired || p.nat[0] !== 'IRN' || p.clubId == null || p.known < 55 || !p.recent || p.recent.length < 2) continue
      if (p.lastNews != null && w.day - p.lastNews < 28) continue
      const club = w.clubs[p.clubId]
      const abroad = club.country !== 'IRN'
      if (!abroad && p.ovr < 66 && p.caps === 0) continue
      const last = (n: number) => p.recent!.slice(-n).reduce((a, x) => [a[0] + x[0], a[1] + x[1]], [0, 0])
      const [g2, a2] = last(2)
      const [g4, a4] = last(Math.min(4, p.recent.length))
      const f3 = p.form.slice(-3)
      const where = `for ${club.name}`
      let text = ''
      let weight = 0
      if (g2 + a2 >= 4) { text = `${p.name} has ${g2 + a2} goal contributions in his last two matches ${where} (${g2} goals, ${a2} assists).`; weight = 10 + g2 + a2 }
      else if (g2 >= 3) { text = `${p.name} has scored ${g2} goals in his last two matches ${where}.`; weight = 9 + g2 }
      else if (p.recent.length >= 4 && g4 + a4 >= 5) { text = `${p.name} is in form ${where}: ${g4} goals and ${a4} assists in his last four matches.`; weight = 7 + g4 + a4 }
      else if (f3.length === 3 && f3.every((r) => r >= 7.7)) { text = `${p.name} has been outstanding ${where}, rated ${f3.map((r) => r.toFixed(1)).join(', ')} in his last three matches.`; weight = 6 }
      else if (p.caps >= 10 && f3.length === 3 && f3.every((r) => r <= 6.1)) { text = `${p.name} is struggling ${where}: three poor ratings in a row (${f3.map((r) => r.toFixed(1)).join(', ')}).`; weight = 5 }
      else if (p.caps >= 10 && p.sharp < 42) { text = `${p.name} has fallen out of the team at ${club.name} and is short of match fitness.`; weight = 4 }
      if (text) out.push([weight + (abroad ? 3 : 0) + p.ovr / 20, p, text])
    }
    out.sort((x, y) => y[0] - x[0])
    for (const [, p, text] of out.slice(0, 5)) { p.lastNews = w.day; this.news('form', text, p.id) }
    // serious injuries to known Iran players picked up in club matches this week
    for (const p of w.players) {
      if (p.retired || p.nat[0] !== 'IRN' || !p.injury || (p.caps < 5 && p.ovr < 70) || p.known < 55) continue
      const len = p.injury.until - w.day
      if (len >= 21 && (p.lastNews == null || w.day - p.lastNews > 6) && !(w.news ?? []).some((n) => n.kind === 'injury' && n.playerId === p.id && w.day - n.day < len + 30)) this.news('injury', `${p.name} is out for about ${Math.round(len / 7)} weeks with a ${p.injury.name.toLowerCase()}.`, p.id)
    }
  }

  // ───────────────────────── squads ─────────────────────────
  private calledUp(): Set<number> {
    const s = new Set<number>()
    for (const t of Object.values(this.w.teams)) for (const id of t.squad) s.add(id)
    return s
  }
  activeCamp(level: Level): Camp | undefined {
    return this.w.camps.find((c) => c.level === level && !c.done && c.from <= this.w.day)
  }
  suggestSquad(level: Level, size: number): number[] {
    const coach = this.w.teams[level].coachId != null ? this.w.staff[this.w.teams[level].coachId!] : null
    const taken = new Set<number>()
    // a player can only be in one Iran squad at a time; senior has priority
    for (const t of Object.values(this.w.teams)) if (t.level !== level) for (const id of t.squad) taken.add(id)
    return pickSquad(this.w, this.idx, this.rng, 'IRN', level, size, this.w.day, coach?.abroadBias ?? 0, taken)
  }
  /** The previous squad for this team, minus anyone who can no longer be picked (retired, too old for the age group, long-term injured). */
  lastSquadFor(level: Level): { ids: number[]; dropped: string[] } {
    const w = this.w
    const team = w.teams[level]
    let prev = team.lastSquad ?? []
    if (!prev.length) {
      // careers from before squads were remembered: use the players from the team's most recent match
      const ref = natRef('IRN', level)
      const f = [...w.fixtures].reverse().find((x) => x.played && x.report != null && (x.home === ref || x.away === ref))
      const rep = f ? w.reports.find((r) => r.id === f.report) : null
      if (rep && f) prev = rep.players[f.home === ref ? 0 : 1].map((st) => st.id)
    }
    const camp = this.activeCamp(level)
    const ok = new Set(eligible(w, this.idx, 'IRN', level, w.day).map((p) => p.id))
    const taken = new Set<number>()
    for (const t of Object.values(w.teams)) if (t.level !== level) for (const id of t.squad) taken.add(id)
    const ids: number[] = []
    const dropped: string[] = []
    for (const id of prev) {
      const p = w.players[id]
      if (!p) continue
      const why = !ok.has(id) ? (p.intlRetired ? 'retired from internationals' : p.retired ? 'retired' : 'no longer eligible') : p.injury && p.injury.until > (camp?.first ?? w.day) + 10 ? 'injured' : this.squadOf(id, level) && LEVELS.indexOf(this.squadOf(id, level)!) < LEVELS.indexOf(level) ? `with the ${LEVEL_NAME[this.squadOf(id, level)!]} squad` : null
      if (why) dropped.push(`${p.name} (${why})`)
      else ids.push(id)
    }
    return { ids: ids.slice(0, camp?.size ?? 26), dropped }
  }
  /** The other Iran squad a player is currently called up to, if any. */
  squadOf(id: number, not?: Level): Level | null {
    for (const l of LEVELS) if (l !== not && this.w.teams[l]?.squad.includes(id)) return l
    return null
  }
  /** A player is only ever in one Iran squad: the older age group keeps him. */
  dedupeSquads() {
    const seen = new Set<number>()
    for (const l of LEVELS) {
      const t = this.w.teams[l]
      if (!t) continue
      t.squad = t.squad.filter((id) => !seen.has(id))
      for (const id of t.squad) seen.add(id)
    }
  }
  validateSquad(level: Level, ids: number[], camp: Camp): string | null {
    if (ids.length > camp.size) return `Too many players: ${ids.length} selected, the limit is ${camp.size}.`
    if (ids.length < 18) return 'Select at least 18 players.'
    const el = new Set(eligible(this.w, this.idx, 'IRN', level, this.w.day).map((p) => p.id))
    for (const id of ids) {
      const p = this.w.players[id]
      if (!el.has(id)) return `${p.name} is not eligible for the ${LEVEL_NAME[level]} team.`
      if (p.injury && p.injury.until > camp.first + 10) return `${p.name} is injured until ${fmtDay(p.injury.until)}.`
      const other = this.squadOf(id, level)
      if (other && LEVELS.indexOf(other) < LEVELS.indexOf(level)) return `${p.name} is with the ${LEVEL_NAME[other]} squad, which has first call on him.`
    }
    if (ids.filter((id) => this.w.players[id].pos[0] === 'GK').length < 2) return 'Select at least two goalkeepers.'
    return null
  }
  announceSquad(level: Level, ids: number[], byCoach: boolean): string | null {
    const w = this.w
    const camp = this.activeCamp(level)
    if (!camp) return 'There is no camp to select for right now.'
    const err = this.validateSquad(level, ids, camp)
    if (err) return err
    const team = w.teams[level]
    team.squad = [...ids]
    team.lastSquad = [...ids]
    camp.announced = true
    // the older age group has first call: anyone promoted leaves the younger squad he was in
    const mine = new Set(ids)
    for (const l of LEVELS) {
      const t = w.teams[l]
      if (!t || l === level || LEVELS.indexOf(l) < LEVELS.indexOf(level)) continue
      const gone = t.squad.filter((id) => mine.has(id))
      if (!gone.length) continue
      t.squad = t.squad.filter((id) => !mine.has(id))
      if (t.control === 'manual') this.msg('squad', `${gone.length} player${gone.length === 1 ? '' : 's'} moved up from the ${LEVEL_NAME[l]} squad`, `${gone.map((id) => w.players[id].name).join(', ')} ${gone.length === 1 ? 'has' : 'have'} been called up by the ${LEVEL_NAME[level]} team and ${gone.length === 1 ? 'leaves' : 'leave'} the ${LEVEL_NAME[l]} squad. You can name replacements from the Call-up tab.`, false, `team:${l}`)
    }
    // time in camp with the coaches tells you a lot about a player
    for (const id of ids) { const pl = w.players[id]; pl.known = Math.min(100, Math.max(pl.known + 20, 65)) }
    const set = new Set(ids)
    // reactions: debutants delighted, established players left out unhappy
    const pool = eligible(w, this.idx, 'IRN', level, w.day).filter((p) => !p.injury)
    const cut = [...ids].map((id) => selectionScore(w, w.players[id])).sort((a, b) => a - b)[Math.floor(ids.length * 0.35)] ?? 0
    const campComp = w.comps[camp.compId]
    const stakes = !campComp || campComp.friendly ? 0 : campComp.stages[0].neutral ? 2 : 1
    const snubbed: Player[] = []
    for (const p of pool) {
      if (set.has(p.id)) {
        if (level === 'senior' && p.caps === 0) p.morale = clamp(p.morale + 12, 0, 100)
        continue
      }
      // how much an omission stings depends on what he is missing: a tournament hurts, a qualifier matters,
      // a friendly window is a shrug for all but the most established
      if (level === 'senior' && p.caps >= (stakes === 0 ? 30 : 15) && selectionScore(w, p) > cut) { p.morale = clamp(p.morale - [4, 8, 14][stakes], 0, 100); snubbed.push(p) }
    }
    if (level === 'senior') {
      // call-up pattern shifts the Europe pathway culture
      let wsum = 0
      for (const id of ids) {
        const p = w.players[id]
        if (p.clubId == null) continue
        const lg = w.leagues[w.clubs[p.clubId].leagueId]
        if (lg.country !== 'IRN') wsum += clamp((lg.strength - 48) / 32, 0.1, 1) * (w.nations[lg.country]?.confed === 'UEFA' ? 1 : 0.55)
      }
      const target = clamp((wsum / ids.length) * 190, 0, 100)
      w.fed.pathway = Math.round((w.fed.pathway + (target - w.fed.pathway) * 0.07) * 10) / 10
    }
    const debut = ids.map((id) => w.players[id]).filter((p) => p.caps === 0)
    const who = byCoach && team.coachId != null ? w.staff[team.coachId].name : 'You'
    let body = `${who} named ${ids.length} players for the ${camp.label.toLowerCase()}.`
    if (level === 'senior' && debut.length) body += `\n\nUncapped: ${debut.slice(0, 6).map((p) => p.name).join(', ')}.`
    if (snubbed.length) body += `\n\nLeft out and unhappy about it: ${snubbed.slice(0, 4).map((p) => p.name).join(', ')}.`
    this.msg('squad', `${LEVEL_NAME[level]} squad announced`, body, false, `team:${level}`)
    return null
  }

  // ───────────────────────── scouting, staff, dual nationals ─────────────────────────
  private scopeMatch(p: Player, scope: ScoutScope, day: Day): boolean {
    const w = this.w
    const club = p.clubId != null ? w.clubs[p.clubId] : null
    const lg = club ? w.leagues[club.leagueId] : null
    const iranian = p.nat[0] === 'IRN'
    const age = (day - p.dob) / 365.25
    switch (scope) {
      case 'iran-top': return iranian && !!lg && lg.country === 'IRN' && lg.tier === 1 && age >= 19
      case 'iran-lower': return iranian && !!lg && lg.country === 'IRN' && lg.tier > 1 && age >= 19
      case 'iran-youth': return iranian && !!lg && lg.country === 'IRN' && age < 19
      case 'gulf': return iranian && !!lg && lg.country !== 'IRN' && w.nations[lg.country]?.confed !== 'UEFA'
      case 'europe': return iranian && !!lg && w.nations[lg.country]?.confed === 'UEFA'
      case 'diaspora': return !iranian && p.nat.includes('IRN') && !p.capTied
    }
  }
  private scoutWeek() {
    const w = this.w
    for (const job of w.scouts) {
      const s = w.staff[job.staffId]
      if (!s) continue
      const targets = w.players.filter((p) => !p.retired && p.known < 100 && this.scopeMatch(p, job.scope, w.day))
      if (!targets.length) continue
      const n = 2 + Math.round(s.judging / 4)
      const found: Player[] = []
      for (let i = 0; i < n; i++) {
        const p = this.rng.weighted(targets, (x) => 1 + Math.max(0, x.pot - 60) * 0.25)
        const before = p.known
        p.known = Math.min(100, p.known + 12 + s.judging * 1.6 + this.rng.range(0, 10))
        if (before < 25 && p.known >= 25) found.push(p)
      }
      const stars = found.filter((p) => p.pot >= 74 || job.scope === 'diaspora')
      if (stars.length)
        this.msg('scout', `Scout report: ${stars[0].name}`, `${s.name} recommends ${stars.map((p) => `${p.name} (${Math.floor((w.day - p.dob) / 365.25)}, ${p.pos[0]}${p.clubId != null ? ', ' + w.clubs[p.clubId].name : ''})`).join('; ')}.${job.scope === 'diaspora' ? ' Eligible for Iran but not yet committed.' : ''}`, false, `player:${stars[0].id}`)
    }
  }
  assignScout(staffId: number, scope: ScoutScope | null): string | null {
    const w = this.w
    const s = w.staff[staffId]
    if (!s || s.role !== 'scout') return 'Not a scout.'
    w.scouts = w.scouts.filter((j) => j.staffId !== staffId)
    if (scope) {
      if (!s.job) { if (w.scouts.length >= 8) return 'The scouting department is full (8 scouts).'; s.job = 'fed:scout' }
      w.scouts.push({ staffId, scope })
    } else s.job = null
    return null
  }
  hireCoach(level: Level, staffId: number): string | null {
    const w = this.w
    const s = w.staff[staffId]
    if (!s || s.role !== 'coach') return 'Not a coach.'
    if (s.job && !s.job.startsWith('nation:IRN')) return `${s.name} is under contract elsewhere.`
    const fee = Math.round(s.wage * 0.5)
    if (w.fed.budget < fee) return 'The federation cannot afford the signing-on costs.'
    // prestige check: top coaches will not take junior teams
    const need = level === 'senior' ? 0 : level === 'u23' ? 78 : 66
    if (need && s.rep > need) return `${s.name} is not interested in the ${LEVEL_NAME[level]} job.`
    const team = w.teams[level]
    if (team.coachId != null) w.staff[team.coachId].job = null
    for (const t of Object.values(w.teams)) if (t.coachId === staffId) t.coachId = null
    team.coachId = staffId
    s.job = `nation:IRN:${level}`
    s.since = w.day
    s.contractEnd = toDay(ymd(w.day).y + 2, 7, 31)
    w.fed.budget -= fee
    w.fed.ledger.push({ day: w.day, label: `Appointment of ${s.name}`, amount: -fee })
    team.tactic = { ...team.tactic, formation: s.formation, mentality: s.mentality, lineup: new Array(11).fill(-1) }
    this.msg('staff', `${s.name} appointed ${LEVEL_NAME[level]} head coach`, `${s.name} takes charge of the ${LEVEL_NAME[level]} team on a contract to ${fmtDay(s.contractEnd)}.`)
    w.fed.media = clamp(w.fed.media + (s.rep - 55) * 0.15, 0, 100)
    return null
  }
  approach(playerId: number, promise: 'none' | 'squad' | 'starter'): string {
    const w = this.w
    const p = w.players[playerId]
    if (!p || p.iranStatus === 'committed' || !p.nat.includes('IRN')) return 'This player cannot be approached.'
    const last = w.approaches[playerId]
    if (last && w.day - last < 120) return `${p.name} asked for time. Try again after ${fmtDay(last + 120)}.`
    w.approaches[playerId] = w.day
    // track record: how many foreign-born players have been capped, and Iran's standing
    const used = w.players.filter((x) => x.born && x.born !== 'IRN' && x.nat[0] === 'IRN' && x.caps > 0).length
    let will = (p.willingness ?? 40) + (promise === 'starter' ? 16 : promise === 'squad' ? 8 : 0) + Math.min(12, used * 3) + (60 - w.nations.IRN.rank) * 0.2 + (w.fed.pathway - 40) * 0.12
    if (promise === 'starter' && p.ovr < w.nations.IRN.level - 6) will -= 10 // an empty promise is seen through
    const roll = this.rng.range(0, 100)
    if (roll < will) {
      p.iranStatus = 'committed'
      p.nat = ['IRN', ...p.nat.filter((n) => n !== 'IRN')]
      p.known = Math.max(p.known, 70)
      this.idx = buildIndex(w)
      this.msg('news', `${p.name} commits to Iran`, `${p.name} has chosen to represent Iran and is available for selection.`, true, `player:${p.id}`)
      return `${p.name} has agreed to represent Iran.`
    }
    p.willingness = clamp((p.willingness ?? 40) + (roll - will < 20 ? 6 : -4), 0, 95)
    p.iranStatus = roll - will < 20 ? 'interested' : 'reluctant'
    return roll - will < 20 ? `${p.name} is flattered and wants to think it over. A camp invitation later may persuade him.` : `${p.name} says his focus is elsewhere for now.`
  }
  friendlyCost(opp: string): number {
    const n = this.w.nations[opp]
    return n ? Math.max(0, Math.round(((n.level - 62) * 45_000) / 10_000) * 10_000) : 0
  }
  private friendlyCheck(level: Level, day: Day, opp: string, skip?: Fixture): string | null {
    const w = this.w
    const n = w.nations[opp]
    if (!n || opp === 'IRN') return 'Choose another nation.'
    if (w.fixtures.some((x) => x !== skip && !x.played && Math.abs(x.day - day) <= 2 && (x.home === natRef(opp, level) || x.away === natRef(opp, level)))) return `${n.name} already have a match on that date.`
    const cost = level === 'senior' ? this.friendlyCost(opp) : Math.round(this.friendlyCost(opp) * 0.15)
    if (w.fed.budget < cost) return `The federation cannot afford the ${n.name} match fee.`
    // big nations are choosy about opponents ranked well below them
    const gap = n.level - w.nations.IRN.level
    if (gap > 5 && this.rng.chance(Math.min(0.85, (gap - 5) * 0.09))) return `${n.name} declined: they have other plans for that date.`
    if (cost) { w.fed.budget -= cost; w.fed.ledger.push({ day: w.day, label: `Friendly against ${n.name}`, amount: -cost }) }
    return null
  }
  /** Book a friendly on an open international-window date. */
  bookFriendly(level: Level, day: Day, opp: string, home: boolean): string {
    const w = this.w
    if (!openSlots(w, level).some((s) => s.day === day)) return 'That date is no longer available.'
    const err = this.friendlyCheck(level, day, opp)
    if (err) return err
    addFriendly(w, level, day, opp, home)
    rebuildCamps(w)
    this.idx = buildIndex(w)
    return `Friendly ${home ? 'at home to' : 'away to'} ${w.nations[opp].name} booked for ${fmtDay(day)}.`
  }
  /** Swap the opponent of an upcoming friendly. */
  arrangeFriendly(fixtureId: number, opp: string): string {
    const w = this.w
    const f = w.fixtures.find((x) => x.id === fixtureId)
    if (!f || f.played || !w.comps[f.compId].friendly) return 'That fixture cannot be changed.'
    if (f.day - w.day < 10) return 'Too late: opponents need at least ten days\' notice.'
    const iranHome = f.home.startsWith('n:IRN:')
    const level = (iranHome ? f.home : f.away).split(':')[2] as Level
    const err = this.friendlyCheck(level, f.day, opp, f)
    if (err) return err
    if (iranHome) f.away = natRef(opp, level); else f.home = natRef(opp, level)
    this.idx = buildIndex(w)
    return `Friendly against ${w.nations[opp].name} confirmed.`
  }
  cancelFriendly(fixtureId: number): string {
    const w = this.w
    const f = w.fixtures.find((x) => x.id === fixtureId)
    if (!f || f.played || !w.comps[f.compId].friendly) return 'That fixture cannot be cancelled.'
    if (f.day - w.day < 10) return 'Too late to cancel: the match is less than ten days away.'
    const level = (f.home.startsWith('n:IRN:') ? f.home : f.away).split(':')[2] as Level
    w.fixtures = w.fixtures.filter((x) => x !== f)
    // drop camps that no longer have a match, then rebuild
    w.camps = w.camps.filter((c) => c.done || c.announced || c.level !== level)
    rebuildCamps(w)
    this.idx = buildIndex(w)
    return 'Friendly cancelled.'
  }
  /** Ask a player who has retired from international football to come back. */
  askReturn(playerId: number): string {
    const w = this.w
    const p = w.players[playerId]
    if (!p || !p.intlRetired || p.retired) return 'He has not retired from international football.'
    const last = w.approaches[playerId]
    if (last && w.day - last < 180) return `${p.name} gave his answer recently. Ask again after ${fmtDay(last + 180)}.`
    w.approaches[playerId] = w.day
    const age = (w.day - p.dob) / 365.25
    // a major tournament on the horizon, a strong bond with the shirt and still being good enough all help
    const tournament = w.comps.some((c) => c.scope === 'nat' && c.level === 'senior' && !c.friendly && !c.done && c.weight >= 35)
    const stillGood = p.ovr >= w.nations.IRN.level - 5
    const will = 8 + (p.traits.attachment - 10) * 3 + (tournament ? 15 : 0) + (stillGood ? 12 : -10) - Math.max(0, age - 34) * 9 + (w.fed.fans - 50) * 0.15
    if (this.rng.range(0, 100) < will) {
      p.intlRetired = false
      p.morale = clamp(p.morale + 10, 0, 100)
      this.msg('news', `${p.name} reverses his international retirement`, `${p.name} (${p.caps} caps) has agreed to make himself available for Iran again.`, true, `player:${p.id}`)
      this.news('intl', `${p.name} has come out of international retirement and is available for selection.`, p.id)
      return `${p.name} has agreed to return.`
    }
    return `${p.name} thanks you for asking, but says his international career is over.`
  }
  setControl(level: Level, control: 'manual' | 'auto') { this.w.teams[level].control = control }
  setTactic(level: Level, tac: Tactic) { this.w.teams[level].tactic = tac }
  setBudget(key: 'scoutBudget' | 'youthInvest', v: number) { this.w.fed[key] = clamp(Math.round(v), 0, 5_000_000) }
  markAllRead() { for (const m of this.w.inbox) m.read = true }
  markRead(id: number) { const m = this.w.inbox.find((x) => x.id === id); if (m) m.read = true }

  // ───────────────────────── matches ─────────────────────────
  private squadFor(ref: string, comp: Comp, day: Day): number[] {
    const w = this.w
    const r = parseRef(ref)
    if (r.kind !== 'nat') return []
    if (r.code === 'IRN') return w.teams[r.level].squad
    const key = `${comp.id}|${ref}`
    let s = w.natSquads[key]
    if (!s || s.some((id) => w.players[id].retired)) s = w.natSquads[key] = pickSquad(w, this.idx, this.rng, r.code, r.level, comp.squadSize || 23, day)
    return s
  }
  private isKo(f: Fixture, comp: Comp): boolean {
    const st = comp.stages[f.stage]
    return st?.type === 'ko' && ((st as KoStage).legs === 1 || f.round === 1)
  }
  private makeSim(f: Fixture, record: boolean, userSide: 0 | 1 | -1): MatchSim {
    const w = this.w
    const comp = w.comps[f.compId]
    const teams = ([f.home, f.away] as const).map((ref, i) => {
      const r = parseRef(ref) as { kind: 'nat'; code: string; level: Level }
      const opp = parseRef(i === 0 ? f.away : f.home) as { code: string }
      const squad = this.squadFor(ref, comp, f.day)
      if (r.code === 'IRN') {
        const team = w.teams[r.level]
        if (squad.length < 16) team.squad = this.suggestSquad(r.level, comp.squadSize || 23)
        const user = userSide === i
        const tac = user ? team.tactic : { ...team.tactic, ...this.coachApproach(r.level, opp.code) }
        return buildMTeam(w, ref, team.squad, tac, !user, !user)
      }
      return buildMTeam(w, ref, squad, aiTactic(w, r.code, opp.code), true, true)
    })
    const imp = comp.friendly ? 0.2 : comp.stages[f.stage].type === 'ko' ? 1 : 0.7
    // is another match close behind this one? (a later round of the same tournament, or a fixture within six days)
    const lastStage = f.stage === comp.stages.length - 1
    const soon = (ref: string) => w.fixtures.some((x) => x !== f && !x.played && (x.home === ref || x.away === ref) && x.day > f.day && x.day <= f.day + 6)
    const rest: [boolean, boolean] = [f.home, f.away].map((ref) => soon(ref) || (!comp.friendly && comp.stages[f.stage].type === 'ko' && !lastStage && f.slot !== 99)) as [boolean, boolean]
    return new MatchSim(teams[0], teams[1], { seed: this.rng.int(1, 2 ** 31), neutral: !!f.neutral, knockout: this.isKo(f, comp), subs: comp.subs, importance: imp, rest, record })
  }
  private coachApproach(level: Level, opp: string): Partial<Tactic> {
    const t = this.w.teams[level]
    const c = t.coachId != null ? this.w.staff[t.coachId] : null
    const diff = this.w.nations.IRN.level - (this.w.nations[opp]?.level ?? 60)
    return { mentality: clamp((c?.mentality ?? 50) + diff * 1.2, 28, 75) }
  }

  private finishNat(f: Fixture, sim: MatchSim) {
    const w = this.w
    const comp = w.comps[f.compId]
    f.played = true
    f.hg = sim.score[0]; f.ag = sim.score[1]
    f.pens = sim.pens
    f.et = sim.period > 2
    f.scorers = sim.events.filter((e) => e.type === 'goal' || e.type === 'pen').map((e) => [e.p!, e.min, e.team, undefined])
    const ko = comp.stages[f.stage].type === 'ko'
    const level = (parseRef(f.home) as { level: Level }).level
    const competitive = !comp.friendly
    const grew: Player[] = []
    for (const t of [0, 1] as const) {
      sim.ps[t].forEach((st, i) => {
        if (!st.played) return
        const p = w.players[st.id]
        const s = p.intl
        s.apps++; s.mins += Math.round(st.mins); s.goals += st.goals; s.assists += st.assists; s.ratingSum += st.rating
        s.yellows += st.yellow; s.reds += st.red
        if (!st.subOn) s.starts++
        if (level === 'senior') { p.caps++; p.goals += st.goals; if (competitive) p.capTied = true } else p.youthCaps[level] = (p.youthCaps[level] ?? 0) + 1
        p.cond = clamp(sim.energy[t][i] - 10 - (st.mins / 90) * 8, 30, 100)
        p.sharp = Math.min(100, p.sharp + (st.mins / 90) * 8)
        // minutes against better opposition bring a young player on a little
        const oppCode = parseRefCode(t === 0 ? f.away : f.home)
        const oppLevel = (w.nations[oppCode]?.level ?? 60) - (level === 'senior' ? 0 : ({ u23: 8, u21: 11, u20: 13, u19: 16, u17: 21, u16: 24, u15: 27 } as Record<string, number>)[level] ?? 0)
        if (matchLift(this.rng, p, f.day, oppLevel, st.mins, st.rating, competitive) && p.nat[0] === 'IRN') grew.push(p)
        // tournament football is a shop window: standout displays put a player on foreign clubs' radar
        if (competitive && st.mins >= 45) {
          const stage = comp.weight >= 50 ? 1.6 : comp.weight >= 35 ? 1.2 : comp.weight >= 25 ? 0.5 : level === 'senior' ? 0.3 : 0.45
          const gain = Math.min(1.6, (Math.max(0, st.rating - 7.0) * 1.0 + st.goals * 0.35 + st.assists * 0.2) * stage * (ko ? 1.25 : 1))
          if (gain > 0.15) {
            const before = p.spotlight ?? 0
            p.spotlight = Math.min(10, before + gain)
            if (before < 3 && p.spotlight >= 3 && p.nat[0] === 'IRN' && p.clubId != null) this.news('transfer', `${p.name} is attracting attention from clubs abroad after his performances at the ${comp.name}.`, p.id)
          }
        }
        // an international counts toward recent form like any other match (cameos of under 20 minutes do not)
        if (st.mins >= 20) { p.form.push(st.rating); if (p.form.length > 8) p.form.shift() }
        if (p.nat[0] === 'IRN') { p.morale = clamp(p.morale + (st.rating - 6.6) * 4, 0, 100); p.known = Math.min(100, p.known + 10 + (st.mins / 90) * 20) }
      })
    }
    if (grew.length && (level === 'senior' || w.teams[level]?.control === 'manual')) {
      const opp = teamName(w, f.home.startsWith('n:IRN:') ? f.away : f.home).name
      this.news('form', `${grew.map((x) => x.name).join(', ')} ${grew.length === 1 ? 'looks' : 'look'} to have grown from the experience of facing ${opp}.`, grew[0].id)
    }
    for (const [t, id] of sim.injured) {
      const p = w.players[id]
      const sev = this.rng.next()
      const days = sev < 0.5 ? this.rng.int(4, 12) : sev < 0.85 ? this.rng.int(14, 40) : this.rng.int(50, 200)
      p.injury = { name: days > 100 ? 'Knee ligament injury' : days > 30 ? 'Hamstring tear' : days > 12 ? 'Muscle strain' : 'Knock', until: f.day + days }
      if (p.nat[0] === 'IRN') this.msg('injury', `${p.name} injured`, `${p.name} suffered a ${p.injury.name.toLowerCase()} against ${teamName(w, t === 0 ? f.away : f.home).name} and is out until about ${fmtDay(p.injury.until)}.`, false, `player:${p.id}`)
    }
    if (level === 'senior') applyRanking(w, f, comp.weight + (ko && comp.weight >= 35 && comp.stages.length - f.stage <= 3 ? (comp.weight >= 50 ? 10 : 5) : 0), ko)
    const iranSide = f.home.startsWith('n:IRN:') ? 0 : f.away.startsWith('n:IRN:') ? 1 : -1
    if (iranSide >= 0) {
      const names: Record<number, string> = {}
      for (const t of [0, 1] as const) for (const p of sim.teams[t].players) names[p.id] = p.name
      let motm = -1
      let best = 0
      for (const t of [0, 1] as const) for (const st of sim.ps[t]) if (st.played && st.rating > best) { best = st.rating; motm = st.id }
      const rep: MatchReport = {
        id: w.nextId.report++, fixtureId: f.id,
        home: { ref: f.home, name: sim.teams[0].name, short: sim.teams[0].short, colors: sim.teams[0].colors, formation: sim.startFormation[0] },
        away: { ref: f.away, name: sim.teams[1].name, short: sim.teams[1].short, colors: sim.teams[1].colors, formation: sim.startFormation[1] },
        score: [f.hg, f.ag], pens: f.pens, et: !!f.et, stats: sim.snapshot().stats, players: sim.ps, names, events: sim.events, shots: sim.shots, momentum: sim.momentum,
        lineups: sim.startXI, motm,
      }
      w.reports.push(rep)
      if (w.reports.length > 80) w.reports.shift()
      f.report = rep.id
      if (motm >= 0 && w.players[motm]) w.players[motm].intl.motm++
      const me = iranSide as 0 | 1
      const o = (1 - me) as 0 | 1
      const pensWon = sim.pens ? sim.pens[me] > sim.pens[o] : null
      const res = sim.score[me] > sim.score[o] || pensWon === true ? 'W' : sim.score[me] < sim.score[o] || pensWon === false ? 'L' : 'D'
      const big = competitive ? (ko ? 3 : 2) : 0.6
      const exp = 1 / (1 + Math.pow(10, -((w.nations.IRN.points - (w.nations[parseRefCode(iranSide === 0 ? f.away : f.home)]?.points ?? 1400)) / 600)))
      const delta = ((res === 'W' ? 1 : res === 'D' ? 0.5 : 0) - exp) * 6 * big * (level === 'senior' ? 1 : 0.25)
      w.fed.fans = clamp(w.fed.fans + delta * 1.2, 0, 100)
      w.fed.board = clamp(w.fed.board + delta, 0, 100)
      w.fed.media = clamp(w.fed.media + delta * 1.1, 0, 100)
      const scorers = sim.events.filter((e) => (e.type === 'goal' || e.type === 'pen') && e.team === me).map((e) => `${names[e.p!]?.split(' ').slice(-1)[0]} ${e.min}'`)
      this.news('intl', `${sim.teams[0].name} ${f.hg}–${f.ag} ${sim.teams[1].name}${f.pens ? ` (${f.pens[0]}–${f.pens[1]} on penalties)` : ''} · ${comp.short}${scorers.length ? ' · ' + scorers.join(', ') : ''}`, undefined, `fixture:${f.id}`)
      this.msg('match', `${LEVEL_NAME[level]}: ${sim.teams[0].name} ${f.hg}–${f.ag} ${sim.teams[1].name}${f.pens ? ` (${f.pens[0]}–${f.pens[1]} pens)` : ''}`, `${comp.name}${comp.friendly ? '' : ' · ' + comp.stages[f.stage].name}.${scorers.length ? ' Scorers: ' + scorers.join(', ') + '.' : ''}${motm >= 0 ? ` Player of the match: ${names[motm]} (${best.toFixed(1)}).` : ''}`, level === 'senior', `fixture:${f.id}`)
    }
    this.afterFixture(f)
  }

  private afterFixture(f: Fixture) {
    const w = this.w
    const comp = w.comps[f.compId]
    if (comp.friendly) return
    const before = comp.cur
    if (progress(w, comp, this.rng)) {
      this.idx = buildIndex(w)
      if (comp.scope === 'nat') {
        this.resolveClashes()
        rebuildCamps(w)
        const iran = natRef('IRN', comp.level)
        if (comp.done) this.closeComp(comp)
        else if (comp.cur !== before) {
          const st = comp.stages[comp.cur] as KoStage
          const inIt = st.type === 'ko' ? st.teams.includes(iran) : (st as unknown as GroupStage).groups.some((g) => g.includes(iran))
          if (comp.placings?.[iran] === 'Qualified' && !w.history.some((h) => h.comp === comp.name)) { this.msg('news', 'Iran qualify for the World Cup', 'Qualification is secured with matches to spare.', true, `comp:${comp.id}`); w.history.push({ year: comp.season, comp: comp.name, level: comp.level, result: 'Qualified' }); w.fed.board = clamp(w.fed.board + 12, 0, 100); w.fed.fans = clamp(w.fed.fans + 10, 0, 100) }
          const was = [...w.fixtures].some((x) => x.compId === comp.id && x.stage === before && (x.home === iran || x.away === iran))
          if (was && !inIt && comp.placings?.[iran] !== 'Qualified') this.eliminated(comp, comp.stages[before].name)
          else if (inIt) {
            const fx = w.fixtures.find((x) => x.compId === comp.id && x.stage === comp.cur && (x.home === iran || x.away === iran) && x.slot !== 99)
            if (fx) this.msg('match', `${comp.short}: ${st.name}`, `Iran will face ${teamName(w, fx.home === iran ? fx.away : fx.home).name} in the ${st.name.toLowerCase()} on ${fmtDay(fx.day)}.`, true, `comp:${comp.id}`)
          }
        }
      } else if (comp.done) this.leagueDone(comp)
    }
  }
  private eliminated(comp: Comp, stage: string) {
    const w = this.w
    const team = w.teams[comp.level]
    this.msg('match', `Iran out of the ${comp.name}`, `The ${LEVEL_NAME[comp.level]} team's tournament ends at the ${stage.toLowerCase()}.`, true, `comp:${comp.id}`)
    w.history.push({ year: comp.season, comp: comp.name, level: comp.level, result: stage })
    // beaten semi-finalists still have the third-place play-off: the squad stays until that is played
    const ref = natRef('IRN', comp.level)
    if (w.fixtures.some((f) => f.compId === comp.id && !f.played && (f.home === ref || f.away === ref))) return
    team.squad = []
    for (const c of w.camps) if (c.level === comp.level && c.compId === comp.id) c.done = true
  }
  private closeComp(comp: Comp) {
    const w = this.w
    const iran = natRef('IRN', comp.level)
    const place = comp.placings?.[iran]
    if (place && !w.history.some((h) => h.comp === comp.name && h.level === comp.level)) w.history.push({ year: comp.season, comp: comp.name, level: comp.level, result: place })
    if (comp.winner) {
      const win = teamName(w, comp.winner).name
      this.msg('news', `${win} win the ${comp.name}`, comp.winner === iran ? `Iran are champions! The federation's standing has never been higher.` : `${win} lifted the trophy.${place ? ` Iran's campaign ended: ${place}.` : ''}`, true, `comp:${comp.id}`)
      if (comp.winner === iran) { w.fed.board = clamp(w.fed.board + 25, 0, 100); w.fed.fans = clamp(w.fed.fans + 25, 0, 100); w.fed.budget += 5_000_000; w.fed.ledger.push({ day: w.day, label: `${comp.name} prize money`, amount: 5_000_000 }) }
    }
    for (const k of Object.keys(w.natSquads)) if (k.startsWith(`${comp.id}|`)) delete w.natSquads[k]
    rerank(w)
  }
  private leagueDone(comp: Comp) {
    const w = this.w
    if (comp.key.startsWith('lg:irn') && comp.winner) this.msg('news', `${teamName(w, comp.winner).name} are ${comp.name} champions`, `The ${comp.season}/${String((comp.season + 1) % 100).padStart(2, '0')} season is complete.`, false, `comp:${comp.id}`)
  }

  /** Simulate a fixture that needs no user involvement. */
  private autoPlay(f: Fixture, away: Set<number>) {
    const comp = this.w.comps[f.compId]
    if (comp.scope === 'club') {
      simClubFixture(this.w, this.idx, f, this.rng, away)
      if (f.scorers?.length) {
        const n = new Map<number, number>()
        for (const [pid] of f.scorers) n.set(pid, (n.get(pid) ?? 0) + 1)
        for (const [pid, g] of n) {
          const p = this.w.players[pid]
          if (g < 2 || !p || p.nat[0] !== 'IRN' || p.known < 55) continue
          const club = this.w.clubs[p.clubId ?? -1]
          if (!club || (club.country === 'IRN' && g < 3 && p.caps === 0)) continue
          const home = f.home === `c:${club.id}`
          const opp = teamName(this.w, home ? f.away : f.home).name
          const [us, them] = home ? [f.hg, f.ag] : [f.ag, f.hg]
          this.news('result', `${p.name} scored ${g === 2 ? 'twice' : g === 3 ? 'a hat-trick' : `${g} goals`} as ${club.name} ${us > them ? 'beat' : us === them ? 'drew with' : 'lost to'} ${opp} ${us}–${them}.`, p.id)
        }
      }
      this.afterFixture(f)
      return
    }
    this.finishNat(f, this.makeSim(f, false, -1).run())
  }

  // live (user-managed or watched) match
  liveStart(fixtureId: number): LiveChunk | string {
    const f = this.w.fixtures.find((x) => x.id === fixtureId)
    if (!f || f.played) return 'That match is not available.'
    const side = f.home.startsWith('n:IRN:') ? 0 : 1
    const level = (parseRef(side === 0 ? f.home : f.away) as { level: Level }).level
    const team = this.w.teams[level]
    if (team.squad.length < 11) return 'Name a squad first.'
    const manual = team.control === 'manual'
    const sim = this.makeSim(f, true, manual ? (side as 0 | 1) : -1)
    this.live = { sim, fixture: f, side: side as 0 | 1, sentFrames: 0, sentEvents: 0, sentShots: 0 }
    return this.liveStep(1)
  }
  liveStep(n: number): LiveChunk {
    const L = this.live!
    for (let i = 0; i < n && !L.sim.done; i++) L.sim.step()
    const chunk: LiveChunk = { frames: L.sim.frames.slice(L.sentFrames), events: L.sim.events.slice(L.sentEvents), shots: L.sim.shots.slice(L.sentShots), snap: L.sim.snapshot(), frameBase: L.sentFrames }
    L.sentFrames = L.sim.frames.length
    L.sentEvents = L.sim.events.length
    L.sentShots = L.sim.shots.length
    return chunk
  }
  /** Let the head coach run the match from the touchline (or take charge again). */
  liveCoach(on: boolean) { this.live!.sim.setAi(this.live!.side, on); return this.live!.sim.snapshot() }
  liveSub(outId: number, inId: number): string | null { return this.live!.sim.substitute(this.live!.side, outId, inId) }
  liveTactic(tac: Tactic) { this.live!.sim.setTactic(this.live!.side, tac) }
  liveFinish(): number {
    const L = this.live!
    L.sim.run()
    this.finishNat(L.fixture, L.sim)
    this.live = null
    this.save()
    return L.fixture.report ?? -1
  }

  // ───────────────────────── calendar ─────────────────────────
  /** Things that need the user before today can be processed. */
  blocker(): AdvanceResult | null {
    const w = this.w
    for (const c of w.camps) {
      if (c.done || c.announced || c.from > w.day) continue
      if (w.teams[c.level].control === 'manual') return { stop: 'squad', level: c.level, campId: c.id, days: 0 }
    }
    for (const f of this.idx.byDay.get(w.day) ?? []) {
      if (f.played) continue
      for (const ref of [f.home, f.away]) {
        if (!ref.startsWith('n:IRN:')) continue
        const level = ref.split(':')[2] as Level
        if (w.teams[level].control === 'manual') return { stop: 'match', level, fixtureId: f.id, days: 0 }
      }
    }
    return null
  }

  private processToday() {
    const w = this.w
    // coach-run teams name their squads
    for (const c of w.camps) {
      if (c.done || c.announced || c.from > w.day) continue
      const ids = this.suggestSquad(c.level, c.size)
      w.teams[c.level].squad = []
      if (this.announceSquad(c.level, ids, true)) w.teams[c.level].squad = ids
      c.announced = true
    }
    const away = this.calledUp()
    const todays = (this.idx.byDay.get(w.day) ?? []).filter((f) => !f.played)
    for (const f of todays) this.autoPlay(f, away)
    this.idx.byDay.delete(w.day)
    // release squads when a camp has ended
    for (const c of w.camps) {
      if (c.done || !c.announced || c.to > w.day) continue
      const ref = natRef('IRN', c.level)
      if (w.fixtures.some((f) => !f.played && (f.home === ref || f.away === ref) && f.day <= c.to + 1)) continue
      // a tournament squad is registered for the whole competition: it stays together between rounds
      // (knockout fixtures do not exist until the previous round finishes) until Iran are out or it ends
      if (this.inTournament(c)) continue
      c.done = true
      this.campEffects(c)
      if (!w.camps.some((x) => x !== c && !x.done && x.level === c.level && x.announced)) w.teams[c.level].squad = []
    }
  }

  /** Call off friendlies that now clash with competitive fixtures, and tell the user. */
  resolveClashes() {
    const w = this.w
    const off = cancelClashingFriendlies(w)
    if (!off.length) return
    // camps built around a cancelled friendly are rebuilt from what is left
    w.camps = w.camps.filter((c) => c.done || c.announced)
    rebuildCamps(w)
    this.idx = buildIndex(w)
    const mine = off.filter((o) => w.teams[o.level].control === 'manual')
    if (mine.length) this.msg('match', `${mine.length} friendl${mine.length === 1 ? 'y' : 'ies'} called off`, `${mine.map((o) => `${LEVEL_NAME[o.level]} v ${w.nations[o.opp]?.name ?? o.opp} on ${fmtDay(o.day)} (clashes with a ${o.versus})`).join('; ')}. A team cannot play two matches in the same slot, and competitive fixtures take priority.`, true)
  }

  /** True while Iran are still alive in the centrally-hosted tournament this camp was called for. */
  private inTournament(c: Camp): boolean {
    const comp = this.w.comps[c.compId]
    if (!comp || comp.friendly || comp.done) return false
    const st0 = comp.stages[0]
    if (!st0.neutral) return false // home-and-away qualifying is played window by window, not as one camp
    const ref = natRef('IRN', c.level)
    // still a match to come (a third-place play-off counts) or not yet knocked out
    if (this.w.fixtures.some((f) => f.compId === comp.id && !f.played && (f.home === ref || f.away === ref))) return true
    return !comp.placings?.[ref]
  }
  /**
   * Repair for careers saved before tournament squads were kept between rounds: if a squad is being asked
   * for again in a tournament Iran have already played in, restore the registered squad instead (everyone
   * who appeared, topped up with the coach's choices).
   */
  restoreTournamentSquads() {
    const w = this.w
    this.dedupeSquads()
    rebuildCamps(w) // also separates a finals squad from one named for a warm-up friendly
    for (const c of w.camps) {
      if (c.done || c.announced) continue
      const comp = w.comps[c.compId]
      if (!comp || comp.friendly || comp.done || !comp.stages[0].neutral) continue
      const ref = natRef('IRN', c.level)
      const ids = new Set<number>()
      for (const f of w.fixtures) {
        if (f.compId !== comp.id || !f.played || (f.home !== ref && f.away !== ref) || f.report == null) continue
        const rep = w.reports.find((r) => r.id === f.report)
        const side = rep ? rep.players[f.home === ref ? 0 : 1] : []
        for (const st of side) if (w.players[st.id] && !w.players[st.id].retired) ids.add(st.id)
      }
      if (ids.size < 11) continue
      const team = w.teams[c.level]
      for (const id of this.suggestSquad(c.level, c.size)) { if (ids.size >= c.size) break; ids.add(id) }
      team.squad = [...ids]
      c.announced = true
      this.msg('squad', `${LEVEL_NAME[c.level]} squad stays together`, `The ${comp.name} squad remains registered for the rest of the tournament. No new selection is needed between rounds.`, false, `team:${c.level}`)
    }
  }

  /** End of a camp: young players may have learned something; anyone who never got on loses a little sharpness. */
  private campEffects(c: Camp) {
    const w = this.w
    const team = w.teams[c.level]
    const squad = team.squad.map((id) => w.players[id]).filter(Boolean)
    if (squad.length < 11) return
    const top = [...squad].sort((a, b) => b.ovr - a.ovr).slice(0, 14)
    const avg = top.reduce((a, p) => a + p.ovr, 0) / top.length
    const coach = team.coachId != null ? w.staff[team.coachId] : null
    const ref = natRef('IRN', c.level)
    const played = new Set<number>()
    for (const f of w.fixtures) {
      if (!f.played || f.day < c.from || f.day > c.to || (f.home !== ref && f.away !== ref) || f.report == null) continue
      const rep = w.reports.find((r) => r.id === f.report)
      if (rep) for (const side of rep.players) for (const st of side) if (st.played && st.mins >= 10) played.add(st.id)
    }
    const days = Math.max(3, c.to - c.from)
    const improved: Player[] = []
    for (const p of squad) {
      if (campLift(this.rng, p, w.day, avg, coach?.youth ?? 10, days)) improved.push(p)
      // a camp without a minute on the pitch costs match sharpness: he has missed club football for it
      if (!played.has(p.id)) p.sharp = Math.max(25, p.sharp - Math.min(8, 2 + days * 0.5))
    }
    if (improved.length && (c.level === 'senior' || team.control === 'manual'))
      this.msg('squad', `${LEVEL_NAME[c.level]} camp report`, `${improved.map((p) => `${p.name} (${Math.floor((w.day - p.dob) / 365.25)})`).join(', ')} ${improved.length === 1 ? 'has' : 'have'} come on noticeably from training with the group${coach ? ` under ${coach.name}` : ''}.`, false, `player:${improved[0].id}`)
  }

  private newDay() {
    const w = this.w
    w.day++
    const { y, m, d, dow } = ymd(w.day)
    for (const p of w.players) {
      if (p.retired) continue
      // daily recovery: fitter players bounce back faster, older legs take longer
      if (p.cond < 100) p.cond = Math.min(100, p.cond + 4.6 + p.attrs[A.stamina] / 36 - Math.max(0, (w.day - p.dob) / 365.25 - 30) * 0.3)
      if (p.injury && p.injury.until <= w.day) p.injury = null
    }
    for (const t of Object.values(w.teams)) {
      if (t.control !== 'manual') continue
      const open = openSlots(w, t.level).filter((sl) => sl.day - w.day === 45 || sl.day - w.day === 20)
      if (open.length) {
        const all = openSlots(w, t.level).filter((sl) => sl.window === open[0].window && Math.abs(sl.day - open[0].day) < 20)
        this.msg('match', `${LEVEL_NAME[t.level]}: ${all.length} open date${all.length === 1 ? '' : 's'} in the ${open[0].window} window`, `No match is booked for ${all.map((sl) => fmtDay(sl.day, false)).join(', ')}. Arrange friendlies from Home → Calendar, or leave the dates free and the players stay with their clubs. Opponents need at least ten days' notice.`, t.level === 'senior' && open[0].day - w.day === 45)
      }
    }
    if (dow === 1) {
      this.formNews()
      this.scoutWeek()
      const moves = transferWeek(w, this.rng, w.day)
      if (moves.length) {
        this.idx = buildIndex(w)
        const notable = moves.filter((mv) => mv.player.ovr >= 66 || mv.to.country !== 'IRN').sort((a, b) => b.fee - a.fee)
        for (const mv of notable.slice(0, 10)) this.news('transfer', `${mv.player.name} joins ${mv.to.name} from ${mv.from?.name ?? 'free agency'}${mv.fee ? ` for €${(mv.fee / 1e6).toFixed(2)}M` : ' on a free transfer'}.`, mv.player.id)
        for (const mv of notable.slice(0, 6)) {
          const abroad = mv.to.country !== 'IRN'
          this.msg('transfer', `${mv.player.name} joins ${mv.to.name}`, `${mv.player.name} (${mv.player.pos[0]}, ${Math.floor((w.day - mv.player.dob) / 365.25)}) moves from ${mv.from?.name ?? 'free agency'} to ${mv.to.name} (${w.leagues[mv.to.leagueId].name})${mv.fee ? ` for €${(mv.fee / 1e6).toFixed(2)}M` : ' on a free transfer'}.${abroad && mv.from?.country === 'IRN' ? ' Another player makes the step abroad.' : ''}`, false, `player:${mv.player.id}`)
        }
      }
    }
    if (d === 1) {
      // moods settle: morale drifts back toward an even keel over the months
      for (const pl of w.players) if (!pl.retired && pl.morale !== 65) pl.morale = Math.round((pl.morale + (65 - pl.morale) * 0.15) * 10) / 10
      // clubs' interest is spent in transfer windows, not by waiting for one: it fades quickly after a month in
      // which the window was open (January, July, August) and only slowly in the months between
      const fade = m === 2 || m === 8 || m === 9 ? 0.72 : 0.95
      for (const pl of w.players) if (pl.spotlight) pl.spotlight = pl.spotlight < 0.3 ? 0 : pl.spotlight * fade
      developAll(w, this.rng, w.day)
      for (const { player: pl, by } of reviewPotential(w, this.rng, w.day)) {
        if (pl.nat[0] !== 'IRN' || pl.known < 60) continue
        const club = pl.clubId != null ? w.clubs[pl.clubId].name : 'his club'
        this.news('form', `${pl.name}'s run of form at ${club} has the scouts revising his ceiling upward (+${by} potential, now ${pl.pot}).`, pl.id)
        if (pl.pot >= 78) this.msg('scout', `${pl.name} is developing faster than expected`, `After a sustained run of performances for ${club}, our assessment of ${pl.name} (${Math.floor((w.day - pl.dob) / 365.25)}, ${pl.pos[0]}) has gone up. His potential is now rated ${pl.pot}.`, false, `player:${pl.id}`)
      }
      const eur = (v: number) => (v >= 1e6 ? `€${(v / 1e6).toFixed(1)}m` : `€${Math.round(v / 1000)}k`)
      for (const { p, from } of revalue(w, w.day).sort((a, b) => b.p.value - a.p.value).slice(0, 3))
        this.news('form', `${p.name}'s market value is up from ${eur(from)} to ${eur(p.value)}${(p.spotlight ?? 0) >= 2 ? ' after his displays for Iran' : ''}.`, p.id)
      rerank(w)
      w.rankHist.push([w.day, w.nations.IRN.rank])
      this.finance()
      scheduleYear(w, this.rng, y, w.day)
      rebuildCamps(w)
      for (const lg of w.leagues) {
        if (lg.virtual || lg.startMonth !== m) continue
        const key = `lg:${lg.rid}:${y}`
        if (!w.comps.some((c) => c.key === key)) startLeagueSeason(w, lg, y)
      }
      this.idx = buildIndex(w)
      if (m === 7) {
        w.season = y
        for (const n of seasonRollover(w, this.rng, w.day)) this.msg('news', n.split(' has ')[0].split(' (')[0], n)
        this.idx = buildIndex(w)
      }
      if (m === 12) { planYear(w, this.rng, y + 1, w.day); this.resolveClashes(); this.idx = buildIndex(w) }
      if (m === 4 && y >= 2030 && (y - 2030) % 4 === 0 && !w.comps.some((c) => c.key === `world-cup:${y}`)) {
        const hosts = y === 2030 ? ['ESP', 'POR', 'MAR'] : [Object.values(w.nations).sort((a, b) => b.points - a.points)[this.rng.int(0, 15)].code]
        const wc = setupWorldCup(w, this.rng, y, hosts)
        const in_ = (wc.stages[0] as GroupStage).groups.some((g) => g.includes(natRef('IRN')))
        this.msg('news', `World Cup ${y}: the draw`, in_ ? 'Iran have qualified and know their group. The squad deadline is in early June.' : 'Iran did not qualify. The tournament goes ahead without Team Melli.', true, `comp:${wc.id}`)
        if (!in_) { w.fed.board = clamp(w.fed.board - 18, 0, 100); w.fed.fans = clamp(w.fed.fans - 18, 0, 100) }
        rebuildCamps(w); this.idx = buildIndex(w)
      }
      // staff contracts
      for (const t of Object.values(w.teams)) {
        if (t.coachId == null) continue
        const s = w.staff[t.coachId]
        if (s.contractEnd - w.day < 31 && s.contractEnd > w.day) this.msg('staff', `${s.name}'s contract is ending`, `The ${LEVEL_NAME[t.level]} head coach's deal runs out on ${fmtDay(s.contractEnd)}. It will be renewed for two years unless you appoint someone else.`)
        if (s.contractEnd <= w.day) s.contractEnd = toDay(y + 2, 7, 31)
      }
      // prune old played club fixtures to keep saves small
      if (m === 8) {
        const keep = new Set(w.comps.filter((c) => c.scope === 'nat' || c.season >= y - 1).map((c) => c.id))
        w.fixtures = w.fixtures.filter((f) => keep.has(f.compId))
      }
    }
  }
  private finance() {
    const w = this.w
    const f = w.fed
    const income = Math.round(520_000 + f.fans * 6_000 + Math.max(0, 60 - w.nations.IRN.rank) * 12_000)
    let wages = 0
    for (const t of Object.values(w.teams)) if (t.coachId != null) wages += w.staff[t.coachId].wage / 12
    for (const j of w.scouts) wages += (w.staff[j.staffId]?.wage ?? 0) / 12
    const costs = Math.round(wages + f.scoutBudget / 12 + f.youthInvest / 12 + 640_000)
    f.income = income - costs
    f.budget += f.income
    f.ledger.push({ day: w.day, label: 'Monthly income', amount: income }, { day: w.day, label: 'Wages, scouting and youth programmes', amount: -costs })
    if (f.ledger.length > 120) f.ledger.splice(0, f.ledger.length - 120)
    if (f.budget < 0) { f.board = clamp(f.board - 3, 0, 100); if (ymd(w.day).m % 3 === 0) this.msg('board', 'The federation is in deficit', 'The board is unhappy that spending exceeds income. Reduce scouting or youth budgets, or deliver results that bring in prize money.', true) }
  }

  /** Advance until something needs the user, or `maxDays` have passed. */
  advance(maxDays: number): AdvanceResult {
    let days = 0
    for (;;) {
      const b = this.blocker()
      if (b) { this.save(); return { ...b, days } }
      const unread = this.w.inbox.length
      this.processToday()
      if (days >= maxDays) { this.save(); return { stop: 'days', days } }
      this.newDay()
      days++
      const b2 = this.blocker()
      if (b2) { this.save(); return { ...b2, days } }
      if (this.w.inbox.slice(unread).some((m) => m.important) && maxDays < 200) { this.save(); return { stop: 'news', days } }
    }
  }
}

const ordSuffix = (n: number) => ['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]
const parseRefCode = (ref: string) => ref.split(':')[1]
