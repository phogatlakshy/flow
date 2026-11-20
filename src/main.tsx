import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity, Briefcase, CalendarDays, Check, ChevronDown, ChevronRight, Cpu, Download, FlaskConical, Globe2, History,
  LayoutDashboard, Menu, Moon, Plus, Search, Settings2, Sun, BarChart3, Upload, User, UserRound, Users, X, Zap,
} from 'lucide-react'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './styles.css'
import { Approval, Compare } from './Compare'
import { Dashboard } from './Dashboard'
import { EmployeeProfile, Employees } from './People'
import { RequestPane, sampleLoaded, TaskForm } from './Request'
import { AssignmentDetails, Calendar, CommitmentForm, EmployeeView, VerificationForm } from './Schedule'
import { Settings } from './Settings'
import { BrandMark, CommandPalette, NotificationsBell, Toasts, type Notification, type PaletteItem } from './Shell'
import { Automation, downloadCalendar, findingLabel, Import, severity, WorkLog } from './TeamTools'
import { accessId, displayTime, emptyTask, skillLabel, type Assignment, type Block, type Language, type Task, type Workspace } from './domain'
import { defaultModel, extractTask, IntakeError, listModels } from './intake'
import { importToWorkspace, scanTeam } from './operations'
import { checkApproval, flagCalendarChanges, planTask, type PlanResult } from './scheduler'
import { dashboardTask, demoPreviousOwner, demoRecommended, exampleRequest, roster, teamName, teams } from './seed'
import { getPref, readWorkspace, setPref, transact, WORKSPACE_KEY } from './storage'
import { Dialog, Label, nameOf, PageHeading, Select, ThemeContext, useTheme, type Translate } from './ui'

const Insights = lazy(() => import('./Insights').then(({ Insights }) => ({ default: Insights })))

const VIEWS = ['dashboard', 'employees', 'automation', 'workspace', 'calendar', 'worklog', 'workload', 'employee', 'import'] as const
type View = typeof VIEWS[number]
type Step = 'request' | 'compare' | 'approve'
type Modal = { kind: 'settings' } | { kind: 'assignment'; id: string } | { kind: 'commitment'; person?: string; block?: Block } | { kind: 'verify'; id: string } | { kind: 'person'; id: string }
const viewFromHash = (): View => { const id = location.hash.replace(/^#\/?/, ''); return (VIEWS as readonly string[]).includes(id) ? id as View : 'dashboard' }

function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const [lang, setLanguage] = useState<Language>(() => getPref('language', 'ko') === 'en' ? 'en' : 'ko')
  const t: Translate = (en, ko) => lang === 'ko' ? ko : en
  const [team, setTeam] = useState(teams[0])
  const [view, setView] = useState<View>(viewFromHash)
  const [step, setStep] = useState<Step>('request')
  const [raw, setRaw] = useState(() => exampleRequest(lang))
  const [workspace, setWorkspace] = useState(readWorkspace)
  const [task, setTask] = useState<Task>()
  const [draftSource, setDraftSource] = useState<'manual' | 'seed' | 'ollama' | 'review'>('manual')
  const [warning, setWarning] = useState('')
  const [snapshot, setSnapshot] = useState<{ plan: PlanResult; version: number; approvalId: string; reviewedHistory?: number }>()
  const [selected, setSelected] = useState('')
  const [replacement, setReplacement] = useState(false)
  const [completedId, setCompletedId] = useState('')
  const [stale, setStale] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState<Modal>()
  const [menu, setMenu] = useState(false)
  const [palette, setPalette] = useState(false)
  const [personId, setPersonId] = useState(demoRecommended)
  const [online, setOnline] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState(() => getPref('model', defaultModel))
  const request = useRef<AbortController | null>(null)
  const people = roster.filter((person) => person.team === team)
  const chosen = snapshot?.plan.ranked.find((record) => record.employee.id === selected)
  const confirmed = workspace.assignments.find((record) => record.task.id === completedId)
  const modalAssignment = modal?.kind === 'assignment' ? workspace.assignments.find((record) => record.task.id === modal.id) : undefined
  const modalPerson = modal?.kind === 'verify' ? roster.find((person) => person.id === modal.id) : undefined
  const profilePerson = modal?.kind === 'person' ? roster.find((person) => person.id === modal.id) : undefined
  const teamAssignments = workspace.assignments.filter((record) => record.task.team === team)
  const pendingCount = teamAssignments.filter((record) => record.pending).length

  // Flow-style navigation: one simple list.
  // Menu grouped by task, the way Korean groupware menus are organised.
  const routes: { id: View; group: string; icon: typeof LayoutDashboard; label: string; hint: string; badge?: number }[] = [
    { id: 'dashboard', group: t('Home', '홈'), icon: LayoutDashboard, label: t('Dashboard', '대시보드'), hint: t('Team status at a glance', '팀 현황 한눈에 보기') },
    { id: 'workspace', group: t('Work', '업무'), icon: Briefcase, label: t('Assign Work', '업무 배정'), hint: t('Request → Compare → Approve', '요청 → 비교 → 승인') },
    { id: 'calendar', group: t('Work', '업무'), icon: CalendarDays, label: t('Team Calendar', '팀 일정'), hint: t('Shared work blocks', '팀원별 일정과 작업 시간') },
    { id: 'worklog', group: t('Work', '업무'), icon: History, label: t('Work Log', '배정 내역'), hint: t('Assignment history', '확정 및 검토 내역'), badge: pendingCount },
    { id: 'employees', group: t('Team', '팀 관리'), icon: Users, label: t('Employees', '팀원 관리'), hint: t('Directory, skills, workload', '팀원 정보, 스킬, 업무량') },
    { id: 'automation', group: t('Team', '팀 관리'), icon: Zap, label: t('Schedule Check', '일정 점검'), hint: t('Find schedule risks', '일정 위험 자동 점검') },
    { id: 'workload', group: t('Team', '팀 관리'), icon: BarChart3, label: t('Reports', '분석 리포트'), hint: t('Workload and comparison', '업무량 및 배정 방식 비교') },
    { id: 'employee', group: t('Team', '팀 관리'), icon: UserRound, label: t('Employee View', '팀원 화면'), hint: t('What a team member sees', '팀원이 보는 화면') },
    { id: 'import', group: t('Data', '데이터'), icon: Upload, label: t('Upload CSV', 'CSV 업로드'), hint: t('Import commitments or skills', '일정 또는 스킬 가져오기') },
  ]
  const groups = [...new Set(routes.map(({ group }) => group))]
  const route = routes.find(({ id }) => id === view)!
  const steps = [
    { id: 'request', title: t('Request', '요청'), sub: t('Capture task details', '과제 세부 정보') },
    { id: 'compare', title: t('Compare', '비교'), sub: t('Review eligible matches', '배정 후보 검토') },
    { id: 'approve', title: t('Approve', '승인'), sub: t('Confirm the assignment', '배정 확정') },
  ] as const
  const currentStep = steps.findIndex((item) => item.id === step)

  async function checkModels() {
    try { setModels(await listModels()); setOnline(true) } catch { setOnline(false); setModels([]) }
  }
  useEffect(() => {
    void checkModels()
    const storage = (event: StorageEvent) => { if (event.key === WORKSPACE_KEY) setWorkspace(readWorkspace()) }
    const hash = () => setView(viewFromHash())
    const keys = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPalette((open) => !open) } }
    window.addEventListener('storage', storage)
    window.addEventListener('hashchange', hash)
    window.addEventListener('keydown', keys)
    return () => { window.removeEventListener('storage', storage); window.removeEventListener('hashchange', hash); window.removeEventListener('keydown', keys) }
  }, [])
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  useEffect(() => { document.title = route.label + ' · SkillRelay' }, [route.label])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const go = (page: View) => {
    setView(page); setMenu(false)
    if (location.hash !== '#/' + page) history.pushState(null, '', '#/' + page)
    window.scrollTo(0, 0)
  }
  function cancelExtraction() { request.current?.abort(); request.current = null; setBusy(false) }
  function reset(nextTeam = team, sample = false) {
    cancelExtraction()
    setTask(undefined); setWarning(''); setSelected(''); setSnapshot(undefined); setCompletedId(''); setReplacement(false); setStale(null)
    setStep('request'); setRaw(sample && nextTeam === teams[0] ? exampleRequest(lang) : '')
    go('workspace')
  }
  function language() {
    const next = lang === 'en' ? 'ko' : 'en'
    if (sampleLoaded(raw) && !busy) setRaw(exampleRequest(next))
    setPref('language', next)
    setLanguage(next)
  }
  function openDraft(draft: Task, source: typeof draftSource, message = '') {
    setTask({ ...draft, id: draft.id || crypto.randomUUID() }); setDraftSource(source); setWarning(message); setStep('request')
    setSnapshot(undefined); setSelected(''); setCompletedId(''); setStale(null)
  }
  function manual(message = '') {
    cancelExtraction()
    const sample = sampleLoaded(raw) && team === teams[0]
    openDraft(sample ? { ...dashboardTask(raw === exampleRequest('ko') ? 'ko' : 'en'), raw } : emptyTask(team, raw), sample ? 'seed' : 'manual', message)
  }
  function loadExample(open?: boolean) {
    if (open) openDraft(dashboardTask(lang), 'seed')
    setRaw(exampleRequest(lang))
  }
  function openDemo() { setReplacement(false); loadExample(true); go('workspace') }
  async function extract() {
    if (busy || !raw.trim()) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    try {
      const draft = await extractTask(raw, team, workspace.now, model, controller.signal)
      if (request.current !== controller) return
      setOnline(true)
      const sample = sampleLoaded(raw) && team === teams[0]
      openDraft(sample ? { ...draft, id: 'dashboard-demo', previousOwner: demoPreviousOwner } : draft, 'ollama')
    } catch (error) {
      if (request.current !== controller) return
      const kind = error instanceof IntakeError ? error.kind : 'offline'
      if (kind === 'offline') setOnline(false)
      manual(kind === 'malformed' ? t('Ollama returned an invalid draft. Your request is preserved. Review the fields manually.', 'Ollama 초안 형식이 올바르지 않습니다. 원본 요청을 유지하고 직접 검토합니다.')
        : kind === 'no-model' ? t('The selected model is unavailable. Your request is preserved in the manual form.', '선택한 모델을 사용할 수 없습니다. 직접 입력 화면에 원본 요청을 유지했습니다.')
          : t('Ollama is unavailable. Your request is preserved in the manual form.', 'Ollama에 연결할 수 없습니다. 직접 입력 화면에 원본 요청을 유지했습니다.'))
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false) }
    }
  }
  function compare(draft = task) {
    if (!draft) return
    const latest = readWorkspace()
    setWorkspace(latest)
    const plan = planTask(draft, latest, replacement ? draft.id : undefined)
    const top = plan.ranked.slice(0, 3)
    const record = latest.assignments.find(({ task }) => task.id === draft.id)
    setSnapshot({ plan, version: latest.version, approvalId: crypto.randomUUID(), reviewedHistory: record?.history.length })
    setSelected(top.some((candidate) => candidate.employee.id === selected) ? selected : top[0]?.employee.id || '')
    setStep('compare'); setStale(null); setCompletedId('')
    go('workspace')
  }
  async function update(mutator: (state: Workspace) => Workspace, success?: string) {
    try {
      const { state } = await transact((current) => ({ state: mutator(current), result: true }))
      setWorkspace(state)
      if (success) setToast(success)
      return true
    } catch {
      setToast(t('The browser could not save this change.', '브라우저에서 변경 사항을 저장하지 못했습니다.'))
      return false
    }
  }
  async function approve() {
    if (!task || !chosen || !snapshot || saving || completedId) return
    setSaving(true)
    try {
      const { state, result } = await transact((latest) => {
        const checked = checkApproval(latest, task, chosen, replacement, snapshot.approvalId, snapshot.reviewedHistory)
        return { state: checked.state, result: { status: checked.status, conflicts: checked.conflicts } }
      })
      setWorkspace(state)
      if (result.status === 'stale') setStale(result.conflicts || [])
      else {
        setCompletedId(task.id)
        if (result.status === 'duplicate') setToast(t('This task was already booked.', '이미 예약된 과제입니다.'))
      }
    } catch { setToast(t('The browser could not save the assignment.', '브라우저에서 배정을 저장하지 못했습니다.')) }
    finally { setSaving(false) }
  }
  function editAssignment(record: Assignment) { setModal({ kind: 'assignment', id: record.task.id }) }
  function openCommitment(person?: string, block?: Block) { setModal({ kind: 'commitment', person, block }) }
  function openPerson(id: string) { setModal({ kind: 'person', id }) }
  function beginReplacement(record: Assignment) {
    setModal(undefined); setReplacement(true); setRaw(record.task.raw); setTeam(record.task.team)
    openDraft({ ...(record.proposed || record.task), confirmed: false }, 'review')
    go('workspace')
  }
  function markReview(id: string, note: string, effort: number | null, proposed?: Task) {
    void update((state) => ({ ...state, version: state.version + 1, assignments: state.assignments.map((record) => {
      if (record.task.id !== id) return record
      const taskUpdate = proposed || (effort ? { ...(record.proposed || record.task), max: effort, min: Math.min(record.task.min || effort, effort), confirmed: false } : record.proposed)
      return { ...record, proposed: taskUpdate, pending: true, history: [...record.history, { at: state.now, type: proposed ? 'change' : effort ? 'effort' : 'review', note: note + (effort ? ' · ' + effort + ' min' : '') }] }
    }) }), t('Review saved. The original booking is still visible.', '검토가 저장되었고 기존 예약이 유지됩니다.')).then((ok) => { if (ok) setModal(undefined) })
  }
  function saveCommitment(block: Block) {
    const employee = view === 'employee'
    void update((state) => {
      const changed = flagCalendarChanges({ ...state, blocks: [...state.blocks.filter((item) => item.id !== block.id), block] }, block.title)
      if (!employee) return changed
      return { ...changed, assignments: changed.assignments.map((record) => record.employeeId === block.employeeId && record.pending
        ? { ...record, history: [...record.history, { at: state.now, type: 'commitment', note: block.title }] } : record) }
    }, t('Commitment saved.', '일정이 저장되었습니다.')).then((ok) => { if (ok) setModal(undefined) })
  }
  function runScan() {
    void update((state) => ({ ...state, scans: [scanTeam(state, team, roster), ...(state.scans || [])].slice(0, 30) }), t('Schedule scan complete.', '일정 스캔이 완료되었습니다.'))
  }
  function resetWorkspace() {
    try { localStorage.removeItem(WORKSPACE_KEY) } catch { /* A fresh fixture loads either way. */ }
    setWorkspace(readWorkspace()); setModal(undefined); reset(team, true); go('dashboard')
    setToast(t('Demo workspace restored.', '데모 워크스페이스가 초기화되었습니다.'))
  }
  const fromLead = view !== 'employee'

  // Bell: pending reviews plus the latest scan's watch/review findings for this team.
  const notifications = useMemo<Notification[]>(() => {
    const items: Notification[] = teamAssignments.filter((record) => record.pending).map((record) => ({
      id: 'review:' + record.task.id + ':' + record.history.length, tone: 'red', level: t('Review', '검토'),
      title: t('Assignment needs review', '배정 검토 필요'), detail: record.task.title + ' · ' + record.history.at(-1)?.note, open: () => editAssignment(record),
    }))
    const scan = (workspace.scans || []).find((item) => item.team === team)
    scan?.findings.filter((finding) => finding.level >= 2 && finding.kind !== 'review').forEach((finding, index) => {
      const person = roster.find(({ id }) => id === finding.ref)
      const sev = severity(finding.level, t)
      items.push({ id: scan.id + ':' + index, tone: sev.tone, level: sev.label, title: findingLabel(finding.kind, t), detail: (person ? nameOf(person, lang) + ' · ' : '') + (finding.kind === 'skill' ? skillLabel(finding.detail, lang) : finding.detail), open: () => go('automation') })
    })
    return items.slice(0, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, team, lang])

  const paletteItems: PaletteItem[] = [
    ...routes.map((item) => ({ id: 'page:' + item.id, group: t('Navigate', '이동'), label: item.label, hint: item.hint, icon: item.icon, run: () => go(item.id) })),
    { id: 'act:new', group: t('Actions', '작업'), label: t('New request', '새 요청'), icon: Plus, keywords: 'task assign', run: () => reset() },
    ...(team === teams[0] ? [{ id: 'act:demo', group: t('Actions', '작업'), label: t('Open demo task', '데모 과제 열기'), hint: t('The dashboard fix scenario', '대시보드 수정 시나리오'), icon: FlaskConical, run: openDemo }] : []),
    { id: 'act:scan', group: t('Actions', '작업'), label: t('Run schedule scan', '일정 스캔 실행'), icon: Activity, keywords: 'automation alerts', run: () => { runScan(); go('automation') } },
    { id: 'act:commit', group: t('Actions', '작업'), label: t('Add commitment', '일정 추가'), icon: CalendarDays, keywords: 'meeting block', run: () => openCommitment() },
    { id: 'act:ics', group: t('Actions', '작업'), label: t('Download team calendar', '팀 캘린더 다운로드'), hint: '.ics', icon: Download, run: () => downloadCalendar(teamAssignments, people, workspace.now) },
    { id: 'act:theme', group: t('Actions', '작업'), label: theme === 'dark' ? t('Switch to light mode', '라이트 모드로 전환') : t('Switch to dark mode', '다크 모드로 전환'), icon: theme === 'dark' ? Sun : Moon, run: toggleTheme },
    { id: 'act:lang', group: t('Actions', '작업'), label: lang === 'en' ? '한국어로 전환' : 'Switch to English', icon: Globe2, keywords: 'language korean english', run: language },
    { id: 'act:settings', group: t('Actions', '작업'), label: t('Settings', '설정'), hint: t('Ollama, policy, reset', 'Ollama, 정책, 초기화'), icon: Settings2, run: () => setModal({ kind: 'settings' }) },
    ...people.map((person) => ({ id: 'person:' + person.id, group: t('Employees', '팀원'), label: nameOf(person, lang), hint: person.role + ' · ' + person.id, icon: User, keywords: person.name + ' ' + person.korean, run: () => openPerson(person.id) })),
  ]

  const synthetic = <Label tone="peach"><FlaskConical size={12} />{t('Synthetic records', '합성 기록')}</Label>
  const descriptions: Partial<Record<View, string>> = {
    employees: t('Search the team, filter by skill or status, and open a profile.', '팀원을 검색하고 스킬이나 상태로 필터링한 뒤 프로필을 엽니다.'),
    automation: t('Proactive checks across the shared calendar.', '공유 캘린더 전체를 미리 점검합니다.'),
    workspace: t('Match urgent work to the people with the skills, access, and time to deliver.', '긴급 업무를 필요한 스킬, 권한, 시간을 갖춘 팀원에게 배정하세요.'),
    calendar: t('Every work block and commitment in one place · Asia/Seoul.', '모든 작업 블록과 일정을 한곳에서 · Asia/Seoul.'),
    worklog: t('Audit trail of every confirmed assignment and review.', '모든 확정 배정과 검토의 감사 기록입니다.'),
    workload: t('Workload, replay against previous-owner-first, and team pressure points.', '업무량, 이전 담당자 우선 방식과의 비교, 팀 부담 요인.'),
    employee: t('What a team member sees on the shared calendar.', '팀원이 공유 캘린더에서 보는 화면입니다.'),
    import: t('Bring in commitments or verified skills for this team.', '이 팀의 일정이나 검증된 스킬을 가져옵니다.'),
  }

  return <ThemeContext.Provider value={theme}><div className="shell">
    {menu && <button aria-label={t('Close menu', '메뉴 닫기')} className="mobile-overlay" onClick={() => setMenu(false)} />}

    <aside className={'sidebar ' + (menu ? 'open' : '')}>
      <button className="brand" onClick={() => go('dashboard')} aria-label="SkillRelay"><BrandMark /><span><span className="brand-name">SkillRelay</span><span className="brand-tag">{t('Workforce planning', '인력 배정 관리')}</span></span></button>
      <div className="team-switch"><span className="team-icon">{teamName(team, lang).slice(0, 1)}</span><div><label htmlFor="team-select">{t('Team', '팀')}</label><Select id="team-select" value={team} onChange={(event) => { setTeam(event.target.value); reset(event.target.value, true); go(view) }}>{teams.map((item) => <option value={item} key={item}>{teamName(item, lang)}</option>)}</Select></div></div>
      <nav aria-label={t('Main navigation', '주 메뉴')}>
        {groups.map((group) => <div className="nav-group" key={group}><span className="nav-caption">{group}</span><div style={{ display: 'grid', gap: 2 }}>
          {routes.filter((item) => item.group === group).map(({ id, icon: Icon, label, badge }) => <button key={id} className={'nav-item ' + (view === id ? 'active' : '')} aria-current={view === id ? 'page' : undefined} onClick={() => go(id)}>
            <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{!!badge && <span className="nav-badge">{badge}</span>}
          </button>)}
        </div></div>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => { setMenu(false); setModal({ kind: 'settings' }) }}><Settings2 size={18} /><span>{t('Settings', '설정')}</span></button>
        <div className="demo-clock">
          <div><span className="live-dot" />{t('Demo workspace', '데모 워크스페이스')}</div><span>{displayTime(workspace.now, lang)}</span>
          <button className="text-button" style={{ marginTop: 6, marginLeft: 15, color: 'var(--text-2)' }} onClick={() => setModal({ kind: 'settings' })}><span className={'live-dot ' + (online ? '' : 'off')} /><Cpu size={13} />Ollama {online ? t('connected', '연결됨') : t('offline', '연결 안 됨')}</button>
        </div>
        <button className="profile" onClick={() => go(view === 'employee' ? 'workspace' : 'employee')}><span className="profile-avatar">{view === 'employee' ? 'EV' : 'TL'}</span><span><strong>{view === 'employee' ? t('Employee mode', '팀원 모드') : t('Team lead', '팀 리드')}</strong><small>{t('Local session', '로컬 세션')}</small></span><ChevronDown size={15} /></button>
      </div>
    </aside>

    <div className="main">
      <header className="topbar">
        <div className="topbar-title">
          <button className="icon-button menu-button" onClick={() => setMenu(!menu)} aria-label={t('Open menu', '메뉴 열기')}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
          <div className="breadcrumb"><span>{teamName(team, lang)}</span><ChevronRight size={14} /><strong key={view}>{route.label}</strong></div>
        </div>
        <div className="header-actions">
          <button className="chip-button search-button" onClick={() => setPalette(true)} aria-label={t('Search', '검색')}><Search size={15} /><span>{t('Search menus and people', '메뉴·팀원 검색')}</span><kbd>Ctrl K</kbd></button>
          <NotificationsBell items={notifications} t={t} footer={{ label: t('View all in Schedule Check', '일정 점검에서 모두 보기'), run: () => go('automation') }} />
          <span className="header-divider" />
          <button className="icon-button lang-button" onClick={language} aria-label={lang === 'en' ? '한국어로 전환' : 'Switch to English'}><Globe2 size={16} />{lang === 'en' ? 'English' : '한국어'}</button>
          <button className="icon-button" onClick={toggleTheme} aria-label={theme === 'dark' ? t('Switch to light mode', '라이트 모드로 전환') : t('Switch to dark mode', '다크 모드로 전환')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
        </div>
      </header>

      <main className="content">
        <div className="page" key={view}>
          {view === 'dashboard' && <Dashboard workspace={workspace} people={people} lang={lang} t={t} demoTeam={team === teams[0]} onNavigate={go} onNewRequest={() => reset()} onDemo={openDemo} onScan={() => { runScan(); go('automation') }} onAssignment={editAssignment} onPerson={openPerson} />}

          {view === 'workspace' && <>
            <PageHeading eyebrow={<Label tone="violet"><Briefcase size={12} />{teamName(team, lang)}</Label>} title={t('Assign Work', '업무 배정')} description={descriptions.workspace}
              actions={(step !== 'request' || task) && <button className="btn secondary slim" onClick={() => reset()}><Plus size={15} />{t('New request', '새 요청')}</button>} />
            <nav className="stepper" aria-label={t('Assignment steps', '배정 단계')}>{steps.map((item, index) => <div className="step-cell" key={item.id}>
              <button className={currentStep === index ? 'current' : currentStep > index ? 'past' : ''} aria-current={currentStep === index ? 'step' : undefined}
                disabled={currentStep === index || (!!confirmed && index !== currentStep) || (index === 1 && !snapshot) || (index === 2 && (!snapshot || !chosen || currentStep < 1))}
                onClick={() => { setStep(item.id); if (item.id === 'compare' && stale) compare() }}>
                <span className="step-circle">{index < currentStep ? <Check size={15} /> : index + 1}</span><span className="step-label"><strong>{item.title}</strong><small>{item.sub}</small></span>
              </button>{index < steps.length - 1 && <ChevronRight className="step-divider" size={16} />}</div>)}</nav>
            {step === 'request' && (!task
              ? <RequestPane raw={raw} setRaw={setRaw} language={lang} t={t} busy={busy} isSample={sampleLoaded(raw)} onExample={loadExample} onExtract={() => void extract()} onManual={() => manual()} onSettings={() => setModal({ kind: 'settings' })} onCalendar={() => go('calendar')} team={team} people={people} workspace={workspace} />
              : <TaskForm key={task.id + draftSource} task={task} onChange={(draft) => { setTask(draft); setSnapshot(undefined); setSelected('') }} now={workspace.now} people={people} t={t} lang={lang} warning={warning} source={draftSource} onBack={() => { setTask(undefined); setSnapshot(undefined); setReplacement(false) }} onSubmit={() => compare()} />)}
            {step === 'compare' && task && snapshot && <Compare task={task} plan={snapshot.plan} current={workspace} replacement={replacement} lang={lang} t={t} selected={selected} select={setSelected} onEdit={() => setStep('request')} onNext={() => { setStep('approve'); window.scrollTo(0, 0) }} onScenario={(next) => { setTask({ ...next, confirmed: false }); setSnapshot(undefined); setStep('request') }} onSettings={() => setModal({ kind: 'settings' })} onRefresh={() => compare()} stale={workspace.version !== snapshot.version} onVerify={(id) => setModal({ kind: 'verify', id })} />}
            {step === 'approve' && task && <Approval task={task} candidate={chosen} replacement={replacement} confirmed={confirmed} confirmedEmployee={people.find((person) => person.id === confirmed?.employeeId)} stale={stale} busy={saving} onApprove={() => void approve()} onCompare={() => stale ? compare() : setStep('compare')} onCalendar={() => go('calendar')} onDownload={() => { if (confirmed) downloadCalendar([confirmed], people, workspace.now) }} t={t} lang={lang} />}
          </>}

          {view !== 'dashboard' && view !== 'workspace' && <PageHeading eyebrow={<Label tone="violet"><route.icon size={12} />{teamName(team, lang)}</Label>} title={route.label} description={descriptions[view]} actions={synthetic} />}
          {view === 'employees' && <Employees workspace={workspace} people={people} lang={lang} t={t} onOpen={openPerson} />}
          {view === 'automation' && <Automation workspace={workspace} people={people} team={team} lang={lang} t={t} run={runScan} onAssignment={editAssignment} onPerson={openPerson} />}
          {view === 'calendar' && <Calendar key={team} workspace={workspace} people={people} lang={lang} t={t} onEdit={editAssignment} onCommitment={openCommitment} onLog={() => go('worklog')} />}
          {view === 'worklog' && <WorkLog workspace={workspace} people={people} team={team} lang={lang} t={t} onAssignment={editAssignment} />}
          {view === 'workload' && <Suspense fallback={<p className="muted">{t('Loading analytics…', '분석 불러오는 중…')}</p>}><Insights workspace={workspace} people={people} lang={lang} team={team} t={t} onTools={() => go('employees')} /></Suspense>}
          {view === 'employee' && <EmployeeView workspace={workspace} people={people} personId={personId} setPerson={setPersonId} lang={lang} t={t} onEdit={editAssignment} onCommitment={openCommitment} />}
          {view === 'import' && <Import people={people} t={t} apply={(data) => update((state) => importToWorkspace(state, data, t('CSV import changed the team schedule or profiles.', 'CSV 가져오기로 팀 일정 또는 프로필이 변경되었습니다.')), t('CSV imported.', 'CSV를 가져왔습니다.'))} />}
        </div>
        <footer className="footer"><span>SkillRelay</span><span>{t('Local prototype · Synthetic team data', '로컬 프로토타입 · 합성 팀 데이터')}</span><span>Asia/Seoul · KST</span></footer>
      </main>
    </div>

    <CommandPalette open={palette} close={() => setPalette(false)} items={paletteItems} t={t} />
    <Toasts message={toast} />

    {modal?.kind === 'settings' && <Dialog title={t('Workspace settings', '워크스페이스 설정')} close={() => setModal(undefined)}><Settings workspace={workspace} model={model} models={models} online={online} t={t} check={() => void checkModels()} onImport={() => { setModal(undefined); go('import') }} onReset={resetWorkspace} saveModel={(value) => { setModel(value); setPref('model', value); setToast(t('Local model saved.', '로컬 모델이 저장되었습니다.')) }} savePolicy={(policy, now) => {
      void update((state) => flagCalendarChanges({ ...state, policy, now }, t('Company policy or fixture clock changed.', '회사 정책 또는 데모 기준 시각이 변경되었습니다.'), true), t('Demo policy saved.', '데모 정책이 저장되었습니다.')).then((ok) => { if (ok) setModal(undefined) })
    }} /></Dialog>}
    {profilePerson && <Dialog key={profilePerson.id} variant="sheet" title={t('Employee profile', '팀원 프로필')} close={() => setModal(undefined)}><EmployeeProfile person={profilePerson} workspace={workspace} people={people} lang={lang} t={t} onAssignment={editAssignment} onCommitment={openCommitment} onVerify={(id) => setModal({ kind: 'verify', id })} onEmployeeView={(id) => { setPersonId(id); setModal(undefined); go('employee') }} /></Dialog>}
    {modal?.kind === 'commitment' && <Dialog title={modal.block ? t('Edit commitment', '일정 수정') : fromLead ? t('Add commitment', '일정 추가') : t('Report missing commitment', '누락 일정 신고')} close={() => setModal(undefined)}><CommitmentForm people={people} personId={modal.person} block={modal.block} workspace={workspace} lang={lang} t={t} employee={!fromLead} save={saveCommitment} remove={() => {
      const id = modal.block?.id
      if (id) void update((state) => flagCalendarChanges({ ...state, blocks: state.blocks.filter((item) => item.id !== id) }, t('Calendar commitment removed.', '일정이 제거되었습니다.'))).then((ok) => { if (ok) setModal(undefined) })
    }} /></Dialog>}
    {modalAssignment && <Dialog key={modalAssignment.task.id} title={modalAssignment.task.title} close={() => setModal(undefined)}><AssignmentDetails record={modalAssignment} person={roster.find(({ id }) => id === modalAssignment.employeeId)!} employee={!fromLead} lang={lang} t={t} replace={() => beginReplacement(modalAssignment)} update={(note, effort) => markReview(modalAssignment.task.id, note, effort)} propose={(draft) => markReview(modalAssignment.task.id, t('Deadline or upper effort updated for review.', '검토용 마감 또는 최대 예상 작업 시간 변경.'), null, draft)} /></Dialog>}
    {modalPerson && <Dialog title={t('Verify candidate details', '후보 정보 확인')} close={() => setModal(undefined)}><VerificationForm person={modalPerson} workspace={workspace} lang={lang} t={t} save={(schedule, item, value, verifiedTasks) => {
      void update((state) => {
        const current = state.verifications?.[modalPerson.id]
        const access = item ? { ...current?.access, [accessId(item)]: value === 'unknown' ? value : value ? [{ start: value.start, end: value.end }] : [] } : current?.access
        return flagCalendarChanges({ ...state, verifiedTasks, verifications: { ...state.verifications, [modalPerson.id]: { ...current, schedule, access } } }, t('Candidate access or working windows changed.', '후보자의 접근 권한 또는 근무 시간이 변경되었습니다.'))
      }, t('Candidate details saved. Refresh the comparison.', '후보 정보가 저장되었습니다. 비교를 새로고침하세요.')).then((ok) => { if (ok) setModal(undefined) })
    }} /></Dialog>}
  </div></ThemeContext.Provider>
}

createRoot(document.getElementById('root')!).render(<App />)
