import { Activity, ArrowUpRight, CircleDot, Smile, X, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fmtDay, ymd } from '../../sim/core/date'
import { A, type Attr, ATTR_LABEL, effectiveOverall, faceStats, POS_LIST, POS_NAME } from '../../sim/ratings/attributes'
import { dynOvr, engineDelta } from '../../sim/ratings/dynamic'
import { LEVEL_NAME, type Level, type Player, type SeasonStats } from '../../sim/world/types'
import { clubLogo, ageOf, clubOf, Crest, Face, Flag, leagueOf, Meter, money, ovrColor, PosTag, Rating, ratingColor, scoutView } from '../bits'
import { useGame } from '../store'

const CATS: { name: string; attrs: Attr[] }[] = [
  { name: 'Pace', attrs: ['acceleration', 'pace', 'agility'] },
  { name: 'Shooting', attrs: ['finishing', 'longShots', 'penalties', 'offTheBall', 'composure'] },
  { name: 'Passing', attrs: ['passing', 'vision', 'crossing', 'setPieces', 'technique'] },
  { name: 'Dribbling', attrs: ['dribbling', 'firstTouch', 'decisions', 'teamwork'] },
  { name: 'Defending', attrs: ['tackling', 'marking', 'positioning', 'anticipation', 'heading'] },
  { name: 'Physical', attrs: ['strength', 'stamina', 'jumping', 'aggression', 'workRate', 'leadership'] },
]
const GK_CAT = { name: 'Goalkeeping', attrs: ['reflexes', 'handling', 'oneOnOnes', 'command', 'kicking'] as Attr[] }
const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')
const cls = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : '')

function blurb(p: Player, age: number, lgStrength: number): string {
  const gap = p.pot - p.ovr
  const a = age <= 21 && gap >= 8 ? 'An exciting prospect.' : age <= 24 && gap >= 4 ? 'Still developing, with room to grow.' : age >= 33 ? 'A veteran in the final years of his career.' : p.ovr >= 78 ? 'A leading player for his country.' : p.ovr >= 70 ? 'An established professional.' : 'A squad player at this level.'
  const b = p.clubId == null ? 'Currently without a club.' : p.sharp < 45 ? 'Short of minutes at his club.' : lgStrength >= 72 ? 'Playing regularly in a strong league.' : 'Playing regularly.'
  return `${a}\n${b}`
}
function Spark({ pts, color = '#f3f4f6', h = 46 }: { pts: number[]; color?: string; h?: number }) {
  if (pts.length < 2) return <div className="faint" style={{ fontSize: 13 }}>Not enough history yet.</div>
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  return <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }}><polyline points={pts.map((v, i) => `${(i / (pts.length - 1)) * 100},${h - 4 - ((v - lo) / (hi - lo || 1)) * (h - 8)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>
}
const StatRow = ({ label, s }: { label: string; s: SeasonStats }) => (
  <tr><td>{label}</td><td className="c num">{s.apps}</td><td className="c num">{s.mins}</td><td className="c num">{s.goals}</td><td className="c num">{s.assists}</td><td className="c num">{s.cleanSheets || '–'}</td><td className="c num">{s.yellows}</td><td className="r"><Rating v={s.apps ? s.ratingSum / s.apps : null} /></td></tr>
)

export function PlayerProfile({ id }: { id: number }) {
  const { w, openPlayer, cmd, notify } = useGame()
  const world = w!
  const p = world.players[id]
  const [tab, setTab] = useState<'overview' | 'attributes' | 'stats'>('overview')
  const [promise, setPromise] = useState<'none' | 'squad' | 'starter'>('squad')
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && openPlayer(null)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [openPlayer])
  if (!p) return null
  const v = scoutView(p)
  const d = dynOvr(p)
  const eng = engineDelta(p)
  const c = clubOf(world, p)
  const lg = leagueOf(world, p)
  const age = ageOf(world, p)
  const dob = ymd(p.dob)
  const dual = p.iranStatus && p.iranStatus !== 'committed'
  const fs = faceStats(p.attrs, p.pos[0])
  const levels = (Object.keys(p.youthCaps) as Level[]).filter((l) => p.youthCaps[l])
  const cats = p.pos[0] === 'GK' ? [GK_CAT, ...CATS.filter((x) => x.name !== 'Shooting' && x.name !== 'Dribbling'), CATS[3]].slice(0, 5) : CATS
  const condLabel = p.injury ? `Out until ${fmtDay(p.injury.until, false)}` : p.cond >= 85 ? 'Ready to play' : p.cond >= 70 ? 'Needs a rest' : 'Exhausted'
  return (
    <div className={`profile ${tab === 'overview' ? '' : 'dark'}`}>
      <div className="profile-bg" />
      <button className="btn profile-close" onClick={() => openPlayer(null)}><X />Close</button>
      <div className="profile-face">
        <div className="face"><Face p={p} /></div>
        <div className="profile-id">
          <div className="big">{p.num ?? age}</div>
          <small>Age (date of birth)</small><b>{age} ({dob.d} {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dob.m - 1]} {dob.y})</b>
          <small>Height and foot</small><b>{p.heightCm} cm · {p.foot === 'L' ? 'Left' : p.foot === 'B' ? 'Both' : 'Right'}</b>
        </div>
      </div>
      <div className="profile-main">
        <div className="profile-nav"><span className="ttl">Player profile</span>{(['overview', 'attributes', 'stats'] as const).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
        <div className="profile-head">
          <div className="diamond">{v.exact && d.total !== 0 && <i className={cls(d.total)}>{d.total > 0 ? '▲' : '▼'}</i>}<b>{v.exact ? d.ovr : '??'}</b></div>
          <div>
            <div className="profile-pos">{p.pos.map((x, i) => (i === 0 ? <b key={x}>{x}</b> : <span key={x}> · {x}</span>))}</div>
            <div className="profile-name">{p.nat.map((n) => <Flag key={n} code={n} />)}{p.name}</div>
            <div className="chips">
              <span title="Baseline overall"><CircleDot size={15} />{v.exact ? d.base : `${v.lo}–${v.hi}`}</span>
              <span title="Potential"><ArrowUpRight size={16} />{v.exact ? p.pot : `${v.potLo}–${v.potHi}`}</span>
              <span className={cls(d.form)} title="Form"><Activity size={15} />{sign(d.form)} <em>OVR</em></span>
              <span className={cls(d.morale)} title="Morale"><Smile size={15} />{sign(d.morale)} <em>OVR</em></span>
              <span className={cls(d.fitness)} title="Match fitness"><Zap size={15} />{sign(d.fitness)} <em>OVR</em></span>
            </div>
          </div>
        </div>

        {tab === 'overview' && <>
          <div className="row" style={{ marginTop: 22, alignItems: 'flex-start' }}>
            <div style={{ whiteSpace: 'pre-line', fontSize: 16.5, lineHeight: 1.45 }}>{blurb(p, age, lg?.strength ?? 40)}</div>
            <div className="right" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14.5 }}>International</div>
              <b style={{ fontSize: 17, fontWeight: 800, textTransform: 'uppercase' }}>{p.intlRetired ? 'Retired' : dual ? `Eligible · ${p.iranStatus}` : `${p.caps} caps · ${p.goals} goals`}</b>
              {levels.length > 0 && <div className="faint" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>{levels.map((l) => `${LEVEL_NAME[l]} × ${p.youthCaps[l]}`).join(' · ')}</div>}
            </div>
          </div>
          <div className="statusrow">
            <div className="kv"><span>Form</span><b><Activity size={17} />{d.formLabel}</b></div>
            <div className="kv"><span>Morale</span><b><Smile size={17} />{d.moraleLabel}</b></div>
            <div className="kv"><span>Match fitness</span><b><Zap size={17} />{d.fitnessLabel}</b></div>
            <div className="kv"><span>Condition</span><b style={{ color: p.injury ? '#ffb3b8' : undefined }}>{condLabel}</b></div>
          </div>
          <div className="infogrid">
            <div className="kv"><span>Club</span><b>{c ? <><Crest colors={c.colors} logo={clubLogo(c)} /><span className="truncate">{c.name}</span></> : 'Free agent'}</b></div>
            <div className="kv"><span>Market value</span><b className="num">{money(p.value)}</b></div>
            <div className="kv"><span>Scouting knowledge</span><b className="num">{Math.round(p.known)}%</b></div>
            <div className="facecol">{fs.labels.map((l, i) => <div key={l}><span>{({ PAC: 'Pace', SHO: 'Shooting', PAS: 'Passing', DRI: 'Dribbling', DEF: 'Defending', PHY: 'Physical', DIV: 'Diving', HAN: 'Handling', KIC: 'Kicking', REF: 'Reflexes', SPD: 'Speed', POS: 'Positioning' } as Record<string, string>)[l]}</span><b>{v.attrs ? fs.values[i] : '?'}</b></div>)}</div>
            <div className="kv"><span>League</span><b>{lg && <Flag code={lg.country} />}<span className="truncate">{lg?.name ?? '–'}</span></b></div>
            <div className="kv"><span>Yearly wage</span><b className="num">{money(p.wage)}</b></div>
            <div className="kv"><span>Position</span><b>{POS_NAME[p.pos[0]]}</b></div>
            <div className="kv"><span>Contract until</span><b className="num">{c ? `30 Jun ${ymd(p.contractEnd).y}` : '–'}</b></div>
            <div className="kv"><span>Born</span><b>{world.nations[p.born ?? p.nat[0]]?.name ?? '–'}</b></div>
            <div className="kv"><span>Status</span><b>{p.real ? 'Real player' : 'Generated'}</b></div>
          </div>
          {!v.exact && <div className="card" style={{ marginTop: 24 }}><b>Ratings are estimates</b><div className="muted" style={{ fontSize: 13.5, margin: '3px 0 10px' }}>Your scouts do not know this player well yet, so overall and potential are shown as ranges. Assign a scout to his region under Recruitment.</div><Meter v={p.known} tone="amber" /></div>}
          {dual && (
            <div className="card col" style={{ marginTop: 24 }}>
              <div className="row"><h3>Ask him to represent Iran</h3><span className="muted right">Interest: {v.attrs ? ((p.willingness ?? 40) > 60 ? 'warm' : (p.willingness ?? 40) > 35 ? 'open' : 'cool') : 'unknown'}</span></div>
              <div className="muted" style={{ fontSize: 13.5 }}>He also holds {p.nat.filter((n) => n !== 'IRN').map((n) => world.nations[n]?.name ?? n).join(', ')} nationality and is not cap-tied. A promise he can see through will backfire, and each approach needs four months before the next.</div>
              <div className="row"><div className="seg">{([['none', 'No promise'], ['squad', 'A place in the next squad'], ['starter', 'A starting role']] as const).map(([k, n]) => <button key={k} className={promise === k ? 'on' : ''} onClick={() => setPromise(k)}>{n}</button>)}</div>
                <button className="btn primary right" onClick={() => void cmd<string>('approach', p.id, promise).then(notify)}>Make the approach</button></div>
            </div>
          )}
        </>}

        {tab === 'attributes' && (v.attrs ? <>
          <div className="cats" style={{ marginTop: 28, gridTemplateColumns: `repeat(${cats.length}, 1fr)` }}>
            {cats.map((cat) => {
              const base = Math.round(cat.attrs.reduce((a, k) => a + p.attrs[A[k]], 0) / cat.attrs.length)
              return (
                <div key={cat.name} className="cat"><h4>{cat.name}</h4>
                  <div className="n">{Math.min(99, base + eng)}{eng !== 0 && <sup className={cls(eng)}>{sign(eng)}</sup>}</div>
                  {cat.attrs.map((k) => <div key={k} className={`a ${eng ? 'chg' : ''}`}><span>{ATTR_LABEL[k]}</span><b style={{ color: ovrColor(p.attrs[A[k]]) }}>{Math.min(99, Math.max(1, p.attrs[A[k]] + eng))}</b></div>)}
                </div>
              )
            })}
          </div>
          <div className="muted" style={{ marginTop: 18, fontSize: 13.5 }}>Dynamic OVR: form {sign(d.form)}, morale {sign(d.morale)} and match sharpness shift every attribute by {sign(eng)} in his next match. Tiredness is applied separately during play.</div>
          <div className="card" style={{ marginTop: 18 }}><div className="row" style={{ flexWrap: 'wrap', gap: 14 }}><b>Rating by position</b>{POS_LIST.filter((x) => (x === 'GK') === (p.pos[0] === 'GK')).map((x) => { const e = effectiveOverall(p.attrs, p.pos, x); return <span key={x} className="row" style={{ gap: 6, opacity: e < p.ovr - 9 ? 0.45 : 1 }}><PosTag pos={x} /><b className="num" style={{ color: ovrColor(e) }}>{e}</b></span> })}</div></div>
        </> : <div className="card" style={{ marginTop: 28 }}>Attributes are unknown until this player has been scouted.</div>)}

        {tab === 'stats' && <div className="col" style={{ marginTop: 24, gap: 18 }}>
          <div className="grid g2">
            <div className="card"><div className="card-head"><h3>Club form</h3><span className="muted right">{d.formLabel}</span></div>
              <div className="row" style={{ alignItems: 'flex-end', height: 86, gap: 7 }}>{p.form.length ? p.form.map((f, i) => <div key={i} className="grow col center" style={{ gap: 4, justifyContent: 'flex-end', height: '100%' }}><div style={{ height: `${Math.max(8, (f - 4.5) * 17)}%`, borderRadius: 6, background: ratingColor(f) }} /><span className="num" style={{ fontSize: 12 }}>{f.toFixed(1)}</span></div>) : <span className="muted">No recent club matches.</span>}</div></div>
            <div className="card"><div className="card-head"><h3>Market value</h3><span className="right num">{money(p.value)}</span></div><Spark pts={p.valueHist.map((x) => x[1])} color="#3ddc97" h={86} /></div>
          </div>
          <div className="card flush"><table className="t"><thead><tr><th>Season</th><th className="c">Apps</th><th className="c">Mins</th><th className="c">Goals</th><th className="c">Assists</th><th className="c">Clean sheets</th><th className="c">Yellows</th><th className="r">Rating</th></tr></thead><tbody>
            <StatRow label={`This season · ${c?.name ?? 'club'}`} s={p.club} /><StatRow label="This season · international" s={p.intl} />
            {[...p.history].reverse().map((h, i) => <StatRow key={i} label={`${h.season}/${String((h.season + 1) % 100).padStart(2, '0')} · ${h.clubId != null ? world.clubs[h.clubId].name : '–'}`} s={h.stats} />)}
          </tbody></table></div>
          {p.transfers.length > 0 && <div className="card flush"><div className="card-head"><h3>Transfers</h3></div><table className="t"><tbody>{[...p.transfers].reverse().map((t, i) => <tr key={i}><td className="faint num">{fmtDay(t.day)}</td><td>{t.from != null ? world.clubs[t.from].name : 'Free agent'}</td><td className="faint">▶</td><td><b>{t.to != null ? world.clubs[t.to].name : 'Released'}</b></td><td className="r num">{t.fee ? money(t.fee) : 'Free'}</td></tr>)}</tbody></table></div>}
          {p.photoCredit && <div className="faint" style={{ fontSize: 12 }}>Photo: {p.photoCredit}</div>}
        </div>}
      </div>
    </div>
  )
}
