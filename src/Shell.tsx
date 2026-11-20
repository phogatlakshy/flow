import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bell, CornerDownLeft, Search, type LucideIcon } from 'lucide-react'
import { Label, type Translate } from './ui'

export function BrandMark() {
  return <img className="brand-logo" src="/logo-mark.png?v=2" alt="" width="34" height="34" />
}

export type PaletteItem = { id: string; group: string; label: string; hint?: string; icon: LucideIcon; keywords?: string; run: () => void }
export function CommandPalette({ open, close, items, t }: { open: boolean; close: () => void; items: PaletteItem[]; t: Translate }) {
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) { node.showModal(); setQuery(''); setActive(0); requestAnimationFrame(() => input.current?.focus()) }
    if (!open && node.open) node.close()
  }, [open])
  const filtered = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return items.filter((item) => terms.every((term) => (item.label + ' ' + (item.hint || '') + ' ' + (item.keywords || '') + ' ' + item.group).toLocaleLowerCase().includes(term))).slice(0, 60)
  }, [items, query])
  useEffect(() => { setActive(0) }, [query])
  useEffect(() => { ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active])
  const run = (item?: PaletteItem) => { if (!item) return; close(); item.run() }
  let lastGroup = ''
  return <dialog ref={ref} className="dialog palette" aria-label={t('Command palette', '명령 팔레트')} onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === ref.current) close() }}>
    <div className="palette-input"><Search size={18} />
      <input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search pages, people, or actions…', '페이지, 팀원, 작업 검색…')} aria-label={t('Search', '검색')} role="combobox" aria-expanded="true" aria-controls="palette-list"
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(filtered.length - 1, index + 1)) }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(0, index - 1)) }
          if (event.key === 'Enter') { event.preventDefault(); run(filtered[active]) }
        }} />
      <kbd>ESC</kbd></div>
    <div className="palette-list" id="palette-list" role="listbox">
      {!filtered.length && <p className="empty-state">{t('No results found.', '검색 결과가 없습니다.')}</p>}
      {filtered.map((item, index) => {
        const heading = item.group !== lastGroup ? item.group : ''
        lastGroup = item.group
        const Icon = item.icon
        return <div key={item.id}>{heading && <div className="palette-group">{heading}</div>}
          <button className="palette-item" role="option" aria-selected={index === active} onMouseMove={() => setActive(index)} onClick={() => run(item)}>
            <Icon size={16} /><div>{item.label}{item.hint && <small>{item.hint}</small>}</div>{index === active && <CornerDownLeft size={13} />}
          </button></div>
      })}
    </div>
    <div className="palette-foot"><span>↑↓ {t('navigate', '이동')}</span><span>↵ {t('open', '열기')}</span><span>esc {t('close', '닫기')}</span></div>
  </dialog>
}

export type Notification = { id: string; tone: 'red' | 'peach' | 'violet' | 'green'; level: string; title: string; detail: string; open: () => void }
const SEEN_KEY = 'skillrelay.notifications.seen'
export function NotificationsBell({ items, t, footer }: { items: Notification[]; t: Translate; footer: { label: string; run: () => void } }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]') } catch { return [] } })
  const root = useRef<HTMLDivElement>(null)
  const unseen = items.filter((item) => !seen.includes(item.id)).length
  useEffect(() => {
    if (!open) return
    const ids = items.map(({ id }) => id)
    setSeen(ids)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)) } catch { /* Optional. */ }
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape) }
  }, [open, items])
  return <div ref={root} style={{ position: 'relative' }}>
    <button className="icon-button" aria-label={t('Notifications', '알림') + (unseen ? ' · ' + unseen : '')} aria-expanded={open} onClick={() => setOpen(!open)}>
      <Bell size={17} />{unseen > 0 && <span className="badge-count">{unseen > 9 ? '9+' : unseen}</span>}
    </button>
    {open && <div className="popover" role="dialog" aria-label={t('Notifications', '알림')}>
      <div className="popover-head"><h3>{t('Needs attention', '확인 필요')}</h3><span>{items.length} {t('total', '건')}</span></div>
      <div className="popover-list">
        {!items.length && <div className="empty-state"><Bell size={26} /><strong>{t('All clear', '모두 정상')}</strong>{t('Run a schedule scan to check for new risks.', '일정 스캔을 실행해 새 위험을 확인하세요.')}</div>}
        {items.map((item) => <button key={item.id} className="notif" onClick={() => { setOpen(false); item.open() }}>
          <Label tone={item.tone}>{item.level}</Label><div><strong>{item.title}</strong><p>{item.detail}</p></div>
        </button>)}
      </div>
      <div className="popover-foot"><button className="btn ghost slim" onClick={() => { setOpen(false); footer.run() }}>{footer.label} →</button></div>
    </div>}
  </div>
}

export function Toasts({ message }: { message: ReactNode }) {
  if (!message) return null
  return <div className="toast-stack" role="status" aria-live="polite"><div className="toast"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg><div>{message}</div></div></div>
}
