import { useState } from 'react'
import { Activity, CalendarRange, CheckCircle2, Download, FileSpreadsheet, FileUp, History, Search, ShieldAlert, BadgeCheck, TriangleAlert, Users, Zap } from 'lucide-react'
import { priorityName } from './Compare'
import { displayTime, minutes, skillLabel, total, type Assignment, type Employee, type Language, type Scan, type Workspace } from './domain'
import { calendarIcs, downloadFile, exampleCsv, prepareImport, workLogCsv } from './operations'
import { Avatar, EmptyState, Field, KpiCard, Label, Notice, PanelTitle, Select, nameOf, type Translate } from './ui'

type Props = { workspace: Workspace; people: Employee[]; team: string; lang: Language; t: Translate }
const downloadCsv = (name: string, data: string) => downloadFile(name, data, 'text/csv;charset=utf-8')
export const downloadCalendar = (records: Assignment[], people: Employee[], now: number) =>
  downloadFile('skillrelay-assignments.ics', calendarIcs(records, people, now), 'text/calendar;charset=utf-8')

export const findingLabel = (kind: Scan['findings'][number]['kind'], t: Translate) => ({
  overlap: t('Calendar overlap', '캘린더 중복'), deadline: t('One hour or less before deadline', '마감 전 여유 1시간 이하'),
  review: t('Assignment needs review', '배정 검토 필요'), capacity: t('Planning threshold reached', '계획 기준 도달'), skill: t('Single verified skill owner', '스킬 검증 담당자 한 명'),
})[kind]
export const severity = (level: number, t: Translate) => level === 3 ? { tone: 'red' as const, label: t('Review', '검토') } : level === 2 ? { tone: 'peach' as const, label: t('Watch', '주의') } : { tone: 'violet' as const, label: t('Coverage', '스킬 보유') }

export function Automation({ workspace, people, team, lang, t, run, onAssignment, onPerson }: Props & { run: () => void; onAssignment: (record: Assignment) => void; onPerson: (id: string) => void }) {
  const scans = (workspace.scans || []).filter((scan) => scan.team === team)
  const [chosen, setChosen] = useState('')
  const [level, setLevel] = useState(0)
  const [scanning, setScanning] = useState(false)
  const scan = scans.find(({ id }) => id === chosen) || scans[0]
  const findings = scan?.findings.filter((finding) => !level || finding.level === level) || []
  const count = (n: number) => scan?.findings.filter((finding) => finding.level === n).length || 0
  function start() {
    setScanning(true); setChosen('')
    window.setTimeout(() => { run(); setScanning(false) }, 450)
  }
  return <div className="stack page-stack">
    <section className="panel"><PanelTitle icon={Activity} title={t('Continuous monitoring', '지속 모니터링')} subtitle={t('Scan the team for overlapping commitments, tight deadlines, pending reviews, workload thresholds, and single-owner skills.', '팀의 일정 중복, 임박한 마감, 검토 대기, 업무량 기준, 단일 담당 스킬을 확인합니다.')}
      actions={<button className="btn primary" onClick={start} disabled={scanning}><Zap size={15} className={scanning ? 'animate-pulse' : ''} />{scanning ? t('Scanning…', '스캔 중…') : t('Run schedule scan', '일정 스캔 실행')}</button>} />
      {scan && <div className="summary-strip"><span><History size={15} />{t('Last scan', '마지막 스캔')} · {displayTime(scan.at, lang)}</span><span><ShieldAlert size={15} />{scan.findings.length} {t('findings', '건')}</span></div>}
    </section>
    {scan && <div className="kpi-grid">
      <KpiCard index={0} label={t('Review now', '즉시 검토')} value={count(3)} icon={TriangleAlert} accent={count(3) ? 'rose' : 'slate'} sub={t('Overlaps, missed buffers, reviews', '중복, 여유 부족, 검토')} onClick={() => setLevel(level === 3 ? 0 : 3)} />
      <KpiCard index={1} label={t('Watch', '주의')} value={count(2)} icon={Activity} accent={count(2) ? 'amber' : 'slate'} sub={t('Thresholds and tight deadlines', '기준 도달, 임박 마감')} onClick={() => setLevel(level === 2 ? 0 : 2)} />
      <KpiCard index={2} label={t('Coverage', '스킬 보유')} value={count(1)} icon={BadgeCheck} accent="indigo" sub={t('Skills with one verified owner', '검증 담당자 1명인 스킬')} onClick={() => setLevel(level === 1 ? 0 : 1)} />
      <KpiCard index={3} label={t('Scans run', '실행한 스캔')} value={scans.length} icon={History} accent="sky" sub={t('History kept for this team', '이 팀의 기록 보관')} />
    </div>}
    <div className="dash-grid" style={{ marginTop: 0 }}>
      <section className="panel span-2"><PanelTitle icon={ShieldAlert} title={t('Alert feed', '알림 피드')} actions={scan && <Select aria-label={t('Severity', '심각도')} value={level} onChange={(event) => setLevel(Number(event.target.value))}><option value={0}>{t('All severities', '모든 심각도')}</option><option value={3}>{t('Review', '검토')}</option><option value={2}>{t('Watch', '주의')}</option><option value={1}>{t('Coverage', '스킬 보유')}</option></Select>} />
        <div className="panel-body stack">
          {!scan && <EmptyState icon={Zap} title={t('No scans yet', '아직 스캔 없음')}>{t('Run a schedule scan to surface risks on the shared calendar.', '일정 스캔을 실행해 공유 캘린더의 위험을 확인하세요.')}<button className="btn primary slim" onClick={start} style={{ marginTop: 6 }}><Zap size={14} />{t('Run first scan', '첫 스캔 실행')}</button></EmptyState>}
          {scan && scan.findings.length === 0 && <Notice tone="green">{t('The scan found no schedule risks.', '스캔에서 일정 위험이 발견되지 않았습니다.')}</Notice>}
          {findings.map((finding, index) => {
            const person = people.find((item) => item.id === finding.ref)
            const assignment = (finding.kind === 'review' || finding.kind === 'deadline') ? workspace.assignments.find((item) => item.task.id === finding.ref) : undefined
            const owner = assignment && people.find(({ id }) => id === assignment.employeeId)
            const sev = severity(finding.level, t)
            return <div key={index} className="alert-card" style={{ animationDelay: Math.min(index, 10) * 35 + 'ms' }}><i className={'sev-' + finding.level} /><div>
              {(person || owner) && <Avatar person={(person || owner)!} size="small" />}
              <div><strong>{findingLabel(finding.kind, t)}</strong><p>{person ? nameOf(person, lang) + ' · ' : owner ? nameOf(owner, lang) + ' · ' : ''}{finding.kind === 'skill' ? skillLabel(finding.detail, lang) : finding.detail}</p></div>
              <Label tone={sev.tone}>{sev.label}</Label>
              {assignment && <button className="btn secondary slim" onClick={() => onAssignment(assignment)}>{t('Open assignment', '배정 열기')}</button>}
              {person && !assignment && <button className="btn ghost slim" onClick={() => onPerson(person.id)}>{t('Profile', '프로필')}</button>}
            </div></div>
          })}
          {scan && scan.findings.length > 0 && !findings.length && <p className="muted">{t('No findings at this severity.', '이 심각도의 항목이 없습니다.')}</p>}
        </div>
      </section>
      <div className="stack">
        <section className="panel"><PanelTitle icon={History} title={t('Scan timeline', '스캔 기록')} />
          <div className="panel-body">{scans.length ? <ol className="timeline-list">{scans.map((item, index) => <li key={item.id} className={item.id === scan?.id ? 'current' : ''}><button onClick={() => setChosen(item.id)}><strong>#{scans.length - index} · {item.findings.length} {t('findings', '건')}</strong><small>{displayTime(item.at, lang)} · {item.findings.filter((f) => f.level === 3).length} {t('to review', '검토')}</small></button></li>)}</ol> : <p className="muted">{t('Past scans will appear here.', '이전 스캔이 여기에 표시됩니다.')}</p>}</div>
        </section>
        <section className="panel"><PanelTitle icon={CheckCircle2} title={t('What the scan checks', '스캔 항목')} />
          <div className="panel-body"><ul className="check-list">
            {[
              [t('Calendar overlaps', '일정 중복'), t('Busy blocks that collide for the same person.', '같은 사람의 겹치는 일정.')],
              [t('Tight deadlines', '임박한 마감'), t('Assignments finishing within an hour of their due time.', '마감 1시간 이내에 끝나는 배정.')],
              [t('Pending reviews', '검토 대기'), t('Employee review or effort requests awaiting the lead.', '리드 확인을 기다리는 검토 요청.')],
              [t('Workload threshold', '업무량 기준'), t('People at or above the policy planning threshold.', '정책 기준 이상인 팀원.')],
              [t('Skill coverage', '스킬 보유'), t('Skills held at level 4+ by only one person.', '레벨 4+ 보유자가 한 명뿐인 스킬.')],
            ].map(([title, body]) => <li key={title}><CheckCircle2 size={15} /><div><strong>{title}</strong>{body}</div></li>)}
          </ul></div>
        </section>
      </div>
    </div>
  </div>
}

export function WorkLog({ workspace, people, team, lang, t, onAssignment }: Props & { onAssignment: (record: Assignment) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const all = workspace.assignments.filter((record) => record.task.team === team)
  const rows = all.filter((record) => (!priority || record.task.priority === priority) &&
    (!status || record.pending === (status === 'review')) &&
    (record.task.title + ' ' + (people.find(({ id }) => id === record.employeeId)?.name || '') + ' ' + (people.find(({ id }) => id === record.employeeId)?.korean || ''))
      .toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (b.history.at(-1)?.at || 0) - (a.history.at(-1)?.at || 0))
  const booked = all.reduce((sum, record) => sum + total(record.blocks), 0)
  return <div className="stack page-stack">
    <div className="kpi-grid">
      <KpiCard index={0} label={t('Assignments', '배정')} value={all.length} icon={History} accent="indigo" sub={t('All time for this team', '이 팀 전체')} />
      <KpiCard index={1} label={t('Confirmed', '확정')} value={all.filter((r) => !r.pending).length} icon={CheckCircle2} accent="emerald" sub={t('On the shared calendar', '공유 캘린더 반영')} onClick={() => setStatus('confirmed')} />
      <KpiCard index={2} label={t('Needs review', '검토 필요')} value={all.filter((r) => r.pending).length} icon={TriangleAlert} accent="amber" sub={t('Original booking kept', '기존 예약 유지')} onClick={() => setStatus('review')} />
      <KpiCard index={3} label={t('Booked hours', '예약 시간')} value={Math.round(booked / 6) / 10} decimals={1} suffix="h" icon={CalendarRange} accent="violet" sub={t('Across all work blocks', '모든 작업 블록 합계')} />
    </div>
    <section className="panel">
      <div className="toolbar">
        <div className="input-icon grow-2"><Search size={15} /><input type="search" aria-label={t('Search tasks or employees', '과제 또는 팀원 검색')} placeholder={t('Search tasks or employees…', '과제 또는 팀원 검색…')} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <Select aria-label={t('Status', '상태')} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t('All statuses', '모든 상태')}</option><option value="confirmed">{t('Confirmed', '확정')}</option><option value="review">{t('Needs review', '검토 필요')}</option></Select>
        <Select aria-label={t('Priority', '우선순위')} value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">{t('All priorities', '모든 우선순위')}</option>{(['urgent', 'high', 'routine'] as const).map((item) => <option value={item} key={item}>{priorityName(item, t)}</option>)}</Select>
        <button className="btn secondary slim" disabled={!rows.length} onClick={() => downloadCsv('skillrelay-work-log.csv', workLogCsv(rows, people))}><Download size={14} />{t('Export CSV', 'CSV 내보내기')}</button>
        <button className="btn secondary slim" disabled={!rows.length} onClick={() => downloadCalendar(rows, people, workspace.now)}><Download size={14} />{t('Download calendar', '캘린더 다운로드')}</button>
      </div>
      {rows.length > 0 && <div className="table-scroll"><table className="data-table">
        <thead><tr><th>{t('Task', '과제')}</th><th>{t('Assigned to', '담당')}</th><th>{t('Priority', '우선순위')}</th><th>{t('Booked', '예약')}</th><th>{t('Last update', '최근 변경')}</th><th>{t('Status', '상태')}</th></tr></thead>
        <tbody>{rows.map((record) => {
          const person = people.find(({ id }) => id === record.employeeId)!
          const last = record.history.at(-1)
          return <tr key={record.task.id} className="clickable" onClick={() => onAssignment(record)}>
            <th style={{ minWidth: 200 }}>{record.task.title}<br /><small className="muted" style={{ fontSize: 11.5, fontWeight: 500 }}>{record.task.deadline && t('Due ', '마감 ') + displayTime(record.task.deadline, lang)}</small></th>
            <td><div className="emp-cell" style={{ minWidth: 150 }}><Avatar person={person} size="small" /><strong>{nameOf(person, lang)}</strong></div></td>
            <td><Label tone={record.task.priority === 'urgent' ? 'red' : record.task.priority === 'high' ? 'peach' : 'neutral'}>{priorityName(record.task.priority, t)}</Label></td>
            <td className="tabular">{minutes(total(record.blocks), lang)}</td>
            <td style={{ minWidth: 160 }}><small className="muted" style={{ fontSize: 12 }}>{last && displayTime(last.at, lang)}</small></td>
            <td><Label tone={record.pending ? 'peach' : 'green'}>{record.pending ? t('Needs review', '검토 필요') : t('Confirmed', '확정')}</Label></td>
          </tr>
        })}</tbody>
      </table></div>}
      {!rows.length && <EmptyState icon={History} title={all.length ? t('No matching assignments', '일치하는 배정이 없습니다') : t('No assignments yet', '아직 배정 없음')}>{all.length ? t('Adjust the filters above.', '위의 필터를 조정하세요.') : t('Approved assignments and their audit history land here.', '승인된 배정과 감사 기록이 여기에 쌓입니다.')}</EmptyState>}
    </section>
  </div>
}

export function Import({ people, t, apply }: { people: Employee[]; t: Translate; apply: (data: ReturnType<typeof prepareImport>) => Promise<boolean> }) {
  const [type, setType] = useState<'commitments' | 'profiles'>('commitments')
  const [data, setData] = useState<ReturnType<typeof prepareImport>>()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const count = data ? data.type === 'commitments' ? data.blocks.length : Object.keys(data.entries).length : 0
  async function read(file?: File) {
    setData(undefined); setError(''); setDone(false); setFileName(file?.name || '')
    if (!file) return
    setReading(true)
    try {
      if (file.size > 1024 * 1024) throw new Error(t('Choose a CSV smaller than 1 MB.', '1MB 미만의 CSV 파일을 선택하세요.'))
      setData(prepareImport(await file.text(), type, people))
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('Could not read the file.', '파일을 읽을 수 없습니다.')) }
    finally { setReading(false) }
  }
  const columns = type === 'commitments' ? ['employee_id', 'title', 'kind', 'start_kst', 'end_kst'] : ['employee_id', 'skills', 'weekdays', 'work_start', 'work_end']
  return <div className="dash-grid" style={{ marginTop: 0 }}>
    <section className="panel span-2"><PanelTitle icon={FileUp} title={t('Import team CSV', '팀 CSV 가져오기')} subtitle={t('Every row is validated before anything changes.', '변경 전에 모든 행을 검증합니다.')} />
      <div className="panel-body stack">
        <div className="segmented" role="group" aria-label={t('Import type', '가져오기 유형')} style={{ justifySelf: 'start' }}>
          <button aria-pressed={type === 'commitments'} onClick={() => { setType('commitments'); void read() }}>{t('Calendar commitments', '캘린더 일정')}</button>
          <button aria-pressed={type === 'profiles'} onClick={() => { setType('profiles'); void read() }}>{t('Skills and working windows', '스킬 및 근무 시간')}</button>
        </div>
        <label className={'dropzone ' + (dragging ? 'dragging' : '')} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void read(event.dataTransfer.files?.[0]) }}>
          <input type="file" key={type + fileName} accept=".csv,text/csv" disabled={reading} aria-label={t('Select CSV file', 'CSV 파일 선택')} onChange={(event) => void read(event.target.files?.[0])} />
          <span className="dropzone-icon"><FileSpreadsheet size={24} /></span>
          <strong>{fileName || t('Drop a CSV here, or click to browse', 'CSV를 끌어다 놓거나 클릭해 선택')}</strong>
          <p>{type === 'commitments' ? t('Adds commitments for employee IDs in the selected synthetic team. Timestamps in KST.', '선택한 합성 팀의 팀원 ID에 일정을 추가합니다. 시각은 KST.') : t('Each row replaces the skill list and working window for an employee ID in this team.', '각 행은 이 팀 팀원 ID의 스킬 목록과 근무 시간을 교체합니다.')} · {t('Up to 1 MB, 500 rows.', '최대 1MB, 500행.')}</p>
        </label>
        {error && <Notice tone="red">{error}</Notice>}
        {data && <Notice tone="violet">{count} {t('valid records. Apply them to refresh the calendar and recommendations.', '건이 유효합니다. 적용하면 캘린더와 추천이 업데이트됩니다.')}</Notice>}
        {done && <Notice tone="green">{t('CSV imported.', 'CSV를 가져왔습니다.')}</Notice>}
        <div className="actions"><button className="btn primary" disabled={!data || reading} onClick={async () => { if (data) { setReading(true); if (await apply(data)) { setData(undefined); setDone(true); setFileName('') } setReading(false) } }}><CheckCircle2 size={15} />{t('Apply import', '가져오기 적용')}</button></div>
      </div>
    </section>
    <section className="panel"><PanelTitle icon={FileSpreadsheet} title={t('Template', '템플릿')} subtitle={t('Use these exact column names.', '아래 열 이름을 그대로 사용하세요.')} />
      <div className="panel-body stack">
        <div className="chips">{columns.map((column) => <span key={column} className="code-chip">{column}</span>)}</div>
        <Field label={t('Example', '예시')}><textarea readOnly rows={4} value={exampleCsv(type, people[0])} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }} /></Field>
        <button className="btn secondary" onClick={() => downloadCsv('skillrelay-' + type + '-template.csv', exampleCsv(type, people[0]))}><Download size={15} />{t('Download CSV template', 'CSV 템플릿 다운로드')}</button>
        <p className="muted"><Users size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {people.length} {t('employee IDs are accepted for this team.', '명의 팀원 ID를 이 팀에서 사용할 수 있습니다.')}</p>
      </div>
    </section>
  </div>
}
