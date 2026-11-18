import { CheckCheck, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fmtDay } from '../../sim/core/date'
import { Empty } from '../bits'
import { useGame } from '../store'

const CAT: Record<string, [string, string]> = { news: ['News', ''], squad: ['Squad', 'blue'], match: ['Match', 'green'], scout: ['Scouting', 'amber'], board: ['Board', 'red'], transfer: ['Transfer', 'blue'], injury: ['Injury', 'red'], staff: ['Staff', ''] }

export function Inbox() {
  const { w, cmd, link } = useGame()
  const [cat, setCat] = useState('all')
  const list = [...w!.inbox].reverse().filter((m) => cat === 'all' || m.cat === cat)
  const unread = w!.inbox.filter((m) => !m.read).length
  const [sel, setSel] = useState<number | null>(list[0]?.id ?? null)
  const cur = w!.inbox.find((m) => m.id === sel) ?? list[0]
  useEffect(() => { if (cur && !cur.read) void cmd('markRead', cur.id) }, [cur?.id]) // eslint-disable-line
  return (
    <div className="page-inner" style={{ height: '100%' }}>
      <div className="row">
      <div className="seg">
        {['all', 'match', 'squad', 'scout', 'transfer', 'injury', 'board', 'news', 'staff'].map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c === 'all' ? 'All' : CAT[c][0]}</button>)}
      </div>
      <span className="faint right">{unread} unread</span>
      <button className="btn" disabled={!unread} onClick={() => void cmd('markAllRead')}><CheckCheck />Mark all as read</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '420px 1fr', flex: 1, minHeight: 0 }}>
        <div className="card flush scroll">
          {list.length === 0 && <Empty>Nothing here yet.</Empty>}
          {list.map((m) => (
            <button key={m.id} onClick={() => setSel(m.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.045)', background: cur?.id === m.id ? 'rgba(255,255,255,0.07)' : 'transparent' }}>
              <div className="row" style={{ gap: 8 }}>
                {!m.read && <span style={{ width: 7, height: 7, borderRadius: 9, background: 'var(--blue)', flex: 'none' }} />}
                <span className="truncate grow" style={{ fontWeight: m.read ? 500 : 680 }}>{m.title}</span>
                <span className="faint num" style={{ fontSize: 11.5 }}>{fmtDay(m.day, false)}</span>
              </div>
              <div className="faint truncate" style={{ fontSize: 12, marginTop: 2 }}>{m.body.split('\n')[0]}</div>
            </button>
          ))}
        </div>
        <div className="card" style={{ padding: 30 }}>
          {cur ? (
            <div className="col" style={{ gap: 16, maxWidth: 720 }}>
              <div className="row"><span className={`pill ${CAT[cur.cat][1]}`}>{CAT[cur.cat][0]}</span><span className="faint">{fmtDay(cur.day)}</span></div>
              <h1 style={{ fontSize: 26 }}>{cur.title}</h1>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.65, color: '#d6d9df' }}>{cur.body}</div>
              {cur.link && <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => link(cur.link)}>Open <ChevronRight /></button>}
            </div>
          ) : <Empty>Select a message.</Empty>}
        </div>
      </div>
    </div>
  )
}
