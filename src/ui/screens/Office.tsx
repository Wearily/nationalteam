import { useMemo, useState } from 'react'
import { fmtDay, ymd } from '../../sim/core/date'
import { SCOUT_SCOPES, type ScoutScope, type World } from '../../sim/world/state'
import { LEVEL_NAME, LEVELS, type Level, type Staff as StaffT } from '../../sim/world/types'
import { Empty, Flag, Meter, money, tone } from '../bits'
import { useGame } from '../store'

const Skill = ({ v }: { v: number }) => <span className="num" style={{ fontWeight: 680, color: v >= 15 ? '#86efac' : v >= 11 ? '#fde047' : '#fdba74' }}>{v}</span>
const age = (day: number, dob: number) => Math.floor((day - dob) / 365.25)

/** Results of an Iran team since its current coach took charge. */
function recordOf(world: World, level: Level, since: number) {
  const ref = `n:IRN:${level}`
  const r = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }
  for (const f of world.fixtures) {
    if (!f.played || f.day < since || (f.home !== ref && f.away !== ref)) continue
    const home = f.home === ref
    const [us, them] = home ? [f.hg, f.ag] : [f.ag, f.hg]
    const pens = f.pens ? (home ? f.pens[0] > f.pens[1] : f.pens[1] > f.pens[0]) : null
    r.p++; r.gf += us; r.ga += them
    if (us > them || pens === true) r.w++
    else if (us < them || pens === false) r.l++
    else r.d++
  }
  return r
}

export function Staff() {
  const { w, cmd, notify } = useGame()
  const world = w!
  const [level, setLevel] = useState<Level>('senior')
  const current = world.teams[level].coachId != null ? world.staff[world.teams[level].coachId!] : null
  // candidates: free agents, plus coaches of Iran's other teams who could be moved across
  const coaches = useMemo(() => world.staff.filter((s) => s.role === 'coach' && s.id !== current?.id && (!s.job || s.job.startsWith('nation:IRN'))).sort((a, b) => b.rep - a.rep), [world, current])
  const bias = (s: StaffT) => (s.abroadBias > 0.25 ? 'Abroad-based' : s.abroadBias < -0.25 ? 'Home-based' : 'Balanced')
  const Cmp = ({ v, k }: { v: number; k: 'tactics' | 'motivation' | 'youth' | 'judging' }) => {
    const d = current ? v - current[k] : 0
    return <span className="row" style={{ gap: 4, justifyContent: 'center' }}><Skill v={v} />{d !== 0 && <span className={`ovr-d ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}</span>}</span>
  }
  return (
    <div className="page-inner">
      <div className="grid g4">
        {LEVELS.map((l) => {
          const t = world.teams[l]
          const c = t.coachId != null ? world.staff[t.coachId] : null
          const r = recordOf(world, l, c?.since ?? world.startDay)
          return (
            <button key={l} className="card" style={{ textAlign: 'left', padding: 16, outline: level === l ? '1.5px solid rgba(255,255,255,0.55)' : 'none' }} onClick={() => setLevel(l)}>
              <div className="row"><span className="eyebrow">{LEVEL_NAME[l]}</span><span className={`pill right ${t.control === 'manual' ? 'blue' : ''}`}>{t.control === 'manual' ? 'You manage' : 'Coach manages'}</span></div>
              <div className="row" style={{ marginTop: 8, gap: 8 }}>{c && <Flag code={c.nat} />}<b style={{ fontSize: 16 }} className="truncate">{c?.name ?? 'Vacant'}</b></div>
              <div className="faint" style={{ fontSize: 12.5 }}>{c ? `${c.formation} · ${bias(c)} · contract to ${ymd(c.contractEnd).y}` : 'Appoint a head coach'}</div>
              {c && <>
                <div className="row" style={{ marginTop: 12, gap: 0, justifyContent: 'space-between' }}>
                  {([['Tac', c.tactics], ['Mot', c.motivation], ['Yth', c.youth], ['Jud', c.judging]] as const).map(([k, v]) => <span key={k} className="col center" style={{ gap: 1 }}><Skill v={v} /><span className="faint" style={{ fontSize: 10.5 }}>{k}</span></span>)}
                  <span className="col center" style={{ gap: 1 }}><b className="num">{Math.round(c.rep)}</b><span className="faint" style={{ fontSize: 10.5 }}>Rep</span></span>
                </div>
                <div className="row" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
                  {r.p ? <><b className="num">{r.w}W {r.d}D {r.l}L</b><span className="faint num">{r.gf}–{r.ga}</span><span className="pill right">{Math.round((r.w / r.p) * 100)}% won</span></> : <span className="faint">No matches yet</span>}
                </div>
              </>}
            </button>
          )
        })}
      </div>
      <div className="card flush">
        <div className="card-head"><h3>Candidates for the {LEVEL_NAME[level]} job</h3><span className="faint">{current ? `Arrows compare each candidate with ${current.name}` : 'The post is vacant'} · signing fee of half a year's salary</span></div>
        <table className="t"><thead><tr><th>Coach</th><th className="c">Age</th><th className="c">Reputation</th><th className="c">Tactics</th><th className="c">Motivation</th><th className="c">Youth</th><th className="c">Judging</th><th>Formation</th><th>Selection leaning</th><th>Status</th><th className="r">Salary</th><th /></tr></thead><tbody>
          {current && (
            <tr className="hl"><td><span className="row" style={{ gap: 9 }}><Flag code={current.nat} /><b>{current.name}</b><span className="pill green">In the job</span></span></td><td className="c num">{age(world.day, current.dob)}</td><td className="c" style={{ width: 120 }}><Meter v={current.rep} /></td><td className="c"><Skill v={current.tactics} /></td><td className="c"><Skill v={current.motivation} /></td><td className="c"><Skill v={current.youth} /></td><td className="c"><Skill v={current.judging} /></td><td>{current.formation}</td><td className="muted">{bias(current)}</td><td className="muted">Iran {LEVEL_NAME[level]}</td><td className="r num">{money(current.wage)}</td><td /></tr>
          )}
          {coaches.map((s) => (
            <tr key={s.id}><td><span className="row" style={{ gap: 9 }}><Flag code={s.nat} /><b>{s.name}</b></span></td><td className="c num">{age(world.day, s.dob)}</td><td className="c" style={{ width: 120 }}><Meter v={s.rep} /></td><td className="c"><Cmp v={s.tactics} k="tactics" /></td><td className="c"><Cmp v={s.motivation} k="motivation" /></td><td className="c"><Cmp v={s.youth} k="youth" /></td><td className="c"><Cmp v={s.judging} k="judging" /></td><td>{s.formation}</td><td className="muted">{bias(s)}</td>
              <td className="muted">{s.job ? `Iran ${LEVEL_NAME[s.job.split(':')[2] as Level]} coach` : 'Available'}</td><td className="r num">{money(s.wage)}</td>
              <td className="r"><button className="btn sm" onClick={() => void cmd<string | null>('hireCoach', level, s.id).then((e) => notify(e ?? `${s.name} appointed.`))}>{s.job ? 'Move here' : 'Appoint'}</button></td></tr>
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
