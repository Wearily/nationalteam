import { ChevronRight, Monitor } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fmtDay, fmtDow } from './sim/core/date'
import { teamName } from './sim/intl/select'
import { LEVEL_NAME, type Level } from './sim/world/types'
import { clearSave, loadSaved, useGame, type Route } from './ui/store'
import { Home } from './ui/screens/Home'
import { Inbox } from './ui/screens/Inbox'
import { Pool } from './ui/screens/Pool'
import { Teams } from './ui/screens/Teams'
import { PlayerProfile } from './ui/screens/PlayerDrawer'
import { MatchCentre, ReportView } from './ui/screens/Match'
import { Calendar, Comps } from './ui/screens/Comps'
import { Rankings, Transfers, WorldLeagues } from './ui/screens/World'
import { Federation, Scouting, Staff } from './ui/screens/Office'

type Name = Route['name']
const NAV: { label: string; items: { name: Name; label: string }[] }[] = [
  { label: 'Home', items: [{ name: 'home', label: 'Overview' }, { name: 'inbox', label: 'Inbox' }, { name: 'calendar', label: 'Calendar' }] },
  { label: 'Squad', items: [{ name: 'teams', label: 'National teams' }, { name: 'pool', label: 'National pool' }] },
  { label: 'Recruitment', items: [{ name: 'scouting', label: 'Scouting' }, { name: 'transfers', label: 'Transfers' }] },
  { label: 'Competitions', items: [{ name: 'comps', label: 'Tournaments' }, { name: 'rankings', label: 'FIFA ranking' }, { name: 'world', label: 'Leagues' }] },
  { label: 'Federation', items: [{ name: 'federation', label: 'Office' }, { name: 'staff', label: 'Coaches' }] },
]

function Mark({ size = 38 }: { size?: number }) {
  return <div className="brand-mark" style={{ width: size, height: size }}><span style={{ width: size * 0.64, height: size * 0.64, fontSize: size * 0.27 }}>TM</span></div>
}

function Start() {
  const { newGame, resume, busy } = useGame()
  const [name, setName] = useState('')
  const [hasSave, setHasSave] = useState(false)
  useEffect(() => { void loadSaved().then((w) => setHasSave(!!w)) }, [])
  return (
    <div className="start">
      <div className="start-card">
        <Mark size={56} />
        <h1>Team Melli<br />Manager</h1>
        <p className="muted" style={{ fontSize: 16, margin: '0 0 26px' }}>Run Iran's football federation. Hire the coaches, shape every national team from the under-15s to the seniors, and chase the Asian Cup and the World Cup.</p>
        <div className="col" style={{ gap: 12 }}>
          {hasSave && <button className="btn primary go" onClick={() => void resume()}>Continue career <ChevronRight /></button>}
          <div className="row">
            <input className="input grow" style={{ height: 42 }} placeholder="Your name" value={name} maxLength={28} onChange={(e) => setName(e.target.value)} />
            <button className={`btn go ${hasSave ? '' : 'primary'}`} disabled={!!busy || !name.trim()} onClick={() => void (async () => { if (hasSave) await clearSave(); await newGame(name.trim()) })()}>{busy ? <span className="spinner" /> : 'New career'}</button>
          </div>
          <span className="faint" style={{ fontSize: 13 }}>Starts 18 November 2026, with a year to build towards the Asian Cup in Saudi Arabia.{hasSave ? ' Starting a new career replaces the saved one.' : ''}</span>
        </div>
      </div>
    </div>
  )
}

function NextChip() {
  const w = useGame((s) => s.w)!
  const next = useMemo(() => {
    let best = null as null | (typeof w.fixtures)[number]
    for (const f of w.fixtures) if (!f.played && f.day >= w.day && (f.home === 'n:IRN:senior' || f.away === 'n:IRN:senior') && (!best || f.day < best.day)) best = f
    return best
  }, [w])
  if (!next) return null
  const opp = teamName(w, next.home === 'n:IRN:senior' ? next.away : next.home)
  const d = next.day - w.day
  return (
    <div className="next-chip">
      <span className="eyebrow">Next</span>
      <span className="truncate"><b>{next.home === 'n:IRN:senior' ? 'vs' : 'at'} {opp.name}</b> <span className="muted">· {w.comps[next.compId].short}</span></span>
      <span className="pill">{d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d} days`}</span>
    </div>
  )
}

export default function App() {
  const { w, route, go, playerId, busy, toast, cont } = useGame()
  const unread = w ? w.inbox.filter((m) => !m.read).length : 0
  const pendingSquad = w?.camps.find((c) => !c.done && !c.announced && c.from <= w.day && w.teams[c.level].control === 'manual')
  const todayMatch = w?.fixtures.find((f) => !f.played && f.day === w.day && [f.home, f.away].some((r) => r.startsWith('n:IRN:') && w.teams[r.split(':')[2] as Level].control === 'manual'))
  const small = (
    <div className="small-screen">
      <div style={{ maxWidth: 360 }}>
        <Monitor size={34} style={{ opacity: 0.7 }} />
        <h2 style={{ margin: '14px 0 8px' }}>Built for desktop</h2>
        <p className="muted">Team Melli Manager needs a larger screen. Open it on a laptop or desktop with a window at least 1180 pixels wide.</p>
      </div>
    </div>
  )
  if (!w) return <>{small}<Start /></>
  let label = 'Continue'
  let action: () => void = () => void cont()
  if (route.name === 'match') { label = 'Match in progress'; action = () => {} } else if (pendingSquad) { label = `Name ${LEVEL_NAME[pendingSquad.level]} squad`; action = () => go({ name: 'teams', level: pendingSquad.level, tab: 'callup' }) } else if (todayMatch) { label = 'Go to match'; action = () => go({ name: 'match', fixtureId: todayMatch.id }) }
  const group = NAV.find((g) => g.items.some((i) => i.name === route.name)) ?? (route.name === 'match' || route.name === 'report' ? null : NAV[0])
  return (
    <>
      {small}
      <div className="app">
        <header className="top">
          <div className="brand"><Mark /><b>Team Melli</b></div>
          <nav className="pnav">
            {NAV.map((g) => <button key={g.label} className={g === group ? 'on' : ''} onClick={() => go({ name: g.items[0].name } as Route)}>{g.label}{g.label === 'Home' && unread > 0 && <span className="badge">{unread}</span>}</button>)}
            {!group && <button className="on">{route.name === 'match' ? 'Match day' : 'Match report'}</button>}
          </nav>
          <div className="grow" />
          <NextChip />
          <div className="date-chip"><b>{fmtDay(w.day)}</b><span className="faint" style={{ fontSize: 12.5 }}>{fmtDow(w.day)} · Iran #{w.nations.IRN.rank}</span></div>
          <button className="btn primary go" disabled={!!busy || route.name === 'match'} onClick={action}>{busy ? <span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: '#000' }} /> : null}{label}<ChevronRight /></button>
        </header>
        <div className="subnav">
          {group ? group.items.map((it) => <button key={it.name} className={route.name === it.name ? 'on' : ''} onClick={() => go({ name: it.name } as Route)}>{it.label}{it.name === 'inbox' && unread > 0 ? ` (${unread})` : ''}</button>) : <span className="muted">{w.managerName} · Federation president</span>}
          <span className="right faint" style={{ fontSize: 13 }}>{group ? `${w.managerName} · Federation president` : ''}</span>
        </div>
        <main className="page" key={route.name + (('level' in route && route.level) || '')}>
          {route.name === 'home' && <Home />}
          {route.name === 'inbox' && <Inbox />}
          {route.name === 'teams' && <Teams level={(route.level as Level) ?? 'senior'} tab={route.tab} />}
          {route.name === 'pool' && <Pool />}
          {route.name === 'scouting' && <Scouting />}
          {route.name === 'calendar' && <Calendar />}
          {route.name === 'comps' && <Comps id={route.id} />}
          {route.name === 'rankings' && <Rankings />}
          {route.name === 'world' && <WorldLeagues league={route.league} />}
          {route.name === 'transfers' && <Transfers />}
          {route.name === 'staff' && <Staff />}
          {route.name === 'federation' && <Federation />}
          {route.name === 'match' && <MatchCentre fixtureId={route.fixtureId} />}
          {route.name === 'report' && <ReportView id={route.id} />}
        </main>
      </div>
      {playerId != null && <PlayerProfile id={playerId} />}
      {busy && <div className="busy"><div className="card row"><span className="spinner" />{busy}</div></div>}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
