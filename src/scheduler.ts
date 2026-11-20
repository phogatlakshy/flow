import { catalog, clip, DAY, dayOf, duration, intersects, merge, span, subtract, taskIssues, total, weekday, weekOf, type Assignment, type Block, type Candidate, type Employee, type Factor, type Interval, type Issue, type Policy, type Rejected, type Task, type Workspace } from './domain'
import { existingTasks, roster } from './seed'

export const weights = { skill: 25, experience: 15, buffer: 15, workload: 15, deadlines: 12, focus: 10, overload: 8 }
const rotationWindow = 30 * DAY
const rotationBand = 5
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const byStart = (a: Interval, b: Interval) => a.start - b.start || a.end - b.end
const relative = (list: Interval[], day: number) => list.map(({ start, end }) => span(day + start, day + end))
const countsAsWork = (block: Block) => block.kind !== 'leave' && block.kind !== 'reserve'
const dates = (start: number, end: number, step = DAY) => {
  const days: number[] = []
  for (let day = start; day < end; day += step) days.push(day)
  return days
}

export const policyIssues = (policy: Policy) => {
  const issues: string[] = []
  if (!policy.daily || policy.daily < 1 || policy.daily > DAY) issues.push('daily')
  if (!policy.weekly || policy.weekly < 1 || policy.weekly > 7 * DAY) issues.push('weekly')
  if (!policy.breaks || policy.breaks.some((i) => i.start < 0 || i.end > DAY || i.start >= i.end)) issues.push('breaks')
  if (!policy.reserve || policy.reserve.some((i) => i.start < 0 || i.end > DAY || i.start >= i.end) || policy.reserveDay < 0 || policy.reserveDay > 6) issues.push('reserve')
  if (!policy.overload || policy.overload > 1 || policy.overload < 0) issues.push('overload')
  return issues
}
type DaySlots = { day: number; windows: Interval[]; cap: number }
type WeekSlots = { week: number; days: DaySlots[]; cap: number }
type Option = { count: number; max: number; chosen: Interval[] }

function calendarFor(employee: Employee, blocks: Block[], policy: Policy) {
  const work = merge(blocks.filter(countsAsWork))
  const busy = merge(blocks)
  const leaveAndReserve = merge(blocks.filter((block) => !countsAsWork(block)))
  const scheduled = (day: number) => relative(employee.hours[weekday(day)] || [], day)
  const protections = (day: number) => [
    ...relative(policy.breaks || [], day),
    ...relative(weekday(day) === policy.reserveDay ? policy.reserve || [] : [], day),
  ]
  const workUsed = (start: number, end: number) => total(clip(work, span(start, end)))
  const regular = (day: number) => subtract(scheduled(day), protections(day))
  const regularCapacity = (week: number) => dates(week, week + DAY * 7).reduce((sum, day) =>
    sum + total(subtract(regular(day), leaveAndReserve)), 0)
  function slots(start: number, end: number, access: Interval[][] = [], extended = false): WeekSlots[] {
    if (start >= end) return []
    const weeks: WeekSlots[] = []
    for (const week of dates(weekOf(start), end, 7 * DAY)) {
      const cap = extended ? 7 * DAY : Math.max(0, (policy.weekly || 0) - workUsed(week, week + 7 * DAY))
      if (!cap) continue
      const days: DaySlots[] = []
      for (const day of dates(Math.max(week, dayOf(start)), Math.min(week + 7 * DAY, end))) {
        const dayCap = extended ? DAY : Math.max(0, (policy.daily || 0) - workUsed(day, day + DAY))
        if (!dayCap) continue
        const hours = extended ? subtract([span(day, day + DAY)], protections(day)) : regular(day)
        let windows = clip(subtract(hours, busy), span(start, end))
        for (const accessWindows of access) windows = merge(windows.flatMap((window) => clip(accessWindows, window)))
        if (windows.length) days.push({ day, windows, cap: dayCap })
      }
      if (days.length) weeks.push({ week, days, cap })
    }
    return weeks
  }
  return { slots, workUsed, regular, regularCapacity }
}

function capacity(slots: WeekSlots[]) {
  return slots.reduce((sum, week) => sum + Math.min(week.cap, week.days.reduce((daySum, day) => daySum + Math.min(day.cap, total(day.windows)), 0)), 0)
}

function longest(slots: WeekSlots[]) {
  return Math.max(0, ...slots.flatMap((week) => week.days.flatMap((day) => day.windows.map((window) => Math.min(week.cap, day.cap, duration(window))))))
}

// For a fixed number of blocks, each child contributes its longest feasible windows.
// Every length between count × focus and max is attainable, even after a day/week cap.
function optionsBetween(left: Option[], right: Option[], cap: number, focus: number, maxBlocks: number) {
  const best = new Map<number, Option>()
  for (const a of left) for (const b of right) {
    const count = a.count + b.count
    if (count > maxBlocks || count * focus > cap) continue
    const max = Math.min(cap, a.max + b.max)
    if ((best.get(count)?.max ?? -1) < max) best.set(count, { count, max, chosen: [...a.chosen, ...b.chosen] })
  }
  return [...best.values()]
}
const zero: Option = { count: 0, max: 0, chosen: [] }
function pickWindows(slots: WeekSlots[], end: number, limit: number, focus: number, maxBlocks: number): Option[] {
  let overall = [zero]
  for (const week of slots) {
    let weekly = [zero]
    for (const day of week.days) {
      const windows = day.windows.map((window) => span(window.start, Math.min(window.end, end)))
        .filter((window) => duration(window) >= focus)
        .sort((a, b) => duration(b) - duration(a) || byStart(a, b))
      const daily = [zero]
      let sum = 0
      for (const [i, window] of windows.slice(0, Math.min(maxBlocks, Math.floor(day.cap / focus))).entries()) {
        sum += duration(window)
        daily.push({ count: i + 1, max: Math.min(sum, day.cap), chosen: windows.slice(0, i + 1) })
      }
      weekly = optionsBetween(weekly, daily, week.cap, focus, maxBlocks)
    }
    overall = optionsBetween(overall, weekly, limit, focus, maxBlocks)
  }
  return overall
}

function allocate(slots: WeekSlots[], selected: Interval[], effort: number, focus: number) {
  const chosen = selected.slice().sort(byStart)
  const wk = new Map(slots.map((week) => [week.week, week.cap]))
  const dy = new Map(slots.flatMap((week) => week.days.map((day) => [day.day, day.cap] as const)))
  for (const block of chosen) {
    const week = weekOf(block.start)
    const day = dayOf(block.start)
    wk.set(week, wk.get(week)! - focus)
    dy.set(day, dy.get(day)! - focus)
  }
  let left = effort - chosen.length * focus
  return chosen.map((block) => {
    const week = weekOf(block.start)
    const day = dayOf(block.start)
    const extra = Math.min(left, duration(block) - focus, wk.get(week)!, dy.get(day)!)
    left -= extra
    wk.set(week, wk.get(week)! - extra)
    dy.set(day, dy.get(day)! - extra)
    return span(block.start, block.start + focus + extra)
  })
}

function search(slots: WeekSlots[], start: number, end: number, effort: number, split: boolean, minimum: number) {
  if (!split) {
    for (const week of slots) for (const day of week.days) for (const window of day.windows) {
      if (Math.min(week.cap, day.cap, duration(window)) >= effort) return [span(window.start, window.start + effort)]
    }
    return []
  }
  const focus = Math.min(minimum, effort)
  const blockLimit = Math.floor(effort / focus)
  const best = (until: number) => pickWindows(slots, until, effort, focus, blockLimit)
    .filter((option) => option.max >= effort).sort((a, b) => a.count - b.count)[0]
  if (!best(end)) return []
  let lo = start + effort
  let hi = end
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (best(mid)) hi = mid
    else lo = mid + 1
  }
  return allocate(slots, best(hi).chosen, effort, focus)
}

const personBlocks = (state: Workspace, employee: Employee, ignored?: string) => state.blocks.filter((block) => block.employeeId === employee.id && (!ignored || block.taskId !== ignored))
export function effectivePerson(person: Employee, state: Workspace): Employee {
  const verification = state.verifications?.[person.id]
  return verification ? {
    ...person, scheduleVerified: verification.schedule ?? person.scheduleVerified, access: { ...person.access, ...verification.access },
    hours: verification.hours ?? person.hours, skills: verification.skills ?? person.skills,
  } : person
}
const requirementStart = (task: Task, now: number) => Math.max(now, ...task.dependencies.map((dependency) => dependency.available ?? now))
const accessWindows = (task: Task, employee: Employee) => task.access.flatMap((item) => {
  const access = employee.access[item]
  return Array.isArray(access) ? [access] : []
})
export const calendarOverlaps = (blocks: Block[]) => {
  const sorted = blocks.filter((block) => block.kind !== 'reserve').sort(byStart)
  return sorted.flatMap((item, i) => {
    const conflicts: [Block, Block][] = []
    for (let j = i + 1; j < sorted.length && sorted[j].start < item.end; j++) conflicts.push([item, sorted[j]])
    return conflicts
  })
}
function activeTasks(state: Workspace, employee: Employee, ignored?: string) {
  return [
    ...existingTasks.filter((record) => record.employeeId === employee.id && record.id !== ignored),
    ...state.assignments.filter((record) => record.employeeId === employee.id && record.task.id !== ignored)
      .map(({ task }) => ({ id: task.id, employeeId: employee.id, title: task.title, deadline: task.deadline, remaining: task.max || 0, verified: true })),
  ].filter((record) => record.deadline === null || record.deadline > state.now)
}

function eligibility(task: Task, employee: Employee, state: Workspace, blocks: Block[], ignored?: string): Issue[] {
  if (employee.status === 'leave' || employee.status === 'terminated') return [{ code: 'status', detail: employee.status }]
  const issues: Issue[] = []
  for (const rule of task.required) if ((employee.skills[rule.id] || 0) < (rule.level || 1)) issues.push({ code: 'skill', detail: rule.id + ' ' + (employee.skills[rule.id] || 0) + '/' + rule.level })
  for (const item of task.access) {
    const access = employee.access[item]
    if (access === undefined || access === 'unknown') issues.push({ code: 'access-unknown', detail: item })
    else if (!access.length) issues.push({ code: 'access', detail: item })
  }
  if (!employee.scheduleVerified) issues.push({ code: 'schedule', detail: 'working windows' })
  for (const record of activeTasks(state, employee, ignored)) {
    const booked = blocks.filter((block) => block.taskId === record.id && countsAsWork(block))
    const bookedMinutes = total(merge(booked))
    if (record.remaining && ((!record.verified && !state.verifiedTasks?.includes(record.id)) || bookedMinutes < record.remaining)) issues.push({ code: 'schedule', detail: record.title })
  }
  for (const missing of policyIssues(state.policy)) issues.push({ code: 'policy', detail: missing })
  if (task.deadline !== null && requirementStart(task, state.now) >= task.deadline) issues.push({ code: 'dependency', detail: task.dependencies.map(({ name }) => name).join(', ') })
  return issues
}

export function workload(employee: Employee, state: Workspace, week = weekOf(state.now)) {
  const calendar = calendarFor(effectivePerson(employee, state), personBlocks(state, employee), state.policy)
  const used = calendar.workUsed(week, week + 7 * DAY)
  const regular = calendar.regularCapacity(week)
  return { used, regular, ratio: regular ? used / regular : 0 }
}

export function historySummary(employee: Employee, state: Workspace) {
  const current = weekOf(state.now)
  const records = employee.history?.filter((row) => row.verified && row.capacity > 0 && row.start >= current - 28 * DAY && row.start < current) || []
  return { weeks: records.length, overloaded: records.filter((row) => row.used / row.capacity >= (state.policy.overload || 1)).length }
}

function urgentHistory(employee: Employee, state: Workspace, blocks: Block[]) {
  const start = state.now - rotationWindow
  const leave = blocks.filter((block) => block.kind === 'leave')
  const days = dates(dayOf(start), dayOf(state.now)).filter((day) => {
    const windows = employee.hours[weekday(day)] || []
    const carriedIn = employee.hours[weekday(day - DAY)]?.some((window) => window.end === DAY)
    const shiftStarts = windows.filter((window) => !carriedIn || window.start !== 0)
    const continuation = shiftStarts.some((window) => window.end === DAY)
      ? (employee.hours[weekday(day + DAY)] || []).filter((window) => window.start === 0) : []
    return total(subtract([...relative(shiftStarts, day), ...relative(continuation, day + DAY)], leave)) > 0
  }).length
  const urgentCount = employee.urgent === null ? null : employee.urgent.filter((stamp) => stamp >= start && stamp < state.now).length +
    state.assignments.filter((a) => a.employeeId === employee.id && a.task.priority === 'urgent' && a.history[0]?.at >= start && a.history[0]?.at <= state.now).length
  return { urgentCount, urgentDays: days, urgentRate: urgentCount !== null && days ? urgentCount * 10 / days : null }
}

function asBlocks(task: Task, employeeId: string, plan: Interval[]): Block[] {
  return plan.map((interval, index) => ({ ...interval, id: task.id + '-' + index, taskId: task.id, title: task.title, kind: 'assignment', employeeId }))
}
function evaluate(task: Task, employee: Employee, plan: Interval[], blocks: Block[], state: Workspace, ignored?: string): Candidate {
  const finish = plan.at(-1)!.end
  const after = calendarFor(employee, [...blocks, ...asBlocks(task, employee.id, plan)], state.policy)
  const before = calendarFor(employee, blocks, state.policy)
  const free = capacity(after.slots(finish, task.deadline!, accessWindows(task, employee)))
  const factor = (id: keyof typeof weights, value: number, detail: string, detailKo: string, missing = false): Factor =>
    ({ id, value: clamp(value), weight: weights[id], detail, detailKo, missing })
  const pref = task.preferred.map((id) => employee.skills[id] || 0)
  const skill = task.required.length ? task.required.reduce((sum, row) => sum + (employee.skills[row.id] || 0), 0) / (task.required.length * 5) : 1
  const fit = pref.length ? skill * .9 + .1 * pref.reduce((sum, n) => sum + n, 0) / (pref.length * 5) : skill
  const skills = task.required.map(({ id }) => catalog.find((item) => item.id === id)?.en + ' ' + employee.skills[id] + '/5').join(', ')
  const preferred = task.preferred.map((id, index) => id + ' ' + pref[index] + '/5').join(', ')
  const words = (task.title + ' ' + task.deliverable).toLowerCase().split(/[^\p{L}\p{N}-]+/u)
  const tags = new Set([...task.required.map((row) => row.id), ...task.preferred, ...words])
  const withinYear = new Date(state.now * 60000)
  withinYear.setUTCFullYear(withinYear.getUTCFullYear() - 1)
  const comparableWork = employee.experience?.filter((item) => item.verified && item.at >= withinYear.getTime() / 60000 && item.at <= state.now &&
    item.tags.some((tag) => tags.has(tag)))
  const exp = comparableWork?.length
  const examples = comparableWork?.flatMap(({ title }) => title ? [title] : []).slice(0, 2).join(' · ')
  const experienceExamples = examples ? ' · ' + examples : ''
  const usedWeeks = [...new Set(plan.map((block) => weekOf(block.start)))]
  const ratios = usedWeeks.map((week) => {
    const used = after.workUsed(week, week + 7 * DAY)
    const regular = after.regularCapacity(week)
    return { used, regular, ratio: regular ? used / regular : 1 }
  }).sort((a, b) => b.ratio - a.ratio)
  const worst = ratios[0]
  const impacts = activeTasks(state, employee, ignored).flatMap((record) => {
    const due = record.deadline
    if (due === null) return []
    const last = blocks.filter((block) => block.taskId === record.id).reduce((end, block) => Math.max(end, block.end), state.now)
    return [{ title: record.title, before: capacity(before.slots(last, due)), after: capacity(after.slots(last, due)) }]
  })
  const retained = Math.min(1, ...impacts.filter((impact) => impact.before > 0).map((impact) => impact.after / impact.before))
  const history = historySummary(employee, state)
  const impactText = impacts.map((item) => item.title + ' ' + item.before + ' → ' + item.after + ' min').join(', ')
  const impactKo = impacts.map((item) => item.title + ' ' + item.before + '분 → ' + item.after + '분').join(', ')
  const factors = [
    factor('skill', fit, (skills || 'No mandatory skills') + (preferred ? ' · Preferred ' + preferred : ''), (skills || '필수 스킬 없음') + (preferred ? ' · 우대 ' + preferred : '')),
    factor('experience', exp === undefined ? .5 : exp / 5, exp === undefined ? 'Missing verified history · neutral 0.5' : exp + ' comparable tasks in the last 12 months (cap 5)' + experienceExamples, exp === undefined ? '검증된 기록 없음 · 중립값 0.5' : '최근 12개월 유사 과제 ' + exp + '건 (최대 5건)' + experienceExamples, exp === undefined),
    factor('buffer', free / task.max!, free + ' allocatable min ÷ ' + task.max + ' min effort', '배정 가능 ' + free + '분 ÷ 작업 ' + task.max + '분'),
    factor('workload', 1 - worst.ratio, worst.used + ' / ' + worst.regular + ' min in the busiest affected week', '가장 바쁜 주 ' + worst.used + ' / ' + worst.regular + '분'),
    factor('deadlines', retained, impactText || 'No active deadlines', impactKo || '진행 중 마감 없음'),
    factor('focus', 1 / plan.length, '1 ÷ ' + plan.length + ' work blocks', '1 ÷ 작업 블록 ' + plan.length + '개'),
    factor('overload', history.weeks ? 1 - history.overloaded / history.weeks : .5, history.weeks ? history.overloaded + ' / ' + history.weeks + ' weeks above threshold' : 'Missing verified history · neutral 0.5', history.weeks ? '기준 도달 ' + history.overloaded + ' / ' + history.weeks + '주' : '검증된 기록 없음 · 중립값 0.5', !history.weeks),
  ]
  return {
    employee, blocks: plan, finish, free, factors, impacts, score: factors.reduce((sum, item) => sum + item.weight * item.value, 0),
    rotation: false, ...urgentHistory(employee, state, blocks),
    overlaps: calendarOverlaps(blocks.filter((block) => block.end > state.now)).length,
  }
}

const baseOrder = (a: Candidate, b: Candidate) => b.score - a.score || b.free - a.free || a.employee.id.localeCompare(b.employee.id)
export function rankCandidates(candidates: Candidate[], urgent: boolean): Candidate[] {
  const remaining = candidates.slice().sort(baseOrder)
  const result: Candidate[] = []
  while (remaining.length) {
    const highest = remaining[0]
    const band = remaining.filter((candidate) => highest.score - candidate.score <= rotationBand)
    const comparable = band.length > 1 && band.every((item) => item.urgentRate !== null && item.urgentDays > 0)
    const chosen = urgent && comparable
      ? band.slice().sort((a, b) => a.urgentRate! - b.urgentRate! || baseOrder(a, b))[0]
      : highest
    result.push({ ...chosen, rotation: chosen.employee.id !== highest.employee.id })
    remaining.splice(remaining.indexOf(chosen), 1)
  }
  return result
}
export type PlanResult = { ranked: Candidate[]; rejected: Rejected[]; issues: string[] }
export function planTask(task: Task, state: Workspace, ignored?: string, people = roster): PlanResult {
  const issues = [...taskIssues(task, state.now), ...policyIssues(state.policy).map((key) => 'policy-' + key)]
  if (issues.length) return { ranked: [], rejected: [], issues }
  const ranked: Candidate[] = []
  const rejected: Rejected[] = []
  const start = requirementStart(task, state.now)
  const end = task.deadline!
  for (const person of people.filter((person) => person.team === task.team)) {
    const employee = effectivePerson(person, state)
    const blocks = personBlocks(state, employee, ignored)
    const reasons = eligibility(task, employee, state, blocks, ignored)
    const calendar = calendarFor(employee, blocks, state.policy)
    const slots = calendar.slots(start, end, accessWindows(task, employee))
    const available = reasons.some(({ code }) => ['access', 'access-unknown', 'schedule', 'policy', 'status'].includes(code)) ? 0 : capacity(slots)
    const continuous = available ? longest(slots) : 0
    const plan = reasons.length ? [] : search(slots, start, end, task.max!, task.split!, task.focus || task.max!)
    if (plan.length) ranked.push(evaluate(task, employee, plan, blocks, state, ignored))
    else {
      if (!reasons.length) {
        const accessLimited = task.access.length && capacity(calendar.slots(start, end)) > available
        if (accessLimited) reasons.push({ code: 'access', detail: task.access.join(', ') + ' (time window)' })
        reasons.push({ code: available >= task.max! ? 'focus' : 'capacity', detail: String(task.max!) })
      }
      rejected.push({ employee, issues: reasons, available, longest: continuous })
    }
  }
  return { ranked: rankCandidates(ranked, task.priority === 'urgent'), rejected, issues }
}

export function feasibleAlternatives(task: Task, state: Workspace, ignored?: string, people = roster) {
  const test = (id: string, revised: Task, calendar = state, group = people): { id: string; task: Task; candidate?: Candidate } =>
    ({ id, task: revised, candidate: planTask(revised, calendar, ignored, group).ranked[0] })
  const results = [
    ...(task.max! > 1 ? [test('scope', { ...task, min: Math.min(task.min!, Math.ceil(task.max! / 2)), max: Math.ceil(task.max! / 2) })] : []),
    ...(!task.split || (task.focus || 0) > 30 ? [test('split', { ...task, split: true, focus: Math.min(task.focus || 60, 30) })] : []),
    test('deadline', { ...task, deadline: task.deadline! + DAY }),
  ]
  const baseline = planTask(task, state, ignored, people)
  const missing = baseline.rejected.find((entry) => entry.issues.length && entry.issues.every((issue) => issue.code === 'access-unknown' || issue.code === 'access'))
  if (missing) {
    const id = missing.employee.id
    const current = state.verifications?.[id]
    const access = { ...current?.access, ...Object.fromEntries(missing.issues.map(({ detail }) => [detail, [span(state.now, task.deadline!)]])) }
    results.push(test('access:' + id, task, { ...state, verifications: { ...state.verifications, [id]: { ...current, access } } }, people.filter((person) => person.id === id)))
  }
  const viable = baseline.rejected.filter((entry) => entry.issues.every(({ code }) => code === 'capacity' || code === 'focus'))
  const work = state.blocks.find((block) => viable.some((entry) => entry.employee.id === block.employeeId) && block.kind === 'work' &&
    intersects(block, span(state.now, task.deadline!)))
  if (work) {
    const record = existingTasks.find((item) => item.id === work.taskId)
    const shift = task.deadline! - work.start
    const moved = { ...work, start: work.start + shift, end: work.end + shift }
    const person = people.find(({ id }) => id === work.employeeId)!
    const revisedBlocks = state.blocks.filter((block) => block.id !== work.id)
    const calendar = calendarFor(person, revisedBlocks.filter((block) => block.employeeId === person.id), state.policy)
    if ((!record?.deadline || moved.end <= record.deadline) &&
      search(calendar.slots(moved.start, moved.end), moved.start, moved.end, duration(moved), false, duration(moved)).length) {
      results.push(test('work:' + work.title, task, { ...state, blocks: [...revisedBlocks, moved] }))
    } else {
      results.push({ id: 'work:' + work.title, task, candidate: undefined })
    }
  }
  return results
}

export function addBooking(state: Workspace, task: Task, candidate: Candidate, old?: Assignment, approvalId?: string): Workspace {
  const record: Assignment = {
    task, employeeId: candidate.employee.id, blocks: candidate.blocks, score: candidate.score, reasons: candidate.factors,
    reason: candidate.rotation ? 'Urgent-work rotation' : 'Calendar fit and weighted ranking',
    pending: false, approvalId, history: [...(old?.history || []), {
      at: state.now, type: old ? 'replacement' : 'approval', note: candidate.employee.name + ' · ' + candidate.blocks.length + ' blocks · ' + candidate.score.toFixed(1) + '/100',
    }],
  }
  return {
    ...state, version: state.version + 1,
    assignments: [...state.assignments.filter((assignment) => assignment.task.id !== task.id), record],
    blocks: [...state.blocks.filter((block) => block.taskId !== task.id), ...asBlocks(task, candidate.employee.id, candidate.blocks)],
  }
}

export function checkApproval(state: Workspace, task: Task, selected: Candidate, replacement: boolean, approvalId?: string, reviewedHistory?: number) {
  const existing = state.assignments.find((item) => item.task.id === task.id)
  if (existing && (!replacement || (approvalId && existing.approvalId === approvalId))) return { state, status: 'duplicate' as const }
  if (replacement && (!existing || (reviewedHistory !== undefined && existing.history.length !== reviewedHistory))) return { state, status: 'stale' as const }
  const fresh = planTask(task, state, replacement ? task.id : undefined).ranked.find((item) => item.employee.id === selected.employee.id)
  if (!fresh || fresh.blocks.length !== selected.blocks.length || fresh.blocks.some((block, i) => block.start !== selected.blocks[i].start || block.end !== selected.blocks[i].end)) {
    const conflicts = [...new Set(personBlocks(state, selected.employee, replacement ? task.id : undefined)
      .filter((block) => selected.blocks.some((planned) => intersects(block, planned))).map((block) => block.title))]
    return { state, status: 'stale' as const, conflicts }
  }
  return { state: addBooking(state, task, fresh, existing, approvalId), status: 'confirmed' as const }
}

export function flagCalendarChanges(state: Workspace, reason: string, policyChanged = false): Workspace {
  return {
    ...state, version: state.version + 1,
    assignments: state.assignments.map((record) => {
      if (record.pending || record.blocks.at(-1)!.end <= state.now) return record
      const person = roster.find(({ id }) => id === record.employeeId)
      if (!person) return record
      const other = personBlocks(state, person, record.task.id)
      const overlap = record.blocks.some((block) => other.some((busy) => intersects(block, busy)))
      const effective = effectivePerson(person, state)
      const calendar = calendarFor(effective, other, state.policy)
      const invalid = !validBooking(record, effective, calendar, state.now)
      if (!overlap && !invalid && !policyChanged) return record
      return { ...record, pending: true, history: [...record.history, { at: state.now, type: 'change', note: reason }] }
    }),
  }
}

function validBooking(record: Assignment, employee: Employee, calendar: ReturnType<typeof calendarFor>, now: number) {
  const future = record.blocks.filter((block) => block.end > now)
  const access = accessWindows(record.task, employee)
  if (!employee.scheduleVerified || access.length !== record.task.access.length || record.task.required.some(({ id, level }) => (employee.skills[id] || 0) < level!)) return false
  const slots = calendar.slots(future[0].start, future.at(-1)!.end, access)
  return slots.length > 0 && future.every((block) => slots.some((week) => week.days.some((day) =>
    day.windows.some((window) => window.start <= block.start && window.end >= block.end) &&
    day.cap >= total(future.filter((booked) => dayOf(booked.start) === day.day)) &&
    week.cap >= total(future.filter((booked) => weekOf(booked.start) === week.week)))))
}

export function baselinePlan(task: Task, state: Workspace, employee: Employee) {
  const blocks = personBlocks(state, employee)
  if (eligibility(task, employee, state, blocks).length) return { plan: [], overtime: 0 }
  const start = requirementStart(task, state.now)
  const end = task.deadline!
  const effort = task.max!
  const access = accessWindows(task, employee)
  const calendar = calendarFor(employee, blocks, state.policy)
  const slots = calendar.slots(start, end, access)
  const full = search(slots, start, end, effort, task.split!, task.focus || effort)
  if (full.length) return { plan: full, overtime: 0 }
  const possible = task.split
    ? Math.max(...pickWindows(slots, end, effort, Math.min(task.focus || effort, effort), Math.floor(effort / Math.min(task.focus || effort, effort))).map((item) => item.max))
    : longest(slots)
  const partial = possible ? search(slots, start, end, possible, task.split!, task.focus || effort) : []
  // Extend candidate work windows before testing overtime; retain all access and busy blocks.
  const extended = calendar.slots(start, end, access, true)
  const overtimeOf = (plan: Interval[]) => total(plan) - plan.reduce((sum, block) => sum + total(clip(calendar.regular(dayOf(block.start)), block)), 0)
  let overtime = 0
  if (!task.split) {
    const windows = extended.flatMap((week) => week.days.flatMap((day) => day.windows)).filter((window) => duration(window) >= effort)
    const options = windows.flatMap((window) => {
      const regular = calendar.regular(dayOf(window.start))
      const starts = [window.start, window.end - effort, ...regular.flatMap((i) => [i.start, i.end - effort])].filter((time) => time >= window.start && time + effort <= window.end)
      return starts.map((time) => overtimeOf([span(time, time + effort)]))
    })
    if (options.length) overtime = Math.min(...options)
  } else {
    const extendedPlan = search(extended, start, end, effort, true, task.focus || effort)
    if (extendedPlan.length) overtime = overtimeOf(extendedPlan)
  }
  return { plan: partial, overtime }
}

export function simulate(team: string, requests: Task[], initial: Workspace) {
  const run = (baseline: boolean) => {
    let state = structuredClone(initial)
    const summary = { onTime: 0, deferred: 0, blocked: 0, shortfall: 0, overtime: 0, overtimeCount: 0, count: requests.length, overloaded: 0, repeat: 0, people: 0, rows: [] as { title: string; outcome: string; shortfall: number; overtime: number }[] }
    const seen = new Map<string, Set<number>>()
    for (const task of requests) {
      const owner = roster.find((employee) => employee.id === task.previousOwner && employee.team === team)
      const best = baseline ? undefined : planTask(task, state).ranked[0]
      const person = baseline ? owner : best?.employee
      const attempt = baseline && owner ? baselinePlan(task, state, owner) : { plan: best?.blocks || [], overtime: 0 }
      const shortfall = task.max! - total(attempt.plan)
      const outcome = !shortfall ? 'onTime' : attempt.plan.length ? 'deferred' : 'blocked'
      summary[outcome]++
      summary.shortfall += shortfall
      summary.overtime += attempt.overtime
      if (attempt.overtime > 0) summary.overtimeCount++
      summary.rows.push({ title: task.title, outcome, shortfall, overtime: attempt.overtime })
      if (person && attempt.plan.length) {
        state = { ...state, blocks: [...state.blocks, ...asBlocks(task, person.id, attempt.plan)] }
        const weeks = seen.get(person.id) || new Set<number>()
        attempt.plan.forEach((block) => weeks.add(weekOf(block.start)))
        seen.set(person.id, weeks)
      }
    }
    for (const person of roster.filter((employee) => employee.team === team)) {
      const historical = historySummary(person, state)
      const projected = [...(seen.get(person.id) || [])].map((week) => workload(person, state, week)).filter((row) => row.regular)
      const overloaded = historical.overloaded + projected.filter((row) => row.ratio >= (state.policy.overload || 1)).length
      const count = historical.weeks + projected.length
      if (count >= 2) {
        summary.people++
        if (overloaded >= 2) summary.repeat++
      }
      if (projected.length) summary.overloaded += projected.filter((row) => row.ratio >= (state.policy.overload || 1)).length
    }
    return summary
  }
  return { relay: run(false), baseline: run(true) }
}
