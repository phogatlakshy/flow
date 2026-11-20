import { useState } from 'react'
import { AlertTriangle, CalendarCheck, CalendarClock, Check, ChevronRight, CircleCheck, Clock3, Download, GitCompareArrows, History, PencilLine, Route, ShieldCheck, Users, Zap } from 'lucide-react'
import { displayDate, displayTime, hour, minutes, skillLabel, total, type Assignment, type Candidate, type Employee, type Issue, type Language, type Task, type Workspace } from './domain'
import { feasibleAlternatives, type PlanResult } from './scheduler'
import { Avatar, Label, Notice, PanelTitle, nameOf, roleOf, type Translate } from './ui'
import { issueText } from './Request'

export const priorityName = (priority: Task['priority'], t: Translate) => ({ routine: t('Routine', '일반'), high: t('High', '높음'), urgent: t('Urgent', '긴급'), '': t('Unconfirmed', '미확인') })[priority]
export const factorName = (factor: string, t: Translate) => ({
  skill: t('Skill fit', '스킬 적합도'), experience: t('Relevant experience', '관련 경험'),
  buffer: t('Time after finish', '완료 후 여유 시간'), workload: t('Workload after assignment', '배정 후 업무량'),
  deadlines: t('Existing deadlines', '기존 마감 영향'), focus: t('Focus time', '집중 시간'), overload: t('Recent repeated overload', '최근 반복 과부하'),
})[factor] || factor
export function reasonText(issue: Issue, t: Translate, lang: Language) {
  const item = issue.detail.split(' ')[0]
  const label = item === 'staging' ? t('Staging', '스테이징') : issue.detail
  switch (issue.code) {
    case 'status': return issue.detail === 'leave' ? t('On leave in the source roster.', '원본 인원 명단에서 휴직 중입니다.') : t('Employment has ended in the source roster.', '원본 인원 명단에서 고용이 종료되었습니다.')
    case 'skill': return t('Required skill below threshold', '필수 스킬 기준 미달') + ' · ' + skillLabel(item, lang) + ' ' + issue.detail.split(' ').slice(1).join(' ')
    case 'access-unknown': return t(label + ' access requires verification', label + ' 권한 확인 필요')
    case 'access': return t(label + ' access missing', label + ' 권한 없음')
    case 'schedule': return t('Schedule requires verification', '일정 확인 필요') + ' · ' + issue.detail
    case 'focus': return t('Available time is split into windows that do not meet the focus requirement.', '빈 시간이 최소 집중 기준을 충족하지 않습니다.')
    case 'capacity': return t('Insufficient usable minutes before the deadline.', '마감 전 배정 가능한 시간이 부족합니다.')
    case 'dependency': return t('Prerequisite arrives too late.', '선행 조건 완료가 너무 늦습니다.') + ' ' + issue.detail
    default: return t('Policy is incomplete', '정책 정보가 부족합니다') + ' · ' + issue.detail
  }
}

export function Blocks({ blocks, lang }: { blocks: Candidate['blocks']; lang: Language }) {
  return <div className="block-chips">{blocks.map((block) => <span key={block.start}><CalendarClock size={14} />{displayDate(block.start, lang)} · {hour(block.start)}–{hour(block.end)}</span>)}</div>
}

function FactorBreakdown({ candidate, t, lang }: { candidate: Candidate; t: Translate; lang: Language }) {
  return <div className="factor-list">{candidate.factors.map((factor) => <div className="factor-line" key={factor.id}>
    <div><strong>{factorName(factor.id, t)}</strong><span>{lang === 'ko' ? factor.detailKo : factor.detail}</span></div>
    <div className="factor-points"><strong>{(factor.value * factor.weight).toFixed(1)} / {factor.weight}</strong><div className="mini-progress"><span style={{ width: (factor.value * 100) + '%' }} /></div></div>
  </div>)}</div>
}

export function Compare({ task, plan, current, replacement, lang, t, selected, select, onEdit, onNext, onScenario, onSettings, onRefresh, stale, onVerify }: {
  task: Task; plan: PlanResult; current: Workspace; replacement: boolean; lang: Language; t: Translate; selected: string;
  select: (id: string) => void; onEdit: () => void; onNext: () => void; onScenario: (task: Task) => void; onSettings: () => void;
  onRefresh: () => void; stale: boolean; onVerify: (personId: string) => void;
}) {
  const previous = plan.rejected.find((item) => item.employee.id === task.previousOwner)
  const displayed = plan.ranked.slice(0, 3)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const alternatives = showAlternatives && !plan.issues.length && !displayed.length ? feasibleAlternatives(task, current, replacement ? task.id : undefined) : []
  return <div className="stack">
    <section className="panel">
      <PanelTitle icon={GitCompareArrows} title={t('Compare candidates', '후보 비교')} subtitle={task.title} actions={<button className="btn secondary slim" onClick={onEdit}><PencilLine size={15} />{t('Edit task', '과제 수정')}</button>} />
      <div className="summary-strip"><span><Zap size={16} />{priorityName(task.priority, t)}</span>{task.deadline && <span><CalendarClock size={16} />{displayTime(task.deadline, lang)}</span>}{task.max && <span><Clock3 size={16} />{minutes(task.max, lang)} {t('to reserve', '예약')}</span>}</div>
    </section>
    {stale && <Notice><div className="notice-action">{t('The calendar changed after these plans were generated.', '이 계획을 계산한 후 캘린더가 변경되었습니다.')}<button className="text-button" onClick={onRefresh}>{t('Refresh plans', '계획 새로고침')}</button></div></Notice>}
    {plan.issues.length > 0 && <Notice tone="red"><ul>{plan.issues.map((id) => <li key={id}>{issueText(id, t)}</li>)}</ul>{plan.issues.some((id) => id.startsWith('policy')) && <button className="text-button" onClick={onSettings}>{t('Open policy settings', '정책 설정 열기')}</button>}</Notice>}
    {previous && <Notice tone="violet"><strong>{nameOf(previous.employee, lang)} · {t('Previous owner', '이전 담당자')}</strong><p>{previous.available > 0 && (t('Usable before deadline: ', '마감 전 배정 가능: ') + minutes(previous.available, lang) + ' · ')}{previous.issues.map((issue) => reasonText(issue, t, lang)).join(' ')}</p></Notice>}
    {displayed.length > 0 && <div className="candidate-grid">{displayed.map((candidate, i) => {
      const isSelected = selected === candidate.employee.id
      const reduced = candidate.impacts.filter((item) => item.after < item.before)
      const zero = candidate.impacts.filter((item) => item.before === 0)
      return <article className={'panel candidate ' + (isSelected ? 'selected' : '')} key={candidate.employee.id}>
        <div className="candidate-top"><Label tone={i === 0 ? 'violet' : 'neutral'}>{i === 0 ? t('Recommended', '추천') : t('Rank ', '순위 ') + (i + 1)}</Label><span className="score">{candidate.score.toFixed(1)}<small> / 100</small></span></div>
        <div className="person-line"><Avatar person={candidate.employee} /><div><h3>{nameOf(candidate.employee, lang)}</h3><p>{roleOf(candidate.employee, lang)}</p></div></div>
        <dl className="candidate-facts">
          <div><dt><CalendarCheck size={15} />{t('Finish', '완료 예정')}</dt><dd>{displayTime(candidate.finish, lang)}</dd></div>
          <div><dt><Clock3 size={15} />{t('Free before due', '마감 전 여유')}</dt><dd>{minutes(candidate.free, lang)}</dd></div>
          <div><dt><ShieldCheck size={15} />{t('Verified requirements', '검증된 요건')}</dt><dd>{task.required.map(({ id }) => skillLabel(id, lang)).concat(task.access).join(' · ') || t('No mandatory skills or access', '필수 스킬 및 권한 없음')}</dd></div>
          <div><dt><History size={15} />{t('Urgent work · 30 days', '긴급 업무 · 30일')}</dt><dd>{candidate.urgentRate === null ? t('History unavailable', '기록 없음') : t(candidate.urgentCount + ' in ' + candidate.urgentDays + ' workdays', '근무일 ' + candidate.urgentDays + '일 중 ' + candidate.urgentCount + '건')}</dd></div>
        </dl>
        <Blocks blocks={candidate.blocks} lang={lang} />
        <div className="impact-copy"><strong>{t('Deadline impact', '마감 영향')}</strong><p>{reduced.length ? reduced.map((item) => item.title + ' −' + minutes(item.before - item.after, lang)).join(' · ') : t('No positive buffer reduced.', '기존 마감 여유 유지.')}</p>{zero.length > 0 && <p>{t('Already at zero: ', '기존 여유 없음: ')}{zero.map((item) => item.title).join(', ')}</p>}</div>
        {candidate.rotation && <p className="rotation-note"><Route size={15} />{t('Rotation moved this person ahead within five points.', '5점 이내에서 긴급 업무 순환 규칙으로 순위가 올랐습니다.')}</p>}
        {candidate.overlaps > 0 && <p className="rotation-note"><AlertTriangle size={15} />{candidate.overlaps} {t('existing overlaps to review.', '건의 기존 일정 중복 확인 필요.')}</p>}
        <details className="score-details"><summary>{t('Score breakdown', '점수 분석')}</summary><FactorBreakdown candidate={candidate} t={t} lang={lang} />{candidate.urgentRate !== null && <p className="muted">{candidate.urgentRate.toFixed(2)} {t('urgent assignments per 10 scheduled workdays.', '건 / 예정 근무일 10일.')}</p>}</details>
        <button aria-pressed={isSelected} className={'btn ' + (isSelected ? 'secondary chosen' : 'secondary')} onClick={() => select(candidate.employee.id)}>{isSelected ? <CircleCheck size={17} /> : <Users size={17} />}{isSelected ? t('Selected', '선택됨') : t('Select candidate', '후보 선택')}</button>
      </article>
    })}</div>}
    {!displayed.length && !plan.issues.length && <section className="panel">
      <PanelTitle icon={AlertTriangle} tone="peach" title={t('No eligible match', '배정 가능한 후보 없음')} subtitle={t('The current request stays unassigned.', '현재 조건에서는 배정하지 않습니다.')} />
      <div className="panel-body stack"><button className="btn secondary align-start" onClick={() => setShowAlternatives(!showAlternatives)}>{showAlternatives ? t('Hide simulations', '시뮬레이션 숨기기') : t('Simulate alternatives', '대안 시뮬레이션')}</button>
        {alternatives.map(({ id, task: revised, candidate }) => {
          const [kind, target] = id.split(':')
          const label = kind === 'scope' ? t('Smaller scope', '범위 축소') + ' · ' + minutes(revised.max!, lang) : kind === 'split' ? t('Split with documented handoffs', '인수인계를 기록하고 분할') + ' · ' + minutes(revised.focus!, lang) : kind === 'deadline' ? t('Extend deadline', '마감 연장') + ' · ' + displayTime(revised.deadline!, lang) : kind === 'access' ? t('Verify access', '권한 확인') + ' · ' + (plan.rejected.find((item) => item.employee.id === target) ? nameOf(plan.rejected.find((item) => item.employee.id === target)!.employee, lang) : target) : t('Move existing work', '기존 작업 이동') + ' · ' + target
          return <div className="result-row" key={id}><div><strong>{label}</strong><p>{candidate ? nameOf(candidate.employee, lang) + ' · ' + displayTime(candidate.finish, lang) : t('Still blocked in this simulation or existing deadline prevents the change.', '시뮬레이션에서도 배정할 수 없거나 기존 마감이 변경을 막습니다.')}</p></div>{candidate && !['access', 'work'].includes(kind) && <button className="btn secondary slim" onClick={() => onScenario(revised)}>{t('Review change', '변경 검토')}</button>}{['access', 'work'].includes(kind) && <Label tone="peach">{t('Lead confirmation required', '리드 확인 필요')}</Label>}</div>
        })}
      </div>
    </section>}
    {plan.rejected.length > 0 && <section className="panel exclusions"><details open={!displayed.length}><summary>{t('Excluded candidates', '제외된 후보')} <Label>{plan.rejected.length}</Label></summary><div className="exclusion-list">{plan.rejected.map(({ employee, issues, available, longest }) => <div className="excluded-row" key={employee.id}><Avatar person={employee} size="small" /><div><strong>{nameOf(employee, lang)}</strong><p>{issues.map((issue) => reasonText(issue, t, lang)).join(' · ')}</p>{available > 0 && <small>{minutes(available, lang)} {t('usable', '배정 가능')} · {minutes(longest, lang)} {t('longest block', '최장 블록')}</small>}</div>{issues.some(({ code }) => code === 'access' || code === 'access-unknown' || code === 'schedule') && <button className="btn secondary slim" onClick={() => onVerify(employee.id)}>{t('Verify details', '정보 확인')}</button>}</div>)}</div></details></section>}
    {displayed.length > 0 && <div className="actions"><button className="btn primary" disabled={!selected} onClick={onNext}>{t('Review approval', '승인 검토')}<ChevronRight size={17} /></button></div>}
  </div>
}

export function Approval({ task, candidate, replacement, confirmed, confirmedEmployee, stale, busy, onApprove, onCompare, onCalendar, onDownload, t, lang }: {
  task: Task; candidate?: Candidate; replacement: boolean; confirmed?: Assignment; confirmedEmployee?: Employee; stale: string[] | null; busy: boolean;
  onApprove: () => void; onCompare: () => void; onCalendar: () => void; onDownload: () => void; t: Translate; lang: Language;
}) {
  const booked = confirmed || candidate
  const person = confirmedEmployee || candidate?.employee
  const review = confirmed?.task || task
  return <section className="panel approval">
    <PanelTitle icon={confirmed ? CircleCheck : CalendarCheck} tone={confirmed ? 'green' : 'violet'} title={confirmed ? t('Assignment confirmed', '배정 확정') : t('Approve assignment', '배정 승인')} subtitle={review.title} />
    <div className="panel-body stack">
      {confirmed && <Notice tone="green">{t('The task and every work block are on the shared calendar.', '과제와 모든 작업 블록이 공유 캘린더에 예약되었습니다.')}</Notice>}
      {stale && <Notice tone="red">{t('This plan changed on the latest calendar. Refresh the comparison and confirm a fresh set of blocks.', '최신 캘린더에서 계획이 변경되었습니다. 후보를 다시 비교하고 새 블록을 확인하세요.')}{stale.length > 0 && <p>{t('Conflicting commitments', '겹치는 일정')} · {stale.join(' · ')}</p>}</Notice>}
      {replacement && !confirmed && !stale && <Notice tone="violet">{t('The original booking remains visible until you confirm the replacement.', '교체를 확정할 때까지 기존 예약이 유지됩니다.')}</Notice>}
      {booked && person && <div className="approval-recap">
        <div className="person-line"><Avatar person={person} /><div><h3>{nameOf(person, lang)}</h3><p>{roleOf(person, lang)}</p></div><Label tone="violet">{booked.score.toFixed(1)} / 100</Label></div>
        <p>{review.deliverable}</p><Blocks blocks={booked.blocks} lang={lang} />
        <div className="summary-strip"><span><Clock3 size={16} />{minutes(total(booked.blocks), lang)}</span><span><CalendarClock size={16} />{displayTime(booked.blocks.at(-1)!.end, lang)}</span></div>
      </div>}
      <div className="actions">{confirmed ? <><button className="btn secondary" onClick={onDownload}><Download size={17} />{t('Download calendar', '캘린더 다운로드')}</button><button className="btn primary" onClick={onCalendar}><CalendarCheck size={17} />{t('View team calendar', '팀 캘린더 보기')}</button></> : <><button className="btn secondary" onClick={onCompare}>{stale ? t('Refresh comparison', '비교 새로고침') : t('Back to comparison', '비교로 돌아가기')}</button><button className="btn primary" disabled={!candidate || !!stale || busy} onClick={onApprove}><Check size={17} />{replacement ? t('Confirm replacement', '재배정 확정') : t('Confirm assignment', '배정 확정')}</button></>}</div>
    </div>
  </section>
}
