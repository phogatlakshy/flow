import { useState } from 'react'
import { ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, FileText, FlaskConical, ListChecks, LoaderCircle, LockKeyhole, PencilLine, Plus, RotateCcw, ScanText, Trash2, Users, Zap } from 'lucide-react'
import { accessId, catalog, dateInput, displayTime, fromInput, minutes, skillLabel, taskIssues, type Employee, type Language, type Task, type Workspace } from './domain'
import { dashboardTask, exampleRequest, teams } from './seed'
import { Avatar, Field, Label, Notice, PanelTitle, Select, type Translate } from './ui'

export function RequestPane({ raw, setRaw, language, t, busy, isSample, onExample, onExtract, onManual, onSettings, onCalendar, team, people, workspace }: {
  raw: string; setRaw: (raw: string) => void; language: Language; t: Translate; busy: boolean; isSample: boolean;
  onExample: (open?: boolean) => void; onExtract: () => void; onManual: () => void; onSettings: () => void; onCalendar: () => void;
  team: string; people: Employee[]; workspace: Workspace;
}) {
  const sample = dashboardTask(language)
  return <div className="request-grid">
    <section className="panel intake-panel">
      <PanelTitle icon={FileText} title={t('New request', '새 요청')} subtitle={t('Turn a message into a task your team can act on.', '메시지를 팀이 실행할 수 있는 과제로 정리합니다.')} actions={<Label>{t('Step 1 of 3', '1 / 3단계')}</Label>} />
      <div className="panel-body">
        <div className="textarea-label"><label htmlFor="request-text">{t('Request message', '요청 메시지')}</label>{team === teams[0] && <button className="text-button" onClick={() => onExample()} disabled={busy}><RotateCcw size={14} />{t('Load example', '예시 불러오기')}</button>}</div>
        <div className="request-box">
          <textarea id="request-text" spellCheck maxLength={6000} value={raw} onChange={(event) => setRaw(event.target.value)} placeholder={t('Paste a Slack message, email, or work request…', '슬랙, 이메일 또는 업무 요청 내용을 붙여 넣으세요…')} disabled={busy} />
          <div className="request-box-footer"><span>{isSample && <Label tone="violet"><FlaskConical size={12} />{t('Seeded example', '데모 예시')}</Label>}</span><span>{raw.length.toLocaleString()} / 6,000</span></div>
        </div>
        <div className="local-note"><LockKeyhole size={15} /><span>{t('Processed locally with Ollama. English and Korean supported.', 'Ollama로 로컬에서 처리합니다. 한국어와 영어를 지원합니다.')}</span><button className="text-button subtle" onClick={onSettings} aria-label={t('Ollama settings', 'Ollama 설정')}><ArrowUpRight size={16} /></button></div>
        <div className="intake-actions">
          <button className="btn primary" onClick={onExtract} disabled={busy || !raw.trim()}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : <ScanText size={16} />}{busy ? t('Extracting request…', '요청 분석 중…') : t('Extract with Ollama', 'Ollama로 분석')}</button>
          <button className="btn secondary" onClick={onManual}><PencilLine size={16} />{t('Enter manually', '직접 입력')}</button>
        </div>
      </div>
    </section>
    <aside className="request-aside">
      {team === teams[0] && <section className="panel scenario">
        <PanelTitle icon={Zap} tone="peach" title={t('Demo scenario', '데모 시나리오')} actions={<Label tone="peach">{t('Synthetic', '합성 데이터')}</Label>} />
        <div className="scenario-inner">
          <h3>{t('The dashboard fix', '대시보드 필터 수정')}</h3>
          <p>{t('A client demo is hours away. Find someone with the skills, staging access, and time to fix the dashboard filter.', '고객사 데모가 몇 시간 남았습니다. 필터를 수정할 스킬, 스테이징 권한, 시간이 있는 팀원을 찾으세요.')}</p>
          <dl className="scenario-facts">
            <div><dt><CalendarDays size={15} />{t('Deadline', '마감')}</dt><dd>{displayTime(sample.deadline!, language)}</dd></div>
            <div><dt><Clock3 size={15} />{t('Effort', '예상 작업')}</dt><dd>{t('3–4 hours', '3~4시간')}</dd></div>
          </dl>
          <button className="scenario-button" onClick={() => onExample(true)} disabled={busy}>{t('Open demo task', '데모 과제 열기')}<ChevronRight size={16} /></button>
        </div>
      </section>}
      <section className="panel snapshot">
        <div className="snapshot-top"><span><Users size={17} /> {t('Team snapshot', '팀 현황')}</span><button className="icon-button" aria-label={t('Open team calendar', '팀 캘린더 열기')} onClick={onCalendar}><ArrowUpRight size={16} /></button></div>
        <div className="snapshot-main"><div className="avatar-stack">{people.slice(0, 5).map((person) => <Avatar key={person.id} person={person} size="small" />)}</div><div><strong>{people.length} {t('team members', '명의 팀원')}</strong><span>{workspace.assignments.filter((a) => a.task.team === team).length} {t('confirmed locally', '건 로컬 확정')}</span></div></div>
      </section>
    </aside>
  </div>
}

export const issueText = (id: string, t: Translate) => ({
  scope: t('Add a task title and a concrete deliverable.', '과제 제목과 구체적인 결과물을 입력하세요.'),
  effort: t('Confirm a positive effort range in minutes.', '분 단위의 예상 작업 범위를 확인하세요.'),
  deadline: t('When exactly is the deadline? Choose a time after the workspace clock.', '정확한 마감이 언제인가요? 현재 시각 이후의 시간을 선택하세요.'),
  skills: t('Set a minimum level for each skill and resolve unmapped skills.', '각 스킬의 최소 레벨을 정하고 미분류 스킬을 해결하세요.'),
  priority: t('Confirm the task priority.', '우선순위를 확인하세요.'),
  focus: t('Can this task be split? If so, confirm the minimum focus time.', '작업을 나눌 수 있나요? 가능하면 최소 집중 시간을 입력하세요.'),
  dependency: t('When will each prerequisite be ready?', '각 선행 작업이나 입력 자료는 언제 준비되나요?'),
  questions: t('Resolve the questions in the draft before continuing.', '비교하기 전에 초안에 남은 질문을 해결하세요.'),
  confirmation: t('Confirm the reviewed requirements below.', '아래에서 검토한 요건을 확인하세요.'),
})[id] || t('Complete the company policy in Settings: ', '설정에서 회사 정책을 입력하세요. ') + id.replace('policy-', '')

export function TaskForm({ task, onChange, now, people, t, lang, warning, source, onBack, onSubmit }: {
  task: Task; onChange: (task: Task) => void; now: number; people: Employee[]; t: Translate; lang: Language;
  warning: string; source: 'manual' | 'seed' | 'ollama' | 'review'; onBack: () => void; onSubmit: () => void;
}) {
  const [submitted, setSubmitted] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [newAccess, setNewAccess] = useState('')
  const change = (data: Partial<Task>) => onChange({ ...task, ...data, confirmed: data.confirmed ?? false })
  const errors = taskIssues(task, now)
  const numberValue = (input: string) => input === '' ? null : Number(input)
  const eligiblePreferences = catalog.filter((item) => !task.required.some((rule) => rule.id === item.id))
  const corePreferences = eligiblePreferences.filter((item) => catalog.indexOf(item) < 12)
  const extendedPreferences = eligiblePreferences.filter((item) => catalog.indexOf(item) >= 12)
  const extendedSelected = extendedPreferences.filter((item) => task.preferred.includes(item.id)).length
  const skillCheckbox = (item: typeof catalog[number]) => <label key={item.id}><input type="checkbox" checked={task.preferred.includes(item.id)} onChange={(e) => change({ preferred: e.target.checked ? [...task.preferred, item.id] : task.preferred.filter((id) => id !== item.id) })} />{item[lang]}</label>
  return <section className="panel form-panel">
    <PanelTitle icon={ListChecks} title={t('Review task details', '과제 세부 정보 검토')} subtitle={t('Confirm the conditions the scheduler should use.', '일정 계산에 사용할 조건을 확인하세요.')} actions={<Label tone="violet">{{ manual: t('Manual form', '직접 입력'), seed: t('Seeded example', '데모 예시'), ollama: t('Ollama draft', 'Ollama 초안'), review: t('Replacement', '재배정') }[source]}</Label>} />
    <form className="panel-body task-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); if (!errors.length) onSubmit() }}>
      {warning && <Notice>{warning}</Notice>}
      {task.raw && <details className="inline-details"><summary>{t('Original request', '원본 요청')}</summary><p>{task.raw}</p></details>}
      {task.assumptions.length > 0 && <Notice tone="violet"><strong>{t('Assumptions to verify', '확인할 가정')}</strong><ul>{task.assumptions.map((item, i) => <li key={i}>{item}</li>)}</ul></Notice>}
      {task.questions.length > 0 && <div className="draft-questions"><h3>{t('Questions to resolve', '확인이 필요한 질문')}</h3>{task.questions.map((question, index) => <div key={index}><span>{question}</span><button type="button" className="btn secondary slim" onClick={() => change({ questions: task.questions.filter((_, i) => i !== index) })}><Check size={15} />{t('Resolved', '해결 완료')}</button></div>)}</div>}
      <div className="form-grid">
        <Field label={t('Task title', '과제 제목')}><input value={task.title} maxLength={120} onChange={(e) => change({ title: e.target.value })} placeholder={t('Summarize the work', '작업을 한 줄로 요약')} /></Field>
        <Field label={t('Priority', '우선순위')}><Select value={task.priority} onChange={(e) => change({ priority: e.target.value as Task['priority'] })}><option value="">{t('Choose priority', '우선순위 선택')}</option><option value="routine">{t('Routine', '일반')}</option><option value="high">{t('High', '높음')}</option><option value="urgent">{t('Urgent', '긴급')}</option></Select></Field>
        <div className="full"><Field label={t('Expected deliverable', '예상 결과물')}><textarea rows={2} value={task.deliverable} onChange={(e) => change({ deliverable: e.target.value })} placeholder={t('Define the result and how it will be verified', '결과물과 검증 방법을 입력하세요')} /></Field></div>
        <Field label={t('Deadline · KST', '마감 · KST')}><input type="datetime-local" value={dateInput(task.deadline)} onChange={(e) => change({ deadline: fromInput(e.target.value) })} /></Field>
        <Field label={t('Previous owner · optional', '이전 담당자 · 선택')}><Select value={task.previousOwner} onChange={(e) => change({ previousOwner: e.target.value })}><option value="">{t('No previous owner', '이전 담당자 없음')}</option>{people.map((person) => <option key={person.id} value={person.id}>{lang === 'ko' ? person.korean : person.name}</option>)}</Select></Field>
        <Field label={t('Lower effort · minutes', '최소 예상 작업 · 분')}><input type="number" min={1} value={task.min ?? ''} onChange={(e) => change({ min: numberValue(e.target.value), source: 'manual' })} /></Field>
        <Field label={t('Upper effort · minutes', '최대 예상 작업 · 분')} hint={task.source === 'estimate' ? t('Model estimate · verify before planning', '모델 추정치 · 배정 전 확인') : task.max ? t('Reserves ', '예약 시간 ') + minutes(task.max, lang) : undefined}><input type="number" min={1} value={task.max ?? ''} onChange={(e) => change({ max: numberValue(e.target.value), source: 'manual' })} /></Field>
        <Field label={t('Focus mode', '집중 방식')}><Select value={task.split === null ? '' : String(task.split)} onChange={(e) => change({ split: e.target.value === '' ? null : e.target.value === 'true' })}><option value="">{t('Choose focus mode', '집중 방식 선택')}</option><option value="true">{t('Can split across blocks', '여러 블록으로 분할 가능')}</option><option value="false">{t('One continuous block', '하나의 연속 블록')}</option></Select></Field>
        {task.split && <Field label={t('Minimum focus · minutes', '최소 집중 · 분')}><input type="number" min={1} value={task.focus ?? ''} onChange={(e) => change({ focus: numberValue(e.target.value) })} /></Field>}
      </div>
      <div className="form-grid form-section">
        <div><h3>{t('Required skills', '필수 스킬')}</h3>
          {task.required.map(({ id, level }) => <div className="field-line" key={id}><span>{skillLabel(id, lang)}</span><Select aria-label={skillLabel(id, lang) + ' ' + t('minimum level', '최소 레벨')} value={level ?? ''} onChange={(e) => change({ required: task.required.map((rule) => rule.id === id ? { ...rule, level: numberValue(e.target.value) } : rule) })}><option value="">{t('Confirm level', '레벨 선택')}</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{t('Level ', '레벨 ')}{n}</option>)}</Select><button className="icon-button" type="button" aria-label={t('Remove ', '삭제 ') + skillLabel(id, lang)} onClick={() => change({ required: task.required.filter((rule) => rule.id !== id) })}><Trash2 size={16} /></button></div>)}
          <div className="field-line grow"><Select aria-label={t('Skill to add', '추가할 스킬')} value={newSkill} onChange={(e) => setNewSkill(e.target.value)}><option value="">{t('Select a skill', '스킬 선택')}</option>{catalog.filter((item) => !task.required.some((rule) => rule.id === item.id)).map((item) => <option key={item.id} value={item.id}>{item[lang]}</option>)}</Select><button className="btn secondary slim" type="button" disabled={!newSkill} onClick={() => { change({ required: [...task.required, { id: newSkill, level: null }], preferred: task.preferred.filter((id) => id !== newSkill) }); setNewSkill('') }}><Plus size={15} />{t('Add', '추가')}</button></div>
          {task.unmapped.map((item, index) => <div className="field-line" key={index}><Label tone="peach">{item}</Label><button className="text-button" type="button" onClick={() => change({ unmapped: task.unmapped.filter((_, i) => i !== index) })}>{t('Mark reviewed', '검토 완료')}</button></div>)}
        </div>
        <div><h3>{t('Preferred skills', '우대 스킬')}</h3><div className="skill-checks">{corePreferences.map(skillCheckbox)}</div>{extendedPreferences.length > 0 && <details className="inline-details mt-2"><summary>{t('More skills', '추가 스킬')}{extendedSelected > 0 && ' · ' + extendedSelected + ' ' + t('selected', '개 선택')}</summary><div className="skill-checks mt-2">{extendedPreferences.map(skillCheckbox)}</div></details>}</div>
        <div><h3>{t('Required access', '필수 권한')}</h3><div className="chips">{task.access.map((item) => <button className="tag" key={item} type="button" onClick={() => change({ access: task.access.filter((id) => id !== item) })} aria-label={t('Remove access ', '권한 삭제 ') + item}>{item}<Trash2 size={13} /></button>)}</div>
          <div className="field-line grow"><input aria-label={t('Access requirement', '필요 권한')} placeholder={t('e.g., staging', '예: 스테이징')} value={newAccess} onChange={(e) => setNewAccess(e.target.value)} /><button className="btn secondary slim" type="button" disabled={!newAccess.trim()} onClick={() => { change({ access: [...new Set([...task.access, accessId(newAccess)])] }); setNewAccess('') }}><Plus size={15} />{t('Add', '추가')}</button></div>
        </div>
        <div><h3>{t('Prerequisites', '선행 조건')}</h3>{task.dependencies.map((item, index) => <div className="dependency" key={index}><Field label={t('Prerequisite', '선행 항목')}><input value={item.name} onChange={(e) => change({ dependencies: task.dependencies.map((row, i) => i === index ? { ...row, name: e.target.value } : row) })} /></Field><div className="field-line grow"><Field label={t('Available at · KST', '준비 완료 · KST')}><input type="datetime-local" value={dateInput(item.available)} onChange={(e) => change({ dependencies: task.dependencies.map((row, i) => i === index ? { ...row, available: fromInput(e.target.value) } : row) })} /></Field><button className="icon-button" type="button" aria-label={t('Remove prerequisite', '선행 조건 삭제')} onClick={() => change({ dependencies: task.dependencies.filter((_, i) => i !== index) })}><Trash2 size={16} /></button></div></div>)}<button className="btn secondary slim" type="button" onClick={() => change({ dependencies: [...task.dependencies, { name: '', available: null }] })}><Plus size={15} />{t('Add prerequisite', '선행 조건 추가')}</button></div>
      </div>
      <label className="confirm-box"><input type="checkbox" checked={task.confirmed} onChange={(e) => change({ confirmed: e.target.checked })} />{t('I confirm the scope, effort, deadline, skills, priority, focus, prerequisites, and access.', '범위, 작업 시간, 마감, 스킬, 우선순위, 집중 시간, 선행 조건과 권한을 확인했습니다.')}</label>
      {submitted && errors.length > 0 && <Notice tone="red"><ul>{errors.map((id) => <li key={id}>{issueText(id, t)}</li>)}</ul></Notice>}
      <div className="actions"><button className="btn secondary" type="button" onClick={onBack}>{t('Back to request', '요청으로 돌아가기')}</button><button className="btn primary" type="submit">{t('Compare candidates', '후보 비교')}<ChevronRight size={16} /></button></div>
    </form>
  </section>
}

export const sampleLoaded = (raw: string) => raw === exampleRequest('en') || raw === exampleRequest('ko')
