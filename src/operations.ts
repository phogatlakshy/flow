import { add, catalog, span, total, weeklyWindows, type Assignment, type Block, type Employee, type Finding, type Scan, type Workspace } from './domain'
import { parseCsv, toCsv } from './csv'
import { shiftTimes } from './profiles'
import { calendarOverlaps, effectivePerson, flagCalendarChanges, workload } from './scheduler'

const timestamp = (time: number) => new Date(time * 60000).toISOString()

type ImportType = 'commitments' | 'profiles'
type ImportData = { type: 'commitments'; blocks: Block[] } | { type: 'profiles'; entries: NonNullable<Workspace['verifications']> }
const columns: Record<ImportType, string[]> = {
  commitments: ['employee_id', 'title', 'kind', 'start_kst', 'end_kst'],
  profiles: ['employee_id', 'skills', 'weekdays', 'work_start', 'work_end'],
}
const kinds = ['work', 'meeting', 'review', 'support', 'on-call', 'leave', 'reserve'] as const
export function exampleCsv(type: ImportType, employee: Employee) {
  const shift = shiftTimes[(employee.source?.shift || '9-5') as keyof typeof shiftTimes] || shiftTimes['9-5']
  return type === 'commitments'
    ? toCsv([columns[type], [employee.id, 'Partner handoff', 'meeting', '2026-11-25T14:00', '2026-11-25T14:30']])
    : toCsv([columns[type], [employee.id, Object.entries(employee.skills).map(([skill, level]) => skill + ':' + level).join(';'), '1;2;3;4;5', shift.start, shift.end]])
}
const clockMinutes = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN
function kstMinute(value: string) {
  const [date, time] = value.split('T')
  const parsed = add(date, time)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(parsed) ||
    new Date((parsed + 540) * 60000).toISOString().slice(0, 16) !== value) return NaN
  return parsed
}
export function prepareImport(text: string, type: ImportType, people: Employee[]): ImportData {
  const [header, ...lines] = parseCsv(text)
  if (!header || !lines.length || lines.length > 500) throw new Error('Provide a header and 1–500 rows.')
  const normalized = header.map((label) => label.toLowerCase())
  if (new Set(normalized).size !== normalized.length || columns[type].some((field) => !normalized.includes(field))) throw new Error('The CSV header must include ' + columns[type].join(', ') + '.')
  const blocks: Block[] = []
  const entries: NonNullable<Workspace['verifications']> = {}
  const ids = new Set(people.map(({ id }) => id))
  for (const [index, row] of lines.entries()) {
    const fail = (reason: string): never => { throw new Error('Row ' + (index + 2) + ' — ' + reason) }
    if (row.length !== header.length) fail('Column count differs from the header.')
    const values = Object.fromEntries(normalized.map((name, i) => [name, row[i]]))
    const id = values.employee_id.toUpperCase()
    if (!ids.has(id)) fail('Employee ID is outside the selected team.')
    if (type === 'commitments') {
      const start = kstMinute(values.start_kst)
      const end = kstMinute(values.end_kst)
      const kind = kinds.find((entry) => entry === values.kind.toLowerCase()) ?? fail('Unknown commitment type.')
      if (!values.title || values.title.length > 120 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) fail('Give the commitment a title and a valid KST time range.')
      blocks.push({ id: 'csv:' + id + ':' + start + ':' + end + ':' + kind + ':' + values.title, employeeId: id, start, end, kind, title: values.title })
    } else {
      if (entries[id]) fail('Employee profile appears twice.')
      const skills: Employee['skills'] = {}
      for (const assignment of values.skills.split(';').filter(Boolean)) {
        const [skill, level, extra] = assignment.trim().split(':')
        if (extra !== undefined || !catalog.some((item) => item.id === skill) || !/^[1-5]$/.test(level || '') || skills[skill]) fail('Use distinct catalog IDs and levels 1–5, e.g. react:4;typescript:5.')
        skills[skill] = Number(level)
      }
      const days = values.weekdays.split(';')
      const start = clockMinutes(values.work_start)
      const end = clockMinutes(values.work_end)
      if (days.some((day) => !/^[0-6]$/.test(day)) || !Number.isFinite(start) || !Number.isFinite(end) || end === start) fail('Use weekdays 0–6 and distinct HH:mm shift start and end times.')
      entries[id] = { skills, hours: weeklyWindows(days.map(Number), start, end), schedule: true }
    }
  }
  return type === 'commitments' ? { type, blocks: [...new Map(blocks.map((block) => [block.id, block])).values()] } : { type, entries }
}

export function importToWorkspace(state: Workspace, data: ImportData, note: string) {
  if (data.type === 'profiles') {
    const verifications = { ...state.verifications }
    for (const [id, profile] of Object.entries(data.entries)) verifications[id] = { ...verifications[id], ...profile }
    return flagCalendarChanges({ ...state, verifications }, note)
  }
  const ids = new Set(state.blocks.map(({ id }) => id))
  return flagCalendarChanges({ ...state, blocks: [...state.blocks, ...data.blocks.filter((block) => !ids.has(block.id))] }, note)
}

export function scanTeam(state: Workspace, team: string, roster: Employee[]): Scan {
  const people = roster.filter((person) => person.team === team && (!person.status || person.status === 'active')).map((person) => effectivePerson(person, state))
  const findings: Finding[] = []
  const ids = new Set(people.map(({ id }) => id))
  const threshold = state.policy.overload || .9
  for (const person of people) {
    const own = state.blocks.filter((block) => block.employeeId === person.id && block.end > state.now)
    for (const [a, b] of calendarOverlaps(own)) findings.push({ kind: 'overlap', ref: person.id, detail: a.title + ' · ' + b.title, level: 3 })
    const load = workload(person, state)
    if (load.ratio >= threshold) findings.push({ kind: 'capacity', ref: person.id, detail: Math.round(load.ratio * 100) + '%', level: 2 })
  }
  for (const record of state.assignments.filter((item) => ids.has(item.employeeId))) {
    if (record.pending) findings.push({ kind: 'review', ref: record.task.id, detail: record.task.title, level: 3 })
    const finish = record.blocks.at(-1)!.end
    const buffer = record.task.deadline! - finish
    if (record.task.deadline! > state.now && buffer <= 60) findings.push({ kind: 'deadline', ref: record.task.id, detail: record.task.title, level: buffer <= 0 ? 3 : 2 })
  }
  for (const skill of catalog) {
    const owners = people.filter((person) => (person.skills[skill.id] || 0) >= 4)
    if (owners.length === 1) findings.push({ kind: 'skill', ref: owners[0].id, detail: skill.id, level: 1 })
  }
  return { id: crypto.randomUUID(), team, at: state.now, findings: findings.sort((a, b) => b.level - a.level || a.kind.localeCompare(b.kind)) }
}

export function workLogCsv(records: Assignment[], people: Employee[]) {
  return toCsv([
    ['task', 'employee_id', 'employee', 'priority', 'status', 'deadline_utc', 'reserved_minutes', 'reason', 'history_type', 'history_at_utc', 'history_note'],
    ...records.flatMap((record) => record.history.map((entry) => [
      record.task.title, record.employeeId, people.find((person) => person.id === record.employeeId)?.name || '', record.task.priority,
      record.pending ? 'needs review' : 'confirmed', record.task.deadline === null ? '' : timestamp(record.task.deadline), total(record.blocks), record.reason,
      entry.type, timestamp(entry.at), entry.note,
    ])),
  ])
}

const escapeIcs = (value: string) => value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,')
const icsTime = (time: number) => timestamp(time).replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
function foldIcs(line: string) {
  const encoder = new TextEncoder()
  const parts = []
  let part = ''
  let length = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    if (length + size > 75) { parts.push(part); part = ' '; length = 1 }
    part += char; length += size
  }
  parts.push(part)
  return parts.join('\r\n')
}
export function calendarIcs(records: Assignment[], people: Employee[], now: number) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SkillRelay//Assignments//EN', 'CALSCALE:GREGORIAN',
    ...records.flatMap((record) => record.blocks.flatMap((block, i) => [
      'BEGIN:VEVENT', 'UID:' + encodeURIComponent(record.task.id) + '-' + i + '@skillrelay.local',
      'DTSTAMP:' + icsTime(record.history.findLast((entry) => entry.type === 'approval' || entry.type === 'replacement')?.at ?? now),
      'DTSTART:' + icsTime(block.start), 'DTEND:' + icsTime(block.end),
      'SUMMARY:' + escapeIcs(record.task.title),
      'DESCRIPTION:' + escapeIcs((people.find((person) => person.id === record.employeeId)?.name || record.employeeId) + '\n' + record.task.deliverable),
      'STATUS:' + (record.pending ? 'TENTATIVE' : 'CONFIRMED'),
      'SEQUENCE:' + record.history.filter((entry) => entry.type === 'replacement').length,
      'END:VEVENT',
    ])), 'END:VCALENDAR',
  ].map(foldIcs).join('\r\n') + '\r\n'
}

export function downloadFile(name: string, data: string, mediaType: string) {
  const file = URL.createObjectURL(new Blob([data], { type: mediaType }))
  const link = document.createElement('a')
  link.href = file; link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(file), 1000)
}
