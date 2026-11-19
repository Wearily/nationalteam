import type { CSSProperties, ReactNode } from 'react'
import { ageOn } from '../sim/core/date'
import { hashStr } from '../sim/core/rng'
import { faceStats, posLine } from '../sim/ratings/attributes'
import { dynOvr } from '../sim/ratings/dynamic'
import type { World } from '../sim/world/state'
import type { Player, Pos } from '../sim/world/types'
import LOGOS from '../../data/overrides/logos.json'
import PHOTOS from '../../data/overrides/photos.json'
import FACES from './faces.json'
import { FIFA_ISO } from './flags'
import { useGame } from './store'

export const money = (v: number) => {
  const a = Math.abs(v)
  const s = v < 0 ? '−' : ''
  if (a >= 1e9) return `${s}€${(a / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${s}€${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`
  if (a >= 1e3) return `${s}€${Math.round(a / 1e3)}K`
  return `${s}€${a}`
}
export const ageOf = (w: World, p: Player) => ageOn(p.dob, w.day)
export const clubOf = (w: World, p: Player) => (p.clubId != null ? w.clubs[p.clubId] : null)
export const leagueOf = (w: World, p: Player) => (p.clubId != null ? w.leagues[w.clubs[p.clubId].leagueId] : null)
export const isAbroad = (w: World, p: Player) => { const c = clubOf(w, p); return !!c && c.country !== 'IRN' }

export const ovrColor = (v: number) => (v >= 85 ? '#7dd3fc' : v >= 78 ? '#86efac' : v >= 70 ? '#bef264' : v >= 62 ? '#fde047' : v >= 54 ? '#fdba74' : '#fca5a5')
export const ratingColor = (r: number) => (r >= 9 ? '#2563eb' : r >= 8 ? '#059669' : r >= 7 ? '#16a34a' : r >= 6.5 ? '#ca8a04' : r >= 6 ? '#d97706' : '#dc2626')

/** What the federation's scouts can actually see of a player. */
export function scoutView(p: Player): { exact: boolean; lo: number; hi: number; potLo: number; potHi: number; attrs: boolean } {
  if (p.known >= 75) return { exact: true, lo: p.ovr, hi: p.ovr, potLo: p.pot, potHi: p.pot, attrs: true }
  const err = Math.max(2, Math.round(((100 - p.known) / 100) * 9))
  const h = hashStr(`k${p.id}`)
  const off = (h % (err + 1)) - Math.floor(err / 2)
  const pOff = ((h >> 8) % (err + 3)) - Math.floor(err / 2)
  return { exact: false, lo: p.ovr + off - Math.ceil(err / 2), hi: p.ovr + off + Math.floor(err / 2), potLo: p.pot + pOff - err, potHi: Math.min(95, p.pot + pOff + err), attrs: p.known >= 40 }
}

export function Flag({ code, lg, sm }: { code: string; lg?: boolean; sm?: boolean }) {
  const n = useGame((s) => s.w?.nations[code])
  const iso = FIFA_ISO[code]
  if (iso) return <span className={`flag fi fi-${iso}${lg ? ' lg' : ''}${sm ? ' sm' : ''}`} title={n?.name ?? code} />
  const [a, b] = n?.colors ?? ['#555', '#888']
  return <span className={`flag${lg ? ' lg' : ''}`} style={{ background: `linear-gradient(135deg, ${a} 0 55%, ${b} 55%)` }} title={n?.name ?? code}>{code}</span>
}
/** Logo path for a club: the dataset's own, else the ESPN-sourced override keyed by club id. */
export const clubLogo = (c: { logo?: string; rid: string } | null | undefined): string | undefined => (c ? c.logo ?? (LOGOS as Record<string, string>)[c.rid] : undefined)
export function Crest({ colors, lg, logo }: { colors: [string, string]; lg?: boolean; logo?: string }) {
  if (logo) return <img className={`crest-img${lg ? ' lg' : ''}`} src={`${import.meta.env.BASE_URL}${logo}`} alt="" loading="lazy" />
  return <span className={`crest${lg ? ' lg' : ''}`} style={{ background: `linear-gradient(135deg, ${colors[0]} 0 50%, ${colors[1]} 50%)` }} />
}
export function ClubBadge({ clubId, lg }: { clubId: number; lg?: boolean }) {
  const c = useGame((s) => s.w?.clubs[clubId])
  return c ? <Crest colors={c.colors} logo={clubLogo(c)} lg={lg} /> : null
}
export function PosTag({ pos }: { pos: Pos }) {
  return <span className={`pos ${posLine(pos)}`}>{pos}</span>
}
export function Ovr({ p, pot }: { p: Player; pot?: boolean }) {
  const v = scoutView(p)
  if (!v.exact) return <span className="ovr range">{pot ? `${v.potLo}–${v.potHi}` : `${v.lo}–${v.hi}`}</span>
  if (pot) return <span className="ovr" style={{ background: ovrColor(p.pot) }}>{p.pot}</span>
  // dynamic overall: baseline moved by form, morale and fitness
  const d = dynOvr(p)
  return (
    <span className="ovr-wrap" title={`Baseline ${d.base} · form ${d.form >= 0 ? '+' : ''}${d.form} · morale ${d.morale >= 0 ? '+' : ''}${d.morale} · fitness ${d.fitness >= 0 ? '+' : ''}${d.fitness}`}>
      <span className="ovr" style={{ background: ovrColor(d.ovr) }}>{d.ovr}</span>
      {d.total !== 0 && <span className={`ovr-d ${d.total > 0 ? 'up' : 'down'}`}>{d.total > 0 ? '▲' : '▼'}{Math.abs(d.total)}</span>}
    </span>
  )
}
export function OvrNum({ v }: { v: number }) {
  return <span className="ovr" style={{ background: ovrColor(v) }}>{Math.round(v)}</span>
}
export function Rating({ v }: { v: number | null | undefined }) {
  if (v == null || !isFinite(v) || v === 0) return <span className="faint">–</span>
  return <span className="rt" style={{ background: ratingColor(v) }}>{v.toFixed(1)}</span>
}
export function FormDots({ form }: { form: number[] }) {
  if (!form.length) return <span className="faint">–</span>
  return <span className="form-dots" title={form.map((f) => f.toFixed(1)).join('  ')}>{form.slice(-5).map((f, i) => <i key={i} style={{ background: ratingColor(f) }} />)}</span>
}

const SKIN = ['#f1c9a5', '#e0ac7e', '#c98f62', '#a9744b', '#8a5a36']
const HAIR = ['#141414', '#1f1a17', '#2b1d14', '#3a2a1c', '#0d0d0f']
/** Deterministic illustrated portrait for players without a photo. */
export function Portrait({ p, kit }: { p: Player; kit?: string }) {
  const h = hashStr(`${p.name}${p.dob}`)
  const iranish = p.nat.includes('IRN')
  const skin = SKIN[iranish ? (h % 3) : h % 5]
  const hair = HAIR[(h >> 3) % 5]
  const style = (h >> 6) % 5
  const beard = (h >> 9) % 4
  const shirt = kit ?? (iranish ? '#f1f5f9' : '#334155')
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" fill="#1b1f29" />
      <circle cx="50" cy="118" r="52" fill={shirt} />
      <path d="M36 78 Q50 92 64 78 L64 70 L36 70Z" fill={skin} />
      <ellipse cx="50" cy="48" rx="19" ry="23" fill={skin} />
      <ellipse cx="31" cy="50" rx="3" ry="5" fill={skin} /><ellipse cx="69" cy="50" rx="3" ry="5" fill={skin} />
      {style === 0 && <path d="M30 44 Q30 20 50 21 Q70 20 70 44 Q64 30 50 31 Q36 30 30 44Z" fill={hair} />}
      {style === 1 && <path d="M30 46 Q27 18 50 19 Q73 18 70 46 Q66 33 58 30 Q46 36 34 32 Q31 38 30 46Z" fill={hair} />}
      {style === 2 && <path d="M31 42 Q31 23 50 23 Q69 23 69 42 Q62 33 50 33 Q38 33 31 42Z" fill={hair} opacity="0.85" />}
      {style === 3 && <path d="M29 48 Q25 16 52 18 Q76 18 71 48 Q68 34 62 28 Q50 24 36 30 Q31 38 29 48Z" fill={hair} />}
      {style === 4 && <path d="M32 40 Q34 25 50 25 Q66 25 68 40 Q60 34 50 34 Q40 34 32 40Z" fill={hair} opacity="0.5" />}
      {beard === 1 && <path d="M33 56 Q36 74 50 74 Q64 74 67 56 Q62 64 50 64 Q38 64 33 56Z" fill={hair} opacity="0.9" />}
      {beard === 2 && <path d="M34 58 Q38 72 50 72 Q62 72 66 58 Q60 66 50 66 Q40 66 34 58Z" fill={hair} opacity="0.45" />}
      {beard === 3 && <path d="M42 60 Q50 57 58 60 Q50 63 42 60Z" fill={hair} opacity="0.8" />}
      <ellipse cx="42.5" cy="47" rx="2" ry="1.6" fill="#15161a" /><ellipse cx="57.5" cy="47" rx="2" ry="1.6" fill="#15161a" />
      <path d="M38 42.5 Q42.5 40.5 46 42.5 M54 42.5 Q57.5 40.5 62 42.5" stroke={hair} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M49 49 Q48 55 50.5 56" stroke="rgba(0,0,0,0.22)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  )
}
/** Headshot path: FotMob-sourced override by player id first, then the dataset's own photo. */
const FACE_SETS: [string, number][] = [['u18', 18], ['19-24', 24], ['25-30', 30], ['31-36', 99]]
/**
 * Auto-generated Iranian players get a generated headshot (pipeline/11-faces.py): always the same one
 * for a given player within an age set, moving to the next set as he gets older, like a new season's photo.
 */
function generatedFace(p: Player): string | undefined {
  if (p.real || p.nat[0] !== 'IRN') return undefined
  const day = useGame.getState().w?.day
  if (day == null) return undefined
  const age = ageOn(p.dob, day)
  const set = FACE_SETS.find(([, max]) => age <= max)![0]
  const n = (FACES as Record<string, number>)[set] ?? 0
  return n ? `faces/gen/${set}-${String(hashStr(`face:${p.id}`) % n).padStart(3, '0')}.webp` : undefined
}
export const playerPhoto = (p: Player): string | undefined => (p.rid ? (PHOTOS as Record<string, string>)[p.rid] : undefined) ?? p.photo ?? generatedFace(p)
export function Face({ p }: { p: Player }) {
  const src = playerPhoto(p)
  return src ? <img src={`${import.meta.env.BASE_URL}${src}`} alt="" loading="lazy" /> : <Portrait p={p} />
}
export function Avatar({ p, size = 28 }: { p: Player; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size }}><Face p={p} /></span>
}

export function PlayerCard({ p, style }: { p: Player; style?: CSSProperties }) {
  const v = scoutView(p)
  const fs = faceStats(p.attrs, p.pos[0])
  const tier = !v.exact ? 'silver' : p.ovr >= 82 ? 'elite' : p.ovr >= 72 ? 'gold' : p.ovr >= 62 ? 'silver' : 'bronze'
  return (
    <div className={`fcard ${tier}`} style={style}>
      <div className="fcard-top">
        <div>
          <div className="fcard-ovr">{v.exact ? p.ovr : '??'}</div>
          <div className="fcard-pos">{p.pos[0]}</div>
          <Flag code={p.nat[0]} />
        </div>
        <div className="fcard-face"><Face p={p} /></div>
      </div>
      <div className="fcard-name">{p.name.split(' ').slice(1).join(' ') || p.name}</div>
      <div className="fcard-stats">
        {fs.labels.map((l, i) => <div key={l}><b>{v.attrs ? fs.values[i] : '–'}</b><span>{l}</span></div>)}
      </div>
    </div>
  )
}

export function PlayerLink({ p, sub }: { p: Player; sub?: ReactNode }) {
  const open = useGame((s) => s.openPlayer)
  return (
    <span className="row" style={{ gap: 9, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); open(p.id) }}>
      <Avatar p={p} />
      <span className="col" style={{ gap: 0, minWidth: 0 }}>
        <span className="truncate" style={{ fontWeight: 580 }}>{p.name}</span>
        {sub && <span className="faint truncate" style={{ fontSize: 11.5 }}>{sub}</span>}
      </span>
    </span>
  )
}

export function Meter({ v, tone }: { v: number; tone?: 'green' | 'red' | 'amber' }) {
  return <div className={`meter ${tone ?? ''}`}><i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div>
}
export const tone = (v: number): 'green' | 'amber' | 'red' => (v >= 62 ? 'green' : v >= 40 ? 'amber' : 'red')

export function Empty({ children }: { children: ReactNode }) {
  return <div className="faint center" style={{ padding: '34px 12px' }}>{children}</div>
}
