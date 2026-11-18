import { Building2, CalendarDays, ChevronRight, Globe2, Home as HomeIcon, Inbox as InboxIcon, ListOrdered, Monitor, Radar, Repeat, Shield, Trophy, UserCog, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fmtDay, fmtDow } from './sim/core/date'
import { teamName } from './sim/intl/select'
import { LEVEL_NAME, type Level } from './sim/world/types'
import { clearSave, loadSaved, useGame, type Route } from './ui/store'
import { Home } from './ui/screens/Home'
import { Inbox } from './ui/screens/Inbox'
import { Pool } from './ui/screens/Pool'
import { Teams } from './ui/screens/Teams'
import { PlayerDrawer } from './ui/screens/PlayerDrawer'
import { MatchCentre, ReportView } from './ui/screens/Match'
import { Calendar, Comps } from './ui/screens/Comps'
import { Rankings, Transfers, WorldLeagues } from './ui/screens/World'
import { Federation, Scouting, Staff } from './ui/screens/Office'

const NAV: { sec: string; items: { name: Route['name']; label: string; icon: typeof HomeIcon }[] }[] = [
  { sec: 'Federation', items: [{ name: 'home', label: 'Home', icon: HomeIcon }, { name: 'inbox', label: 'Inbox', icon: InboxIcon }, { name: 'federation', label: 'Federation', icon: Building2 }, { name: 'staff', label: 'Coaches', icon: UserCog }] },
  { sec: 'Football', items: [{ name: 'teams', label: 'National teams', icon: Shield }, { name: 'pool', label: 'National pool', icon: Users }, { name: 'scouting', label: 'Scouting', icon: Radar }, { name: 'calendar', label: 'Calendar', icon: CalendarDays }] },
  { sec: 'World', items: [{ name: 'comps', label: 'Competitions', icon: Trophy }, { name: 'rankings', label: 'FIFA ranking', icon: ListOrdered }, { name: 'world', label: 'Leagues', icon: Globe2 }, { name: 'transfers', label: 'Transfers', icon: Repeat }] },
]
const TITLES: Record<string, string> = { home: 'Home', inbox: 'Inbox', federation: 'Federation', staff: 'Coaches', teams: 'National teams', pool: 'National pool', scouting: 'Scouting', calendar: 'Calendar', comps: 'Competitions', rankings: 'FIFA world ranking', world: 'Leagues', transfers: 'Transfers', match: 'Match day', report: 'Match report' }

function Start() {
  const { newGame, resume, busy } = useGame()
  const [name, setName] = useState('')
  const [hasSave, setHasSave] = useState(false)
  useEffect(() => { void loadSaved().then((w) => setHasSave(!!w)) }, [])
  return (
    <div className="start">
      <div className="start-card">
        <div className="brand-mark" style={{ width: 52, height: 52, borderRadius: 15 }}><span style={{ width: 18, height: 18 }} /></div>
        <h1>Team Melli<br />Manager</h1>
        <p className="muted" style={{ fontSize: 15, margin: '0 0 26px' }}>Run Iran's football federation. Hire the coaches, shape every national team from the under-15s to the seniors, and chase the Asian Cup and the World Cup.</p>
        <div className="col" style={{ gap: 12 }}>
          {hasSave && <button className="btn primary go" onClick={() => void resume()}>Continue career <ChevronRight /></button>}
          <div className="row">
            <input className="input grow" style={{ height: 40 }} placeholder="Your name" value={name} maxLength={28} onChange={(e) => setName(e.target.value)} />
            <button className={`btn go ${hasSave ? '' : 'primary'}`} disabled={!!busy || !name.trim()} onClick={() => void (async () => { if (hasSave) await clearSave(); await newGame(name.trim()) })()}>{busy ? <span className="spinner" /> : 'New career'}</button>
          </div>
          <span className="faint" style={{ fontSize: 12 }}>Starts 18 November 2026, with a year to build towards the Asian Cup in Saudi Arabia.{hasSave ? ' Starting a new career replaces the saved one.' : ''}</span>
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
  return (
    <>
      {small}
      <div className="app">
        <aside className="rail">
          <div className="brand"><div className="brand-mark"><span /></div><div><b>Team Melli</b><small>Federation office</small></div></div>
          <nav className="nav">
            {NAV.map((sec) => (
              <div key={sec.sec} className="col" style={{ gap: 2 }}>
                <div className="eyebrow nav-sec">{sec.sec}</div>
                {sec.items.map((it) => (
                  <button key={it.name} className={route.name === it.name ? 'on' : ''} onClick={() => go({ name: it.name } as Route)}>
                    <it.icon />{it.label}{it.name === 'inbox' && unread > 0 && <span className="badge">{unread}</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="rail-foot">
            <div style={{ fontWeight: 600 }}>{w.managerName}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>Federation president · Iran #{w.nations.IRN.rank}</div>
          </div>
        </aside>
        <div className="main">
          <header className="top">
            <h2>{TITLES[route.name]}</h2>
            <div className="grow" />
            <NextChip />
            <div className="date-chip"><b>{fmtDay(w.day)}</b><span className="faint" style={{ fontSize: 11.5 }}>{fmtDow(w.day)}</span></div>
            <button className="btn primary go" disabled={!!busy || route.name === 'match'} onClick={action}>{busy ? <span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: '#000' }} /> : null}{label}<ChevronRight /></button>
          </header>
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
      </div>
      {playerId != null && <PlayerDrawer id={playerId} />}
      {busy && <div className="busy"><div className="card row"><span className="spinner" />{busy}</div></div>}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
