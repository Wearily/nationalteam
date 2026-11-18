import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fmtDay } from '../../sim/core/date'
import { formAvg } from '../../sim/clubs/season'
import { groupTables } from '../../sim/comps/engine'
import type { GroupStage } from '../../sim/comps/types'
import { teamName } from '../../sim/intl/select'
import { openSlots } from '../../sim/intl/calendar'
import { LEVEL_NAME, type Fixture, type Level } from '../../sim/world/types'
import { Avatar, clubOf, Flag, FormDots, isAbroad, Meter, money, Ovr, PlayerLink, PosTag, Rating, tone } from '../bits'
import { FIFA_ISO } from '../flags'
import { useGame } from '../store'

export function ResultRow({ f, mine = 'n:IRN:senior' }: { f: Fixture; mine?: string }) {
  const w = useGame((s) => s.w)!
  const link = useGame((s) => s.link)
  const h = teamName(w, f.home)
  const a = teamName(w, f.away)
  const me = f.home === mine ? 0 : f.away === mine ? 1 : -1
  const diff = me === 0 ? f.hg - f.ag : f.ag - f.hg
  const pensWon = f.pens && me >= 0 ? f.pens[me as 0 | 1] > f.pens[(1 - me) as 0 | 1] : null
  const res = !f.played || me < 0 ? null : diff > 0 || pensWon === true ? 'W' : diff === 0 && pensWon == null ? 'D' : 'L'
  return (
    <div className="row" style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.045)', cursor: f.report != null ? 'pointer' : 'default' }} onClick={() => link(`fixture:${f.id}`)}>
      <span className="faint num" style={{ width: 76, fontSize: 12 }}>{fmtDay(f.day, false)}</span>
      <span className="grow row" style={{ justifyContent: 'flex-end', fontWeight: f.home === mine ? 650 : 480 }}><span className="truncate">{h.name}</span>{f.home.startsWith('n:') && <Flag code={f.home.split(':')[1]} />}</span>
      <span className="mono center" style={{ width: 62, fontWeight: 700 }}>{f.played ? `${f.hg} – ${f.ag}` : 'v'}</span>
      <span className="grow row" style={{ fontWeight: f.away === mine ? 650 : 480 }}>{f.away.startsWith('n:') && <Flag code={f.away.split(':')[1]} />}<span className="truncate">{a.name}</span></span>
      <span style={{ width: 86 }} className="faint truncate">{w.comps[f.compId].short}</span>
      {res ? <span className={`pill ${res === 'W' ? 'green' : res === 'L' ? 'red' : 'amber'}`}>{res}</span> : <span style={{ width: 28 }} />}
    </div>
  )
}

const NEWS_KIND: Record<string, [string, string]> = { transfer: ['Transfer', 'blue'], form: ['Form', 'green'], result: ['Result', 'amber'], injury: ['Injury', 'red'], intl: ['Iran', ''] }

/** FM-style running feed: transfers, club performances, form streaks, injuries and Iran results. */
export function NewsFeed() {
  const { w, link, go } = useGame()
  const world = w!
  const [kind, setKind] = useState('all')
  const items = [...(world.news ?? [])].reverse().filter((n) => kind === 'all' || n.kind === kind).slice(0, 14)
  const ago = (d: number) => { const k = world.day - d; return k === 0 ? 'Today' : k === 1 ? 'Yesterday' : k < 7 ? `${k} days ago` : fmtDay(d, false) }
  return (
    <div className="card">
      <div className="card-head"><h3>News</h3><button className="btn sm ghost right" onClick={() => go({ name: 'inbox' })}>Inbox <ChevronRight /></button></div>
      <div className="seg" style={{ marginBottom: 10 }}>{['all', 'form', 'result', 'transfer', 'injury', 'intl'].map((k) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k === 'all' ? 'All' : NEWS_KIND[k][0]}</button>)}</div>
      {items.length === 0 && <div className="faint" style={{ padding: '10px 0' }}>Nothing to report yet. Stories appear here as club football is played.</div>}
      {items.map((n, i) => {
        const p = n.playerId != null ? world.players[n.playerId] : null
        return (
          <div key={i} className="row" style={{ padding: '10px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none', alignItems: 'flex-start', cursor: n.link ? 'pointer' : 'default' }} onClick={() => link(n.link)}>
            {p ? <Avatar p={p} size={38} /> : <span className="flag fi fi-ir" style={{ width: 38, height: 26, borderRadius: 5, marginTop: 6 }} />}
            <div className="grow"><div style={{ lineHeight: 1.4 }}>{n.text}</div><div className="row" style={{ gap: 8, marginTop: 4 }}><span className={`pill ${NEWS_KIND[n.kind][1]}`}>{NEWS_KIND[n.kind][0]}</span><span className="faint" style={{ fontSize: 12 }}>{ago(n.day)}</span></div></div>
          </div>
        )
      })}
    </div>
  )
}

/** Things that need the president's attention, most urgent first. */
export function Tasks() {
  const { w, go } = useGame()
  const world = w!
  const tasks = useMemo(() => {
    const out: { tone: string; title: string; sub: string; go: () => void; rank: number }[] = []
    const manual = Object.values(world.teams).filter((t) => t.control === 'manual')
    for (const f of world.fixtures) {
      if (f.played || f.day !== world.day) continue
      const ref = [f.home, f.away].find((r) => r.startsWith('n:IRN:'))
      if (ref && world.teams[ref.split(':')[2] as Level].control === 'manual') out.push({ tone: 'red', title: `Match day: ${teamName(world, f.home).name} v ${teamName(world, f.away).name}`, sub: `${world.comps[f.compId].name}. Pick the eleven and kick off.`, go: () => go({ name: 'match', fixtureId: f.id }), rank: 0 })
    }
    for (const c of world.camps) {
      if (c.done || c.announced || world.teams[c.level].control !== 'manual') continue
      const d = c.from - world.day
      if (d <= 0) out.push({ tone: 'red', title: `Name the ${LEVEL_NAME[c.level]} squad`, sub: `${c.label} · up to ${c.size} players · first match ${fmtDay(c.first, false)}`, go: () => go({ name: 'teams', level: c.level, tab: 'callup' }), rank: 1 })
      else if (d <= 21) out.push({ tone: 'amber', title: `${LEVEL_NAME[c.level]} squad due in ${d} day${d === 1 ? '' : 's'}`, sub: `${c.label} · first match ${fmtDay(c.first, false)}`, go: () => go({ name: 'teams', level: c.level, tab: 'callup' }), rank: 3 })
    }
    for (const t of manual) {
      const open = openSlots(world, t.level).filter((sl) => sl.day - world.day <= 150)
      if (open.length) out.push({ tone: open[0].day - world.day <= 45 ? 'amber' : 'blue', title: `${open.length} open ${LEVEL_NAME[t.level]} match date${open.length === 1 ? '' : 's'}`, sub: `${open[0].window} window from ${fmtDay(open[0].day, false)}. Arrange friendlies or leave the dates free.`, go: () => go({ name: 'calendar' }), rank: open[0].day - world.day <= 45 ? 2 : 6 })
    }
    for (const t of Object.values(world.teams)) {
      if (t.coachId == null) out.push({ tone: 'amber', title: `No ${LEVEL_NAME[t.level]} head coach`, sub: 'Appoint someone to run the team.', go: () => go({ name: 'staff' }), rank: 4 })
      else if (world.staff[t.coachId].contractEnd - world.day < 60) out.push({ tone: 'blue', title: `${world.staff[t.coachId].name}'s contract is running out`, sub: `${LEVEL_NAME[t.level]} head coach, until ${fmtDay(world.staff[t.coachId].contractEnd, false)}. Renews automatically unless you replace him.`, go: () => go({ name: 'staff' }), rank: 7 })
    }
    if (!world.scouts.length) out.push({ tone: 'blue', title: 'No scouts are working', sub: 'Many players are only known as rating ranges. Assign scouts to regions.', go: () => go({ name: 'scouting' }), rank: 5 })
    const keen = world.players.filter((p) => p.iranStatus === 'interested' && !p.retired)
    if (keen.length) out.push({ tone: 'green', title: `${keen.length} dual national${keen.length === 1 ? ' is' : 's are'} open to Iran`, sub: `${keen.slice(0, 3).map((p) => p.name).join(', ')}. A second approach may settle it.`, go: () => go({ name: 'scouting' }), rank: 5 })
    if (world.fed.budget < 0) out.push({ tone: 'red', title: 'The federation is in deficit', sub: 'Cut programme spending or the board will lose patience.', go: () => go({ name: 'federation' }), rank: 2 })
    const unread = world.inbox.filter((m) => !m.read && m.important).length
    if (unread) out.push({ tone: 'blue', title: `${unread} important message${unread === 1 ? '' : 's'} unread`, sub: 'Open the inbox.', go: () => go({ name: 'inbox' }), rank: 8 })
    return out.sort((a, b) => a.rank - b.rank)
  }, [world, go])
  return (
    <div className="card">
      <div className="card-head"><h3>To do</h3><span className={`pill right ${tasks.some((t) => t.tone === 'red') ? 'red' : ''}`}>{tasks.length}</span></div>
      {tasks.length === 0 && <div className="faint">Nothing needs you right now. Press Continue.</div>}
      {tasks.slice(0, 7).map((t, i) => (
        <button key={i} className="row" style={{ width: '100%', textAlign: 'left', padding: '10px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none', alignItems: 'flex-start' }} onClick={t.go}>
          <span style={{ width: 9, height: 9, borderRadius: 9, marginTop: 6, flex: 'none', background: t.tone === 'red' ? 'var(--red)' : t.tone === 'amber' ? 'var(--gold)' : t.tone === 'green' ? 'var(--green)' : 'var(--cyan)' }} />
          <span className="grow"><b style={{ fontWeight: 650 }}>{t.title}</b><span className="faint" style={{ display: 'block', fontSize: 12.5 }}>{t.sub}</span></span>
          <ChevronRight size={16} className="faint" style={{ marginTop: 3 }} />
        </button>
      ))}
    </div>
  )
}

export function Home() {
  const { w, go, link } = useGame()
  const world = w!
  const iran = world.nations.IRN
  const ref = 'n:IRN:senior'
  const { next, recent } = useMemo(() => {
    const mine = world.fixtures.filter((f) => f.home === ref || f.away === ref)
    return { next: mine.filter((f) => !f.played).sort((a, b) => a.day - b.day)[0], recent: mine.filter((f) => f.played).sort((a, b) => b.day - a.day).slice(0, 6) }
  }, [world])
  const inForm = useMemo(() => world.players.filter((p) => p.nat[0] === 'IRN' && !p.retired && p.form.length >= 4 && p.known >= 60).sort((a, b) => formAvg(b) + b.ovr / 40 - (formAvg(a) + a.ovr / 40)).slice(0, 7), [world])
  const comp = world.comps.find((c) => c.scope === 'nat' && c.level === 'senior' && !c.friendly && !c.done)
  const grp = useMemo(() => {
    if (!comp || comp.stages[0].type !== 'groups') return null
    const gi = (comp.stages[0] as GroupStage).groups.findIndex((g) => g.includes(ref))
    return gi < 0 ? null : { gi, rows: groupTables(world, comp, 0)[gi] }
  }, [world, comp])
  const abroad = world.players.filter((p) => p.nat[0] === 'IRN' && !p.retired && isAbroad(world, p) && p.ovr >= 60)
  const europe = abroad.filter((p) => world.nations[clubOf(world, p)!.country]?.confed === 'UEFA').length
  const opp = next ? teamName(world, next.home === ref ? next.away : next.home) : null
  const oppCode = next ? (next.home === ref ? next.away : next.home).split(':')[1] : ''
  const moved = iran.prevRank - iran.rank
  return (
    <div className="page-inner">
      <div className="grid g-main">
        <div className="hero">
          {next && opp ? (
            <>
              <div className="row"><span className="eyebrow">Next match · {world.comps[next.compId].name}</span><span className="pill right">{fmtDay(next.day)}</span></div>
              <div className="row" style={{ justifyContent: 'center', gap: 44, padding: '30px 0 24px' }}>
                <div className="col center" style={{ alignItems: 'center', gap: 12 }}><span className="flag xl fi fi-ir" /><h1>Iran</h1><span className="muted">#{iran.rank} in the world</span></div>
                <div className="col center" style={{ alignItems: 'center' }}><span className="faint" style={{ fontSize: 13, fontWeight: 600 }}>{next.neutral ? 'Neutral venue' : next.home === ref ? 'Home' : 'Away'}</span><span style={{ fontSize: 34, fontWeight: 300, opacity: 0.5 }}>vs</span><span className="pill blue">{next.day - world.day === 0 ? 'Today' : `in ${next.day - world.day} days`}</span></div>
                <div className="col center" style={{ alignItems: 'center', gap: 12 }}><span className={`flag xl fi fi-${FIFA_ISO[oppCode] ?? 'xx'}`} /><h1>{opp.name}</h1><span className="muted">#{world.nations[oppCode]?.rank ?? '–'} in the world</span></div>
              </div>
              <div className="row" style={{ justifyContent: 'center' }}>
                {next.day - world.day > 60 && world.teams.senior.control === 'manual' && <button className="btn primary" onClick={() => go({ name: 'calendar' })}>Arrange friendlies</button>}
                <button className="btn" onClick={() => go({ name: 'teams', level: 'senior', tab: 'callup' })}>Squad</button>
                <button className="btn" onClick={() => go({ name: 'teams', level: 'senior', tab: 'tactics' })}>Tactics</button>
                <button className="btn" onClick={() => go({ name: 'comps', id: next.compId })}>Competition <ChevronRight /></button>
              </div>
            </>
          ) : <div className="col center" style={{ alignItems: 'center', gap: 14, padding: '34px 0' }}><span className="eyebrow">Senior team</span><h1 style={{ fontSize: 34 }}>No match booked</h1><span className="muted" style={{ maxWidth: 460 }}>The next international window is open. Choose opponents for the dates you want to use.</span><button className="btn primary go" onClick={() => go({ name: 'calendar' })}>Arrange friendlies <ChevronRight /></button></div>}
        </div>
        <div className="card col" style={{ gap: 16 }}>
          <div className="row"><h3>Standing</h3><button className="btn sm ghost right" onClick={() => go({ name: 'federation' })}>Federation <ChevronRight /></button></div>
          {([['Board', world.fed.board], ['Supporters', world.fed.fans], ['Media', world.fed.media]] as const).map(([k, v]) => (
            <div key={k}><div className="row" style={{ marginBottom: 6 }}><span className="muted">{k}</span><b className="right num">{Math.round(v)}</b></div><Meter v={v} tone={tone(v)} /></div>
          ))}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <div className="row" style={{ marginBottom: 6 }}><span className="muted">Europe pathway</span><b className="right num">{Math.round(world.fed.pathway)}</b></div>
            <Meter v={world.fed.pathway} />
            <div className="faint" style={{ fontSize: 11.5, marginTop: 7 }}>Rises when senior call-ups reward players at strong foreign clubs; it makes the next generation readier to move abroad.</div>
          </div>
        </div>
      </div>
      <div className="grid g4">
        <div className="card kpi"><span className="eyebrow">FIFA ranking</span><b className="row">{iran.rank}{moved !== 0 && <span className={`pill ${moved > 0 ? 'green' : 'red'}`}>{moved > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(moved)}</span>}</b><small>{iran.points.toFixed(1)} points</small></div>
        <div className="card kpi"><span className="eyebrow">Budget</span><b>{money(world.fed.budget)}</b><small>{world.fed.income >= 0 ? '+' : ''}{money(world.fed.income)} last month</small></div>
        <div className="card kpi"><span className="eyebrow">Players abroad</span><b>{abroad.length}</b><small>{europe} in Europe · rated 60+</small></div>
        <div className="card kpi"><span className="eyebrow">Teams you manage</span><b>{Object.values(world.teams).filter((t) => t.control === 'manual').length}<span className="faint" style={{ fontSize: 16 }}> / 8</span></b><small>{Object.values(world.teams).filter((t) => t.control === 'manual').map((t) => LEVEL_NAME[t.level]).join(', ') || 'All run by coaches'}</small></div>
      </div>
      <div className="grid g-main">
        <div className="col" style={{ gap: 18 }}>
          <div className="card">
            <div className="card-head"><h3>Recent results</h3><button className="btn sm ghost right" onClick={() => go({ name: 'calendar' })}>Calendar <ChevronRight /></button></div>
            {recent.length ? recent.map((f) => <ResultRow key={f.id} f={f} />) : <div className="faint">No matches played yet under your presidency.</div>}
          </div>
          <div className="card flush">
            <div className="card-head"><h3>In form</h3><span className="faint">last five matches, club and country</span></div>
            <table className="t"><tbody>
              {inForm.map((p) => (
                <tr key={p.id} className="click" onClick={() => link(`player:${p.id}`)}>
                  <td><PlayerLink p={p} sub={clubOf(world, p)?.name ?? 'Free agent'} /></td><td><PosTag pos={p.pos[0]} /></td><td className="c"><Ovr p={p} /></td>
                  <td className="c num">{p.club.goals}<span className="faint"> G</span> {p.club.assists}<span className="faint"> A</span></td><td className="c"><FormDots form={p.form} /></td><td className="r"><Rating v={formAvg(p)} /></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
        <div className="col" style={{ gap: 18 }}>
          <Tasks />
          <NewsFeed />
          {grp && comp && (
            <div className="card flush">
              <div className="card-head"><h3>{comp.short} · Group {'ABCDEFGH'[grp.gi]}</h3><button className="btn sm ghost right" onClick={() => go({ name: 'comps', id: comp.id })}>Full <ChevronRight /></button></div>
              <table className="t"><thead><tr><th>Team</th><th className="c">P</th><th className="c">GD</th><th className="c">Pts</th></tr></thead><tbody>
                {grp.rows.map((r, i) => <tr key={r.team} className={`${r.team === ref ? 'hl' : ''} ${i < 2 ? 'qual-1' : i === 2 ? 'qual-2' : ''}`}><td><span className="row"><Flag code={r.team.split(':')[1]} />{teamName(world, r.team).name}</span></td><td className="c num">{r.p}</td><td className="c num">{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td><td className="c num"><b>{r.pts}</b></td></tr>)}
              </tbody></table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
