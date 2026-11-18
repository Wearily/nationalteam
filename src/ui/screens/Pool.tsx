import { useVirtualizer } from '@tanstack/react-virtual'
import { Check, Plus, Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { formAvg } from '../../sim/clubs/season'
import { ageEligible } from '../../sim/intl/select'
import { posLine } from '../../sim/ratings/attributes'
import { LEVEL_NAME, LEVELS, type Level, type Player } from '../../sim/world/types'
import { ageOf, clubOf, Crest, Flag, FormDots, leagueOf, money, Ovr, PlayerLink, PosTag, Rating, scoutView } from '../bits'
import { useGame } from '../store'

type SortKey = 'ovr' | 'pot' | 'age' | 'form' | 'value' | 'caps' | 'name' | 'goals' | 'mins'
const WHERE = [['all', 'Anywhere'], ['iran', 'In Iran'], ['abroad', 'Abroad'], ['europe', 'Europe'], ['gulf', 'Gulf & Asia']] as const

/** Sortable, filterable list of everyone eligible (or potentially eligible) for Iran. */
export function PoolTable({ level, selected, onToggle, height = 640, limit }: { level?: Level; selected?: Set<number>; onToggle?: (p: Player) => void; height?: number | string; limit?: number }) {
  const w = useGame((s) => s.w)!
  const open = useGame((s) => s.openPlayer)
  const [q, setQ] = useState('')
  const [line, setLine] = useState('ALL')
  const [where, setWhere] = useState<(typeof WHERE)[number][0]>('all')
  const [lv, setLv] = useState<Level>(level ?? 'senior')
  const [status, setStatus] = useState<'committed' | 'dual'>('committed')
  const [sort, setSort] = useState<[SortKey, number]>(['ovr', -1])
  const lvl = level ?? lv
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const out = w.players.filter((p) => {
      if (p.retired) return false
      if (status === 'dual' ? !(p.iranStatus && p.iranStatus !== 'committed') : p.nat[0] !== 'IRN') return false
      if (p.known < 8) return false
      if (!ageEligible(p, lvl, w.day)) return false
      if (line !== 'ALL' && posLine(p.pos[0]) !== line) return false
      if (ql && !p.name.toLowerCase().includes(ql) && !(clubOf(w, p)?.name.toLowerCase().includes(ql))) return false
      if (where !== 'all') {
        const c = clubOf(w, p)
        const conf = c ? w.nations[c.country]?.confed : null
        if (where === 'iran' && c?.country !== 'IRN') return false
        if (where === 'abroad' && (!c || c.country === 'IRN')) return false
        if (where === 'europe' && conf !== 'UEFA') return false
        if (where === 'gulf' && (!c || c.country === 'IRN' || conf === 'UEFA')) return false
      }
      return true
    })
    const [k, dir] = sort
    const val = (p: Player): number | string => k === 'ovr' ? (scoutView(p).lo + scoutView(p).hi) / 2 : k === 'pot' ? (scoutView(p).potLo + scoutView(p).potHi) / 2 : k === 'age' ? -p.dob : k === 'form' ? (p.form.length ? formAvg(p) : 0) : k === 'value' ? p.value : k === 'caps' ? p.caps : k === 'goals' ? p.club.goals : k === 'mins' ? p.club.mins : p.name
    out.sort((a, b) => { const x = val(a); const y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir })
    return limit ? out.slice(0, limit) : out
  }, [w, q, line, where, lvl, sort, status, limit])
  const parent = useRef<HTMLDivElement>(null)
  const virt = useVirtualizer({ count: rows.length, getScrollElement: () => parent.current, estimateSize: () => 45, overscan: 14 })
  const th = (k: SortKey, label: string, cls = 'c') => <th className={`${cls} sort`} onClick={() => setSort(([ck, d]) => (ck === k ? [k, -d] : [k, k === 'name' ? 1 : -1]))}>{label}{sort[0] === k ? (sort[1] < 0 ? ' ↓' : ' ↑') : ''}</th>
  const items = virt.getVirtualItems()
  const padTop = items.length ? items[0].start : 0
  const padBot = items.length ? virt.getTotalSize() - items[items.length - 1].end : 0
  return (
    <div className="card flush col" style={{ gap: 0, height, minHeight: 0 }}>
      <div className="row" style={{ padding: 14, flexWrap: 'wrap' }}>
        <div className="row input" style={{ gap: 8, width: 230 }}><Search size={14} className="faint" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search player or club" style={{ background: 'none', border: 0, outline: 'none', flex: 1, minWidth: 0 }} /></div>
        <div className="seg">{['ALL', 'GK', 'DEF', 'MID', 'ATT'].map((l) => <button key={l} className={line === l ? 'on' : ''} onClick={() => setLine(l)}>{l === 'ALL' ? 'All' : l}</button>)}</div>
        <div className="seg">{WHERE.map(([k, n]) => <button key={k} className={where === k ? 'on' : ''} onClick={() => setWhere(k)}>{n}</button>)}</div>
        {!level && <select className="input" value={lv} onChange={(e) => setLv(e.target.value as Level)}>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_NAME[l]} eligible</option>)}</select>}
        {!level && <div className="seg"><button className={status === 'committed' ? 'on' : ''} onClick={() => setStatus('committed')}>Iran players</button><button className={status === 'dual' ? 'on' : ''} onClick={() => setStatus('dual')}>Dual nationals</button></div>}
        <span className="faint right num">{rows.length} players</span>
      </div>
      <div ref={parent} className="scroll grow">
        <table className="t">
          <thead><tr>{onToggle && <th style={{ width: 44 }} />}{th('name', 'Player', '')}<th>Pos</th>{th('age', 'Age')}{th('ovr', 'Ovr')}{th('pot', 'Pot')}<th>Club</th>{th('mins', 'Mins')}{th('goals', 'G/A')}<th className="c">Last 5</th>{th('form', 'Form')}{th('caps', 'Caps')}{th('value', 'Value', 'r')}</tr></thead>
          <tbody>
            {padTop > 0 && <tr><td colSpan={13} style={{ height: padTop, padding: 0, border: 0 }} /></tr>}
            {items.map((vi) => {
              const p = rows[vi.index]
              const c = clubOf(w, p)
              const lg = leagueOf(w, p)
              const sel = selected?.has(p.id)
              return (
                <tr key={p.id} className={`click ${sel ? 'sel' : ''}`} onClick={() => open(p.id)} style={{ height: 45 }}>
                  {onToggle && <td><button className={`btn sm ${sel ? 'green' : ''}`} style={{ width: 28, padding: 0 }} onClick={(e) => { e.stopPropagation(); onToggle(p) }}>{sel ? <Check /> : <Plus />}</button></td>}
                  <td><PlayerLink p={p} sub={p.injury ? <span style={{ color: '#fca5a5' }}>Injured · {p.injury.name}</span> : p.iranStatus && p.iranStatus !== 'committed' ? `Eligible · ${p.iranStatus}` : undefined} /></td>
                  <td><span className="row" style={{ gap: 4 }}>{p.pos.slice(0, 2).map((x) => <PosTag key={x} pos={x} />)}</span></td>
                  <td className="c num">{ageOf(w, p)}</td><td className="c"><Ovr p={p} /></td><td className="c"><Ovr p={p} pot /></td>
                  <td><span className="row" style={{ gap: 8 }}>{c ? <>{c.logo ? <Crest colors={c.colors} logo={c.logo} /> : <Flag code={c.country} />}<span className="col" style={{ gap: 0 }}><span className="truncate" style={{ maxWidth: 170 }}>{c.name}</span><span className="faint" style={{ fontSize: 11 }}>{lg?.name}</span></span></> : <span className="faint">Free agent</span>}</span></td>
                  <td className="c num">{p.club.mins || '–'}</td><td className="c num">{p.club.goals}/{p.club.assists}</td><td className="c"><FormDots form={p.form} /></td><td className="c"><Rating v={p.form.length ? formAvg(p) : null} /></td>
                  <td className="c num">{p.caps || '–'}</td><td className="r num">{money(p.value)}</td>
                </tr>
              )
            })}
            {padBot > 0 && <tr><td colSpan={13} style={{ height: padBot, padding: 0, border: 0 }} /></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Pool() {
  return <div className="page-inner" style={{ height: '100%' }}><PoolTable height="100%" /></div>
}
