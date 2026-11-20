import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseCsv, toCsv } from '../src/csv'
import { catalog } from '../src/domain'
import { demoMembers, departments, personId, profileFor, shiftTimes, skillsFor, teamFor, type SourceRow } from '../src/profiles'

const source = new URL('../fake_employee.csv', import.meta.url)
const [header, ...values] = parseCsv(readFileSync(source, 'utf8'))
const required = ['', 'employee_id', 'name', 'department', 'manager_id', 'job_titles', 'employment_status', 'work_hours', 'employee_status']
if (!header || required.some((key) => !header.includes(key))) throw new Error('The employee CSV is missing one or more required columns.')
const statusMap = { Active: 'active', 'On Leave': 'leave', Terminated: 'terminated' } as const
const seen = new Set<number>()
const roster = values.map((cells, i): SourceRow => {
  const data = Object.fromEntries(header.map((key, j) => [key, cells[j] ?? '']))
  const row = /^\d+$/.test(data['']) ? Number(data['']) : NaN
  const department = departments.find((key) => key === data.department)
  const manager = Number(data.manager_id)
  const shift = (Object.keys(shiftTimes) as SourceRow['shift'][]).find((key) => key === data.work_hours)
  const status = statusMap[data.employee_status as keyof typeof statusMap]
  if (cells.length !== header.length || !Number.isSafeInteger(row) || seen.has(row) || !department || !Number.isInteger(manager) ||
    manager < 1 || !shift || !status || !data.employee_id || !data.name || !data.job_titles || !data.employment_status) {
    throw new Error('Invalid or duplicate record at CSV line ' + (i + 2) + '.')
  }
  seen.add(row)
  return { row, id: data.employee_id, name: data.name, department, manager, title: data.job_titles, employment: data.employment_status, shift, status }
}).sort((a, b) => a.row - b.row)
if (demoMembers.some(({ row }) => !seen.has(row))) throw new Error('The source CSV is missing a row used by the Product Platform demo.')

const output = new URL('../src/data/roster.json', import.meta.url)
mkdirSync(new URL('.', output), { recursive: true })
const outputCsv = new URL('../data/employee_profiles.csv', import.meta.url)
mkdirSync(new URL('.', outputCsv), { recursive: true })
const labels = new Map(catalog.map(({ id, en }) => [id as string, en]))
writeFileSync(output, '[\n' + roster.map((row) => JSON.stringify(row)).join(',\n') + '\n]\n')
writeFileSync(outputCsv, toCsv([
  ['employee_id', 'source_employee_id', 'name', 'department', 'manager_group', 'workspace_team', 'source_job_title', 'planning_role', 'employment_type', 'status', 'shift', 'weekdays', 'work_start', 'work_end', 'skill_labels', 'skills', 'skill_provenance'],
  ...roster.map((row) => {
    const profile = profileFor(row)
    const skills = Object.entries(skillsFor(row, profile))
    return [personId(row.row), row.id, row.name, row.department, row.manager, teamFor(row), row.title, profile.en, row.employment, row.status, row.shift, '1;2;3;4;5', shiftTimes[row.shift].start, shiftTimes[row.shift].end, skills.map(([id]) => labels.get(id) || id).join('; '), skills.map(([id, level]) => id + ':' + level).join(';'), 'synthetic role-based demo profile']
  }),
]))
console.log('Prepared ' + roster.length + ' unique workspace profiles using ' + labels.size + ' catalog skills.')
