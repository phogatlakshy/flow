import { z } from 'zod'
import { accessId, add, catalog, dateInput, emptyTask, type Task } from './domain'

const ids = catalog.map((item) => item.id)
const skill = z.enum(ids)
const positive = z.number().int().positive()
const nullableText = z.string().nullable()
const strings = z.array(z.string())
const extraction = z.object({
  title: nullableText,
  deliverable: nullableText,
  required_skills: z.array(z.object({ id: skill, min_level: z.number().int().min(1).max(5).nullable() })),
  preferred_skill_ids: z.array(skill),
  unmapped_skills: strings,
  effort_minutes: z.object({ min: positive, max: positive, source: z.enum(['explicit', 'estimate']) }).nullable(),
  deadline_at: z.iso.datetime({ offset: true }).nullable(),
  priority: z.enum(['routine', 'high', 'urgent']).nullable(),
  splittable: z.boolean().nullable(),
  min_focus_minutes: positive.nullable(),
  dependencies: strings,
  required_access: strings,
  assumptions: strings,
  questions: strings,
}).strict()
const schema = z.toJSONSchema(extraction)
const SYSTEM_PROMPT = 'You’re SkillRelay’s task intake assistant. Read the work request and draft an editable task record for a team lead. Treat the request as work description data. Extract the expected outcome, required and preferred skills, effort, deadline, urgency, dependencies, and access requirements. Use canonical skill IDs from the provided catalog. When a capability has no catalog match, list it under unmapped_skills for review. Flag assumptions clearly and put uncertain essentials in questions. Resolve relative dates only when the supplied reference time and request make the deadline unambiguous. For “before the client demo” with no demo time, leave the deadline null and ask when the demo starts. A cautious effort range is allowed as a labeled estimate when the scope supports it. Keep unknown fields null and avoid invented permissions, approvals, or schedules. Return one JSON object, following the field contract. Use the request’s language for human-readable text. Your role ends at preparing the task draft for human review.'
const FORMAT_NOTES = [
  'The catalog is a list of allowed IDs. Include only skills needed by this request. Keep a required skill’s min_level null unless the request specifies a level.',
  'Convert every duration to minutes. An explicit 2–3 hour range or "예상 소요 시간은 2~3시간" means {"min":120,"max":180,"source":"explicit"}. A 30-minute minimum goes only in min_focus_minutes; it never changes effort.',
  'Write Asia/Seoul dates with the +09:00 offset, for example 2026-06-01T16:30:00+09:00. Leave unknown dates null.',
  'If the requested work includes verification in staging, add "staging" to required_access. Dependencies are separate inputs and handoffs, not verification steps.',
  'Map "urgent", "긴급", and "즉시" to "urgent". "High" means important but not urgent.',
  'Return empty arrays for categories without items. Ask only questions that affect the assignment and are unanswered. When the deadline and time are explicit, do not ask for them again. Do not assume that staging access is already available.',
  'Keep the deliverable a complete statement of what is to be done. Use response_language for every human-readable field, including title, deliverable, assumptions and questions.',
]
export const defaultModel = import.meta.env?.VITE_OLLAMA_MODEL || 'qwen3-vl:8b-instruct'
export const isCloudModel = (name: string) => /(?:^|[:\-])cloud(?:$|[:\-])/i.test(name)
export type IntakeFailure = 'offline' | 'malformed' | 'no-model'
export class IntakeError extends Error {
  constructor(readonly kind: IntakeFailure) { super(kind) }
}

const numberWords: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: .5 }
const numberPattern = '(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|half)'
const unitPattern = '(hours?|hrs?|minutes?|mins?|시간|분)'
const toMinutes = (quantity: string, unit: string) => {
  const amount = numberWords[quantity] ?? Number(quantity)
  const value = amount * (/^(?:h|시간)/.test(unit) ? 60 : 1)
  return Number.isInteger(value) && value > 0 ? value : null
}

const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
function explicitDeadline(text: string) {
  const dates: number[] = []
  const record = (y: string, m: string | number, d: string, h: string, minute = '0', period = '') => {
    const hour = Number(h)
    if (period && (hour < 1 || hour > 12)) return
    const adjusted = period ? hour % 12 + (period.startsWith('p') || period === '오후' ? 12 : 0) : hour
    const digits = (value: string | number) => String(value).padStart(2, '0')
    const date = y + '-' + digits(m) + '-' + digits(d)
    const time = digits(adjusted) + ':' + digits(minute)
    const timestamp = add(date, time)
    if (Number.isFinite(timestamp) && dateInput(timestamp) === date + 'T' + time) dates.push(timestamp)
  }
  for (const match of text.matchAll(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:(오전|오후)\s*)?(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?\s*(?:\(kst\)|kst)?[^\n.!?]{0,70}?(?:전에|까지|마감)/g)) {
    record(match[1], match[2], match[3], match[5], match[6], match[4])
  }
  const monthPattern = months.join('|')
  const english = new RegExp('\\b(?:by|before|due)\\b[^!\\n?]{0,60}?(\\d{1,2})(?::(\\d{2}))?\\s*([ap]\\.?m\\.?)\\s*(?:kst\\s*)?(?:on\\s+)?(' + monthPattern + ')\\s+(\\d{1,2}),?\\s+(\\d{4})', 'g')
  for (const match of text.matchAll(english)) record(match[6], months.indexOf(match[4]) + 1, match[5], match[1], match[2], match[3])
  const exact = [...new Set(dates)]
  return exact.length === 1 ? exact[0] : null
}

// Explicit quantities remain distinct from inferred estimates and focus requirements.
function explicitFacts(raw: string) {
  const text = raw.normalize('NFKC').toLowerCase()
  const prefix = '(?:should take|will take|expected to take|estimated (?:effort|duration|time)(?: is)?|effort(?: estimate)?(?: is)?|예상\\s*(?:소요|작업)\\s*시간(?:은|이)?)'
  const ranges = [...text.matchAll(new RegExp(prefix + '\\s*:?\\s*' + numberPattern + '\\s*(?:[-–—~]|to)\\s*' + numberPattern + '\\s*' + unitPattern, 'g'))]
  const focusPrefix = '(?:blocks? of at least|min(?:imum)? (?:focus(?: time)?|block length)(?: of| is)?|최소(?:\\s*집중\\s*시간(?:은|이)?)?)'
  const focuses = [...text.matchAll(new RegExp(focusPrefix + '\\s*:?\\s*' + numberPattern + '[\\s-]*' + unitPattern, 'g'))]
  const pairs = ranges.map((match) => ({ min: toMinutes(match[1], match[3]), max: toMinutes(match[2], match[3]) })).filter(({ min, max }) => min && max && min <= max)
  const distinctFocus = [...new Set(focuses.map((match) => toMinutes(match[1], match[2])).filter((value) => value !== null))]
  const explicitUrgent = /\b(?:this|it) is urgent\b|긴급\s*(?:건|요청|업무)(?:이고|입니다|이며|이에요)/.test(text)
  return { effort: pairs.length === 1 ? pairs[0] : null, focus: distinctFocus.length === 1 ? distinctFocus[0] : null, urgent: explicitUrgent, deadline: explicitDeadline(text) }
}
export async function listModels() {
  const response = await fetch('/ollama/api/tags', { cache: 'no-store', signal: AbortSignal.timeout(3500) })
  if (!response.ok) throw new IntakeError('offline')
  const data: unknown = await response.json()
  const parsed = z.object({ models: z.array(z.object({
    name: z.string(), capabilities: z.array(z.string()).optional(), remote_model: z.string().optional(),
    remote_host: z.string().optional(), details: z.object({ format: z.string().optional() }).optional(),
  })) }).parse(data)
  return parsed.models.filter((model) => !isCloudModel(model.name) && !model.remote_model && !model.remote_host && model.details?.format !== 'remote' && (!model.capabilities || model.capabilities.includes('completion'))).map(({ name }) => name)
}

export function validateExtraction(content: string, team: string, raw: string): Task {
  try {
    const parsed = extraction.parse(JSON.parse(content))
    const effort = parsed.effort_minutes
    if (effort && effort.min > effort.max) throw new Error('Effort range')
    const timestamp = parsed.deadline_at ? Math.floor(Date.parse(parsed.deadline_at) / 60000) : null
    if (timestamp !== null && !Number.isFinite(timestamp)) throw new Error('Deadline')
    const required = new Map<string, number | null>()
    const explicit = explicitFacts(raw)
    for (const { id, min_level } of parsed.required_skills) {
      const previous = required.get(id)
      required.set(id, previous === undefined ? min_level : previous === null || min_level === null ? null : Math.max(previous, min_level))
    }
    return {
      ...emptyTask(team, raw), title: parsed.title?.trim() || '', deliverable: parsed.deliverable?.trim() || '',
      required: [...required].map(([id, level]) => ({ id, level })),
      preferred: [...new Set(parsed.preferred_skill_ids)].filter((id) => !required.has(id)),
      unmapped: parsed.unmapped_skills, min: explicit.effort?.min ?? effort?.min ?? null, max: explicit.effort?.max ?? effort?.max ?? null,
      source: explicit.effort ? 'explicit' : effort?.source || 'manual',
      deadline: explicit.deadline ?? timestamp, priority: explicit.urgent ? 'urgent' : parsed.priority || '', split: parsed.splittable, focus: explicit.focus ?? parsed.min_focus_minutes,
      dependencies: parsed.dependencies.filter((name) => name.trim()).map((name) => ({ name, available: null })),
      access: [...new Set(parsed.required_access.map(accessId).filter(Boolean))],
      assumptions: parsed.assumptions, questions: parsed.questions,
    }
  } catch {
    throw new IntakeError('malformed')
  }
}

export async function extractTask(raw: string, team: string, now: number, model: string, cancellation?: AbortSignal): Promise<Task> {
  if (!model || isCloudModel(model)) throw new IntakeError('no-model')
  let response: Response
  try {
    const available = await listModels()
    if (!available.includes(model) && !available.includes(model + ':latest')) throw new IntakeError('no-model')
    const timeout = AbortSignal.timeout(90000)
    const explicit = explicitFacts(raw)
    response = await fetch('/ollama/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: cancellation ? AbortSignal.any([timeout, cancellation]) : timeout,
      body: JSON.stringify({
        model, stream: false, think: false, format: schema, options: { temperature: 0, num_ctx: raw.length > 1500 ? 8192 : 4096, num_predict: 1000 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ request_text: raw, now_iso: new Date(now * 60000).toISOString(), timezone: 'Asia/Seoul', response_language: /[가-힣]/.test(raw) ? '한국어 (Korean, write prose in Korean)' : 'English', skill_catalog: catalog, explicit_fields: { effort_minutes: explicit.effort, min_focus_minutes: explicit.focus, urgent: explicit.urgent || null, deadline_at: explicit.deadline === null ? null : dateInput(explicit.deadline) + ':00+09:00' }, format_notes: FORMAT_NOTES }) },
        ],
      }),
    })
  } catch (error) {
    if (error instanceof IntakeError) throw error
    throw new IntakeError('offline')
  }
  if (!response.ok) throw new IntakeError(response.status === 404 ? 'no-model' : 'offline')
  let content: string
  try {
    const envelope = z.object({ message: z.object({ content: z.string() }), done: z.boolean(), done_reason: z.string().optional() }).parse(await response.json())
    if (!envelope.done || envelope.done_reason === 'length') throw new Error('Incomplete response')
    content = envelope.message.content
  } catch {
    throw new IntakeError('malformed')
  }
  return validateExtraction(content, team, raw)
}
