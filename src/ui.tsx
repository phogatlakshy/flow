import { cloneElement, createContext, isValidElement, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, Check, ChevronDown, CircleHelp, X, type LucideIcon } from 'lucide-react'
import { type Employee, type Language } from './domain'

export type Translate = (english: string, korean: string) => string
export type Theme = 'light' | 'dark'
export const nameOf = (person: Employee, lang: Language) => lang === 'ko' ? person.korean : person.name
export const roleOf = (person: Employee, lang: Language) => lang === 'ko' ? person.roleKo || person.role : person.role
export const employmentStatus = (person: Employee, t: Translate) => person.status === 'leave' ? t('On leave', '휴직 중') : person.status === 'terminated' ? t('Employment ended', '고용 종료') : t('Active', '재직 중')

/* ---------- Theme ---------- */
const THEME_KEY = 'skillrelay.theme'
function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* Storage can be unavailable in private windows. */ }
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101013' : '#f2f4f6')
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* Optional preference. */ }
  }, [theme])
  return { theme, toggle: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') }
}
export const ThemeContext = createContext<Theme>('light')
export function useChartColors() {
  const theme = useContext(ThemeContext)
  const dark = theme === 'dark'
  return {
    primary: dark ? '#3182f6' : '#3182f6', violet: dark ? '#2cc4b4' : '#22b5a6', fuchsia: dark ? '#7cc6f5' : '#7fb8f0',
    green: dark ? '#34d399' : '#059669', amber: dark ? '#fbbf24' : '#d97706', red: dark ? '#f87171' : '#dc2626',
    sky: dark ? '#38bdf8' : '#0284c7', peach: dark ? '#94a3b8' : '#94a3b8', slate: dark ? '#64748b' : '#cbd5e1',
    grid: dark ? '#2c2c35' : '#e5e8eb', axis: dark ? '#85858f' : '#8b95a1', cursor: dark ? 'rgba(148,163,184,.08)' : 'rgba(17,24,39,.04)',
    surface: dark ? '#1b1b21' : '#ffffff',
    animate: !(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches),
  }
}
type TooltipEntry = { name?: unknown; value?: unknown; color?: string; payload?: unknown }
export function ChartTooltip({ active, payload, label, unit = '' }: { active?: boolean; payload?: readonly TooltipEntry[]; label?: unknown; unit?: string }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip">{label !== undefined && <strong>{String(label)}</strong>}{payload.map((entry, index) => <div key={index}><i style={{ background: entry.color || (entry.payload as { fill?: string } | undefined)?.fill }} />{String(entry.name ?? '')}: <b>{String(entry.value ?? '')}{unit}</b></div>)}</div>
}

/* ---------- Motion helpers ---------- */
export function useCountUp(target: number, duration = 750) {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); from.current = target; return }
    const start = performance.now()
    const origin = from.current
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(origin + (target - origin) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else from.current = target
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

/* ---------- Primitives ---------- */
export function Avatar({ person, size = '' }: { person: Employee; size?: string }) {
  return <span className={'avatar tint-' + person.color + ' ' + size} aria-hidden="true">{person.initials}</span>
}
export function IconBox({ icon: Icon, tone = 'violet' }: { icon: LucideIcon; tone?: string }) {
  return <span className={'icon-box tone-' + tone}><Icon size={18} strokeWidth={1.9} aria-hidden="true" /></span>
}
export function Label({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={'pill tone-' + tone}>{children}</span>
}
export function Notice({ children, tone = 'warning' }: { children: ReactNode; tone?: 'warning' | 'violet' | 'green' | 'red' }) {
  const Icon = tone === 'green' ? Check : tone === 'violet' ? CircleHelp : AlertCircle
  return <div className={'notice tone-' + tone} role={tone === 'red' ? 'alert' : 'status'}><Icon size={17} aria-hidden="true" /><div>{children}</div></div>
}
export function PanelTitle({ icon, title, subtitle, actions, tone }: { icon: LucideIcon; title: string; subtitle?: string; actions?: ReactNode; tone?: string }) {
  return <div className="panel-title">
    <IconBox icon={icon} tone={tone} />
    <div className="panel-heading"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
    {actions && <div className="panel-actions">{actions}</div>}
  </div>
}
export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: string; description?: string; actions?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-heading-actions">{actions}</div>}</div>
}
export function KpiCard({ label, value, suffix, sub, icon: Icon, accent = 'indigo', index = 0, decimals = 0, onClick }: {
  label: string; value: number; suffix?: string; sub?: ReactNode; icon: LucideIcon; accent?: string; index?: number; decimals?: number; onClick?: () => void
}) {
  const animated = useCountUp(value)
  const content = <>
    <div className="kpi-top"><div><p className="kpi-label">{label}</p><p className="kpi-value">{animated.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix && <small>{suffix}</small>}</p></div><span className="kpi-icon"><Icon size={17} strokeWidth={2} aria-hidden="true" /></span></div>
    {sub && <p className="kpi-sub">{sub}</p>}
  </>
  const props = { className: 'kpi accent-' + accent, style: { animationDelay: index * 45 + 'ms' } }
  return onClick ? <button type="button" {...props} onClick={onClick}>{content}</button> : <div {...props}>{content}</div>
}
export function Meter({ ratio, warn = .75, hot = .9 }: { ratio: number; warn?: number; hot?: number }) {
  return <div className={'meter ' + (ratio >= hot ? 'hot' : ratio >= warn ? 'warn' : '')} role="presentation"><span style={{ width: Math.min(100, Math.max(0, ratio * 100)) + '%' }} /></div>
}
export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return <div className="empty-state"><Icon size={30} aria-hidden="true" /><strong>{title}</strong>{children}</div>
}
export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="select-wrap"><select {...props}>{children}</select><ChevronDown size={15} aria-hidden="true" /></span>
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId()
  const control = isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
    ? cloneElement(children, { id, 'aria-describedby': hint ? id + '-hint' : undefined }) : children
  return <div className="field"><label htmlFor={id}>{label}</label>{control}{hint && <small id={id + '-hint'}>{hint}</small>}</div>
}
export function Dialog({ title, close, children, variant = '' }: { title: string; close: () => void; children: ReactNode; variant?: '' | 'sheet' }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    node?.showModal()
    return () => node?.close()
  }, [])
  return <dialog className={'dialog ' + variant} ref={ref} aria-labelledby="dialog-title" onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === ref.current) close() }}>
    <div className="dialog-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label={document.documentElement.lang === 'ko' ? '닫기' : 'Close'} onClick={close}><X size={18} /></button></div>
    <div className="dialog-body">{children}</div>
  </dialog>
}
