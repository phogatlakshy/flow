import { useMemo, useState } from 'react'
import { BadgeCheck, CalendarPlus, Eye, Search, ShieldQuestion, Users } from 'lucide-react'
import { catalog, displayTime, hour, minutes, skillLabel, type Assignment, type Block, type Employee, type Language, type Workspace } from './domain'
import { effectivePerson, workload } from './scheduler'
import { kindLabel } from './Schedule'
import { Avatar, EmptyState, employmentStatus, Label, Meter, Select, nameOf, roleOf, type Translate } from './ui'

type Props = { workspace: Workspace; people: Employee[]; lang: Language; t: Translate }
const statusTone = (person: Employee) => person.status === 'leave' ? 'peach' : person.status === 'terminated' ? 'red' : person.scheduleVerified ? 'green' : 'peach'

export function Employees({ workspace, people, lang, t, onOpen }: Props & { onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [skill, setSkill] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'away' | 'verify'>('all')
  const [sort, setSort] = useState<'name' | 'load'>('name')
  const threshold = workspace.policy.overload || .9
  const rows = useMemo(() => people.map((person) => ({ person: effectivePerson(person, workspace), load: workload(person, workspace) })), [people, workspace])
  const filtered = rows.filter(({ person }) => {
    const active = !person.status || person.status === 'active'
    if (status === 'active' && !active) return false
    if (status === 'away' && active) return false
    if (status === 'verify' && (!active || person.scheduleVerified)) return false
    if (skill && (person.skills[skill] || 0) < 4) return false
    const needle = query.trim().toLocaleLowerCase()
    return !needle || [person.name, person.korean, person.id, person.role, person.roleKo, person.source?.id, person.source?.title, person.source?.department, ...Object.keys(person.skills).map((id) => skillLabel(id, lang))]
      .some((value) => value?.toLocaleLowerCase().includes(needle))
  }).sort((a, b) => sort === 'load' ? b.load.ratio - a.load.ratio : nameOf(a.person, lang).localeCompare(nameOf(b.person, lang)))
  const counts = {
    all: rows.length, active: rows.filter(({ person }) => !person.status || person.status === 'active').length,
    away: rows.filter(({ person }) => person.status && person.status !== 'active').length,
    verify: rows.filter(({ person }) => (!person.status || person.status === 'active') && !person.scheduleVerified).length,
  }
  const segments = [['all', t('All', '전체')], ['active', t('Active', '재직')], ['away', t('Away', '부재')], ['verify', t('Verify', '확인 필요')]] as const
  return <section className="panel">
    <div className="toolbar">
      <div className="input-icon grow-2"><Search size={15} /><input type="search" aria-label={t('Search employees or skills', '팀원 또는 스킬 검색')} placeholder={t('Search name, ID, role, or skill…', '이름, ID, 직무, 스킬 검색…')} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <Select aria-label={t('Skill level 4+', '레벨 4 이상 스킬')} value={skill} onChange={(event) => setSkill(event.target.value)}><option value="">{t('Any skill (level 4+)', '모든 스킬 (레벨 4+)')}</option>{catalog.map((item) => <option value={item.id} key={item.id}>{item[lang]}</option>)}</Select>
      <Select aria-label={t('Sort', '정렬')} value={sort} onChange={(event) => setSort(event.target.value as 'name' | 'load')}><option value="name">{t('Sort by name', '이름순')}</option><option value="load">{t('Sort by utilization', '업무 비율순')}</option></Select>
      <div className="segmented" role="group" aria-label={t('Status filter', '상태 필터')}>{segments.map(([id, label]) => <button key={id} aria-pressed={status === id} onClick={() => setStatus(id)}>{label} <span className="muted" style={{ fontSize: 11 }}>{counts[id]}</span></button>)}</div>
    </div>
    <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{t('Employee', '팀원')}</th><th>{t('Role', '직무')}</th><th>{t('Status', '상태')}</th><th>{t('This week', '이번 주')}</th><th>{t('Top skills', '주요 스킬')}</th><th><span className="sr-only">{t('Actions', '작업')}</span></th></tr></thead>
      <tbody>{filtered.map(({ person, load }) => {
        const skills = Object.entries(person.skills).sort((a, b) => (b[1] || 0) - (a[1] || 0))
        return <tr key={person.id} className="clickable" onClick={() => onOpen(person.id)}>
          <td><div className="emp-cell"><Avatar person={person} size="small" /><div><strong>{nameOf(person, lang)}</strong><small>{person.id}{person.source ? ' · ' + person.source.department : ''}</small></div></div></td>
          <td style={{ minWidth: 150 }}>{roleOf(person, lang)}</td>
          <td><Label tone={statusTone(person)}>{(!person.status || person.status === 'active') && !person.scheduleVerified ? t('Verify schedule', '일정 확인 필요') : employmentStatus(person, t)}</Label></td>
          <td><div className="meter-line"><Meter ratio={load.ratio} hot={threshold} /><small>{Math.round(load.ratio * 100)}% · {minutes(load.used, lang)} / {minutes(load.regular, lang)}</small></div></td>
          <td><div className="skill-mini">{skills.slice(0, 3).map(([id, level]) => <Label key={id} tone={(level || 0) >= 4 ? 'violet' : 'neutral'}>{skillLabel(id, lang)} {level}</Label>)}{skills.length > 3 && <Label>+{skills.length - 3}</Label>}</div></td>
          <td><button className="btn ghost slim" onClick={(event) => { event.stopPropagation(); onOpen(person.id) }}><Eye size={14} />{t('Profile', '프로필')}</button></td>
        </tr>
      })}</tbody>
    </table></div>
    {!filtered.length && <EmptyState icon={Search} title={t('No matching employees', '일치하는 팀원이 없습니다')}>{t('Try a different search or filter.', '다른 검색어나 필터를 사용해 보세요.')}</EmptyState>}
  </section>
}

export function EmployeeProfile({ person: base, workspace, lang, t, onAssignment, onCommitment, onEmployeeView, onVerify }: Props & {
  person: Employee; onAssignment: (record: Assignment) => void; onCommitment: (personId: string, block?: Block) => void; onEmployeeView: (id: string) => void; onVerify: (id: string) => void
}) {
  const person = effectivePerson(base, workspace)
  const load = workload(base, workspace)
  const threshold = workspace.policy.overload || .9
  const assignments = workspace.assignments.filter((record) => record.employeeId === person.id)
  const upcoming = workspace.blocks.filter((block) => block.employeeId === person.id && block.end > workspace.now).sort((a, b) => a.start - b.start).slice(0, 8)
  const skills = Object.entries(person.skills).sort((a, b) => (b[1] || 0) - (a[1] || 0))
  const active = !person.status || person.status === 'active'
  return <div className="stack">
    <div className="person-line"><Avatar person={person} size="large" /><div><h3 style={{ fontSize: 19 }}>{nameOf(person, lang)}</h3><p>{roleOf(person, lang)} · {person.id}</p></div><Label tone={statusTone(person)}>{active && !person.scheduleVerified ? t('Verify schedule', '일정 확인 필요') : employmentStatus(person, t)}</Label></div>
    <div className="actions" style={{ justifyContent: 'flex-start' }}>
      <button className="btn secondary slim" onClick={() => onEmployeeView(person.id)}><Eye size={14} />{t('View as employee', '팀원 화면 보기')}</button>
      <button className="btn secondary slim" onClick={() => onCommitment(person.id)}><CalendarPlus size={14} />{t('Add commitment', '일정 추가')}</button>
      {active && <button className="btn secondary slim" onClick={() => onVerify(person.id)}>{person.scheduleVerified ? <BadgeCheck size={14} /> : <ShieldQuestion size={14} />}{t('Verify details', '정보 확인')}</button>}
    </div>
    <section className="settings-section"><h3>{t('This week', '이번 주')}</h3><Meter ratio={load.ratio} hot={threshold} /><p>{Math.round(load.ratio * 100)}% · {minutes(load.used, lang)} {t('of', '/')} {minutes(load.regular, lang)} {t('regular capacity', '정규 용량')}</p></section>
    <section className="settings-section"><h3>{t('Skills', '스킬')} <Label tone="peach">{t('Synthetic', '합성')}</Label></h3>
      {skills.length ? <div className="skill-bars">{skills.map(([id, level]) => <div className="skill-bar" key={id}><span>{skillLabel(id, lang)}</span><span className="skill-pips">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= (level || 0) ? 'on' : ''} />)}</span><span>{level}/5</span></div>)}</div> : <p>{t('No verified skills.', '검증된 스킬이 없습니다.')}</p>}
    </section>
    {person.source && <section className="settings-section"><h3>{t('Source record', '원본 기록')}</h3><dl className="kv">
      <dt>{t('Department', '부서')}</dt><dd>{person.source.department}</dd><dt>{t('Original title', '원본 직무')}</dt><dd>{person.source.title}</dd>
      <dt>{t('Manager group', '관리자 그룹')}</dt><dd>{person.source.manager}</dd><dt>{t('Employment', '고용 형태')}</dt><dd>{person.source.employment}</dd>
      <dt>{t('Shift', '근무조')}</dt><dd>{person.source.shift}</dd><dt>{t('Source ID', '원본 ID')}</dt><dd>{person.source.id}</dd>
    </dl>{person.experience?.some(({ title }) => title) && <><h3 className="small-heading" style={{ marginTop: 6 }}>{t('Work examples', '작업 사례')}</h3><ul className="history-list">{person.experience.flatMap(({ title, at }) => title ? [<li key={title + at}><strong>{title}</strong><span>{displayTime(at, lang)}</span></li>] : [])}</ul></>}</section>}
    <section className="settings-section"><h3>{t('Assignments', '배정')}</h3>{assignments.length ? assignments.map((record) => <div className="result-row" key={record.task.id}><div><strong>{record.task.title}</strong><p>{record.task.deadline && displayTime(record.task.deadline, lang)}</p></div><Label tone={record.pending ? 'peach' : 'green'}>{record.pending ? t('Needs review', '검토 필요') : t('Confirmed', '확정')}</Label><button className="btn ghost slim" onClick={() => onAssignment(record)}>{t('Details', '세부 정보')}</button></div>) : <p>{t('No assignments yet.', '배정된 과제가 없습니다.')}</p>}</section>
    <section className="settings-section"><h3>{t('Upcoming commitments', '예정된 일정')}</h3>{upcoming.length ? upcoming.map((block) => <div className="result-row" key={block.id}><div><strong>{block.title}</strong><p>{displayTime(block.start, lang)}–{hour(block.end)}</p></div><Label tone={block.kind === 'assignment' ? 'violet' : 'neutral'}>{kindLabel(block.kind, t)}</Label></div>) : <p>{t('No upcoming commitments.', '예정된 일정이 없습니다.')}</p>}</section>
    <p className="muted"><Users size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {t('Skill levels, work examples, and calendars are synthetic planning data.', '스킬 수준, 작업 사례, 캘린더는 합성 계획 데이터입니다.')}</p>
  </div>
}
