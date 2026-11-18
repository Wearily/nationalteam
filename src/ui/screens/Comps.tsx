import { useMemo, useState } from 'react'
import { fmtDay, fmtDow, monthName, ymd } from '../../sim/core/date'
import { groupTables, stageFixtures } from '../../sim/comps/engine'
import type { Comp, GroupStage, KoStage, Row } from '../../sim/comps/types'
import { teamName } from '../../sim/intl/select'
import { LEVEL_NAME, type Fixture, type TeamRef } from '../../sim/world/types'
import { Crest, Empty, Flag } from '../bits'
import { useGame } from '../store'

export function TeamCell({ team, bold }: { team: TeamRef; bold?: boolean }) {
  const w = useGame((s) => s.w)!
  const n = teamName(w, team)
  return <span className="row" style={{ gap: 8, fontWeight: bold ? 680 : 480 }}>{team.startsWith('n:') ? <Flag code={team.split(':')[1]} /> : <Crest colors={n.colors} logo={w.clubs[+team.split(':')[1]]?.logo} />}<span className="truncate">{n.name}</span></span>
}
export function Table({ rows, hl, adv = 0, next = 0 }: { rows: Row[]; hl?: (t: TeamRef) => boolean; adv?: number; next?: number }) {
  return (
    <table className="t"><thead><tr><th style={{ width: 34 }}>#</th><th>Team</th><th className="c">P</th><th className="c">W</th><th className="c">D</th><th className="c">L</th><th className="c">GF</th><th className="c">GA</th><th className="c">GD</th><th className="c">Pts</th></tr></thead><tbody>
      {rows.map((r, i) => <tr key={r.team} className={`${hl?.(r.team) ? 'hl' : ''} ${i < adv ? 'qual-1' : i < adv + next ? 'qual-2' : ''}`}><td className="faint num">{i + 1}</td><td><TeamCell team={r.team} bold={hl?.(r.team)} /></td><td className="c num">{r.p}</td><td className="c num">{r.w}</td><td className="c num">{r.d}</td><td className="c num">{r.l}</td><td className="c num">{r.gf}</td><td className="c num">{r.ga}</td><td className="c num">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td><td className="c num"><b>{r.pts}</b></td></tr>)}
    </tbody></table>
  )
}
const isIran = (t: TeamRef) => t.startsWith('n:IRN:')

function Bracket({ comp }: { comp: Comp }) {
  const w = useGame((s) => s.w)!
  const link = useGame((s) => s.link)
  const kos = comp.stages.map((s, i) => ({ s, i })).filter((x) => x.s.type === 'ko') as { s: KoStage; i: number }[]
  if (!kos.length) return null
  const first = kos[0].s.teams.length || 16
  return (
    <div className="bracket">
      {kos.map(({ s, i }, col) => {
        const fx = stageFixtures(w, comp.id, i)
        const ties = Math.max(1, first / 2 / 2 ** col)
        return (
          <div key={i} className="bracket-col"><div className="eyebrow">{s.name}</div>
            {Array.from({ length: ties }, (_, t) => {
              const legs = fx.filter((f) => f.slot === t).sort((a, b) => (a.round ?? 0) - (b.round ?? 0))
              const a = s.teams[t * 2]
              const b = s.teams[t * 2 + 1]
              const f = legs[0]
              const agg = legs.every((l) => l.played) && legs.length ? [legs.reduce((x, l) => x + (l.home === a ? l.hg : l.ag), 0), legs.reduce((x, l) => x + (l.home === b ? l.hg : l.ag), 0)] : null
              const pens = legs[legs.length - 1]?.pens
              const win = agg ? (agg[0] !== agg[1] ? (agg[0] > agg[1] ? a : b) : pens ? ((pens[0] > pens[1]) === (legs[legs.length - 1].home === a) ? a : b) : null) : null
              return (
                <div key={t} className="tie" style={{ cursor: f?.report != null ? 'pointer' : 'default' }} onClick={() => f && link(`fixture:${f.id}`)}>
                  {[a, b].map((tm, k) => <div key={k} className={win ? (win === tm ? 'w' : 'l') : ''}>{tm ? <TeamCell team={tm} bold={isIran(tm)} /> : <span className="faint">To be decided</span>}<b>{agg ? agg[k] : ''}{pens && agg && agg[0] === agg[1] ? <span className="faint"> ({(legs[legs.length - 1].home === tm ? pens[0] : pens[1])})</span> : ''}</b></div>)}
                  {!agg && f && <div className="faint" style={{ fontSize: 11 }}>{fmtDay(f.day, false)}</div>}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export function FixtureLine({ f }: { f: Fixture }) {
  const link = useGame((s) => s.link)
  return (
    <div className="row" style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: f.report != null ? 'pointer' : 'default' }} onClick={() => link(`fixture:${f.id}`)}>
      <span className="faint num" style={{ width: 64, fontSize: 12 }}>{fmtDay(f.day, false)}</span>
      <span className="grow" style={{ display: 'flex', justifyContent: 'flex-end' }}><TeamCell team={f.home} bold={isIran(f.home)} /></span>
      <span className="mono center" style={{ width: 70, fontWeight: 700 }}>{f.played ? `${f.hg} – ${f.ag}` : 'v'}{f.pens ? <span className="faint" style={{ fontSize: 10 }}> p</span> : ''}</span>
      <span className="grow"><TeamCell team={f.away} bold={isIran(f.away)} /></span>
    </div>
  )
}

export function Comps({ id }: { id?: number }) {
  const { w, go } = useGame()
  const world = w!
  const list = useMemo(() => world.comps.filter((c) => c.scope === 'nat' && !c.friendly).sort((a, b) => Number(a.done) - Number(b.done) || b.season - a.season), [world])
  const comp = world.comps.find((c) => c.id === id && !c.friendly) ?? list[0]
  const [stage, setStage] = useState<number | null>(null)
  if (!comp) return <div className="page-inner"><div className="card"><Empty>No international competitions are under way.</Empty></div></div>
  const si = stage != null && stage < comp.stages.length ? stage : comp.cur
  const st = comp.stages[si]
  const fx = stageFixtures(world, comp.id, si).sort((a, b) => a.day - b.day)
  const tabs = st.type === 'groups' ? groupTables(world, comp, si) : []
  const gs = st as GroupStage
  const scorers = new Map<number, number>()
  for (const f of world.fixtures) if (f.compId === comp.id && f.scorers) for (const [pid] of f.scorers) if (pid >= 0) scorers.set(pid, (scorers.get(pid) ?? 0) + 1)
  const top = [...scorers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  return (
    <div className="page-inner">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <select className="input" value={comp.id} onChange={(e) => { setStage(null); go({ name: 'comps', id: +e.target.value }) }}>{list.map((c) => <option key={c.id} value={c.id}>{c.name}{c.level !== 'senior' ? ` (${LEVEL_NAME[c.level]})` : ''}{c.done ? ' · finished' : ''}</option>)}</select>
        <div className="seg">{comp.stages.map((s, i) => <button key={i} className={i === si ? 'on' : ''} onClick={() => setStage(i)}>{s.name}</button>)}</div>
        {comp.winner && <span className="pill green right">Winners: {teamName(world, comp.winner).name}</span>}
        {comp.assumed && <span className="pill amber right" title="Entrants, draw or dates for this edition are not published yet, so the game generated them.">Format assumed</span>}
      </div>
      {st.type === 'groups' ? (
        <div className="grid g2">
          {tabs.map((rows, gi) => (
            <div key={gi} className="card flush"><div className="card-head"><h3>Group {'ABCDEFGHIJKL'[gi]}</h3></div><Table rows={rows} hl={isIran} adv={gs.advance} next={gs.bestNext ? 1 : 0} />
              <div style={{ padding: '6px 18px 12px' }}>{fx.filter((f) => f.group === gi).map((f) => <FixtureLine key={f.id} f={f} />)}</div></div>
          ))}
        </div>
      ) : <div className="card"><Bracket comp={comp} /></div>}
      {st.type === 'groups' && comp.stages.length > 1 && <div className="card"><div className="card-head"><h3>Knockout bracket</h3><span className="faint">Top {gs.advance} in each group{gs.bestNext ? ` and the ${gs.bestNext} best third-placed teams` : ''} advance</span></div><Bracket comp={comp} /></div>}
      {top.length > 0 && <div className="card flush" style={{ maxWidth: 520 }}><div className="card-head"><h3>Top scorers</h3></div><table className="t"><tbody>{top.map(([pid, n]) => <tr key={pid}><td>{world.players[pid]?.name}</td><td><Flag code={world.players[pid]?.nat[0] ?? ''} /></td><td className="r num"><b>{n}</b></td></tr>)}</tbody></table></div>}
    </div>
  )
}

export function Calendar() {
  const { w, cmd, notify } = useGame()
  const world = w!
  const [level, setLevel] = useState<'all' | 'senior'>('senior')
  const fx = useMemo(() => world.fixtures.filter((f) => (level === 'all' ? f.home.startsWith('n:IRN:') || f.away.startsWith('n:IRN:') : f.home === 'n:IRN:senior' || f.away === 'n:IRN:senior') && f.day >= world.day - 120).sort((a, b) => a.day - b.day), [world, level])
  const months = new Map<string, Fixture[]>()
  for (const f of fx) { const { y, m } = ymd(f.day); const k = `${monthName(m)} ${y}`; (months.get(k) ?? months.set(k, []).get(k)!).push(f) }
  const friendlies = fx.filter((f) => !f.played && world.comps[f.compId].friendly && f.day - world.day >= 10).slice(0, 8)
  const nations = useMemo(() => Object.values(world.nations).filter((n) => n.code !== 'IRN').sort((a, b) => a.rank - b.rank), [world])
  const camps = world.camps.filter((c) => !c.done && (level === 'all' || c.level === 'senior')).sort((a, b) => a.from - b.from).slice(0, 6)
  return (
    <div className="page-inner">
      <div className="seg" style={{ alignSelf: 'flex-start' }}><button className={level === 'senior' ? 'on' : ''} onClick={() => setLevel('senior')}>Senior team</button><button className={level === 'all' ? 'on' : ''} onClick={() => setLevel('all')}>All Iran teams</button></div>
      <div className="grid g-main" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 18 }}>
          {[...months.entries()].map(([k, list]) => (
            <div key={k} className="card"><div className="card-head"><h3>{k}</h3></div>
              {list.map((f) => <div key={f.id} className="row"><span className="faint" style={{ width: 34, fontSize: 11.5 }}>{fmtDow(f.day)}</span><div className="grow"><FixtureLine f={f} /></div><span className="faint truncate" style={{ width: 150, fontSize: 12 }}>{world.comps[f.compId].short}{f.home.split(':')[2] !== 'senior' ? ` · ${LEVEL_NAME[f.home.split(':')[2] as 'u23']}` : ''}</span></div>)}
            </div>
          ))}
          {!fx.length && <div className="card"><Empty>No fixtures scheduled.</Empty></div>}
        </div>
        <div className="col" style={{ gap: 18 }}>
        <div className="card col"><h3>Arrange friendlies</h3>
          <span className="faint" style={{ fontSize: 12 }}>Friendlies are booked automatically in free international windows. Pick a different opponent here: stronger nations sharpen the squad and move the ranking more, but charge a match fee and may say no.</span>
          {friendlies.length ? friendlies.map((f) => { const opp = (f.home.startsWith('n:IRN:') ? f.away : f.home).split(':')[1]; return (
            <div key={f.id} className="row" style={{ padding: '4px 0' }}><span className="faint num" style={{ width: 58, fontSize: 12 }}>{fmtDay(f.day, false)}</span><span className="pill">{LEVEL_NAME[f.home.split(':')[2] as 'u23']}</span>
              <select className="input grow" value={opp} onChange={(e) => void cmd<string>('arrangeFriendly', f.id, e.target.value).then(notify)}>{nations.map((n) => <option key={n.code} value={n.code}>#{n.rank} {n.name}</option>)}</select></div>
          ) }) : <span className="faint">No friendlies far enough ahead to change.</span>}
        </div>
        <div className="card col"><h3>Squad deadlines</h3>
          {camps.length ? camps.map((c) => <div key={c.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.045)' }}><div className="grow"><b>{c.label}</b><div className="faint" style={{ fontSize: 12 }}>{LEVEL_NAME[c.level]} · up to {c.size} players · first match {fmtDay(c.first, false)}</div></div><span className={`pill ${c.announced ? 'green' : c.from <= world.day ? 'red' : ''}`}>{c.announced ? 'Named' : fmtDay(c.from, false)}</span></div>) : <span className="faint">Nothing due.</span>}
        </div>
        </div>
      </div>
    </div>
  )
}
