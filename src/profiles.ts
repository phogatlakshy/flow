import type { Employee } from './domain'

type Work = { title: string; tags: string[] }
type Profile = { en: string; ko: string; primary: string[]; supporting: string[]; work: Work[]; access: string[] }
const sample = (title: string, ...tags: string[]): Work => ({ title, tags })

export const profiles = {
  frontend: {
    en: 'Frontend Engineer', ko: '프론트엔드 엔지니어',
    primary: ['react', 'typescript', 'javascript', 'html-css'], supporting: ['a11y', 'nextjs', 'playwright', 'api', 'git', 'jest', 'design-systems'],
    work: [sample('Dashboard filter state and query parameters', 'react', 'typescript', 'dashboard', 'filter'), sample('Responsive dashboard navigation', 'react', 'html-css', 'dashboard'), sample('Typed dashboard export controls', 'react', 'typescript', 'dashboard'), sample('Search results keyboard navigation', 'react', 'a11y', 'filter'), sample('Dashboard date range regression tests', 'playwright', 'typescript', 'filter', 'dashboard')],
    access: ['staging'],
  },
  fullstack: {
    en: 'Full-Stack Engineer', ko: '풀스택 엔지니어',
    primary: ['react', 'typescript', 'nodejs', 'api'], supporting: ['sql', 'postgresql', 'jest', 'docker', 'git', 'cicd', 'javascript'],
    work: [sample('Typed dashboard filter API', 'react', 'typescript', 'api', 'dashboard', 'filter'), sample('CSV export job and retry handling', 'nodejs', 'postgresql'), sample('Saved dashboard views', 'react', 'typescript', 'dashboard'), sample('Dashboard pagination and query caching', 'api', 'react', 'dashboard')],
    access: ['staging'],
  },
  backend: {
    en: 'Backend Engineer', ko: '백엔드 엔지니어',
    primary: ['nodejs', 'api', 'postgresql', 'sql'], supporting: ['typescript', 'docker', 'git', 'cicd', 'jest', 'observability'],
    work: [sample('Webhook retries and deduplication', 'nodejs', 'api'), sample('Invoice endpoint pagination', 'api', 'postgresql'), sample('Query index for billing events', 'postgresql', 'sql'), sample('Billing integration contract tests', 'jest', 'api')],
    access: ['staging'],
  },
  quality: {
    en: 'Test Automation Engineer', ko: '테스트 자동화 엔지니어',
    primary: ['qa', 'playwright', 'typescript', 'cicd'], supporting: ['a11y', 'jest', 'api', 'git', 'javascript'],
    work: [sample('Checkout browser regression suite', 'qa', 'playwright'), sample('Duplicate submission verification', 'qa', 'api'), sample('Accessibility checks in CI', 'a11y', 'cicd'), sample('Smoke tests for staging deployment', 'qa', 'playwright', 'cicd')],
    access: ['staging'],
  },
  design: {
    en: 'Product Designer', ko: '프로덕트 디자이너',
    primary: ['design', 'figma', 'design-systems', 'a11y'], supporting: ['html-css', 'experiments', 'content', 'qa'],
    work: [sample('Form validation states in Figma', 'figma', 'design'), sample('Accessible table and filter patterns', 'a11y', 'design-systems', 'filter'), sample('Status component library update', 'design-systems', 'figma'), sample('Prototype usability review', 'design', 'experiments')],
    access: [],
  },
  ui: {
    en: 'UI Engineer', ko: 'UI 엔지니어',
    primary: ['react', 'typescript', 'design-systems', 'a11y'], supporting: ['figma', 'html-css', 'playwright', 'javascript', 'git'],
    work: [sample('Dashboard filter component polish', 'react', 'typescript', 'dashboard', 'filter'), sample('Shared form component package', 'react', 'design-systems'), sample('Screen reader fixes for filter popovers', 'a11y', 'react', 'filter'), sample('High-contrast design tokens', 'design-systems', 'figma')],
    access: ['staging'],
  },
  data: {
    en: 'Data Engineer', ko: '데이터 엔지니어',
    primary: ['sql', 'python', 'dbt', 'airflow'], supporting: ['postgresql', 'data', 'docker', 'git', 'aws'],
    work: [sample('Customer activity incremental model', 'sql', 'dbt'), sample('Order ingestion retry policy', 'airflow', 'python'), sample('Duplicate event quality checks', 'dbt', 'data'), sample('Warehouse query performance audit', 'sql', 'postgresql')],
    access: ['analytics'],
  },
  analytics: {
    en: 'Data Analyst', ko: '데이터 분석가',
    primary: ['sql', 'data', 'power-bi', 'excel'], supporting: ['python', 'dbt', 'experiments', 'forecasting'],
    work: [sample('Weekly adoption dashboard', 'sql', 'data', 'power-bi', 'dashboard'), sample('Subscription cohort reconciliation', 'data', 'sql'), sample('Product experiment readout', 'experiments', 'data'), sample('Operations workbook refresh', 'excel', 'data')],
    access: ['analytics'],
  },
  ml: {
    en: 'Applied ML Engineer', ko: '응용 머신러닝 엔지니어',
    primary: ['ml', 'python', 'data', 'sql'], supporting: ['docker', 'airflow', 'git', 'aws', 'observability'],
    work: [sample('Evaluate ranking model on held-out queries', 'ml', 'python', 'data'), sample('Feature pipeline freshness checks', 'sql', 'airflow'), sample('Package model service for staging', 'ml', 'docker'), sample('Model drift monitoring review', 'ml', 'observability')],
    access: ['analytics', 'staging'],
  },
  platform: {
    en: 'Cloud Platform Engineer', ko: '클라우드 플랫폼 엔지니어',
    primary: ['aws', 'terraform', 'kubernetes', 'linux', 'devops'], supporting: ['cicd', 'docker', 'network', 'iam', 'observability', 'git'],
    work: [sample('Terraform plan for staging cluster', 'terraform', 'aws', 'kubernetes'), sample('Container registry lifecycle rules', 'aws', 'docker'), sample('CI runner capacity upgrade', 'cicd', 'kubernetes'), sample('Linux patch window orchestration', 'linux', 'devops')],
    access: ['staging', 'production'],
  },
  reliability: {
    en: 'Site Reliability Engineer', ko: '사이트 신뢰성 엔지니어',
    primary: ['observability', 'incident', 'linux', 'kubernetes'], supporting: ['aws', 'devops', 'terraform', 'docker', 'network', 'cicd'],
    work: [sample('Queue latency alert thresholds', 'observability', 'incident'), sample('Cluster readiness incident follow-up', 'kubernetes', 'incident'), sample('Database saturation runbook', 'observability', 'linux'), sample('DNS failover drill', 'network', 'incident')],
    access: ['staging', 'production'],
  },
  integration: {
    en: 'Systems Integration Analyst', ko: '시스템 연동 분석가',
    primary: ['api', 'sql', 'qa', 'support'], supporting: ['jira', 'python', 'postgresql', 'typescript', 'javascript'],
    work: [sample('Validate partner API payload mapping', 'api', 'qa'), sample('Order reconciliation query for support', 'sql', 'support'), sample('Escalation routing for integration tickets', 'jira', 'support')],
    access: ['staging'],
  },
  service: {
    en: 'IT Service Desk Analyst', ko: 'IT 서비스 데스크 분석가',
    primary: ['support', 'jira', 'm365', 'network'], supporting: ['iam', 'intune', 'incident', 'excel'],
    work: [sample('Resolve VPN client rollout tickets', 'network', 'support'), sample('Jira request routing cleanup', 'jira', 'support'), sample('Microsoft 365 mailbox access review', 'm365', 'iam')],
    access: ['service desk'],
  },
  identity: {
    en: 'Identity and Endpoint Specialist', ko: '계정 및 기기 관리 담당자',
    primary: ['iam', 'intune', 'm365', 'support'], supporting: ['network', 'jira', 'incident', 'excel'],
    work: [sample('Intune compliance policy rollout', 'intune', 'iam'), sample('Single sign-on onboarding runbook', 'iam', 'm365'), sample('Endpoint enrollment issue triage', 'intune', 'support')],
    access: ['service desk', 'identity console'],
  },
  fpna: {
    en: 'FP&A Analyst', ko: 'FP&A 분석가',
    primary: ['forecasting', 'budgeting', 'excel', 'data'], supporting: ['power-bi', 'sql', 'accounting', 'workforce'],
    work: [sample('Quarterly cash-flow forecast', 'forecasting', 'excel'), sample('Marketing budget variance review', 'budgeting', 'data'), sample('Headcount scenario model', 'budgeting', 'workforce')],
    access: ['finance workspace'],
  },
  accountant: {
    en: 'Financial Accountant', ko: '재무 회계 담당자',
    primary: ['accounting', 'reconciliation', 'excel', 'payables'], supporting: ['budgeting', 'payroll', 'power-bi', 'data'],
    work: [sample('Month-end ledger reconciliation', 'reconciliation', 'accounting'), sample('Unapplied receipts audit', 'accounting', 'excel'), sample('Vendor invoice matching', 'payables', 'reconciliation')],
    access: ['finance workspace'],
  },
  payroll: {
    en: 'Payroll Operations Specialist', ko: '급여 운영 담당자',
    primary: ['payroll', 'accounting', 'reconciliation', 'excel'], supporting: ['hris', 'payables', 'data'],
    work: [sample('Payroll variance reconciliation', 'payroll', 'reconciliation'), sample('Payroll journal import validation', 'payroll', 'accounting'), sample('Time entry exception review', 'payroll', 'excel')],
    access: ['finance workspace', 'payroll workspace'],
  },
  hr: {
    en: 'People Operations Specialist', ko: '인사 운영 담당자',
    primary: ['hris', 'onboarding', 'workforce', 'excel'], supporting: ['recruiting', 'payroll', 'lms', 'data'],
    work: [sample('New-hire onboarding checklist refresh', 'onboarding', 'hris'), sample('Quarterly headcount file validation', 'workforce', 'excel'), sample('HRIS role and access cleanup', 'hris', 'onboarding')],
    access: ['hr workspace'],
  },
  recruiting: {
    en: 'Recruiting Operations Coordinator', ko: '채용 운영 코디네이터',
    primary: ['recruiting', 'onboarding', 'hris', 'excel'], supporting: ['workforce', 'content', 'data'],
    work: [sample('Requisition pipeline report', 'recruiting', 'excel'), sample('Candidate stage checklist update', 'recruiting', 'onboarding'), sample('New job family ATS mapping', 'recruiting', 'hris')],
    access: ['hr workspace'],
  },
  learning: {
    en: 'Learning Operations Specialist', ko: '교육 운영 담당자',
    primary: ['lms', 'onboarding', 'content', 'excel'], supporting: ['hris', 'data', 'figma'],
    work: [sample('New-hire course catalog migration', 'lms', 'onboarding'), sample('Training completion audit', 'lms', 'excel'), sample('Knowledge base publishing checklist', 'content', 'lms')],
    access: ['hr workspace'],
  },
  growth: {
    en: 'Growth Marketing Analyst', ko: '그로스 마케팅 분석가',
    primary: ['ga4', 'gtm', 'experiments', 'data'], supporting: ['sql', 'seo', 'ads', 'excel', 'power-bi'],
    work: [sample('GA4 conversion event audit', 'ga4', 'gtm'), sample('Signup experiment tracking plan', 'experiments', 'ga4'), sample('Paid acquisition funnel review', 'ads', 'data')],
    access: ['analytics', 'marketing workspace'],
  },
  lifecycle: {
    en: 'Lifecycle Marketing Specialist', ko: '라이프사이클 마케팅 담당자',
    primary: ['crm', 'email', 'experiments', 'data'], supporting: ['content', 'ga4', 'excel', 'sql'],
    work: [sample('Trial onboarding email sequence', 'email', 'crm'), sample('Retention campaign segmentation', 'crm', 'data'), sample('Subject-line A/B test review', 'email', 'experiments')],
    access: ['marketing workspace'],
  },
  content: {
    en: 'Web Content Specialist', ko: '웹 콘텐츠 담당자',
    primary: ['content', 'seo', 'ga4', 'html-css'], supporting: ['a11y', 'figma', 'gtm', 'email'],
    work: [sample('Landing page metadata review', 'seo', 'content'), sample('Help center content migration', 'content', 'a11y'), sample('Organic signup tracking QA', 'ga4', 'gtm')],
    access: ['marketing workspace'],
  },
} satisfies Record<string, Profile>

export type ProfileKey = keyof typeof profiles
export const departments = ['Engineering', 'IT', 'Finance', 'HR', 'Marketing'] as const
export type Department = typeof departments[number]
export type SourceRow = {
  row: number; id: string; name: string; department: Department; manager: number; title: string;
  employment: string; shift: '9-5' | '12-8' | 'Night Shift'; status: NonNullable<Employee['status']>;
}
export const personId = (row: number) => 'SR-' + String(row + 1).padStart(4, '0')
export const demoMembers = [
  { row: 326, profile: 'frontend', korean: '킴벌리 맥브라이드' },
  { row: 452, profile: 'fullstack', korean: '게리 왓킨스' },
  { row: 402, profile: 'ui', korean: '트레이시 후아레스' },
  { row: 310, profile: 'integration', korean: '릭 볼드윈' },
  { row: 469, profile: 'design', korean: '레베카 비어드' },
  { row: 332, profile: 'quality', korean: '레이철 머피' },
  { row: 350, profile: 'analytics', korean: '마크 무어' },
  { row: 379, profile: 'reliability', korean: '윌리엄 헨더슨' },
] as const satisfies { row: number; profile: ProfileKey; korean: string }[]
export const demoTeam = 'Product Platform'
export const demoRows = new Set<number>(demoMembers.map(({ row }) => row))
export const teamFor = (row: SourceRow) => demoRows.has(row.row) ? demoTeam : row.department + ' · Team ' + String(row.manager).padStart(2, '0')

const departmentProfiles: Record<Department, ProfileKey[]> = {
  Engineering: ['frontend', 'fullstack', 'backend', 'quality', 'design', 'ui', 'data', 'ml', 'platform', 'reliability'],
  IT: ['service', 'identity', 'platform', 'reliability', 'integration', 'backend', 'data'],
  Finance: ['fpna', 'accountant', 'payroll'],
  HR: ['hr', 'recruiting', 'learning'],
  Marketing: ['growth', 'lifecycle', 'content', 'design'],
}
const profileRules: [RegExp, ProfileKey][] = [
  [/software engineer|applications? programmer|programmer, application|web developer/, 'fullstack'],
  [/multimedia programmer|programmer, multimedia|frontend|front-end/, 'frontend'],
  [/graphic|designer, multimedia/, 'design'],
  [/systems analyst|technical support/, 'integration'],
  [/network engineer|systems administrator|cloud engineer/, 'platform'],
  [/data scientist|machine learning/, 'ml'],
  [/data analyst|business intelligence/, 'analytics'],
  [/accountant|accounts payable/, 'accountant'],
  [/financial analyst|finance analyst|financial risk/, 'fpna'],
  [/recruitment|human resources/, 'recruiting'],
  [/marketing executive|digital marketing/, 'growth'],
]

export function profileFor(row: SourceRow): Profile {
  const demo = demoMembers.find((member) => member.row === row.row)
  const pool = departmentProfiles[row.department]
  const matched = profileRules.find(([rule, key]) => pool.includes(key) && rule.test(row.title.toLowerCase()))
  return profiles[demo?.profile || matched?.[1] || pool[(row.row * 29 + row.manager * 7) % pool.length]]
}

export function skillsFor(row: SourceRow, profile: Profile): Employee['skills'] {
  const core = profile.primary.map((id, i) => [id, (row.row * 3 + row.manager + i * 2) % 11 === 0 ? 5 : i < 2 || (row.row + i) % 3 === 0 ? 4 : 3] as const)
  const secondary = profile.supporting.flatMap((id, i) => (row.row + i * 7) % 5 === 0 ? [] : [[id, 2 + (row.row + i) % 2] as const])
  const skills = Object.fromEntries([...core, ...secondary])
  if (demoMembers.slice(0, 3).some((member) => member.row === row.row)) {
    skills.react = 5
    skills.typescript = row.row === 402 ? 4 : 5
  }
  return skills
}

export const shiftTimes: Record<SourceRow['shift'], { start: string; end: string }> = {
  '9-5': { start: '09:00', end: '17:00' },
  '12-8': { start: '12:00', end: '20:00' },
  'Night Shift': { start: '22:00', end: '06:00' },
}
