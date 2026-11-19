import { History, Sparkles, UserRound, Wand2 } from 'lucide-react'
import { useMemo } from 'react'
import { fmtDay } from '../../sim/core/date'
import { formAvg } from '../../sim/clubs/season'
import { posLine } from '../../sim/ratings/attributes'
import { ageEligible } from '../../sim/intl/select'
import { LEVEL_NAME, LEVELS, type Level, type Player } from '../../sim/world/types'
import { ageOf, clubOf, Empty, Flag, FormDots, isAbroad, Ovr, PlayerLink, PosTag, Rating } from '../bits'
import { useGame } from '../store'
import { ResultRow } from './Home'
import { PoolTable } from './Pool'
import { normaliseTactic, TacticsEditor } from './Tactics'

export function Teams({ level, tab }: { level: Level; tab?: string }) {
  const { w, go, cmd, notify } = useGame()
  const world = w!
  const team = world.teams[level]
  const coach = team.coachId != null ? world.staff[team.coachId] : null
  const camp = world.camps.find((c) => c.level === level && !c.done && c.from <= world.day)
  const nextCamp = world.camps.filter((c) => c.level === level && !c.done && c.from > world.day).sort((a, b) => a.from - b.from)[0]
  const cur = tab ?? (camp && !camp.announced && team.control === 'manual' ? 'callup' : 'squad')
  // the selection in progress lives in the store, so it survives looking at other screens
  const draft = useGame((s) => s.drafts[level])
  const setDraft = useGame((s) => s.setDraft)
  const pick = useMemo(() => new Set((draft && camp && !camp.announced ? draft : team.squad).filter((id) => world.players[id] && !world.players[id].retired)), [draft, team.squad, world, camp])
  const setPick = (next: Set<number> | ((s: Set<number>) => Set<number>)) => setDraft(level, [...(typeof next === 'function' ? next(pick) : next)])
  const squad = useMemo(() => team.squad.map((id) => world.players[id]), [world, team.squad])
  const ref = `n:IRN:${level}`
  const fixtures = useMemo(() => world.fixtures.filter((f) => f.home === ref || f.away === ref).sort((a, b) => a.day - b.day), [world, ref])
  const picked = [...pick].map((id) => world.players[id])
  const lines = ['GK', 'DEF', 'MID', 'ATT'] as const
  const overage = camp ? world.comps[camp.compId]?.overage ?? 0 : 0
  const overN = overage ? picked.filter((p) => !ageEligible(p, level, world.day)).length : 0
  const toggle = (p: Player) => setPick((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })
  const announce = async () => { const err = await cmd<string | null>('announceSquad', level, [...pick], false); notify(err ?? `${LEVEL_NAME[level]} squad announced.`); if (!err) { setDraft(level, null); go({ name: 'teams', level, tab: 'squad' }) } }
  const sameAgain = async () => {
    const { ids, dropped } = await cmd<{ ids: number[]; dropped: string[] }>('lastSquadFor', level)
    if (!ids.length) return notify('There is no previous squad for this team yet.')
    setPick(new Set(ids))
    notify(dropped.length ? `Last squad loaded: ${ids.length} players. Left out: ${dropped.slice(0, 4).join(', ')}${dropped.length > 4 ? ` and ${dropped.length - 4} more` : ''}.` : `Last squad loaded: ${ids.length} players. Edit it, then announce.`)
  }
  const suggest = async () => setPick(new Set(await cmd<number[]>('suggestSquad', level, camp?.size ?? 23)))
  const tactic = useMemo(() => normaliseTactic(team.tactic, squad), [team.tactic, squad])
  const abroadN = picked.filter((p) => isAbroad(world, p)).length
  return (
    <div className="page-inner">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="seg">{LEVELS.map((l) => <button key={l} className={l === level ? 'on' : ''} onClick={() => go({ name: 'teams', level: l })}>{LEVEL_NAME[l]}{world.teams[l].control === 'manual' ? ' •' : ''}</button>)}</div>
        <div className="seg right">{[['squad', 'Squad'], ['callup', 'Call-up'], ['tactics', 'Tactics'], ['fixtures', 'Fixtures']].map(([k, n]) => <button key={k} className={cur === k ? 'on' : ''} onClick={() => go({ name: 'teams', level, tab: k })}>{n}</button>)}</div>
      </div>
      <div className="card row" style={{ gap: 20 }}>
        <Flag code="IRN" lg />
        <div><h2>Iran {level === 'senior' ? '' : LEVEL_NAME[level]}</h2><span className="muted">{coach ? <>Head coach <b style={{ color: 'var(--text)' }}>{coach.name}</b> · prefers {coach.formation} · {coach.abroadBias > 0.25 ? 'favours players based abroad' : coach.abroadBias < -0.25 ? 'favours home-based players' : 'no strong selection bias'}</> : 'No head coach appointed'}</span></div>
        <div className="right col" style={{ alignItems: 'flex-end', gap: 6 }}>
          <div className="seg"><button className={team.control === 'manual' ? 'on' : ''} onClick={() => void cmd('setControl', level, 'manual')}><UserRound size={13} style={{ verticalAlign: -2 }} /> You manage</button><button className={team.control === 'auto' ? 'on' : ''} onClick={() => void cmd('setControl', level, 'auto')}><Sparkles size={13} style={{ verticalAlign: -2 }} /> Coach manages</button></div>
          <span className="faint" style={{ fontSize: 11.5 }}>{team.control === 'manual' ? 'You pick squads, tactics and manage matches.' : 'The coach picks squads and tactics; matches are simulated.'}</span>
        </div>
      </div>

      {cur === 'squad' && (
        squad.length ? (
          <div className="card flush">
            <div className="card-head"><h3>Current squad</h3><span className="faint">{squad.length} players · {squad.filter((p) => isAbroad(world, p)).length} based abroad</span></div>
            <table className="t"><thead><tr><th>Player</th><th>Pos</th><th className="c">Age</th><th className="c">Ovr</th><th className="c">Pot</th><th>Club</th><th className="c">Caps</th><th className="c">Goals</th><th className="c">Club form</th><th className="c">Intl rating</th><th className="c">Cond</th><th className="c">Morale</th></tr></thead><tbody>
              {[...squad].sort((a, b) => lines.indexOf(posLine(a.pos[0])) - lines.indexOf(posLine(b.pos[0])) || b.ovr - a.ovr).map((p) => (
                <tr key={p.id}><td><PlayerLink p={p} sub={p.injury ? <span style={{ color: '#fca5a5' }}>{p.injury.name} until {fmtDay(p.injury.until, false)}</span> : undefined} /></td><td><PosTag pos={p.pos[0]} /></td><td className="c num">{ageOf(world, p)}</td><td className="c"><Ovr p={p} /></td><td className="c"><Ovr p={p} pot /></td>
                  <td><span className="row" style={{ gap: 8 }}>{clubOf(world, p) ? <><Flag code={clubOf(world, p)!.country} />{clubOf(world, p)!.name}</> : <span className="faint">Free agent</span>}</span></td>
                  <td className="c num">{level === 'senior' ? p.caps : p.youthCaps[level] ?? 0}</td><td className="c num">{level === 'senior' ? p.goals : p.intl.goals}</td><td className="c"><FormDots form={p.form} /></td><td className="c"><Rating v={p.intl.apps ? p.intl.ratingSum / p.intl.apps : null} /></td><td className="c num">{Math.round(p.cond)}%</td><td className="c num">{Math.round(p.morale)}</td></tr>
              ))}
            </tbody></table>
          </div>
        ) : <div className="card"><Empty>No squad is together right now. {nextCamp ? `The next camp opens on ${fmtDay(nextCamp.from)} (${nextCamp.label}).` : camp ? 'A squad needs naming — open Call-up.' : 'No camps are scheduled.'}</Empty></div>
      )}

      {cur === 'callup' && (
        camp && !camp.announced ? (
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px', alignItems: 'start' }}>
            <PoolTable level={level} selected={pick} onToggle={toggle} height={720} overage={overage} />
            <div className="card col" style={{ position: 'sticky', top: 0 }}>
              <div><span className="eyebrow">{camp.label}</span><h2 style={{ marginTop: 4 }}>{pick.size} <span className="faint">/ {camp.size}</span></h2><span className="faint" style={{ fontSize: 12 }}>First match {fmtDay(camp.first)} · {abroadN} based abroad{overage ? <> · <b style={{ color: overN > overage ? '#fca5a5' : undefined }}>over-age {overN}/{overage}</b></> : null}</span></div>
              <div className="row"><button className="btn grow" onClick={() => void suggest()}><Wand2 />Coach's pick</button><button className="btn" onClick={() => setPick(new Set())}>Clear</button></div>
              <button className="btn" onClick={() => void sameAgain()} title="Start from the previous squad, then edit it"><History />Last squad</button>
              <div className="scroll col" style={{ maxHeight: 440, gap: 12 }}>
                {lines.map((l) => {
                  const ps = picked.filter((p) => posLine(p.pos[0]) === l).sort((a, b) => b.ovr - a.ovr)
                  return <div key={l}><div className="row eyebrow" style={{ marginBottom: 5 }}>{l}<span className="right">{ps.length}</span></div>
                    {ps.map((p) => <div key={p.id} className="row" style={{ padding: '3px 0', cursor: 'pointer' }} onClick={() => toggle(p)}><PosTag pos={p.pos[0]} /><span className="truncate grow">{p.name}</span><Ovr p={p} /></div>)}</div>
                })}
              </div>
              <button className="btn primary go" disabled={pick.size < 18 || pick.size > camp.size} onClick={() => void announce()}>Announce squad</button>
              <span className="faint" style={{ fontSize: 11.5 }}>Calling up players at strong foreign clubs raises the Europe pathway; established names left out will be unhappy.</span>
            </div>
          </div>
        ) : <div className="card"><Empty>{camp?.announced ? `The squad for the ${camp.label.toLowerCase()} has been announced and is with the team until ${fmtDay(camp.to)}.` : nextCamp ? `The next squad is due on ${fmtDay(nextCamp.from)} for the ${nextCamp.label.toLowerCase()} (first match ${fmtDay(nextCamp.first)}).` : 'No camps are scheduled.'}{team.control === 'auto' ? ' The coach names squads for this team.' : ''}</Empty></div>
      )}

      {cur === 'tactics' && (squad.length >= 11 ? <TacticsEditor tactic={tactic} squad={squad} onChange={(t) => void cmd('setTactic', level, t)} /> : <div className="card"><Empty>Tactics and line-ups are set once a squad is in camp.{team.control === 'auto' ? ' With the coach in charge he will choose them.' : ''}</Empty></div>)}

      {cur === 'fixtures' && <div className="card"><div className="card-head"><h3>Fixtures and results</h3></div>{fixtures.length ? fixtures.map((f) => <ResultRow key={f.id} f={f} mine={ref} />) : <Empty>Nothing scheduled.</Empty>}</div>}
    </div>
  )
}
export { formAvg }
