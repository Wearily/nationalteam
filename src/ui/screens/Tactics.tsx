import { useMemo, useState } from 'react'
import { pickXI } from '../../sim/intl/select'
import { defaultRole, FORMATION_KEYS, FORMATIONS, ROLE, rolesFor, SLIDERS, type Tactic } from '../../sim/match/tactics'
import { effectiveOverall } from '../../sim/ratings/attributes'
import type { Player } from '../../sim/world/types'
import { dynOvr } from '../../sim/ratings/dynamic'
import { Avatar, Face, Ovr, ovrColor, PosTag } from '../bits'
import { useGame } from '../store'

/** Make sure a tactic has a legal eleven drawn from the squad; fills gaps with the best available. */
export function normaliseTactic(tac: Tactic, squad: Player[]): Tactic {
  const ids = new Set(squad.filter((p) => !p.injury).map((p) => p.id))
  const ok = tac.lineup.length === 11 && tac.lineup.every((id) => ids.has(id)) && new Set(tac.lineup).size === 11
  if (ok || squad.length < 11) return { ...tac, bench: squad.filter((p) => !tac.lineup.includes(p.id) && !p.injury).map((p) => p.id) }
  const xi = pickXI(squad, tac.formation)
  return { ...tac, lineup: xi.lineup, bench: xi.bench, roles: tac.roles.length === 11 ? tac.roles : FORMATIONS[tac.formation].map((s) => defaultRole(s.pos)) }
}

export function TacticsEditor({ tactic, squad, onChange, energy, locked, compact }: {
  tactic: Tactic; squad: Player[]; onChange: (t: Tactic) => void
  /** Live match: player id → energy, and ids that may not be brought on. */
  energy?: Record<number, number>; locked?: Set<number>; compact?: boolean
}) {
  const w = useGame((s) => s.w)!
  const [sel, setSel] = useState<number | null>(null)
  const slots = FORMATIONS[tactic.formation]
  const byId = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad])
  const bench = squad.filter((p) => !tactic.lineup.includes(p.id))
  const set = (patch: Partial<Tactic>) => onChange({ ...tactic, ...patch })
  const changeFormation = (f: string) => {
    const xi = pickXI(tactic.lineup.map((id) => byId.get(id)).filter(Boolean) as Player[], f)
    const lineup = xi.lineup.map((id, i) => (id >= 0 ? id : (xi.bench.shift() ?? tactic.lineup[i])))
    setSel(null)
    onChange({ ...tactic, formation: f, lineup, roles: FORMATIONS[f].map((s) => defaultRole(s.pos)) })
  }
  const clickSlot = (i: number) => {
    if (sel == null) return setSel(i)
    if (sel === i) return setSel(null)
    const lineup = [...tactic.lineup]
    ;[lineup[sel], lineup[i]] = [lineup[i], lineup[sel]]
    set({ lineup })
    setSel(null)
  }
  const clickBench = (p: Player) => {
    if (sel == null || locked?.has(p.id) || p.injury) return
    const lineup = [...tactic.lineup]
    lineup[sel] = p.id
    set({ lineup })
    setSel(null)
  }
  const selSlot = sel != null ? slots[sel] : null
  return (
    <div className="grid" style={{ gridTemplateColumns: compact ? '460px 1fr' : '500px minmax(0,1fr) 300px', alignItems: 'start' }}>
      <div className="col">
        <div className="row"><select className="input grow" value={tactic.formation} onChange={(e) => changeFormation(e.target.value)}>{FORMATION_KEYS.map((f) => <option key={f}>{f}</option>)}</select></div>
        <div className="board">
          <svg className="lines" viewBox="0 0 68 100" preserveAspectRatio="none" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.3">
            <rect x="2" y="2" width="64" height="96" /><line x1="2" y1="50" x2="66" y2="50" /><circle cx="34" cy="50" r="8" /><rect x="16" y="2" width="36" height="15" /><rect x="16" y="83" width="36" height="15" /><rect x="25" y="2" width="18" height="5.5" /><rect x="25" y="92.5" width="18" height="5.5" />
          </svg>
          {slots.map((s, i) => {
            const p = byId.get(tactic.lineup[i])
            const eff = p ? effectiveOverall(p.attrs, p.pos, s.pos) + dynOvr(p).total : 0
            const e = p && energy ? energy[p.id] : undefined
            return (
              <div key={i} className={`slot ${sel === i ? 'sel' : ''}`} style={{ left: `${9 + s.y * 82}%`, top: `${90 - s.x * 100}%` }} onClick={() => clickSlot(i)}>
                <div className="pcard">
                  {p && <div className="f"><Face p={p} /></div>}
                  <span className="o" style={{ color: p ? ovrColor(eff) : '#fff' }}>{p ? eff : '+'}</span>
                  {e != null && <div className="bar"><i style={{ width: `${e}%`, background: e > 70 ? '#3ddc97' : e > 55 ? '#f2c46d' : '#e85d65' }} /></div>}
                  <span className="p">{s.pos}{tactic.captain === p?.id ? ' · C' : ''}</span>
                </div>
                <span className="nm">{p ? p.name.split(' ').slice(-1)[0] : s.pos}</span>
              </div>
            )
          })}
        </div>
        {selSlot && sel != null && (
          <div className="card col" style={{ padding: 14 }}>
            <div className="row"><PosTag pos={selSlot.pos} /><b>{byId.get(tactic.lineup[sel])?.name ?? 'Empty'}</b>
              <button className="btn sm right" onClick={() => set({ captain: tactic.lineup[sel] })}>Captain</button></div>
            <div className="seg" style={{ flexWrap: 'wrap' }}>{rolesFor(selSlot.pos).map((r) => <button key={r.key} className={tactic.roles[sel] === r.key ? 'on' : ''} onClick={() => { const roles = [...tactic.roles]; roles[sel] = r.key; set({ roles }) }}>{r.name}</button>)}</div>
            <span className="faint" style={{ fontSize: 12 }}>{ROLE[tactic.roles[sel]]?.blurb} Click another position to swap, or a substitute to bring him in.</span>
          </div>
        )}
      </div>
      <div className="card flush scroll" style={{ maxHeight: 760 }}>
        <div className="card-head"><h3>{energy ? 'Bench' : 'Squad'}</h3><span className="faint">{sel != null ? 'Pick a player for the highlighted position' : 'Select a position on the pitch first'}</span></div>
        <table className="t"><thead><tr><th>Player</th><th>Pos</th><th className="c">Ovr</th><th className="c">{selSlot ? `At ${selSlot.pos}` : 'Fit'}</th><th className="c">Cond</th><th className="c">Sharp</th></tr></thead><tbody>
          {bench.sort((a, b) => (selSlot ? effectiveOverall(b.attrs, b.pos, selSlot.pos) - effectiveOverall(a.attrs, a.pos, selSlot.pos) : b.ovr - a.ovr)).map((p) => {
            const dis = locked?.has(p.id) || !!p.injury
            return (
              <tr key={p.id} className={sel != null && !dis ? 'click' : ''} style={{ opacity: dis ? 0.38 : 1 }} onClick={() => clickBench(p)}>
                <td><span className="row" style={{ gap: 9 }}><Avatar p={p} size={26} /><span style={{ fontWeight: 560 }}>{p.name}</span>{p.injury && <span className="pill red">Inj</span>}{locked?.has(p.id) && <span className="pill">Used</span>}</span></td>
                <td><span className="row" style={{ gap: 4 }}>{p.pos.slice(0, 2).map((x) => <PosTag key={x} pos={x} />)}</span></td>
                <td className="c"><Ovr p={p} /></td>
                <td className="c num">{selSlot ? effectiveOverall(p.attrs, p.pos, selSlot.pos) : '–'}</td>
                <td className="c num">{Math.round(p.cond)}%</td><td className="c num">{Math.round(p.sharp)}%</td>
              </tr>
            )
          })}
        </tbody></table>
      </div>
      <div className="card col" style={{ gap: 15, gridColumn: compact ? '1 / -1' : undefined }}>
        <h3>Team instructions</h3>
        <div className={compact ? 'grid g4' : 'col'} style={{ gap: 15 }}>
          {SLIDERS.map((s) => {
            const v = tactic[s.key] as number
            return (
              <div key={s.key} title={s.blurb}>
                <div className="row" style={{ marginBottom: 7 }}><span style={{ fontWeight: 580 }}>{s.name}</span><span className="faint right" style={{ fontSize: 11.5 }}>{v < 34 ? s.lo : v > 66 ? s.hi : 'Balanced'}</span></div>
                <input type="range" min={0} max={100} step={5} value={v} style={{ ['--v' as string]: `${v}%` }} onChange={(e) => set({ [s.key]: +e.target.value } as Partial<Tactic>)} />
              </div>
            )
          })}
        </div>
        {!compact && (
          <div className="col" style={{ gap: 9, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            {(['pens', 'freeKicks', 'corners'] as const).map((k) => (
              <div key={k} className="row"><span className="muted" style={{ width: 86 }}>{k === 'pens' ? 'Penalties' : k === 'freeKicks' ? 'Free kicks' : 'Corners'}</span>
                <select className="input grow" value={tactic[k]} onChange={(e) => set({ [k]: +e.target.value } as Partial<Tactic>)}><option value={-1}>Best available</option>{tactic.lineup.map((id) => byId.get(id)).filter(Boolean).map((p) => <option key={p!.id} value={p!.id}>{p!.name}</option>)}</select></div>
            ))}
          </div>
        )}
        <span className="faint" style={{ fontSize: 11.5 }}>{w.managerName ? 'Every setting here changes how the match engine plays.' : ''}</span>
      </div>
    </div>
  )
}
