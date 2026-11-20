import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, BadgeCheck, ArrowRight, CalendarClock, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Gauge, History, Layers, Plus, ShieldAlert, Sparkles, Users, Zap } from 'lucide-react'
import { catalog, DAY, dayOf, displayDate, displayTime, hour, intersects, minutes, skillLabel, span, weekOf, type Assignment, type Block, type Employee, type Language, type Workspace } from './domain'
import { calendarOverlaps, effectivePerson, workload } from './scheduler'
import { kindLabel } from './Schedule'
import { Avatar, ChartTooltip, EmptyState, KpiCard, Label, PanelTitle, nameOf, useChartColors, type Translate } from './ui'

type Props = {
  workspace: Workspace; people: Employee[]; lang: Language; t: Translate; demoTeam: boolean
  onNavigate: (view: 'workspace' | 'calendar' | 'employees' | 'automation' | 'worklog' | 'workload') => void
  onNewRequest: () => void; onDemo: () => void; onScan: () => void; onAssignment: (record: Assignment) => void; onPerson: (id: string) => void
}
const kinds = ['assignment', 'work', 'meeting', 'review', 'support', 'on-call', 'leave', 'reserve'] as const

export function Dashboard({ workspace, people, lang, t, demoTeam, onNavigate, onNewRequest, onDemo, onScan, onAssignment, onPerson }: Props) {
  const colors = useChartColors()
  const [donutIndex, setDonutIndex] = useState(0)
  const threshold = workspace.policy.overload || .9
  const active = people.filter((person) => !person.status || person.status === 'active')
  const ids = new Set(people.map(({ id }) => id))
  const loads = active.map((person) => ({ person, ...workload(person, workspace) }))
  const used = loads.reduce((sum, row) => sum + row.used, 0)
  const regular = loads.reduce((sum, row) => sum + row.regular, 0)
  const free = loads.reduce((sum, row) => sum + Math.max(0, row.regular - row.used), 0)
  const hot = loads.filter((row) => row.ratio >= threshold).length
  const assignments = workspace.assignments.filter((record) => ids.has(record.employeeId))
  const pending = assignments.filter((record) => record.pending)
  const upcoming = workspace.blocks.filter((block) => ids.has(block.employeeId) && block.end > workspace.now)
  const overlaps = active.flatMap((person) => calendarOverlaps(upcoming.filter((block) => block.employeeId === person.id)))
  const effective = active.map((person) => effectivePerson(person, workspace))
  const singleOwner = catalog.filter((skill) => effective.filter((person) => (person.skills[skill.id] || 0) >= 4).length === 1)
  const away = people.length - active.length

  const week = weekOf(workspace.now)
  const mix = useMemo(() => {
    const bounds = span(week, week + 7 * DAY)
    const totals = new Map<Block['kind'], number>()
    for (const block of workspace.blocks) {
      if (!ids.has(block.employeeId) || !intersects(block, bounds)) continue
      totals.set(block.kind, (totals.get(block.kind) || 0) + Math.min(block.end, bounds.end) - Math.max(block.start, bounds.start))
    }
    return kinds.map((kind) => ({ kind, name: kindLabel(kind, t), value: totals.get(kind) || 0 })).filter((row) => row.value > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.blocks, week, people, lang])
  const mixColor: Record<Block['kind'], string> = { assignment: colors.primary, work: colors.violet, meeting: colors.sky, review: colors.amber, support: colors.green, 'on-call': colors.fuchsia, leave: colors.red, reserve: colors.slate }
  const mixTotal = mix.reduce((sum, row) => sum + row.value, 0)

  const coverage = catalog.map((skill) => ({
    name: skill[lang], expert: effective.filter((person) => (person.skills[skill.id] || 0) >= 4).length,
    capable: effective.filter((person) => (person.skills[skill.id] || 0) === 3).length,
  })).filter((row) => row.expert + row.capable > 0).sort((a, b) => b.expert - a.expert || b.capable - a.capable).slice(0, 8)

  const today = dayOf(workspace.now)
  const agenda = upcoming.filter((block) => block.start < today + DAY && block.kind !== 'reserve').sort((a, b) => a.start - b.start).slice(0, 7)
  const activity = assignments.flatMap((record) => record.history.map((entry) => ({ record, entry }))).sort((a, b) => b.entry.at - a.entry.at).slice(0, 6)
  const historyLabel = { approval: t('Approved', '승인'), replacement: t('Replacement approved', '재배정 승인'), review: t('Review requested', '검토 요청'), effort: t('Effort correction', '작업 시간 정정'), commitment: t('Commitment reported', '일정 신고'), change: t('Change flagged', '변경 확인 필요') }
  const utilization = loads.map((row) => ({ id: row.person.id, name: row.person.initials, full: nameOf(row.person, lang), value: Math.round(row.ratio * 100), ratio: row.ratio }))

  return <div className="stack page-stack">
    <section className="panel quick-start">
      <div className="quick-start-head">
        <div><h2>{t('Quick start', '빠른 시작')}</h2><p>{t('Assign urgent work in three steps. Every step can be reviewed before anything is booked.', '3단계로 긴급 업무를 배정하세요. 예약 전에 모든 단계를 확인할 수 있습니다.')}</p></div>
        <div className="intro-actions">
          {demoTeam && <button className="btn secondary slim" onClick={onDemo}><Zap size={15} />{t('Try the demo task', '데모 과제로 체험하기')}</button>}
          <button className="btn primary slim" onClick={onNewRequest}><Plus size={15} />{t('New request', '새 업무 요청')}</button>
        </div>
      </div>
      <ol className="quick-steps">
        {[
          [t('Enter the request', '요청 입력'), t('Paste a message or fill in the form.', '메시지를 붙여 넣거나 양식을 작성합니다.')],
          [t('Compare candidates', '담당자 비교'), t('See who has the skills and free time.', '스킬과 가능한 시간을 가진 팀원을 비교합니다.')],
          [t('Approve', '승인'), t('Book the work on the team calendar.', '팀 일정에 작업 시간을 예약합니다.')],
        ].map(([title, body], index) => <li key={title}><button onClick={onNewRequest}><span className="quick-num">{index + 1}</span><span><strong>{title}</strong><small>{body}</small></span></button></li>)}
      </ol>
    </section>

    <div className="kpi-grid">
      <KpiCard index={0} label={t('Team members', '팀원 수')} value={people.length} suffix={t('', '명')} icon={Users} accent="indigo" sub={t(active.length + ' active', '재직 ' + active.length + '명') + (away ? ' · ' + t(away + ' away', '부재 ' + away + '명') : '')} onClick={() => onNavigate('employees')} />
      <KpiCard index={1} label={t('Avg workload', '평균 업무량')} value={regular ? Math.round(used / regular * 100) : 0} suffix="%" icon={Gauge} accent="violet" sub={t('This week vs regular hours', '이번 주 정규 근무시간 대비')} onClick={() => onNavigate('workload')} />
      <KpiCard index={2} label={t('Free hours', '남은 근무시간')} value={Math.round(free / 60)} suffix={t('h', '시간')} icon={Clock3} accent="emerald" sub={t('Not yet booked this week', '이번 주 아직 배정되지 않은 시간')} />
      <KpiCard index={3} label={t('Overloaded', '과부하 인원')} value={hot} suffix={t('', '명')} icon={Gauge} accent={hot ? 'rose' : 'slate'} sub={t('At or above ', '업무량 ') + Math.round(threshold * 100) + t('% this week', '% 이상')} onClick={() => onNavigate('workload')} />
      <KpiCard index={4} label={t('Confirmed', '확정된 배정')} value={assignments.length - pending.length} suffix={t('', '건')} icon={CheckCircle2} accent="sky" sub={t('Booked on the calendar', '팀 일정에 예약됨')} onClick={() => onNavigate('worklog')} />
      <KpiCard index={5} label={t('Needs review', '검토 대기')} value={pending.length} suffix={t('', '건')} icon={ClipboardCheck} accent={pending.length ? 'amber' : 'slate'} sub={t('Original booking kept', '기존 예약은 유지됨')} onClick={() => onNavigate('worklog')} />
      <KpiCard index={6} label={t('Overlaps', '일정 겹침')} value={overlaps.length} suffix={t('', '건')} icon={AlertTriangle} accent={overlaps.length ? 'rose' : 'slate'} sub={t('Upcoming double-bookings', '예정된 중복 일정')} onClick={() => onNavigate('calendar')} />
      <KpiCard index={7} label={t('Single-owner skills', '담당자 1명 스킬')} value={singleOwner.length} suffix={t('', '개')} icon={ShieldAlert} accent="cyan" sub={t('Only one person at level 4+', '레벨 4 이상 보유자가 1명뿐')} onClick={() => onNavigate('automation')} />
    </div>

    <div className="dash-grid">
      <section className="panel span-2"><PanelTitle icon={Gauge} title={t('Utilization by member', '팀원별 업무 비율')} subtitle={t('Scheduled work this week · dashed line marks the planning threshold', '이번 주 예정 업무 · 점선은 계획 기준')} actions={<button className="btn ghost slim" onClick={() => onNavigate('workload')}>{t('Analytics', '분석')}<ArrowRight size={14} /></button>} />
        <div className="panel-body">{utilization.length ? <div className="chart-slot"><ResponsiveContainer width="100%" height={250}>
          <BarChart data={utilization} margin={{ left: -18, right: 8, top: 8 }} onClick={(state) => { const id = (state as { activePayload?: { payload: { id: string } }[] })?.activePayload?.[0]?.payload.id; if (id) onPerson(id) }}>
            <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: colors.axis }} />
            <YAxis domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]} tickFormatter={(value) => value + '%'} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: colors.axis }} />
            <Tooltip cursor={{ fill: colors.cursor }} content={({ active, payload }) => <ChartTooltip active={active} payload={payload?.map((p) => ({ ...p, name: t('Utilization', '업무 비율'), value: p.value as number }))} label={(payload?.[0]?.payload as { full?: string })?.full} unit="%" />} />
            <ReferenceLine y={Math.round(threshold * 100)} stroke={colors.red} strokeDasharray="5 4" />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={46} isAnimationActive={colors.animate} animationDuration={900} style={{ cursor: 'pointer' }}>
              {utilization.map((row) => <Cell key={row.id} fill={row.ratio >= threshold ? colors.red : row.ratio >= .75 ? colors.amber : colors.primary} />)}
            </Bar>
          </BarChart></ResponsiveContainer></div> : <EmptyState icon={Users} title={t('No active members', '재직 중인 팀원 없음')} />}</div>
      </section>

      <section className="panel"><PanelTitle icon={Layers} title={t('Calendar mix', '캘린더 구성')} subtitle={t('Booked minutes this week by type', '이번 주 유형별 예약 시간')} />
        <div className="panel-body">{mix.length ? <div className="chart-body">
          <div className="chart-slot" style={{ position: 'relative' }}><ResponsiveContainer width="100%" height={190}><PieChart>
            <Pie data={mix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke={colors.surface} strokeWidth={2} isAnimationActive={colors.animate} animationDuration={900} onMouseEnter={(_, index) => setDonutIndex(index)}>
              {mix.map((row, index) => <Cell key={row.kind} fill={mixColor[row.kind]} fillOpacity={index === donutIndex ? 1 : .72} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => <ChartTooltip active={active} payload={payload?.map((p) => ({ ...p, value: minutes(Number(p.value), lang) as unknown as number }))} />} />
          </PieChart></ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}><div><strong style={{ fontSize: 19, fontFamily: 'var(--font-display)' }}>{Math.round(mixTotal / 60)}h</strong><br /><small className="muted" style={{ fontSize: 11 }}>{t('booked', '예약')}</small></div></div>
          </div>
          <div className="chart-legend">{mix.map((row, index) => <div key={row.kind} onMouseEnter={() => setDonutIndex(index)}><i style={{ background: mixColor[row.kind] }} /><span>{row.name}</span><strong>{Math.round(row.value / mixTotal * 100)}%</strong></div>)}</div>
        </div> : <EmptyState icon={CalendarDays} title={t('Nothing booked this week', '이번 주 예약 없음')} />}</div>
      </section>

      <section className="panel span-2"><PanelTitle icon={BadgeCheck} title={t('Skill coverage', '스킬 보유 현황')} subtitle={t('Active members at expert (4–5) and capable (3) levels', '재직 팀원의 전문가(4–5) 및 숙련(3) 수준')} actions={<button className="btn ghost slim" onClick={() => onNavigate('employees')}>{t('Directory', '디렉터리')}<ArrowRight size={14} /></button>} />
        <div className="panel-body">{coverage.length ? <div className="chart-slot"><ResponsiveContainer width="100%" height={Math.max(180, coverage.length * 34)}>
          <BarChart data={coverage} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: colors.axis }} />
            <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: colors.axis }} />
            <Tooltip cursor={{ fill: colors.cursor }} content={<ChartTooltip />} />
            <Bar dataKey="expert" name={t('Expert 4–5', '전문가 4–5')} stackId="s" fill={colors.primary} radius={[0, 0, 0, 0]} maxBarSize={18} isAnimationActive={colors.animate} animationDuration={900} />
            <Bar dataKey="capable" name={t('Capable 3', '숙련 3')} stackId="s" fill={colors.fuchsia} fillOpacity={.55} radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive={colors.animate} animationDuration={900} />
          </BarChart></ResponsiveContainer></div> : <EmptyState icon={BadgeCheck} title={t('No skill records', '스킬 기록 없음')} />}
          {singleOwner.length > 0 && <p className="muted" style={{ marginTop: 8 }}><ShieldAlert size={13} style={{ display: 'inline', verticalAlign: -2 }} /> {t('Single verified owner: ', '단일 검증 담당: ')}{singleOwner.slice(0, 6).map((skill) => skillLabel(skill.id, lang)).join(' · ')}{singleOwner.length > 6 && ' +' + (singleOwner.length - 6)}</p>}
        </div>
      </section>

      <section className="panel"><PanelTitle icon={CalendarClock} title={t('Up next today', '오늘 예정')} subtitle={displayDate(workspace.now, lang, true) + ' · ' + hour(workspace.now) + ' KST'} actions={<button className="btn ghost slim" onClick={() => onNavigate('calendar')}><CalendarDays size={14} /></button>} />
        <div className="panel-body">{agenda.length ? <div className="agenda">{agenda.map((block) => {
          const person = people.find(({ id }) => id === block.employeeId)!
          const record = block.kind === 'assignment' ? assignments.find((item) => item.task.id === block.taskId) : undefined
          return <button key={block.id} className="agenda-item" onClick={() => record ? onAssignment(record) : onNavigate('calendar')}>
            <span className="agenda-time">{hour(block.start)}</span><span className="agenda-bar" style={{ background: mixColor[block.kind] }} />
            <div><strong>{block.title}</strong><small>{nameOf(person, lang)} · {kindLabel(block.kind, t)} · {hour(block.start)}–{hour(block.end)}</small></div>
          </button>
        })}</div> : <EmptyState icon={CalendarClock} title={t('Nothing else today', '오늘 남은 일정 없음')} />}</div>
      </section>

      <section className="panel span-3"><PanelTitle icon={History} title={t('Recent activity', '최근 활동')} actions={<button className="btn ghost slim" onClick={() => onNavigate('worklog')}><ArrowRight size={14} /></button>} />
        <div className="panel-body">{activity.length ? <div className="activity">{activity.map(({ record, entry }, index) => {
          const person = people.find(({ id }) => id === record.employeeId)
          return <button key={index} className="activity-item" style={{ textAlign: 'left' }} onClick={() => onAssignment(record)}>
            {person && <Avatar person={person} size="small" />}
            <div><strong>{historyLabel[entry.type]} · {record.task.title}</strong><p>{person ? nameOf(person, lang) + ' · ' : ''}{displayTime(entry.at, lang)}</p></div>
            <Label tone={record.pending ? 'peach' : 'green'}>{record.pending ? t('Review', '검토') : t('Live', '확정')}</Label>
          </button>
        })}</div> : <EmptyState icon={History} title={t('No assignments yet', '아직 배정 없음')}>{t('Confirmed assignments and reviews will appear here.', '확정된 배정과 검토가 여기에 표시됩니다.')}</EmptyState>}</div>
      </section>
    </div>
  </div>
}
