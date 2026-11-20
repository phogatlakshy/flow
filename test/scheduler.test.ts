import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DAY, add, catalog, hour, span, total, type Block, type Candidate } from '../src/domain'
import { parseCsv } from '../src/csv'
import { validateExtraction } from '../src/intake'
import { calendarIcs, exampleCsv, importToWorkspace, prepareImport, scanTeam, workLogCsv } from '../src/operations'
import { baselinePlan, checkApproval, feasibleAlternatives, flagCalendarChanges, planTask, rankCandidates, simulate } from '../src/scheduler'
import { dashboardTask, DEMO_NOW, demoDate, demoPreviousOwner, demoRecommended, demoUnverified, koreanRequest, makeWorkspace, replayTasks, roster, teams } from '../src/seed'

const demo = { ...dashboardTask(), confirmed: true }
const timing = (start: string, end: string) => span(add(demoDate, start), add(demoDate, end))
const meeting = (employeeId: string, start: string, end: string): Block =>
  ({ ...timing(start, end), employeeId, title: 'Client meeting', id: employeeId + start + end, kind: 'meeting' })

test('demo reserves four hours in two blocks, keeps a full hour free, and checks staging', () => {
  const result = planTask(demo, makeWorkspace())
  assert.equal(roster.length, 1000)
  const best = result.ranked[0]
  assert.equal(best.employee.name, 'Kimberly Mcbride')
  assert.deepEqual(best.blocks, [timing('09:00', '12:00'), timing('13:00', '14:00')])
  assert.equal(best.free, 60)
  assert.equal(result.rejected.find(({ employee }) => employee.id === demoPreviousOwner)?.available, 60)
  assert.ok(result.rejected.find(({ employee }) => employee.id === demoUnverified)?.issues.some(({ code, detail }) => code === 'access-unknown' && detail === 'staging'))
  assert.equal(best.factors.reduce((sum, factor) => sum + factor.weight, 0), 100)
})

test('CSV rows remain traceable through distinct workspace IDs and role-specific skills', () => {
  const [header, ...rows] = parseCsv(readFileSync(new URL('../fake_employee.csv', import.meta.url), 'utf8'))
  const csvRows = rows.map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i]])))
  const byId = new Map(roster.map((person) => [person.id, person]))
  assert.equal(byId.size, csvRows.length)
  assert.equal(new Set(roster.map((person) => person.source?.id)).size, 952)
  for (const row of csvRows) {
    const person = byId.get('SR-' + String(Number(row['']) + 1).padStart(4, '0'))!
    assert.equal(person.name, row.name)
    assert.equal(person.source?.title, row.job_titles)
    assert.equal(person.source?.department, row.department)
    assert.equal(person.source?.shift, row.work_hours)
    assert.equal(person.status, { Active: 'active', 'On Leave': 'leave', Terminated: 'terminated' }[row.employee_status])
  }
  const ids = new Set(catalog.map((skill) => skill.id))
  const used = new Set(roster.flatMap((person) => Object.keys(person.skills)))
  assert.equal(used.size, 58)
  for (const key of used) assert.ok(ids.has(key as typeof catalog[number]['id']))
  const [exportHeader, ...exported] = parseCsv(readFileSync(new URL('../data/employee_profiles.csv', import.meta.url), 'utf8'))
  assert.equal(exported.length, roster.length)
  for (const row of exported) assert.deepEqual(Object.fromEntries(Object.entries(byId.get(row[0])!.skills).map(([key, level]) => [key, String(level)])), Object.fromEntries(row[exportHeader.indexOf('skills')].split(';').map((part) => part.split(':'))))
})

test('staff on leave or with ended employment cannot receive new assignments', () => {
  for (const status of ['leave', 'terminated'] as const) {
    const person = { ...roster[0], status }
    const result = planTask(demo, makeWorkspace(), undefined, [person])
    assert.equal(result.ranked.length, 0)
    assert.deepEqual(result.rejected[0].issues, [{ code: 'status', detail: status }])
  }
})

test('overnight requests use the next Seoul day after the scheduled midnight break', () => {
  const state = makeWorkspace()
  const night = roster.find(({ name }) => name === 'Rachel Murphy')!
  const start = add('2026-12-01', '23:00')
  assert.equal(night.source?.shift, 'Night Shift')
  const task = { ...demo, min: 90, max: 90, split: false, required: [{ id: 'playwright', level: 3 }], deadline: start + 270 }
  const candidate = planTask(task, { ...state, now: start }, undefined, [night]).ranked[0]
  assert.deepEqual(candidate.blocks, [span(add('2026-12-02', '00:30'), add('2026-12-02', '02:00'))])
  assert.ok(candidate.urgentDays > 18 && candidate.urgentDays <= 23)
})

test('five available hours cannot satisfy a four-hour continuous request', () => {
  const state = makeWorkspace()
  const task = { ...demo, split: false }
  const result = planTask(task, state)
  assert.deepEqual(result.ranked, [])
  assert.equal(result.rejected[0].available, 300)
  assert.equal(result.rejected[0].longest, 180)
  assert.equal(result.rejected[0].issues[0].code, 'focus')
  assert.ok(feasibleAlternatives(task, state).some((item) => item.id === 'split' && !!item.candidate))
})

test('counts work after the due time in daily and weekly limits and unions overlaps', () => {
  const state = makeWorkspace()
  const blocks = [...state.blocks, meeting(demoRecommended, '16:00', '18:00'), meeting(demoRecommended, '16:30', '17:00')]
  const task = { ...demo, max: 300 }
  const lead = roster[0]
  const exact = planTask(task, { ...state, blocks, policy: { ...state.policy, daily: 450 } }, undefined, [lead]).ranked[0]
  assert.equal(total(exact.blocks), 300)
  assert.equal(exact.overlaps, 2)
  const short = planTask(task, { ...state, blocks, policy: { ...state.policy, daily: 449 } }, undefined, [lead])
  assert.equal(short.rejected[0].available, 299)
  const otherDay: Block = { ...meeting(demoRecommended, '08:00', '15:00'), id: 'week-block', start: add(demoDate, '08:00') + DAY, end: add(demoDate, '15:00') + DAY }
  assert.equal(planTask(task, { ...state, blocks: [...blocks, otherDay], policy: { ...state.policy, weekly: 700 } }, undefined, [lead]).ranked.length, 0)
})

test('focus allocation avoids a too-short remainder and respects access and dependencies', () => {
  const original = roster[0]
  const constrained = { ...original, access: { staging: [timing('09:00', '11:30'), timing('13:00', '15:00')] } }
  const task = { ...demo, min: 120, max: 180, focus: 75, dependencies: [{ name: 'Code', available: add(demoDate, '09:30') }] }
  const state = makeWorkspace()
  const best = planTask(task, state, undefined, [constrained]).ranked[0]
  assert.deepEqual(best.blocks, [timing('09:30', '11:15'), timing('13:00', '14:15')])
  const tiny = planTask({ ...task, min: 30, max: 30, focus: 60 }, state, undefined, [constrained]).ranked[0]
  assert.deepEqual(tiny.blocks, [timing('09:30', '10:00')])
})

test('urgent rotation only moves someone within five unrounded score points and requires verified histories', () => {
  const base = planTask(demo, makeWorkspace()).ranked[0]
  const primary: Candidate = { ...base, employee: roster[0], score: 86, urgentRate: 2, urgentCount: 4, urgentDays: 20 }
  const backup: Candidate = { ...base, employee: roster[3], score: 82, urgentRate: .5, urgentCount: 1, urgentDays: 20 }
  assert.equal(rankCandidates([primary, backup], true)[0].employee.id, backup.employee.id)
  assert.equal(rankCandidates([primary, backup], true)[0].rotation, true)
  assert.equal(rankCandidates([primary, backup], false)[0].employee.id, primary.employee.id)
  assert.equal(rankCandidates([primary, { ...backup, score: 80.99 }], true)[0].employee.id, primary.employee.id)
  assert.equal(rankCandidates([primary, { ...backup, urgentRate: null }], true)[0].employee.id, primary.employee.id)
})

test('approval checks the latest calendar, saves both blocks, and is idempotent for original and replacement', () => {
  const state = makeWorkspace()
  const candidate = planTask(demo, state).ranked[0]
  const changed = { ...state, blocks: [...state.blocks, meeting(demoRecommended, '09:00', '10:00')] }
  assert.equal(checkApproval(changed, demo, candidate, false).status, 'stale')
  assert.equal(changed.assignments.length, 0)
  const approval = checkApproval(state, demo, candidate, false, 'first')
  assert.equal(approval.status, 'confirmed')
  assert.equal(approval.state.blocks.length - state.blocks.length, 2)
  assert.equal(checkApproval(approval.state, demo, candidate, false, 'first').status, 'duplicate')
  const requested = flagCalendarChanges({ ...approval.state, blocks: [...approval.state.blocks, meeting(demoRecommended, '10:00', '10:30')] }, 'New meeting')
  assert.equal(requested.assignments[0].pending, true)
  assert.equal(requested.blocks.filter(({ taskId }) => taskId === demo.id).length, 2)
  const replacement = planTask(demo, requested, demo.id).ranked[0]
  assert.ok(replacement)
  const newApproval = checkApproval(requested, demo, replacement, true, 'second', requested.assignments[0].history.length)
  assert.equal(newApproval.status, 'confirmed')
  assert.equal(total(newApproval.state.blocks.filter((block) => block.taskId === demo.id)), 240)
  assert.equal(checkApproval(newApproval.state, demo, replacement, true, 'second').status, 'duplicate')
})

test('no-fit keeps all calendars intact and returns simulations for revised terms', () => {
  const state = makeWorkspace()
  const busy = { ...state, blocks: [...state.blocks, ...roster.slice(0, 8).map((person) => meeting(person.id, '09:00', '15:00'))] }
  assert.equal(planTask(demo, busy).ranked.length, 0)
  const simulated = feasibleAlternatives(demo, busy)
  assert.ok(simulated.some((row) => row.id === 'scope'))
  assert.ok(simulated.find(({ id }) => id === 'deadline')?.candidate)
  assert.equal(busy.assignments.length, 0)
  assert.equal(busy.blocks.length - state.blocks.length, 8)
})

test('the replay counts deferral, blocking and shortfall on an isolated calendar', () => {
  const state = makeWorkspace()
  const baseline = baselinePlan(demo, state, roster[1])
  assert.equal(total(baseline.plan), 60)
  assert.equal(baseline.overtime, 0)
  const snapshot = structuredClone(state)
  const result = simulate(teams[0], replayTasks(teams[0]), state)
  assert.equal(result.baseline.rows[0].shortfall, 180)
  assert.equal(result.baseline.rows[0].outcome, 'deferred')
  for (const value of [result.relay, result.baseline]) assert.equal(value.onTime + value.deferred + value.blocked, value.count)
  assert.deepEqual(state, snapshot)
})

test('intake rejects malformed drafts and keeps valid optional fields pending lead review', () => {
  assert.throws(() => validateExtraction('not json', demo.team, demo.raw), /malformed/)
  assert.throws(() => validateExtraction('{"title":"Incomplete"}', demo.team, demo.raw), /malformed/)
  const good = validateExtraction(JSON.stringify({
    title: '스테이징 검증', deliverable: '수정 후 검증', required_skills: [{ id: 'react', min_level: null }],
    preferred_skill_ids: [], unmapped_skills: [], effort_minutes: { min: 120, max: 180, source: 'estimate' },
    deadline_at: '2026-11-24T15:00:00+09:00', priority: 'urgent', splittable: true, min_focus_minutes: 60,
    dependencies: ['시안'], required_access: ['스테이징'], assumptions: ['작업 시간은 추정치입니다.'], questions: ['시안은 언제 준비되나요?'],
  }), demo.team, demo.raw)
  assert.equal(hour(good.deadline!), '15:00')
  assert.equal(good.required[0].level, null)
  assert.equal(good.dependencies[0].available, null)
  assert.deepEqual(good.access, ['staging'])
  assert.equal(good.raw, demo.raw)
  assert.equal(good.confirmed, false)
})

test('unambiguous Korean deadline is carried through even when the model leaves it empty', () => {
  const blank = JSON.stringify({ title: null, deliverable: null, required_skills: [], preferred_skill_ids: [], unmapped_skills: [],
    effort_minutes: null, deadline_at: null, priority: null, splittable: null, min_focus_minutes: null,
    dependencies: [], required_access: [], assumptions: [], questions: [] })
  assert.equal(validateExtraction(blank, demo.team, koreanRequest).deadline, demo.deadline)
  assert.equal(validateExtraction(blank, demo.team, '고객사 데모 전에 수정해 주세요.').deadline, null)
})

test('Flow-style CSV import validates scope and applies deduplicated schedule data', () => {
  const state = makeWorkspace()
  const team = roster.slice(0, 8)
  const data = prepareImport(exampleCsv('commitments', team[0]), 'commitments', team)
  const imported = importToWorkspace(state, data, 'Import')
  assert.equal(imported.blocks.length, state.blocks.length + 1)
  assert.equal(importToWorkspace(imported, data, 'Import').blocks.length, imported.blocks.length)
  assert.throws(() => prepareImport(exampleCsv('commitments', roster[10]), 'commitments', team), /outside the selected team/)
  assert.throws(() => prepareImport(exampleCsv('commitments', team[0]).replace('2026-11-25', '2026-02-30'), 'commitments', team), /valid KST/)
  const profile = prepareImport(exampleCsv('profiles', team[0]).replace('09:00', '13:00'), 'profiles', team)
  assert.notEqual(planTask(demo, importToWorkspace(state, profile, 'Profile')).ranked[0]?.employee.id, demoRecommended)
})

test('schedule scan reports conflicts and both exports include only selected bookings', () => {
  const state = makeWorkspace()
  const candidate = planTask(demo, state).ranked[0]
  const approved = checkApproval(state, demo, candidate, false).state
  const changed = flagCalendarChanges({ ...approved, blocks: [...approved.blocks, meeting(demoRecommended, '09:00', '09:30')] }, 'Meeting')
  const scan = scanTeam(changed, teams[0], roster)
  assert.ok(scan.findings.some((finding) => finding.kind === 'overlap' && finding.ref === demoRecommended))
  assert.ok(scan.findings.some((finding) => finding.kind === 'review' && finding.ref === demo.id))
  const exported = calendarIcs(approved.assignments, roster, DEMO_NOW)
  assert.equal(exported.match(/BEGIN:VEVENT/g)?.length, 2)
  assert.match(exported, /DTSTART:20261124T000000Z/)
  assert.match(exported, /DTEND:20261124T050000Z/)
  assert.ok(exported.split('\r\n').every((line) => Buffer.byteLength(line) <= 75))
  assert.match(workLogCsv(changed.assignments, roster), /"needs review"/)
})
