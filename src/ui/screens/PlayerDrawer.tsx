import { X } from 'lucide-react'
import { useState } from 'react'
import { fmtDay, ymd } from '../../sim/core/date'
import { formAvg } from '../../sim/clubs/season'
import { A, ATTR_GROUPS, ATTR_LABEL, effectiveOverall, POS_LIST, POS_NAME } from '../../sim/ratings/attributes'
import { LEVEL_NAME, type Level, type SeasonStats } from '../../sim/world/types'
import { ageOf, clubOf, Crest, Flag, leagueOf, Meter, money, Ovr, ovrColor, PlayerCard, PosTag, Rating, ratingColor, scoutView } from '../bits'
import { useGame } from '../store'

function Spark({ pts, color = '#f3f4f6', h = 46 }: { pts: number[]; color?: string; h?: number }) {
  if (pts.length < 2) return <div className="faint" style={{ fontSize: 12 }}>Not enough history yet.</div>
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  const xy = pts.map((v, i) => `${(i / (pts.length - 1)) * 100},${h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8)}`).join(' ')
  return <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }}><polyline points={xy} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>
}
const StatRow = ({ label, s }: { label: string; s: SeasonStats }) => (
  <tr><td>{label}</td><td className="c num">{s.apps}</td><td className="c num">{s.mins}</td><td className="c num">{s.goals}</td><td className="c num">{s.assists}</td><td className="c num">{s.cleanSheets || '–'}</td><td className="c num">{s.yellows}</td><td className="r"><Rating v={s.apps ? s.ratingSum / s.apps : null} /></td></tr>
)

export function PlayerDrawer({ id }: { id: number }) {
  const { w, openPlayer, cmd, notify } = useGame()
  const world = w!
  const p = world.players[id]
  const [promise, setPromise] = useState<'none' | 'squad' | 'starter'>('squad')
  if (!p) return null
  const v = scoutView(p)
  const c = clubOf(world, p)
  const lg = leagueOf(world, p)
  const dual = p.iranStatus && p.iranStatus !== 'committed'
  const levels = (Object.keys(p.youthCaps) as Level[]).filter((l) => p.youthCaps[l])
  return (
    <>
      <div className="scrim" onClick={() => openPlayer(null)} />
      <aside className="drawer">
        <div style={{ padding: 30, background: 'linear-gradient(135deg, rgba(22,163,74,0.14), transparent 45%, rgba(220,38,38,0.12))', borderBottom: '1px solid var(--line)' }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 28 }}>
            <PlayerCard p={p} />
            <div className="col grow" style={{ gap: 14 }}>
              <div className="row"><div className="row" style={{ gap: 6 }}>{p.nat.map((n) => <Flag key={n} code={n} />)}</div>{p.pos.map((x) => <PosTag key={x} pos={x} />)}<button className="btn ghost right" onClick={() => openPlayer(null)}><X /></button></div>
              <h1 style={{ fontSize: 36 }}>{p.name}</h1>
              <div className="muted" style={{ fontSize: 14.5 }}>{POS_NAME[p.pos[0]]} · {ageOf(world, p)} years old · {p.heightCm} cm · {p.foot === 'L' ? 'Left' : p.foot === 'B' ? 'Both feet' : 'Right'} footed{p.born && p.born !== 'IRN' ? ` · born in ${world.nations[p.born]?.name ?? p.born}` : ''}</div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {p.injury && <span className="pill red">{p.injury.name} · back {fmtDay(p.injury.until, false)}</span>}
                {p.intlRetired && <span className="pill amber">Retired from international football</span>}
                {dual && <span className="pill blue">Eligible for Iran · {p.iranStatus}</span>}
                {p.caps > 0 && <span className="pill">{p.caps} caps · {p.goals} goals</span>}
                {levels.map((l) => <span key={l} className="pill">{LEVEL_NAME[l]} × {p.youthCaps[l]}</span>)}
                {!p.real && <span className="pill">Generated player</span>}
              </div>
              <div className="grid g4" style={{ gap: 12, marginTop: 4 }}>
                <div><div className="eyebrow">Club</div><div className="row" style={{ marginTop: 5, gap: 7 }}>{c ? <>{c.logo ? <Crest colors={c.colors} logo={c.logo} /> : <Flag code={c.country} />}<b className="truncate">{c.name}</b></> : <b>Free agent</b>}</div><div className="faint" style={{ fontSize: 11.5 }}>{lg?.name ?? ''}</div></div>
                <div><div className="eyebrow">Value</div><b style={{ fontSize: 19, display: 'block', marginTop: 3 }}>{money(p.value)}</b><div className="faint" style={{ fontSize: 11.5 }}>{money(p.wage)} a year</div></div>
                <div><div className="eyebrow">Overall / potential</div><div className="row" style={{ marginTop: 6, gap: 6 }}><Ovr p={p} /><span className="faint">→</span><Ovr p={p} pot /></div></div>
                <div><div className="eyebrow">Contract</div><b style={{ display: 'block', marginTop: 5 }}>{c ? ymd(p.contractEnd).y : '–'}</b><div className="faint" style={{ fontSize: 11.5 }}>Morale {Math.round(p.morale)} · sharpness {Math.round(p.sharp)}%</div></div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: 26 }} className="col">
          {!v.exact && (
            <div className="card row" style={{ gap: 16 }}>
              <div className="grow"><b>Scouting knowledge {Math.round(p.known)}%</b><div className="faint" style={{ fontSize: 12, margin: '3px 0 9px' }}>Ratings are shown as ranges until your scouts know this player better. Assign a scout to his region on the Scouting screen.</div><Meter v={p.known} tone="amber" /></div>
            </div>
          )}
          {dual && (
            <div className="card col">
              <div className="row"><h3>Ask him to represent Iran</h3><span className="faint right">Estimated interest: {v.attrs ? ((p.willingness ?? 40) > 60 ? 'warm' : (p.willingness ?? 40) > 35 ? 'open' : 'cool') : 'unknown'}</span></div>
              <div className="muted" style={{ fontSize: 12.5 }}>He also holds {p.nat.filter((n) => n !== 'IRN').map((n) => world.nations[n]?.name ?? n).join(', ')} nationality and is not cap-tied. Promises help, but one he can see through will backfire, and each approach needs four months before the next.</div>
              <div className="row"><div className="seg">{([['none', 'No promise'], ['squad', 'A place in the next squad'], ['starter', 'A starting role']] as const).map(([k, n]) => <button key={k} className={promise === k ? 'on' : ''} onClick={() => setPromise(k)}>{n}</button>)}</div>
                <button className="btn primary right" onClick={() => void cmd<string>('approach', p.id, promise).then(notify)}>Make the approach</button></div>
            </div>
          )}
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
            <div className="card">
              <div className="card-head"><h3>Attributes</h3>{!v.attrs && <span className="faint">Unknown — needs scouting</span>}</div>
              <div className="grid g3" style={{ gap: 26 }}>
                {ATTR_GROUPS.filter((g) => g.name !== 'Goalkeeping' || p.pos[0] === 'GK').filter((g) => !(p.pos[0] === 'GK' && g.name === 'Technical')).map((g) => (
                  <div key={g.name}><div className="eyebrow" style={{ marginBottom: 8 }}>{g.name}</div>
                    {g.attrs.map((a) => { const val = p.attrs[A[a]]; return <div key={a} className="attr"><span className="muted">{ATTR_LABEL[a]}</span><b style={{ color: v.attrs ? ovrColor(val) : 'var(--text-3)' }}>{v.attrs ? val : '?'}</b><div className="attr-bar"><i style={{ width: v.attrs ? `${val}%` : 0, background: ovrColor(val) }} /></div></div> })}
                  </div>
                ))}
              </div>
            </div>
            <div className="col" style={{ gap: 18 }}>
              <div className="card"><div className="card-head"><h3>Club form</h3><span className="right"><Rating v={p.form.length ? formAvg(p) : null} /></span></div>
                <div className="row" style={{ alignItems: 'flex-end', height: 74, gap: 6 }}>{p.form.length ? p.form.map((f, i) => <div key={i} className="grow col center" style={{ gap: 4, justifyContent: 'flex-end', height: '100%' }}><div style={{ height: `${Math.max(8, (f - 4.5) * 17)}%`, borderRadius: 5, background: ratingColor(f) }} /><span className="num faint" style={{ fontSize: 10.5 }}>{f.toFixed(1)}</span></div>) : <span className="faint">No recent club matches.</span>}</div>
              </div>
              <div className="card"><div className="card-head"><h3>Market value</h3><span className="right num">{money(p.value)}</span></div><Spark pts={p.valueHist.map((x) => x[1])} color="#86efac" /></div>
              {v.attrs && <div className="card"><div className="card-head"><h3>Positions</h3></div><div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>{POS_LIST.filter((x) => (x === 'GK') === (p.pos[0] === 'GK')).map((x) => { const e = effectiveOverall(p.attrs, p.pos, x); return <span key={x} className="row" style={{ gap: 5, opacity: e < p.ovr - 9 ? 0.4 : 1 }}><PosTag pos={x} /><b className="num" style={{ color: ovrColor(e) }}>{e}</b></span> })}</div></div>}
            </div>
          </div>
          <div className="card flush">
            <div className="card-head"><h3>Season and career</h3></div>
            <table className="t"><thead><tr><th>Season</th><th className="c">Apps</th><th className="c">Mins</th><th className="c">Goals</th><th className="c">Assists</th><th className="c">Clean sheets</th><th className="c">Yellows</th><th className="r">Rating</th></tr></thead><tbody>
              <StatRow label={`This season · ${c?.name ?? 'club'}`} s={p.club} />
              <StatRow label="This season · international" s={p.intl} />
              {[...p.history].reverse().map((h, i) => <StatRow key={i} label={`${h.season}/${String((h.season + 1) % 100).padStart(2, '0')} · ${h.clubId != null ? world.clubs[h.clubId].name : '–'}`} s={h.stats} />)}
            </tbody></table>
          </div>
          {p.transfers.length > 0 && <div className="card flush"><div className="card-head"><h3>Transfers</h3></div><table className="t"><tbody>{[...p.transfers].reverse().map((t, i) => <tr key={i}><td className="faint num">{fmtDay(t.day)}</td><td>{t.from != null ? world.clubs[t.from].name : 'Free agent'}</td><td className="faint">→</td><td><b>{t.to != null ? world.clubs[t.to].name : 'Released'}</b></td><td className="r num">{t.fee ? money(t.fee) : 'Free'}</td></tr>)}</tbody></table></div>}
          {p.photoCredit && <div className="faint" style={{ fontSize: 11 }}>Photo: {p.photoCredit}</div>}
        </div>
      </aside>
    </>
  )
}
