import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, BarChart3, CalendarClock, FlaskConical, Users } from 'lucide-react'
import { minutes, type Employee, type Language, type Workspace } from './domain'
import { effectivePerson, historySummary, simulate, workload } from './scheduler'
import { makeWorkspace, replayTasks } from './seed'
import { Avatar, Label, PanelTitle, nameOf, useChartColors, type Translate } from './ui'

export function Insights({ workspace, people, lang, t, team, onTools }: { workspace: Workspace; people: Employee[]; lang: Language; t: Translate; team: string; onTools: () => void }) {
  const colors = useChartColors()
  const active = people.filter((person) => !person.status || person.status === 'active')
  const rosterLoad = active.map((person) => ({ person, ...workload(person, workspace), ...historySummary(person, workspace) }))
  const seed = useMemo(() => makeWorkspace(), [])
  const requests = useMemo(() => replayTasks(team), [team])
  const simulation = useMemo(() => simulate(team, requests, seed), [team, requests, seed])
  const labels = { onTime: t('On time', '기한 내 완료'), deferred: t('Deferred', '지연'), blocked: t('Blocked', '배정 불가') }
  const counts = (['onTime', 'deferred', 'blocked'] as const).map((id) => ({ name: labels[id], relay: simulation.relay[id], baseline: simulation.baseline[id] }))
  const n = requests.length
  const multi = rosterLoad.filter((person) => person.overloaded >= 2).length
  const eligibleWeeks = rosterLoad.filter((row) => row.weeks >= 2).length
  const effective = active.map((person) => effectivePerson(person, workspace))
  const skillGaps = [...new Set(effective.flatMap((person) => Object.keys(person.skills)))].filter((id) => effective.filter((person) => (person.skills[id] || 0) >= 4).length === 1)
  const reqLate = requests.filter((task) => task.dependencies.some((dependency) => dependency.available !== null && task.deadline! - dependency.available < task.max!)).length
  const collisions = requests.filter((task, index) => requests.some((other, otherIndex) => otherIndex < index && Math.abs(task.deadline! - other.deadline!) <= 120)).length
  return <div className="stack page-stack">
    <section className="panel"><PanelTitle icon={Activity} title={t('Team workload', '팀 업무량')} subtitle={t('Scheduled work this week for active staff in the selected team.', '선택한 팀의 재직 중인 팀원에 대한 이번 주 배정 업무입니다.')} actions={<button className="btn secondary slim" onClick={onTools}><Users size={15} />{t('Team tools', '팀 도구')}</button>} />
      <div className="panel-body chart-body"><div className="chart-slot">
        <ResponsiveContainer width="100%" height={255}><BarChart data={rosterLoad.map((row) => ({ name: row.person.initials, utilization: Math.round(row.ratio * 100) }))}><CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: colors.axis }} /><YAxis tickFormatter={(v) => v + '%'} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: colors.cursor }} contentStyle={{ background: colors.surface, border: '1px solid ' + colors.grid, borderRadius: 10 }} formatter={(value) => value + '%'} /><Bar dataKey="utilization" name={t('Utilization', '업무 비율')} fill={colors.primary} radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={colors.animate} animationDuration={800} /></BarChart></ResponsiveContainer>
      </div><div className="workload-list">{rosterLoad.map((row) => <div className="workload-person" key={row.person.id}><Avatar person={row.person} size="small" /><div><strong>{nameOf(row.person, lang)}</strong><small>{minutes(row.used, lang)} / {minutes(row.regular, lang)} · {Math.round(row.ratio * 100)}%</small></div></div>)}</div></div>
    </section>
    <section className="panel"><PanelTitle icon={BarChart3} title={t('Assignment replay', '배정 시뮬레이션')} subtitle={t('Same request order, starting calendar, deadlines, and demo policy.', '요청 순서, 시작 캘린더, 마감 및 데모 정책이 동일합니다.')} actions={<Label tone="peach"><FlaskConical size={13} />{t('Simulated', '시뮬레이션')}</Label>} />
      <div className="panel-body chart-body">
        <div className="chart-slot"><ResponsiveContainer width="100%" height={255}><BarChart data={counts}><CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Legend /><Tooltip cursor={{ fill: colors.cursor }} contentStyle={{ background: colors.surface, border: '1px solid ' + colors.grid, borderRadius: 10 }} /><Bar dataKey="relay" name="SkillRelay" fill={colors.primary} radius={[5, 5, 0, 0]} maxBarSize={48} isAnimationActive={colors.animate} animationDuration={800} /><Bar dataKey="baseline" name={t('Previous owner first', '이전 담당자 우선')} fill={colors.peach} radius={[5, 5, 0, 0]} maxBarSize={48} isAnimationActive={colors.animate} animationDuration={800} /></BarChart></ResponsiveContainer></div>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>{t('Measure', '지표')}</th><th>SkillRelay</th><th>{t('Previous owner first', '이전 담당자 우선')}</th></tr></thead><tbody>
          {counts.map((item) => <tr key={item.name}><th>{item.name}</th><td>{item.relay} / {n}</td><td>{item.baseline} / {n}</td></tr>)}
          <tr><th>{t('Capacity shortfall', '배정 시간 부족')}</th><td>{minutes(simulation.relay.shortfall, lang)}</td><td>{minutes(simulation.baseline.shortfall, lang)}</td></tr>
          <tr><th>{t('Projected overtime', '예상 초과근무')}</th><td>{minutes(simulation.relay.overtime, lang)} · {simulation.relay.overtimeCount}/{n} {t('requests', '요청')}</td><td>{minutes(simulation.baseline.overtime, lang)} · {simulation.baseline.overtimeCount}/{n} {t('requests', '요청')}</td></tr>
          <tr><th>{t('Repeated overload', '반복 과부하')}</th><td>{simulation.relay.repeat} / {simulation.relay.people} {t('employees', '명')}</td><td>{simulation.baseline.repeat} / {simulation.baseline.people} {t('employees', '명')}</td></tr>
        </tbody></table></div>
        <details className="inline-details"><summary>{t('Replay requests and outcomes', '시뮬레이션 요청 및 결과')}</summary><p>{t('Deferred means some effort fit before the deadline. Blocked means no work was booked. Overtime is projected only when an extended-hours plan can finish before the deadline. Repeated overload means at least two threshold weeks among people with at least two verified or projected weeks.', '지연은 마감 전 일부 작업만 가능하다는 뜻입니다. 배정 불가는 예약된 작업이 없는 경우입니다. 근무 외 시간을 사용해 마감 전에 완료할 수 있을 때 예상 초과근무를 표시합니다. 확인되거나 예상된 주가 2주 이상인 사람 중 2주 이상 기준치를 넘으면 반복 과부하로 계산합니다.')}</p><table className="data-table"><thead><tr><th>{t('Request', '요청')}</th><th>SkillRelay</th><th>{t('Previous owner first', '이전 담당자 우선')}</th></tr></thead><tbody>{simulation.relay.rows.map((row, i) => <tr key={row.title}><th>{row.title}</th><td>{labels[row.outcome as keyof typeof labels]} · {minutes(row.shortfall, lang)}</td><td>{labels[simulation.baseline.rows[i].outcome as keyof typeof labels]} · {minutes(simulation.baseline.rows[i].shortfall, lang)}</td></tr>)}</tbody></table></details>
      </div>
    </section>
    <section className="panel"><PanelTitle icon={CalendarClock} title={t('Team pressure points', '팀 일정 부담 요인')} /><div className="panel-body stats-grid">
      <div><strong>{reqLate}/{n}</strong><span>{t('Late prerequisite windows', '늦은 선행 조건')}</span></div><div><strong>{collisions}/{n}</strong><span>{t('Deadlines within two hours of another', '다른 요청과 2시간 이내 마감')}</span></div><div><strong>{skillGaps.length}</strong><span>{t('Skills with one verified level 4+ owner', '레벨 4 이상 검증 담당자가 한 명인 스킬')}</span></div><div><strong>{multi}/{eligibleWeeks}</strong><span>{t('Employees with repeated overload', '반복 과부하 팀원')}</span></div>
    </div></section>
  </div>
}

