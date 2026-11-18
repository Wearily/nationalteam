import { FastForward, Pause, Play, Settings2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LiveChunk } from '../../sim/game'
import { teamName } from '../../sim/intl/select'
import type { Tactic } from '../../sim/match/tactics'
import type { Frame, MatchSnapshot, MEvent, PStats, ShotRec, TStats } from '../../sim/match/types'
import { LEVEL_NAME, type Level } from '../../sim/world/types'
import { Empty, Flag, OvrNum, PosTag, ratingColor } from '../bits'
import { sim, useGame } from '../store'
import { normaliseTactic, TacticsEditor } from './Tactics'

const PL = 105
const PW = 68

function contrast(a: string, b: string) {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [rgb(a), rgb(b)]
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2])
}
const textOn = (h: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#0a0b0e' : '#fff' }

function Pitch({ frames, clock, colors, nums }: { frames: React.RefObject<Frame[]>; clock: React.RefObject<number>; colors: [string, string]; nums: React.RefObject<string[]> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    let raf = 0
    let idx = 0
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = cv.clientWidth
      const H = (W * PW) / PL
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr) }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const k = W / (PL + 6)
      const ox = 3 * k
      const oy = (H - PW * k) / 2
      const X = (x: number) => ox + x * k
      const Y = (y: number) => oy + y * k
      ctx.fillStyle = '#0d4226'; ctx.fillRect(0, 0, W, H)
      for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.05)'; ctx.fillRect(X((i * PL) / 12), Y(0), (PL / 12) * k, PW * k) }
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2
      ctx.strokeRect(X(0), Y(0), PL * k, PW * k)
      ctx.beginPath(); ctx.moveTo(X(52.5), Y(0)); ctx.lineTo(X(52.5), Y(68)); ctx.stroke()
      ctx.beginPath(); ctx.arc(X(52.5), Y(34), 9.15 * k, 0, 7); ctx.stroke()
      for (const s of [0, 1]) {
        const bx = s ? PL - 16.5 : 0
        ctx.strokeRect(X(bx), Y(34 - 20.16), 16.5 * k, 40.32 * k)
        ctx.strokeRect(X(s ? PL - 5.5 : 0), Y(34 - 9.16), 5.5 * k, 18.32 * k)
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(X(s ? PL - 11 : 11), Y(34), 1.6, 0, 7); ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2
        ctx.strokeRect(X(s ? PL : -1.8), Y(34 - 3.66), 1.8 * k, 7.32 * k)
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2
      }
      const fr = frames.current
      const t = clock.current
      if (fr.length) {
        while (idx < fr.length - 1 && fr[idx + 1].t <= t) idx++
        if (idx > 0 && fr[idx].t > t) idx = 0
        const a = fr[idx]
        const b = fr[Math.min(idx + 1, fr.length - 1)]
        const seg = Math.min(3, Math.max(0.2, b.t - a.t))
        const al = b === a ? 0 : Math.max(0, Math.min(1, (t - (b.t - seg)) / seg))
        const ease = al * al * (3 - 2 * al)
        const away = contrast(colors[0], colors[1]) < 140 ? '#f8fafc' : colors[1]
        const r = Math.max(7, 1.55 * k)
        ctx.font = `700 ${Math.max(8, r * 0.95)}px Inter Variable, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        for (let i = 0; i < 22; i++) {
          if (a.p[i * 2] < 0 || b.p[i * 2] < 0) continue
          const x = X(a.p[i * 2] + (b.p[i * 2] - a.p[i * 2]) * ease)
          const y = Y(a.p[i * 2 + 1] + (b.p[i * 2 + 1] - a.p[i * 2 + 1]) * ease)
          const col = i < 11 ? colors[0] : away
          ctx.beginPath(); ctx.arc(x, y + 1.5, r, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill()
          ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = col; ctx.fill()
          ctx.lineWidth = b.c === i ? 2.4 : 1.2; ctx.strokeStyle = b.c === i ? '#fff' : 'rgba(255,255,255,0.55)'; ctx.stroke()
          ctx.fillStyle = textOn(col.length === 7 ? col : '#888888'); ctx.fillText(nums.current[i] ?? '', x, y + 0.5)
        }
        const bx = X(a.b[0] + (b.b[0] - a.b[0]) * ease)
        const by = Y(a.b[1] + (b.b[1] - a.b[1]) * ease)
        const lift = Math.sin(ease * Math.PI) * Math.min(10, Math.hypot(b.b[0] - a.b[0], b.b[1] - a.b[1]) * 0.25)
        ctx.beginPath(); ctx.ellipse(bx, by + 2, 3.4, 2, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill()
        ctx.beginPath(); ctx.arc(bx, by - lift, 3.6, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#111'; ctx.stroke()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [frames, clock, colors, nums])
  return <div className="pitch-wrap"><canvas ref={ref} /></div>
}

const STAT_ROWS: [keyof TStats, string, (v: number) => string][] = [
  ['possession', 'Possession', (v) => `${v}%`], ['xg', 'Expected goals', (v) => v.toFixed(2)], ['shots', 'Shots', String], ['sot', 'On target', String], ['bigChances', 'Big chances', String],
  ['passes', 'Passes', String], ['corners', 'Corners', String], ['fouls', 'Fouls', String], ['offsides', 'Offsides', String], ['tackles', 'Tackles won', String], ['saves', 'Saves', String], ['yellows', 'Yellow cards', String], ['reds', 'Red cards', String],
]
export function StatsPanel({ stats, colors }: { stats: [TStats, TStats]; colors: [string, string] }) {
  return (
    <div>
      {STAT_ROWS.map(([k, label, f]) => {
        const a = stats[0][k]
        const b = stats[1][k]
        return (
          <div key={k} className="statline"><b>{f(a)}</b><span>{label}</span><b>{f(b)}</b>
            <div className="statbar"><i style={{ flex: a + 0.001, background: colors[0] }} /><i style={{ flex: b + 0.001, background: colors[1], opacity: 0.85 }} /></div></div>
        )
      })}
      <div className="statline"><b>{stats[0].passes ? Math.round((stats[0].passesC / stats[0].passes) * 100) : 0}%</b><span>Pass accuracy</span><b>{stats[1].passes ? Math.round((stats[1].passesC / stats[1].passes) * 100) : 0}%</b></div>
    </div>
  )
}
export function Momentum({ data, colors }: { data: number[]; colors: [string, string] }) {
  const max = Math.max(1.5, ...data.map(Math.abs))
  const n = Math.max(90, data.length)
  return (
    <svg viewBox={`0 0 ${n} 40`} preserveAspectRatio="none" style={{ width: '100%', height: 64, display: 'block' }}>
      <line x1="0" x2={n} y1="20" y2="20" stroke="rgba(255,255,255,0.12)" strokeWidth="0.3" /><line x1="45" x2="45" y1="2" y2="38" stroke="rgba(255,255,255,0.12)" strokeWidth="0.3" strokeDasharray="1 1" />
      {data.map((v, i) => { const h = (Math.abs(v) / max) * 18; return <rect key={i} x={i + 0.12} width={0.76} y={v >= 0 ? 20 - h : 20} height={Math.max(0.3, h)} rx={0.3} fill={v >= 0 ? colors[0] : colors[1]} opacity={0.92} /> })}
    </svg>
  )
}
export function ShotMap({ shots, colors }: { shots: ShotRec[]; colors: [string, string] }) {
  return (
    <svg viewBox="0 0 105 68" style={{ width: '100%', borderRadius: 14, background: '#0d4226', display: 'block' }}>
      <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.35"><rect x="0.5" y="0.5" width="104" height="67" /><line x1="52.5" y1="0" x2="52.5" y2="68" /><circle cx="52.5" cy="34" r="9.15" /><rect x="0.5" y="13.84" width="16.5" height="40.32" /><rect x="88" y="13.84" width="16.5" height="40.32" /></g>
      {shots.map((s, i) => {
        const x = s.team === 0 ? s.x * 105 : (1 - s.x) * 105
        const y = s.team === 0 ? s.y * 68 : (1 - s.y) * 68
        const goal = s.out === 'goal'
        return <circle key={i} cx={x} cy={y} r={1.1 + Math.sqrt(s.xg) * 4.4} fill={goal ? colors[s.team] : 'transparent'} stroke={colors[s.team]} strokeWidth={goal ? 0.5 : 0.45} opacity={goal ? 1 : s.out === 'saved' ? 0.9 : 0.5}><title>{`${s.min}' · xG ${s.xg.toFixed(2)} · ${s.out}`}</title></circle>
      })}
    </svg>
  )
}
export function Feed({ events, max }: { events: MEvent[]; max?: number }) {
  const list = [...events].reverse().slice(0, max)
  if (!list.length) return <Empty>Waiting for kick-off.</Empty>
  return <div className="feed">{list.map((e, i) => <div key={events.length - i} className={`feed-item ${e.type === 'goal' || e.type === 'pen' ? 'goal' : e.type === 'red' ? 'red' : ''}`}><span className="m">{e.min}{e.plus ? `+${e.plus}` : ''}'</span><span>{e.type === 'yellow' ? '🟨 ' : e.type === 'red' ? '🟥 ' : e.type === 'sub' ? '⇄ ' : ''}{e.text}</span></div>)}</div>
}
export function RatingsTable({ ps, names, title, color, energy }: { ps: PStats[]; names: (id: number) => string; title: string; color: string; energy?: number[]; ids?: number[] }) {
  const open = useGame((s) => s.openPlayer)
  const world = useGame((s) => s.w)
  const rows = ps.map((p, i) => ({ p, i })).filter((x) => x.p.played).sort((a, b) => Number(b.p.on) - Number(a.p.on) || b.p.rating - a.p.rating)
  return (
    <div className="card flush">
      <div className="card-head"><span style={{ width: 10, height: 10, borderRadius: 3, background: color }} /><h3>{title}</h3></div>
      <div className="scroll">
        <table className="t compact">
          <colgroup><col /><col style={{ width: 54 }} /><col style={{ width: 40 }} /><col style={{ width: 30 }} /><col style={{ width: 30 }} /><col style={{ width: 32 }} /><col style={{ width: 46 }} /><col style={{ width: 58 }} /><col className="opt" style={{ width: 34 }} /><col style={{ width: 36 }} /><col className="opt" style={{ width: 38 }} />{energy && <col style={{ width: 46 }} />}</colgroup>
          <thead><tr><th>Player</th><th className="c">Rating</th><th className="c">Min</th><th className="c">G</th><th className="c">A</th><th className="c">Sh</th><th className="c">xG</th><th className="c">Pass</th><th className="c opt" title="Key passes">KP</th><th className="c" title="Tackles won">Tkl</th><th className="c opt" title="Ball recoveries">Rec</th>{energy && <th className="c">Fit</th>}</tr></thead>
          <tbody>
            {rows.map(({ p, i }) => {
              const pos = p.pos ?? world?.players[p.id]?.pos[0]
              return (
                <tr key={p.id} className="click" style={{ opacity: p.on ? 1 : 0.55 }} onClick={() => open(p.id)}>
                  <td><span className="row" style={{ gap: 8 }}>{pos && <PosTag pos={pos} />}<span className="truncate" style={{ fontWeight: 560 }} title={names(p.id)}>{names(p.id)}</span><span className="faint" style={{ flex: 'none', fontSize: 12 }}>{p.yellow > 0 && '🟨'}{p.red > 0 && '🟥'}{p.subOn ? ` ↑${p.subOn}'` : ''}{p.subOff ? ` ↓${p.subOff}'` : ''}</span></span></td>
                  <td className="c"><span className="rt" style={{ background: ratingColor(p.rating) }}>{p.rating.toFixed(1)}</span></td>
                  <td className="c num">{Math.round(p.mins)}</td><td className="c num">{p.goals || ''}</td><td className="c num">{p.assists || ''}</td><td className="c num">{p.shots || ''}</td><td className="c num">{p.xg ? p.xg.toFixed(2) : ''}</td>
                  <td className="c num">{p.passesC}/{p.passes}</td><td className="c num opt">{p.keyPasses || ''}</td><td className="c num">{p.tacklesWon || ''}</td><td className="c num opt">{p.interceptions || ''}</td>
                  {energy && <td className="c num" style={{ color: energy[i] < 60 ? '#fca5a5' : undefined }}>{p.on ? `${energy[i]}%` : ''}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const SPEEDS: [string, number][] = [['Slow', 8], ['Normal', 18], ['Fast', 45], ['Very fast', 140]]

export function MatchCentre({ fixtureId }: { fixtureId: number }) {
  const { w, setWorld, go, notify } = useGame()
  const world = w!
  const f = world.fixtures.find((x) => x.id === fixtureId)!
  const side = f.home.startsWith('n:IRN:') ? 0 : 1
  const level = (side === 0 ? f.home : f.away).split(':')[2] as Level
  const team = world.teams[level]
  const squad = useMemo(() => team.squad.map((id) => world.players[id]), [world, team.squad])
  const home = teamName(world, f.home)
  const away = teamName(world, f.away)
  const colors = useMemo<[string, string]>(() => [home.colors[0], contrast(home.colors[0], away.colors[0]) < 140 ? away.colors[1] : away.colors[0]], [home, away])
  const comp = world.comps[f.compId]
  const [phase, setPhase] = useState<'pre' | 'live' | 'done'>('pre')
  const [tactic, setTactic] = useState<Tactic>(() => normaliseTactic(team.tactic, squad))
  const [snap, setSnap] = useState<MatchSnapshot | null>(null)
  const [events, setEvents] = useState<MEvent[]>([])
  const [shown, setShown] = useState(0)
  const [shots, setShots] = useState<ShotRec[]>([])
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(18)
  const [tab, setTab] = useState<'feed' | 'stats' | 'players' | 'shots'>('feed')
  const [panel, setPanel] = useState(false)
  const frames = useRef<Frame[]>([])
  const clock = useRef(0)
  const nums = useRef<string[]>([])
  const busy = useRef(false)
  const st = useRef({ playing: true, speed: 18, done: false, events: [] as MEvent[], shown: 0 })
  st.current.playing = playing && !panel
  st.current.speed = speed
  st.current.events = events

  const absorb = useCallback((c: LiveChunk) => {
    frames.current.push(...c.frames)
    if (c.events.length) setEvents((e) => [...e, ...c.events])
    if (c.shots.length) setShots((s) => [...s, ...c.shots])
    setSnap(c.snap)
    st.current.done = c.snap.done
    nums.current = [...c.snap.on[0], ...c.snap.on[1]].map((id) => (id >= 0 ? String(world.players[id]?.num ?? (id % 30) + 1) : ''))
  }, [world])

  const kickOff = async () => {
    await sim.cmd('setTactic', [level, tactic], false)
    const c = await sim.liveStart(fixtureId)
    if (typeof c === 'string') return notify(c)
    absorb(c)
    setPhase('live')
  }

  useEffect(() => {
    if (phase !== 'live') return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const s = st.current
      const fr = frames.current
      const head = fr.length ? fr[fr.length - 1].t : 0
      if (s.playing) clock.current = Math.min(head, clock.current + dt * s.speed)
      // reveal events as the playhead reaches them
      let n = s.shown
      while (n < s.events.length && (fr[Math.min(fr.length - 1, s.events[n].f)]?.t ?? 0) <= clock.current + 0.01) n++
      if (n !== s.shown) {
        const ev = s.events[n - 1]
        s.shown = n
        setShown(n)
        if (ev.type === 'half' && !s.done) setPlaying(false)
      }
      if (!s.done && !busy.current && head - clock.current < Math.max(25, s.speed * 1.5)) {
        busy.current = true
        void sim.liveStep(Math.max(12, Math.round(s.speed * 0.9))).then((c) => { absorb(c); busy.current = false })
      }
      if (s.done && clock.current >= head - 0.01 && s.shown >= s.events.length) setPhase('done')
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, absorb])

  const finish = async () => {
    const { report, w: nw } = await sim.liveFinish()
    setWorld(nw)
    go(report >= 0 ? { name: 'report', id: report } : { name: 'home' })
  }
  const applyTactic = async (t: Tactic) => {
    if (!snap) return
    const cur = snap.tactics[side].lineup
    for (let i = 0; i < 11; i++) {
      const inn = t.lineup[i]
      if (inn >= 0 && !cur.includes(inn)) {
        const out = cur.find((id) => id >= 0 && !t.lineup.includes(id))
        if (out == null) continue
        const err = await sim.liveSub(out, inn)
        if (err) { notify(err); return }
        cur[cur.indexOf(out)] = inn
      }
    }
    await sim.liveTactic(t)
    absorb(await sim.liveStep(0))
  }

  const seen = events.slice(0, shown)
  const score = [0, 1].map((t) => seen.filter((e) => (e.type === 'goal' || e.type === 'pen') && e.team === t).length)
  const last = seen[seen.length - 1]
  const oppCode = (side === 0 ? f.away : f.home).split(':')[1]
  const nameOf = (id: number) => world.players[id]?.name ?? '—'

  if (phase === 'pre') {
    const opp = world.nations[oppCode]
    return (
      <div className="page-inner">
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.18), rgba(255,255,255,0.03) 45%, rgba(220,38,38,0.18))' }}>
          <div className="scoreboard">
            <div className="side"><Flag code={f.home.split(':')[1]} lg /><div><b>{home.name}</b><div className="muted">#{world.nations[f.home.split(':')[1]]?.rank}</div></div></div>
            <div className="center"><div className="eyebrow">{comp.name}{comp.friendly ? '' : ` · ${comp.stages[f.stage].name}`}</div><div style={{ fontSize: 30, fontWeight: 300, opacity: 0.6, margin: '4px 0' }}>vs</div><span className="pill">{f.neutral ? 'Neutral venue' : side === 0 ? 'Home' : 'Away'}</span></div>
            <div className="side away"><Flag code={f.away.split(':')[1]} lg /><div><b>{away.name}</b><div className="muted">#{world.nations[f.away.split(':')[1]]?.rank}</div></div></div>
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 14, paddingBottom: 8 }}>
            <span className="muted">Opponent strength</span><OvrNum v={opp?.level ?? 60} /><span className="muted">· {LEVEL_NAME[level]} team · {comp.subs} substitutions</span>
            <button className="btn primary go" disabled={squad.length < 11} onClick={() => void kickOff()}><Play />Kick off</button>
          </div>
        </div>
        {squad.length >= 11 ? <TacticsEditor tactic={tactic} squad={squad} onChange={setTactic} /> : <div className="card"><Empty>You need to name a squad before this match can be played.</Empty></div>}
      </div>
    )
  }
  if (!snap) return null
  const live = phase === 'live'
  return (
    <div className="page-inner">
      <div className="card flush">
        <div className="scoreboard">
          <div className="side"><Flag code={f.home.split(':')[1]} lg /><b>{home.name}</b></div>
          <div className="center">
            <div className="score">{score[0]}<span style={{ opacity: 0.35, margin: '0 14px' }}>–</span>{score[1]}</div>
            {live ? <span className="clock"><i />{last ? `${last.min}${last.plus ? `+${last.plus}` : ''}'` : "1'"} · {Math.floor(clock.current / 60)} min played</span> : <span className="pill green">Full time{snap.pens ? ` · ${snap.pens[0]}–${snap.pens[1]} on penalties` : ''}</span>}
          </div>
          <div className="side away"><Flag code={f.away.split(':')[1]} lg /><b>{away.name}</b></div>
        </div>
        <div style={{ padding: '0 22px 6px' }}><Momentum data={snap.momentum.slice(0, last?.min ?? 1)} colors={colors} /></div>
        <div className="row" style={{ padding: '10px 22px 16px' }}>
          {live ? <>
            <button className="btn" onClick={() => setPlaying((p) => !p)}>{playing ? <><Pause />Pause</> : <><Play />Resume</>}</button>
            <div className="seg">{SPEEDS.map(([n, v]) => <button key={n} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>{n}</button>)}</div>
            <button className="btn" onClick={() => setPanel(true)}><Settings2 />Tactics and substitutions <span className="pill">{snap.subsLeft[side]} left</span></button>
            <button className="btn ghost right" onClick={() => void finish()}><FastForward />Instant result</button>
          </> : <button className="btn primary go right" onClick={() => void finish()}>Continue to report</button>}
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="col" style={{ gap: 18 }}>
          <Pitch frames={frames} clock={clock} colors={colors} nums={nums} />
          <RatingsTable ps={snap.players[side]} names={nameOf} title={side === 0 ? home.name : away.name} color={colors[side]} energy={snap.energy[side]} />
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>{([['feed', 'Commentary'], ['stats', 'Stats'], ['shots', 'Shot map'], ['players', 'Opponent']] as const).map(([k, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}</div>
          {tab === 'feed' && <div className="card scroll" style={{ maxHeight: 640, padding: 10 }}><Feed events={seen} /></div>}
          {tab === 'stats' && <div className="card"><StatsPanel stats={snap.stats} colors={colors} /></div>}
          {tab === 'shots' && <div className="card"><ShotMap shots={shots.filter((s) => s.min <= (last?.min ?? 0))} colors={colors} /><div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>Circle size shows chance quality (xG). Filled circles are goals. {home.short} attack left to right.</div></div>}
          {tab === 'players' && <RatingsTable ps={snap.players[1 - side]} names={nameOf} title={side === 0 ? away.name : home.name} color={colors[1 - side]} />}
        </div>
      </div>
      {panel && (
        <>
          <div className="scrim" onClick={() => setPanel(false)} />
          <aside className="drawer" style={{ padding: 24 }}>
            <div className="row" style={{ marginBottom: 16 }}><h2>Touchline</h2><span className="muted">{snap.subsLeft[side]} substitutions left · the match is paused</span><button className="btn primary right" onClick={() => setPanel(false)}>Back to the match</button></div>
            <TacticsEditor compact ratings={Object.fromEntries(snap.players[side].filter((p) => p.on).map((p) => [p.id, p.rating]))} tactic={snap.tactics[side]} squad={squad} energy={Object.fromEntries(snap.players[side].map((p, i) => [p.id, snap.energy[side][i]]))} locked={new Set(snap.players[side].filter((p) => p.played && !p.on).map((p) => p.id))} onChange={(t) => void applyTactic(t)} />
          </aside>
        </>
      )}
    </div>
  )
}

export function ReportView({ id }: { id: number }) {
  const { w, go } = useGame()
  const r = w!.reports.find((x) => x.id === id)
  if (!r) return <div className="page-inner"><div className="card"><Empty>This match report is no longer stored.</Empty></div></div>
  const colors: [string, string] = [r.home.colors[0], contrast(r.home.colors[0], r.away.colors[0]) < 140 ? r.away.colors[1] : r.away.colors[0]]
  const name = (pid: number) => r.names[pid] ?? '—'
  const goals = (t: number) => r.events.filter((e) => (e.type === 'goal' || e.type === 'pen') && e.team === t)
  return (
    <div className="page-inner">
      <div className="card flush">
        <div className="scoreboard">
          <div className="side"><Flag code={r.home.ref.split(':')[1]} lg /><div><b>{r.home.name}</b><div className="muted">{r.home.formation}</div></div></div>
          <div className="center"><div className="score">{r.score[0]}<span style={{ opacity: 0.35, margin: '0 14px' }}>–</span>{r.score[1]}</div><span className="pill">{r.pens ? `${r.pens[0]}–${r.pens[1]} on penalties` : r.et ? 'After extra time' : 'Full time'}</span></div>
          <div className="side away"><Flag code={r.away.ref.split(':')[1]} lg /><div><b>{r.away.name}</b><div className="muted">{r.away.formation}</div></div></div>
        </div>
        <div className="grid g2" style={{ padding: '0 28px 14px' }}>
          <div className="muted" style={{ textAlign: 'right' }}>{goals(0).map((e, i) => <div key={i}>{name(e.p!)} {e.min}'</div>)}</div>
          <div className="muted">{goals(1).map((e, i) => <div key={i}>{name(e.p!)} {e.min}'</div>)}</div>
        </div>
        <div style={{ padding: '0 22px 14px' }}><Momentum data={r.momentum} colors={colors} /></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="card"><div className="card-head"><h3>Match stats</h3></div><StatsPanel stats={r.stats} colors={colors} /></div>
        <div className="card"><div className="card-head"><h3>Shot map</h3>{r.motm >= 0 && <span className="right faint">Player of the match: <b style={{ color: 'var(--text)' }}>{name(r.motm)}</b></span>}</div><ShotMap shots={r.shots} colors={colors} /></div>
        <div className="card scroll" style={{ maxHeight: 520, padding: 10 }}><Feed events={r.events} /></div>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <RatingsTable ps={r.players[0]} names={name} title={r.home.name} color={colors[0]} />
        <RatingsTable ps={r.players[1]} names={name} title={r.away.name} color={colors[1]} />
      </div>
      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => go({ name: 'home' })}>Back to home</button>
    </div>
  )
}
