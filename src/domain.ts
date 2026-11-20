export type Language = 'en' | 'ko'
export type Priority = 'routine' | 'high' | 'urgent'
export type Interval = { start: number; end: number }
export type BlockKind = 'work' | 'meeting' | 'review' | 'support' | 'on-call' | 'leave' | 'reserve' | 'assignment'
export type Block = Interval & { id: string; employeeId: string; title: string; kind: BlockKind; taskId?: string }
export type Requirement = { id: string; level: number | null }
export type Dependency = { name: string; available: number | null }
export type Task = {
  id: string; title: string; deliverable: string; required: Requirement[]; preferred: string[]
  unmapped: string[]; min: number | null; max: number | null; source: 'explicit' | 'estimate' | 'manual'
  deadline: number | null; priority: Priority | ''; split: boolean | null; focus: number | null
  dependencies: Dependency[]; access: string[]; assumptions: string[]; questions: string[]
  previousOwner: string; raw: string; confirmed: boolean; team: string
}
export type Employee = {
  id: string; team: string; name: string; korean: string; initials: string; role: string; color: number
  skills: Partial<Record<string, number>>; scheduleVerified: boolean; hours: Record<number, Interval[]>
  status?: 'active' | 'leave' | 'terminated' | 'unknown'
  source?: { id: string; title: string; department: string; manager: string; shift: string; employment: string }
  roleKo?: string
  access: Record<string, Interval[] | 'unknown'>
  experience: { tags: string[]; at: number; verified: boolean; title?: string }[] | null
  urgent: number[] | null
  history: { start: number; used: number; capacity: number; verified: boolean }[] | null
}
export type ExistingTask = { id: string; employeeId: string; title: string; deadline: number | null; remaining: number; verified: boolean }
export type Policy = {
  timezone: 'Asia/Seoul'; daily: number | null; weekly: number | null
  breaks: Interval[] | null; reserve: Interval[] | null; reserveDay: number; overload: number | null
}
export type Review = { at: number; type: 'approval' | 'replacement' | 'review' | 'effort' | 'commitment' | 'change'; note: string }
export type Factor = { id: string; weight: number; value: number; detail: string; detailKo: string; missing?: boolean }
export type Candidate = {
  employee: Employee; blocks: Interval[]; finish: number; free: number; score: number; factors: Factor[]
  impacts: { title: string; before: number; after: number }[]
  rotation: boolean; urgentCount: number | null; urgentDays: number; urgentRate: number | null; overlaps: number
}
export type Assignment = {
  task: Task; employeeId: string; blocks: Interval[]; score: number; reason: string; reasons: Factor[]
  history: Review[]; pending: boolean; proposed?: Task; approvalId?: string
}
export type Finding = { kind: 'overlap' | 'deadline' | 'review' | 'capacity' | 'skill'; ref: string; detail: string; level: number }
export type Scan = { id: string; team: string; at: number; findings: Finding[] }
export type WorkforceDataset = { id: string; name: string; loadedAt: number; people: Employee[] }
export type Workspace = {
  version: number; blocks: Block[]; assignments: Assignment[]; policy: Policy; now: number
  verifications?: Record<string, { schedule?: boolean; access?: Employee['access']; hours?: Employee['hours']; skills?: Employee['skills'] }>
  verifiedTasks?: string[]
  scans?: Scan[]
  dataset?: WorkforceDataset
}
export type Issue = { code: 'skill' | 'access' | 'access-unknown' | 'schedule' | 'focus' | 'capacity' | 'policy' | 'dependency' | 'status'; detail: string }
export type Rejected = { employee: Employee; issues: Issue[]; available: number; longest: number }

export const DAY = 1440
const KST = 540
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
export const add = (date: string, time = '00:00') => Math.ceil(Date.parse(date + 'T' + time + ':00+09:00') / 60000)
export const dayOf = (time: number) => Math.floor((time + KST) / DAY) * DAY - KST
export const weekday = (day: number) => ((Math.floor((day + KST) / DAY) + 4) % 7 + 7) % 7
export const weekOf = (time: number) => dayOf(time) - ((weekday(dayOf(time)) + 6) % 7) * DAY
export const dayKey = (time: number) => dateFormat.format(time * 60000)
export const hour = (time: number) => {
  const m = time - dayOf(time)
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}
export const dateInput = (time: number | null) => time === null ? '' : dayKey(time) + 'T' + hour(time)
export const fromInput = (value: string) => {
  if (!value) return null
  const [date, time] = value.split('T')
  const parsed = add(date, time)
  return Number.isFinite(parsed) ? parsed : null
}
export const displayDate = (time: number, language: Language, long = false) =>
  new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-GB', {
    timeZone: 'Asia/Seoul', weekday: long ? 'long' : 'short', month: 'short', day: 'numeric',
  }).format(time * 60000)
export const displayTime = (time: number, language: Language) => displayDate(time, language) + ' · ' + hour(time) + ' KST'
export const minutes = (value: number, language: Language = 'en') => {
  const h = Math.floor(value / 60)
  const m = value % 60
  return [h ? h + (language === 'ko' ? '시간' : 'h') : '', m || !h ? m + (language === 'ko' ? '분' : 'm') : ''].filter(Boolean).join(' ')
}
export const span = (start: number, end: number): Interval => ({ start, end })
export const duration = (interval: Interval) => interval.end - interval.start
export function weeklyWindows(days: number[], start: number, end: number) {
  const hours: Employee['hours'] = {}
  const append = (day: number, window: Interval) => { hours[day] = [...(hours[day] || []), window] }
  for (const day of new Set(days)) {
    append(day, span(start, end > start ? end : DAY))
    if (end < start && end > 0) append((day + 1) % 7, span(0, end))
  }
  return hours
}
export const total = (intervals: Interval[]) => intervals.reduce((sum, block) => sum + duration(block), 0)
export const intersects = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end
export const clip = (intervals: Interval[], bounds: Interval) => intervals
  .filter((interval) => intersects(interval, bounds))
  .map((interval) => span(Math.max(interval.start, bounds.start), Math.min(interval.end, bounds.end)))
export function merge(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start || a.end - b.end)
  const result: Interval[] = []
  for (const interval of sorted) {
    const last = result.at(-1)
    if (last && last.end >= interval.start) last.end = Math.max(last.end, interval.end)
    else result.push({ ...interval })
  }
  return result
}
export function subtract(windows: Interval[], busy: Interval[]): Interval[] {
  const mergedBusy = merge(busy)
  return merge(windows).flatMap((window) => {
    const result: Interval[] = []
    let cursor = window.start
    for (const block of mergedBusy) {
      if (block.end <= cursor) continue
      if (block.start >= window.end) break
      if (block.start > cursor) result.push(span(cursor, block.start))
      cursor = Math.max(cursor, block.end)
    }
    if (cursor < window.end) result.push(span(cursor, window.end))
    return result
  })
}

export const catalog = [
  { id: 'react', en: 'React', ko: 'React', aliases: ['React.js', '리액트'] },
  { id: 'typescript', en: 'TypeScript', ko: 'TypeScript', aliases: ['TS', '타입스크립트'] },
  { id: 'design', en: 'UI design', ko: 'UI 디자인', aliases: ['Figma', 'UI', '디자인'] },
  { id: 'a11y', en: 'Accessibility', ko: '웹 접근성', aliases: ['a11y', 'WCAG', '접근성'] },
  { id: 'api', en: 'API integration', ko: 'API 연동', aliases: ['API', 'REST', 'API 통합'] },
  { id: 'sql', en: 'SQL', ko: 'SQL', aliases: ['SQL queries', 'SQL 쿼리'] },
  { id: 'python', en: 'Python', ko: 'Python', aliases: ['파이썬'] },
  { id: 'ml', en: 'Machine learning', ko: '머신러닝', aliases: ['ML', '머신 러닝'] },
  { id: 'data', en: 'Data analysis', ko: '데이터 분석', aliases: ['Analytics', '분석'] },
  { id: 'devops', en: 'DevOps', ko: 'DevOps', aliases: ['CI/CD', 'Kubernetes', '배포'] },
  { id: 'qa', en: 'QA', ko: '품질 검증', aliases: ['testing', '테스트', 'QA'] },
  { id: 'support', en: 'Technical support', ko: '기술 지원', aliases: ['customer support', '고객 지원'] },
  { id: 'javascript', en: 'JavaScript', ko: 'JavaScript', aliases: ['JS', '자바스크립트'] },
  { id: 'html-css', en: 'HTML and CSS', ko: 'HTML·CSS', aliases: ['HTML', 'CSS', '반응형 웹'] },
  { id: 'nextjs', en: 'Next.js', ko: 'Next.js', aliases: ['NextJS', '넥스트.js'] },
  { id: 'nodejs', en: 'Node.js', ko: 'Node.js', aliases: ['NodeJS', 'Express', '노드'] },
  { id: 'postgresql', en: 'PostgreSQL', ko: 'PostgreSQL', aliases: ['Postgres', '포스트그레스'] },
  { id: 'git', en: 'Git', ko: 'Git', aliases: ['version control', '버전 관리'] },
  { id: 'playwright', en: 'Playwright', ko: 'Playwright', aliases: ['browser E2E', '브라우저 E2E'] },
  { id: 'jest', en: 'Jest and Vitest', ko: 'Jest·Vitest', aliases: ['Jest', 'Vitest', '단위 테스트'] },
  { id: 'figma', en: 'Figma', ko: 'Figma', aliases: ['피그마', 'Figma components'] },
  { id: 'design-systems', en: 'Design systems', ko: '디자인 시스템', aliases: ['component tokens', '디자인 토큰'] },
  { id: 'docker', en: 'Docker', ko: 'Docker', aliases: ['container images', '도커'] },
  { id: 'kubernetes', en: 'Kubernetes', ko: 'Kubernetes', aliases: ['K8s', '쿠버네티스'] },
  { id: 'terraform', en: 'Terraform', ko: 'Terraform', aliases: ['IaC', '테라폼'] },
  { id: 'aws', en: 'AWS', ko: 'AWS', aliases: ['Amazon Web Services', '아마존 웹 서비스'] },
  { id: 'linux', en: 'Linux administration', ko: '리눅스 운영', aliases: ['Linux', 'Ubuntu', '리눅스'] },
  { id: 'cicd', en: 'CI/CD pipelines', ko: 'CI/CD 파이프라인', aliases: ['GitHub Actions', '지속적 통합'] },
  { id: 'observability', en: 'Observability', ko: '관측성', aliases: ['Grafana', 'Prometheus', '모니터링'] },
  { id: 'incident', en: 'Incident response', ko: '장애 대응', aliases: ['on-call triage', '인시던트 대응'] },
  { id: 'iam', en: 'Identity and access management', ko: '계정 및 접근 권한 관리', aliases: ['IAM', 'SSO', '싱글사인온'] },
  { id: 'network', en: 'Network troubleshooting', ko: '네트워크 문제 해결', aliases: ['TCP/IP', 'DNS', 'VPN'] },
  { id: 'intune', en: 'Microsoft Intune', ko: 'Microsoft Intune', aliases: ['endpoint management', '기기 관리'] },
  { id: 'm365', en: 'Microsoft 365 administration', ko: 'Microsoft 365 운영', aliases: ['M365', 'Microsoft 365', 'Exchange Online'] },
  { id: 'jira', en: 'Jira service workflows', ko: 'Jira 서비스 워크플로', aliases: ['Jira Service Management', 'JSM', '지라'] },
  { id: 'dbt', en: 'dbt data modeling', ko: 'dbt 데이터 모델링', aliases: ['dbt', '변환 모델'] },
  { id: 'airflow', en: 'Apache Airflow', ko: 'Apache Airflow', aliases: ['Airflow DAG', '에어플로'] },
  { id: 'power-bi', en: 'Power BI', ko: 'Power BI', aliases: ['DAX', '파워 BI'] },
  { id: 'excel', en: 'Excel and Power Query', ko: 'Excel·Power Query', aliases: ['Excel', 'Power Query', '엑셀'] },
  { id: 'forecasting', en: 'Financial forecasting', ko: '재무 예측', aliases: ['FP&A forecasting', '현금흐름 예측'] },
  { id: 'reconciliation', en: 'Account reconciliation', ko: '계정 대사', aliases: ['bank reconciliation', '계좌 대사'] },
  { id: 'accounting', en: 'General ledger accounting', ko: '총계정원장 회계', aliases: ['GL accounting', 'month-end close', '월말 결산'] },
  { id: 'payables', en: 'Accounts payable', ko: '매입채무 관리', aliases: ['AP', 'invoice matching', '매입채무'] },
  { id: 'budgeting', en: 'Budgeting and variance analysis', ko: '예산 및 차이 분석', aliases: ['budget variance', '예산 편차'] },
  { id: 'payroll', en: 'Payroll administration', ko: '급여 운영', aliases: ['payroll processing', '급여 처리'] },
  { id: 'hris', en: 'HRIS administration', ko: '인사 정보 시스템 운영', aliases: ['HRIS', 'Workday', '인사 시스템'] },
  { id: 'recruiting', en: 'Recruiting operations', ko: '채용 운영', aliases: ['ATS', 'candidate pipeline', '지원자 관리'] },
  { id: 'onboarding', en: 'Employee onboarding', ko: '신규 입사자 온보딩', aliases: ['onboarding checklist', '입사 절차'] },
  { id: 'workforce', en: 'Workforce planning', ko: '인력 계획', aliases: ['headcount plan', '인력 수급'] },
  { id: 'lms', en: 'Learning management systems', ko: '학습 관리 시스템', aliases: ['LMS', '사내 교육 시스템'] },
  { id: 'ga4', en: 'Google Analytics 4', ko: 'Google 애널리틱스 4', aliases: ['GA4', 'Google Analytics'] },
  { id: 'gtm', en: 'Google Tag Manager', ko: 'Google 태그 관리자', aliases: ['GTM', '이벤트 태깅'] },
  { id: 'seo', en: 'Search engine optimization', ko: '검색 엔진 최적화', aliases: ['SEO', 'organic search'] },
  { id: 'crm', en: 'CRM operations', ko: 'CRM 운영', aliases: ['Salesforce', 'HubSpot', '고객 관계 관리'] },
  { id: 'email', en: 'Email campaign operations', ko: '이메일 캠페인 운영', aliases: ['email marketing', 'lifecycle email', '이메일 마케팅'] },
  { id: 'experiments', en: 'A/B testing', ko: 'A/B 테스트', aliases: ['split test', 'experimentation', '실험 설계'] },
  { id: 'content', en: 'Content management', ko: '콘텐츠 관리', aliases: ['CMS', 'WordPress', '콘텐츠 게시'] },
  { id: 'ads', en: 'Paid search and social', ko: '검색·소셜 광고', aliases: ['Google Ads', 'Meta Ads', '유료 광고'] },
] as const
export const skillLabel = (id: string, lang: Language = 'en') => catalog.find((item) => item.id === id)?.[lang] || id
export const accessId = (value: string) => {
  const key = value.trim().toLowerCase()
  if (/stag(e|ing)|스테이징/.test(key)) return 'staging'
  if (/production|운영 환경|운영환경/.test(key)) return 'production'
  if (/analytics|분석 환경/.test(key)) return 'analytics'
  return key
}
export const emptyTask = (team: string, raw = ''): Task => ({
  id: '', title: '', deliverable: '', required: [], preferred: [], unmapped: [], min: null, max: null,
  source: 'manual', deadline: null, priority: '', split: null, focus: null, dependencies: [], access: [],
  assumptions: [], questions: [], previousOwner: '', raw, confirmed: false, team,
})
export function taskIssues(task: Task, now: number): string[] {
  const issues: string[] = []
  if (!task.title.trim() || !task.deliverable.trim()) issues.push('scope')
  if (!task.min || !task.max || !Number.isInteger(task.min) || !Number.isInteger(task.max) || task.min < 1 || task.min > task.max) issues.push('effort')
  if (task.deadline === null || task.deadline <= now) issues.push('deadline')
  if (task.required.some(({ level }) => level === null || !Number.isInteger(level) || level < 1 || level > 5) || task.unmapped.length) issues.push('skills')
  if (!task.priority) issues.push('priority')
  if (task.split === null || (task.split && (!task.focus || !Number.isInteger(task.focus) || task.focus < 1))) issues.push('focus')
  if (task.dependencies.some((dependency) => !dependency.name.trim() || dependency.available === null)) issues.push('dependency')
  if (task.questions.length) issues.push('questions')
  if (!task.confirmed) issues.push('confirmation')
  return issues
}
