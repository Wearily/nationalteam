import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fmtDay } from '../../sim/core/date'
import { table } from '../../sim/comps/engine'
import type { GroupStage } from '../../sim/comps/types'
import { ClubBadge, clubLogo, ageOf, clubOf, Crest, Empty, Flag, leagueOf, money, Ovr, PlayerLink, PosTag, Rating } from '../bits'
import { useGame } from '../store'

export function Rankings() {
  const w = useGame((s) => s.w)!
  const [conf, setConf] = useState('ALL')
  const rows = useMemo(() => Object.values(w.nations).filter((n) => conf === 'ALL' || n.confed === conf).sort((a, b) => a.rank - b.rank), [w, conf])
  const hist = w.rankHist
  return (
    <div className="page-inner">
      <div className="row"><div className="seg">{['ALL', 'AFC', 'UEFA', 'CONMEBOL', 'CAF', 'CONCACAF', 'OFC'].map((c) => <button key={c} className={conf === c ? 'on' : ''} onClick={() => setConf(c)}>{c === 'ALL' ? 'World' : c}</button>)}</div>
        <span className="faint right">Points use FIFA's published formula: P = P₀ + I × (W − Wₑ). Updated after every senior international.</span></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="card flush"><table className="t"><thead><tr><th style={{ width: 50 }}>Rank</th><th style={{ width: 40 }} /><th>Nation</th><th>Confederation</th><th className="r">Points</th></tr></thead><tbody>
          {rows.map((n, i) => { const mv = n.prevRank - n.rank; return <tr key={n.code} className={n.code === 'IRN' ? 'hl' : ''}><td className="num"><b>{n.rank}</b>{conf !== 'ALL' && <span className="faint"> ({i + 1})</span>}</td><td>{mv > 0 ? <span style={{ color: 'var(--green)' }}><ArrowUp size={12} />{mv}</span> : mv < 0 ? <span style={{ color: 'var(--red)' }}><ArrowDown size={12} />{-mv}</span> : <span className="faint">–</span>}</td><td><span className="row" style={{ gap: 9 }}><Flag code={n.code} /><span style={{ fontWeight: n.code === 'IRN' ? 700 : 500 }}>{n.name}</span></span></td><td className="muted">{n.confed}{n.region ? ` · ${n.region}` : ''}</td><td className="r num">{n.points.toFixed(2)}</td></tr> })}
        </tbody></table></div>
        <div className="card col" style={{ position: 'sticky', top: 0 }}><h3>Iran's ranking</h3>
          <div className="row" style={{ alignItems: 'baseline' }}><span style={{ fontSize: 54, fontWeight: 720, letterSpacing: '-0.05em' }}>{w.nations.IRN.rank}</span><span className="muted">in the world · {rows.length && [...Object.values(w.nations)].filter((n) => n.confed === 'AFC' && n.rank < w.nations.IRN.rank).length + 1} in Asia</span></div>
          {hist.length > 1 ? <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 90 }}>{(() => { const lo = Math.min(...hist.map((h) => h[1])) - 1; const hi = Math.max(...hist.map((h) => h[1])) + 1; return <polyline fill="none" stroke="#86efac" strokeWidth="1.6" vectorEffect="non-scaling-stroke" points={hist.map((h, i) => `${(i / (hist.length - 1)) * 100},${((h[1] - lo) / (hi - lo)) * 36 + 2}`).join(' ')} /> })()}</svg> : <span className="faint">History builds month by month.</span>}
        </div>
      </div>
    </div>
  )
}

export function WorldLeagues({ league }: { league?: number }) {
  const { w, go, link } = useGame()
  const world = w!
  const leagues = world.leagues.filter((l) => !l.virtual && l.clubIds.length >= 4)
  const lg = leagues.find((l) => l.id === league) ?? leagues.find((l) => l.country === 'IRN' && l.tier === 1) ?? leagues[0]
  const comp = useMemo(() => world.comps.filter((c) => c.key.startsWith(`lg:${lg?.rid}:`)).sort((a, b) => b.season - a.season)[0], [world, lg])
  const rows = useMemo(() => (comp ? table((comp.stages[0] as GroupStage).groups[0], world.fixtures.filter((f) => f.compId === comp.id), 'gd') : []), [world, comp])
  const iranians = useMemo(() => (lg ? world.players.filter((p) => !p.retired && p.nat.includes('IRN') && leagueOf(world, p)?.id === lg.id).sort((a, b) => b.ovr - a.ovr).slice(0, 40) : []), [world, lg])
  const [clubId, setClubId] = useState<number | null>(null)
  const squad = clubId != null ? world.players.filter((p) => p.clubId === clubId && !p.retired).sort((a, b) => b.ovr - a.ovr) : []
  if (!lg) return <div className="page-inner"><div className="card"><Empty>No leagues loaded.</Empty></div></div>
  return (
    <div className="page-inner">
      <div className="row"><select className="input" value={lg.id} onChange={(e) => { setClubId(null); go({ name: 'world', league: +e.target.value }) }}>{leagues.map((l) => <option key={l.id} value={l.id}>{world.nations[l.country]?.name ?? l.country} · {l.name}</option>)}</select>
        <span className="pill">League strength {lg.strength}</span><span className="faint right">{lg.country === 'IRN' ? 'Every player in this league is modelled.' : 'Clubs and results are simulated; only Iranian and notable players are tracked individually.'}</span></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="card flush"><div className="card-head"><h3>{lg.name}{comp ? ` ${comp.season}/${String((comp.season + 1) % 100).padStart(2, '0')}` : ''}</h3></div>
          {rows.length ? <table className="t"><thead><tr><th style={{ width: 34 }}>#</th><th>Club</th><th className="c">P</th><th className="c">W</th><th className="c">D</th><th className="c">L</th><th className="c">GD</th><th className="c">Pts</th></tr></thead><tbody>
            {rows.map((r, i) => { const c = world.clubs[+r.team.split(':')[1]]; return <tr key={r.team} className={`click ${clubId === c.id ? 'sel' : ''}`} onClick={() => setClubId(c.id)}><td className="faint num">{i + 1}</td><td><span className="row" style={{ gap: 9 }}><Crest colors={c.colors} logo={clubLogo(c)} />{c.name}</span></td><td className="c num">{r.p}</td><td className="c num">{r.w}</td><td className="c num">{r.d}</td><td className="c num">{r.l}</td><td className="c num">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td><td className="c num"><b>{r.pts}</b></td></tr> })}
          </tbody></table> : <Empty>The season has not started.</Empty>}
        </div>
        <div className="card flush"><div className="card-head"><h3>{clubId != null ? world.clubs[clubId].name : `Iranians in the ${lg.name}`}</h3>{clubId != null && <button className="btn sm ghost right" onClick={() => setClubId(null)}>Show Iranians</button>}</div>
          <table className="t"><thead><tr><th>Player</th><th>Pos</th><th className="c">Age</th><th className="c">Ovr</th><th className="c">Apps</th><th className="c">G</th><th className="r">Rating</th></tr></thead><tbody>
            {(clubId != null ? squad : iranians).map((p) => <tr key={p.id} className="click" onClick={() => link(`player:${p.id}`)}><td><PlayerLink p={p} sub={clubId == null ? clubOf(world, p)?.name : undefined} /></td><td><PosTag pos={p.pos[0]} /></td><td className="c num">{ageOf(world, p)}</td><td className="c"><Ovr p={p} /></td><td className="c num">{p.club.apps}</td><td className="c num">{p.club.goals}</td><td className="r"><Rating v={p.club.apps ? p.club.ratingSum / p.club.apps : null} /></td></tr>)}
          </tbody></table>
          {(clubId != null ? squad : iranians).length === 0 && <Empty>{clubId != null ? 'No individually tracked players at this club.' : 'No Iranian players here at the moment.'}</Empty>}
        </div>
      </div>
      <span className="faint" style={{ fontSize: 11.5 }}>Click a club to see its tracked players.</span>
    </div>
  )
}

export function Transfers() {
  const { w, link } = useGame()
  const world = w!
  const moves = useMemo(() => {
    const out: { p: (typeof world.players)[number]; t: (typeof world.players)[number]['transfers'][number] }[] = []
    for (const p of world.players) for (const t of p.transfers) out.push({ p, t })
    return out.sort((a, b) => b.t.day - a.t.day).slice(0, 150)
  }, [world])
  const abroad = useMemo(() => world.players.filter((p) => !p.retired && p.nat[0] === 'IRN' && clubOf(world, p) && clubOf(world, p)!.country !== 'IRN').sort((a, b) => b.value - a.value).slice(0, 40), [world])
  const top = useMemo(() => world.players.filter((p) => !p.retired && p.nat[0] === 'IRN').sort((a, b) => b.value - a.value).slice(0, 15), [world])
  return (
    <div className="page-inner">
      <div className="card flush">
        <div className="card-head"><h3>Recent moves</h3><span className="faint">Iranian players · windows open in January and July–August · free agents can sign at any time</span></div>
        {moves.length ? (
          <div className="scroll" style={{ maxHeight: 520 }}>
            <table className="t fixed">
              <colgroup><col style={{ width: 112 }} /><col /><col style={{ width: 62 }} /><col style={{ width: 52 }} /><col style={{ width: 86 }} /><col style={{ width: 80 }} /><col style={{ width: '20%' }} /><col style={{ width: '23%' }} /><col style={{ width: 96 }} /></colgroup>
              <thead><tr><th>Date</th><th>Player</th><th>Pos</th><th className="c">Age</th><th className="c">Ovr</th><th className="c">Pot</th><th>From</th><th>To</th><th className="r">Fee</th></tr></thead>
              <tbody>
                {moves.map(({ p, t }, i) => (
                  <tr key={i} className="click" onClick={() => link(`player:${p.id}`)}>
                    <td className="faint num">{fmtDay(t.day)}</td>
                    <td><PlayerLink p={p} /></td>
                    <td><PosTag pos={p.pos[0]} /></td>
                    <td className="c num">{ageOf(world, p)}</td>
                    <td className="c"><Ovr p={p} /></td>
                    <td className="c"><Ovr p={p} pot /></td>
                    <td className="muted"><span className="row" style={{ gap: 7 }}>{t.from != null && <ClubBadge clubId={t.from} />}<span className="truncate">{t.from != null ? world.clubs[t.from].name : 'Free agent'}</span></span></td>
                    <td><span className="row" style={{ gap: 7 }}>{t.to != null && <ClubBadge clubId={t.to} />}<span className="truncate">{t.to != null ? world.clubs[t.to].name : '–'}</span>{t.to != null && <Flag code={world.clubs[t.to].country} sm />}</span></td>
                    <td className="r num">{t.fee ? money(t.fee) : 'Free'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No transfers yet. The next window opens in January.</Empty>}
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card flush"><div className="card-head"><h3>Most valuable Iranians</h3></div><table className="t"><thead><tr><th style={{ width: 30 }}>#</th><th>Player</th><th className="c">Age</th><th className="c">Ovr</th><th className="c">Pot</th><th className="r">Value</th></tr></thead><tbody>{top.map((p, i) => <tr key={p.id} className="click" onClick={() => link(`player:${p.id}`)}><td className="faint num">{i + 1}</td><td><PlayerLink p={p} sub={clubOf(world, p)?.name} /></td><td className="c num">{ageOf(world, p)}</td><td className="c"><Ovr p={p} /></td><td className="c"><Ovr p={p} pot /></td><td className="r num"><b>{money(p.value)}</b></td></tr>)}</tbody></table></div>
        <div className="card flush"><div className="card-head"><h3>Iranians abroad</h3><span className="faint">{abroad.length} shown, by value</span></div><table className="t"><thead><tr><th>Player</th><th className="c">Age</th><th className="c">Ovr</th><th className="c">Pot</th><th className="c">Mins</th><th className="r">Value</th></tr></thead><tbody>{abroad.map((p) => <tr key={p.id} className="click" onClick={() => link(`player:${p.id}`)}><td><PlayerLink p={p} sub={<><Flag code={clubOf(world, p)!.country} sm />{clubOf(world, p)!.name} · {leagueOf(world, p)!.name}</>} /></td><td className="c num">{ageOf(world, p)}</td><td className="c"><Ovr p={p} /></td><td className="c"><Ovr p={p} pot /></td><td className="c num">{p.club.mins}</td><td className="r num">{money(p.value)}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  )
}
