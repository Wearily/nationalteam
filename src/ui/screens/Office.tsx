import { useMemo, useState } from 'react'
import { fmtDay } from '../../sim/core/date'
import { SCOUT_SCOPES, type ScoutScope } from '../../sim/world/state'
import { LEVEL_NAME, LEVELS, type Level, type Staff as StaffT } from '../../sim/world/types'
import { Empty, Flag, Meter, money, tone } from '../bits'
import { useGame } from '../store'

const Skill = ({ v }: { v: number }) => <span className="num" style={{ fontWeight: 680, color: v >= 15 ? '#86efac' : v >= 11 ? '#fde047' : '#fdba74' }}>{v}</span>
const age = (day: number, dob: number) => Math.floor((day - dob) / 365.25)

export function Staff() {
  const { w, cmd, notify } = useGame()
  const world = w!
  const [level, setLevel] = useState<Level>('senior')
  const coaches = useMemo(() => world.staff.filter((s) => s.role === 'coach' && (!s.job || s.job.startsWith('nation:IRN'))).sort((a, b) => b.rep - a.rep), [world])
  const bias = (s: StaffT) => (s.abroadBias > 0.25 ? 'Abroad-based' : s.abroadBias < -0.25 ? 'Home-based' : 'Balanced')
  return (
    <div className="page-inner">
      <div className="grid g4">
        {LEVELS.map((l) => { const t = world.teams[l]; const c = t.coachId != null ? world.staff[t.coachId] : null; return (
          <button key={l} className="card" style={{ textAlign: 'left', padding: 16, outline: level === l ? '1px solid rgba(255,255,255,0.4)' : 'none' }} onClick={() => setLevel(l)}>
            <div className="row"><span className="eyebrow">{LEVEL_NAME[l]}</span><span className={`pill right ${t.control === 'manual' ? 'blue' : ''}`}>{t.control === 'manual' ? 'You' : 'Coach'}</span></div>
            <div style={{ fontWeight: 650, fontSize: 15, marginTop: 8 }}>{c?.name ?? 'Vacant'}</div>
            <div className="faint" style={{ fontSize: 12 }}>{c ? `${c.formation} · ${bias(c)} · to ${fmtDay(c.contractEnd, true).slice(-4)}` : 'Appoint a head coach'}</div>
          </button>
        ) })}
      </div>
      <div className="card flush">
        <div className="card-head"><h3>Available head coaches</h3><span className="faint">Appointing for the {LEVEL_NAME[level]} team · a signing fee of half a year's salary applies</span></div>
        <table className="t"><thead><tr><th>Coach</th><th className="c">Age</th><th className="c">Reputation</th><th className="c">Tactics</th><th className="c">Motivation</th><th className="c">Youth</th><th className="c">Judging</th><th>Formation</th><th>Selection leaning</th><th>Current role</th><th className="r">Salary</th><th /></tr></thead><tbody>
          {coaches.map((s) => (
            <tr key={s.id}><td><span className="row" style={{ gap: 9 }}><Flag code={s.nat} /><b>{s.name}</b></span></td><td className="c num">{age(world.day, s.dob)}</td><td className="c" style={{ width: 120 }}><Meter v={s.rep} /></td><td className="c"><Skill v={s.tactics} /></td><td className="c"><Skill v={s.motivation} /></td><td className="c"><Skill v={s.youth} /></td><td className="c"><Skill v={s.judging} /></td><td>{s.formation}</td><td className="muted">{bias(s)}</td>
              <td className="muted">{s.job ? `Iran ${LEVEL_NAME[s.job.split(':')[2] as Level]}` : 'Available'}</td><td className="r num">{money(s.wage)}</td>
              <td className="r"><button className="btn sm" disabled={s.job === `nation:IRN:${level}`} onClick={() => void cmd<string | null>('hireCoach', level, s.id).then((e) => notify(e ?? `${s.name} appointed.`))}>Appoint</button></td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  )
}

export function Scouting() {
  const { w, cmd, notify, link } = useGame()
  const world = w!
  const scouts = useMemo(() => world.staff.filter((s) => s.role === 'scout').sort((a, b) => Number(!!b.job) - Number(!!a.job) || b.judging - a.judging), [world])
  const jobOf = (id: number) => world.scouts.find((j) => j.staffId === id)?.scope ?? ''
  const coverage = (scope: ScoutScope) => {
    const ps = world.players.filter((p) => !p.retired && p.nat.includes('IRN') && (scope === 'diaspora' ? p.iranStatus && p.iranStatus !== 'committed' : p.nat[0] === 'IRN'))
    return ps.length ? Math.round(ps.reduce((a, p) => a + p.known, 0) / ps.length) : 0
  }
  const finds = useMemo(() => world.players.filter((p) => !p.retired && p.iranStatus && p.iranStatus !== 'committed' && p.known >= 8).sort((a, b) => b.known - a.known).slice(0, 12), [world])
  return (
    <div className="page-inner">
      <div className="grid g3">
        {SCOUT_SCOPES.map((s) => { const n = world.scouts.filter((j) => j.scope === s.key).length; return (
          <div key={s.key} className="card"><div className="row"><h3>{s.name}</h3><span className={`pill right ${n ? 'green' : ''}`}>{n} scout{n === 1 ? '' : 's'}</span></div><div className="faint" style={{ fontSize: 12, margin: '4px 0 12px' }}>{s.blurb}</div></div>
        ) })}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="card flush"><div className="card-head"><h3>Scouts</h3><span className="faint">{world.scouts.length} / 8 employed · knowledge of all Iranian players {coverage('iran-top')}%</span></div>
          <table className="t"><thead><tr><th>Scout</th><th className="c">Age</th><th className="c">Judging</th><th className="r">Salary</th><th>Assignment</th></tr></thead><tbody>
            {scouts.map((s) => <tr key={s.id}><td><span className="row" style={{ gap: 9 }}><Flag code={s.nat} /><b>{s.name}</b></span></td><td className="c num">{age(world.day, s.dob)}</td><td className="c"><Skill v={s.judging} /></td><td className="r num">{money(s.wage)}</td>
              <td><select className="input" value={jobOf(s.id)} onChange={(e) => void cmd<string | null>('assignScout', s.id, e.target.value || null).then((er) => er && notify(er))}><option value="">Not employed</option>{SCOUT_SCOPES.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</select></td></tr>)}
          </tbody></table>
        </div>
        <div className="card flush"><div className="card-head"><h3>Dual nationals found</h3></div>
          {finds.length ? <table className="t"><tbody>{finds.map((p) => <tr key={p.id} className="click" onClick={() => link(`player:${p.id}`)}><td><b>{p.name}</b><div className="faint" style={{ fontSize: 11.5 }}>{p.pos[0]} · {age(world.day, p.dob)} · {p.clubId != null ? world.clubs[p.clubId].name : 'Free agent'}</div></td><td><span className="row" style={{ gap: 4 }}>{p.nat.map((n) => <Flag key={n} code={n} />)}</span></td><td className="r"><span className="pill blue">{p.iranStatus}</span></td></tr>)}</tbody></table> : <Empty>None yet. Put a scout on the diaspora search to find players abroad who could still choose Iran.</Empty>}
        </div>
      </div>
    </div>
  )
}

export function Federation() {
  const { w, cmd } = useGame()
  const world = w!
  const f = world.fed
  const Budget = ({ k, label, blurb }: { k: 'scoutBudget' | 'youthInvest'; label: string; blurb: string }) => (
    <div><div className="row" style={{ marginBottom: 8 }}><b>{label}</b><span className="right num">{money(f[k])} a year</span></div>
      <input type="range" min={0} max={3_000_000} step={100_000} value={f[k]} style={{ ['--v' as string]: `${(f[k] / 3_000_000) * 100}%` }} onChange={(e) => void cmd('setBudget', k, +e.target.value)} />
      <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>{blurb}</div></div>
  )
  return (
    <div className="page-inner">
      <div className="grid g4">
        <div className="card kpi"><span className="eyebrow">Balance</span><b>{money(f.budget)}</b><small>{f.income >= 0 ? '+' : ''}{money(f.income)} last month</small></div>
        {([['Board confidence', f.board], ['Supporters', f.fans], ['Media', f.media]] as const).map(([k, v]) => <div key={k} className="card kpi"><span className="eyebrow">{k}</span><b>{Math.round(v)}</b><div style={{ marginTop: 10 }}><Meter v={v} tone={tone(v)} /></div></div>)}
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 18 }}>
          <div className="card col" style={{ gap: 20 }}><h3>Annual programmes</h3>
            <Budget k="youthInvest" label="Youth development" blurb="Raises the quality of each summer's academy intake across Iranian clubs. The effect builds over years." />
            <Budget k="scoutBudget" label="Scouting network" blurb="Running costs for the scouting department, on top of scouts' salaries." />
          </div>
          <div className="card"><div className="row" style={{ marginBottom: 8 }}><h3>Europe pathway</h3><b className="right num" style={{ fontSize: 20 }}>{Math.round(f.pathway)}</b></div><Meter v={f.pathway} />
            <p className="muted" style={{ fontSize: 13 }}>A measure of how normal it is for Iranian players to build careers abroad. Each senior squad nudges it toward the share of call-ups playing at strong foreign clubs, with European leagues counting most. A high value makes ambitious players more willing to leave, more of them choose Europe over the Gulf, and fewer drift home early. Coaches who favour home-based players will pull it down while they pick the squad.</p></div>
          <div className="card flush"><div className="card-head"><h3>Honours and tournament record</h3></div>{world.history.length ? <table className="t"><tbody>{[...world.history].reverse().map((h, i) => <tr key={i}><td className="num faint">{h.year}</td><td><b>{h.comp}</b></td><td className="muted">{LEVEL_NAME[h.level]}</td><td className="r">{h.result}</td></tr>)}</tbody></table> : <Empty>No tournaments completed yet.</Empty>}</div>
        </div>
        <div className="card flush"><div className="card-head"><h3>Ledger</h3></div><table className="t"><tbody>{[...f.ledger].reverse().slice(0, 40).map((l, i) => <tr key={i}><td className="faint num">{fmtDay(l.day)}</td><td>{l.label}</td><td className="r num" style={{ color: l.amount < 0 ? '#fca5a5' : '#86efac' }}>{l.amount > 0 ? '+' : ''}{money(l.amount)}</td></tr>)}</tbody></table>{!f.ledger.length && <Empty>The first accounts arrive at the start of next month.</Empty>}</div>
      </div>
    </div>
  )
}
