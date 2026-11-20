import { add, DAY, dayOf, duration, emptyTask, span, subtract, total, weekday, weeklyWindows, weekOf, type Block, type Employee, type ExistingTask, type Language, type Policy, type Task, type Workspace } from './domain'
import { demoMembers, demoRows, demoTeam, departments, personId, profileFor, shiftTimes, skillsFor, teamFor, type Department, type SourceRow } from './profiles'
import sourceRows from './data/roster.json'

const rows = sourceRows as SourceRow[]
const shiftMinute = (key: string) => Number(key.slice(0, 2)) * 60 + Number(key.slice(3))
const weekdays = [1, 2, 3, 4, 5]
export const teams = [demoTeam, ...departments.flatMap((department) =>
  [...new Set(rows.filter((row) => row.department === department && !demoRows.has(row.row)).map(teamFor))].sort())]
const teamKorean: Record<Department, string> = { Engineering: '엔지니어링', IT: 'IT', Finance: '재무', HR: '인사', Marketing: '마케팅' }
export function teamName(team: string, lang: Language) {
  if (lang === 'en') return team
  if (team === demoTeam) return '제품 플랫폼'
  const [department, group] = team.split(' · ')
  return (teamKorean[department as Department] || department) + ' · ' + group.replace('Team ', '팀 ')
}
export const demoRecommended = personId(demoMembers[0].row)
export const demoPreviousOwner = personId(demoMembers[1].row)
export const demoUnverified = personId(demoMembers[2].row)
export const demoDate = '2026-11-24'
export const DEMO_NOW = add(demoDate, '09:00')
export const policy: Policy = {
  timezone: 'Asia/Seoul', daily: 480, weekly: 2400, breaks: [span(720, 780), span(1050, 1080), span(0, 30)],
  reserve: [span(990, 1020)], reserveDay: 5, overload: .9,
}
const horizon = add('2035-01-01')
const since = add('2026-01-01')
const at = (time: string) => add(demoDate, time)

function schedule(row: SourceRow) {
  if (row.status !== 'active') return {}
  const { start, end } = shiftTimes[row.shift]
  return weeklyWindows(weekdays, shiftMinute(start), shiftMinute(end))
}

const ordered = [...demoMembers.map(({ row }) => rows.find((entry) => entry.row === row)!), ...rows.filter((row) => !demoRows.has(row.row))]
const rowById = new Map(ordered.map((row) => [personId(row.row), row]))

function workDates(now: number) {
  return Array.from({ length: 30 }, (_, i) => dayOf(now) - (i + 1) * DAY).filter((day) => weekdays.includes(weekday(day)))
}

function shiftWindows(person: Employee, date: number) {
  const day = weekday(date)
  const protections = [...policy.breaks!, ...(day === policy.reserveDay ? policy.reserve! : [])]
  return subtract(person.hours[day] || [], protections).map((interval) => span(date + interval.start, date + interval.end))
}

const capacityInWeek = (person: Employee, week: number) =>
  Array.from({ length: 7 }, (_, day) => total(shiftWindows(person, week + day * DAY))).reduce((sum, length) => sum + length, 0)

export const roster: Employee[] = ordered.map((row, index) => {
  const member = demoMembers.find((item) => item.row === row.row)
  const profile = profileFor(row)
  const parts = row.name.split(/\s+/)
  const id = personId(row.row)
  const inactive = row.status !== 'active'
  const access: Employee['access'] = Object.fromEntries(
    ['staging', 'production', 'analytics', 'service desk', 'identity console', 'finance workspace', 'payroll workspace', 'hr workspace', 'marketing workspace']
      .map((system) => [system, profile.access.includes(system) && !inactive ? [span(since, horizon)] : []]),
  )
  if (id === demoUnverified) access.staging = 'unknown'
  else if (!member && !inactive && row.row % 13 === 0 && profile.access[0]) access[profile.access[0]] = 'unknown'
  const urgentCount = id === demoRecommended ? 1 : id === demoPreviousOwner ? 4 : (row.row * 7 + 2) % 5
  const evidenceCount = id === demoRecommended ? profile.work.length : 2 + row.row % Math.max(1, profile.work.length - 1)
  const person: Employee = {
    id, team: teamFor(row), name: row.name, korean: member?.korean || row.name,
    initials: parts[0][0] + parts.at(-1)![0], role: profile.en, roleKo: profile.ko, color: index % 8,
    status: row.status, skills: skillsFor(row, profile), scheduleVerified: !inactive && (!!member || row.row % 41 !== 0), hours: schedule(row), access,
    source: { id: row.id, title: row.title, department: row.department, manager: String(row.manager), shift: row.shift, employment: row.employment },
    experience: inactive || (!member && row.row % 19 === 0) ? null : profile.work.slice(0, evidenceCount)
      .map((item, i) => ({ ...item, at: DEMO_NOW - (21 + i * 37 + row.row % 17) * DAY, verified: true })),
    urgent: inactive || (!member && row.row % 37 === 0) ? null : workDates(DEMO_NOW)
      .filter((_, i) => i % 4 === row.row % 4).slice(0, urgentCount).map((day) => day + shiftMinute(shiftTimes[row.shift].start)),
    history: null,
  }
  if (!inactive && (member || row.row % 17 !== 0)) {
    person.history = Array.from({ length: 4 }, (_, i) => {
      const start = weekOf(DEMO_NOW) - (i + 1) * 7 * DAY
      const capacity = capacityInWeek(person, start)
      const fraction = id === demoRecommended ? [.8, .84, .92, .78][i]
        : id === demoPreviousOwner ? [.94, .96, .92, .87][i] : .68 + ((row.row * 11 + i * 13) % 31) / 100
      return { start, capacity, used: Math.round(capacity * fraction / 5) * 5, verified: true }
    })
  }
  return person
})

export const workspaceRoster = (state: Workspace) => state.dataset?.people ?? roster
export const workspaceTeams = (state: Workspace) => state.dataset ? [...new Set(state.dataset.people.map((person) => person.team))].sort() : teams

const fixtureBlocks: Block[] = []
export const existingTasks: ExistingTask[] = []
function seedBlock(employeeId: string, title: string, kind: Block['kind'], start: number, end: number, taskId?: string) {
  fixtureBlocks.push({ id: 'seed-' + fixtureBlocks.length, employeeId, title, kind, start, end, taskId })
}
function seedTask(employeeId: string, title: string, window: { start: number; end: number }, deadline: number) {
  const id = 'active-' + existingTasks.length
  existingTasks.push({ id, employeeId, title, deadline, remaining: duration(window), verified: true })
  seedBlock(employeeId, title, 'work', window.start, window.end, id)
}
seedTask(demoPreviousOwner, 'Release preparation', span(at('09:00'), at('12:00')), at('14:00'))
seedBlock(demoPreviousOwner, 'Release code review', 'review', at('13:00'), at('14:00'))
seedTask(demoRecommended, 'Navigation QA handoff', span(at('15:30'), at('16:30')), at('17:00'))
seedBlock(roster[3].id, 'Partner API handoff', 'meeting', at('09:00'), at('10:00'))
seedBlock(roster[3].id, 'Integration escalation queue', 'support', at('13:00'), at('14:00'))
seedBlock(roster[4].id, 'Design critique', 'meeting', at('13:00'), at('14:00'))
seedBlock(roster[5].id, 'Staging regression sweep', 'review', at('22:30'), at('23:30'))
seedBlock(roster[6].id, 'Adoption metrics review', 'meeting', at('13:30'), at('14:30'))
seedBlock(roster[7].id, 'Overnight on-call handoff', 'on-call', at('22:00'), at('23:00'))
for (const person of roster) {
  const row = rowById.get(person.id)!
  if (row.status !== 'active') continue
  const profile = profileFor(row)
  for (const offset of [-1, 0, 1, 2, 3]) {
    if (offset === 0 && demoRows.has(row.row)) continue
    const day = dayOf(DEMO_NOW) + offset * DAY
    const windows = shiftWindows(person, day).filter((window) => duration(window) >= 60)
    if (!windows.length) continue
    const project = profile.work[((row.row + offset) % profile.work.length + profile.work.length) % profile.work.length]
    const first = windows[0]
    const chunks = 90 + ((row.row + offset + 9) % 5) * 15
    const work = span(first.start + 15, Math.min(first.end, first.start + 15 + chunks))
    if (offset > -1) seedTask(person.id, project.title, work, Math.max(work.end, windows.at(-1)!.end))
    else seedBlock(person.id, project.title, 'work', work.start, work.end)
    const follow = subtract(windows, [work]).find((window) => duration(window) >= 45)
    if (follow) seedBlock(person.id, offset % 2 === 0 ? 'Project handoff' : 'Workstream review', offset % 2 ? 'review' : 'meeting', follow.start, follow.start + 45)
    const later = windows.at(-1)!
    if (later !== first && duration(later) >= 150 && row.row % 4 !== 0) {
      const start = later.end - 105
      const kind = profile.access.includes('production') ? 'on-call' : 'work'
      seedBlock(person.id, kind === 'on-call' ? 'Platform operations coverage' : profile.work.at(-1)!.title, kind, start, start + 90)
    }
    if (offset === 1 && row.row % 21 === 0) seedBlock(person.id, 'Partner review', 'meeting', work.start + 15, Math.min(work.end, work.start + 40))
    if (offset === 2 && later !== first && row.row % 29 === 0) seedBlock(person.id, 'Planned time off', 'leave', later.start, later.start + 45)
  }
  if (!demoRows.has(row.row) && row.row % 43 === 0) {
    existingTasks.push({ id: 'unverified-' + person.id, employeeId: person.id, title: 'Unscheduled ' + profile.work[0].title.toLowerCase(), remaining: 60, verified: false, deadline: at('17:00') + DAY })
  }
}

export const englishRequest = 'Fix the React and TypeScript dashboard filter before the client demo at 3 p.m. KST on November 24, 2026. Verify the fix in staging. This is urgent and should take 3–4 hours. It can be split into blocks of at least one hour.'
export const koreanRequest = '2026년 11월 24일 오후 3시(KST) 고객사 데모 전에 React·TypeScript 대시보드의 필터 오류를 수정하고 스테이징에서 확인해 주세요. 긴급 건이고 예상 소요 시간은 3~4시간입니다. 최소 1시간 단위로 나눠서 작업할 수 있습니다.'
export const exampleRequest = (language: Language) => language === 'ko' ? koreanRequest : englishRequest
export const dashboardTask = (language: Language = 'en'): Task => ({
  ...emptyTask(demoTeam, exampleRequest(language)), id: 'dashboard-demo',
  title: language === 'ko' ? '대시보드 필터 오류 수정' : 'Fix dashboard filter',
  deliverable: language === 'ko' ? 'React·TypeScript 대시보드 필터를 수정하고 스테이징에서 확인합니다.' : 'Fix the React and TypeScript dashboard filter and verify it in staging.',
  required: [{ id: 'react', level: 4 }, { id: 'typescript', level: 4 }], min: 180, max: 240, source: 'explicit',
  deadline: at('15:00'), priority: 'urgent', split: true, focus: 60, access: ['staging'], previousOwner: demoPreviousOwner,
  assumptions: [language === 'ko' ? '스킬 최소 레벨 4는 리드가 검토할 데모 기준입니다.' : 'Minimum skill level 4 is a demo assumption for the lead to confirm.'],
})
export const makeWorkspace = (): Workspace => ({ version: 0, now: DEMO_NOW, blocks: fixtureBlocks.map((block) => ({ ...block })), assignments: [], policy: structuredClone(policy) })

export function replayTasks(team: string): Task[] {
  const people = roster.filter((person) => person.team === team)
  const members = people.filter((person) => person.status === 'active')
  const pool = members.length ? members : people
  const specifications = [
    { date: at('15:00'), effort: 240, priority: 'urgent' },
    { date: at('16:30'), effort: 150, priority: 'high' },
    { date: at('17:30'), effort: 180, priority: 'urgent' },
    { date: at('14:00') + DAY, effort: 240, priority: 'routine' },
    { date: at('16:30') + DAY, effort: 120, priority: 'high' },
  ] as const
  return specifications.map((entry, index) => {
    if (index === 0 && team === demoTeam) return { ...dashboardTask(), confirmed: true }
    const owner = pool[index % pool.length]
    const profile = profileFor(rowById.get(owner.id)!)
    const work = profile.work[index % profile.work.length]
    const verified = work.tags.filter((id) => (owner.skills[id] || 0) >= 3).slice(0, 2)
    const required = (verified.length ? verified : profile.primary.slice(0, 1)).map((id) => ({ id, level: 3 }))
    return {
      ...emptyTask(team), id: 'replay-' + index, title: work.title, deliverable: work.title + ' and record verification findings.',
      required, access: profile.access.slice(0, 1), previousOwner: owner.id,
      confirmed: true, split: true, focus: 60, source: 'explicit', min: entry.effort, max: entry.effort,
      priority: entry.priority, deadline: entry.date,
      dependencies: index === 2 ? [{ name: 'Latest handoff artefacts', available: at('15:30') }] : [],
    }
  })
}
