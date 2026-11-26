export const POLICY_VERSION = 1
export const DEFAULT_SOCIAL_WINDOW = { limitMinutes: 0, endHour: 24 }
export type SocialWindow = typeof DEFAULT_SOCIAL_WINDOW
export type TemplateKey = 'water' | 'movement' | 'reading' | 'journal' | 'sleep' | 'social'
export type HabitDifficulty = 'easy' | 'medium' | 'hard'
export type CompletionMethod = 'legacy' | 'photo' | 'tracked' | 'self_report'

export const habitRoots: Record<HabitDifficulty, number> = { easy: 1, medium: 2, hard: 3 }

export type HabitPolicy = {
  habitTitle: string
  habitCategory: string
  userInstruction: string
  verificationMode: 'PHOTO' | 'SCREENSHOT' | 'TIMER' | 'INTEGRATION' | 'SELF_REPORT' | 'HYBRID'
  acceptableEvidence: string[]
  insufficientEvidence: string[]
  rejectionCriteria: string[]
  completionCriteria: string[]
  measurableTarget: { value: number | null; unit: string | null }
  verificationLimitations: string[]
  privacyGuidance: string
  policyVersion: typeof POLICY_VERSION
  safetyStatus: 'ALLOWED' | 'NEEDS_CLARIFICATION' | 'UNSUPPORTED'
  dateBasis: 'CURRENT_DAY' | 'LAST_CLOSED_DAY'
}

export type EvidenceResult = {
  status: 'ACCEPTED' | 'PARTIAL' | 'UNCERTAIN' | 'REJECTED'
  confidence: number
  observedEvidence: string[]
  criteriaSatisfied: string[]
  criteriaNotEstablished: string[]
  targetVerified: boolean
  reasonCode: string
  userMessage: string
  retryInstruction: string | null
}

const templates = {
  water: { title: 'Drink water', icon: '💧', area: 'Body', difficulty: 'easy' },
  movement: { title: 'Move my body', icon: '🏃', area: 'Body', difficulty: 'medium' },
  reading: { title: 'Read 20 pages', icon: '📚', area: 'Mind', difficulty: 'medium' },
  journal: { title: 'Journal one page', icon: '📓', area: 'Mind', difficulty: 'easy' },
  sleep: { title: 'Sleep before 11', icon: '🌙', area: 'Rest', difficulty: 'hard' },
  social: { title: 'No social scrolling', icon: '🚫', area: 'Focus', difficulty: 'hard' },
} as const

export const habitTemplates = (['movement', 'water', 'reading', 'journal', 'sleep', 'social'] as const)
  .map((templateKey) => ({ ...templates[templateKey], templateKey }))

export function normalizedTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function findTemplate(title: string): TemplateKey | null {
  return habitTemplates.find((template) => normalizedTitle(template.title) === normalizedTitle(title))?.templateKey ?? null
}

export function allowsSelfReport(policy: HabitPolicy, templateKey: TemplateKey | null): boolean {
  return policy.safetyStatus === 'ALLOWED' && (templateKey === 'sleep' || policy.verificationMode === 'SELF_REPORT')
}

export function shiftHabitDate(date: string, days: number): string {
  const utc = new Date(`${date}T12:00:00Z`)
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

export function habitDate(now: Date, timezone: string, template: TemplateKey | null, dateBasis?: HabitPolicy['dateBasis'], endHour = 24): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)?.value
  const today = `${part('year')}-${part('month')}-${part('day')}`
  const previousDay = template === 'sleep' || (template === 'social'
    ? Number(part('hour')) < endHour
    : dateBasis === 'LAST_CLOSED_DAY')
  return previousDay ? shiftHabitDate(today, -1) : today
}

export function currentHabitStreak(completedDates: ReadonlySet<string>, date: string): number {
  let current = completedDates.has(date) ? date : shiftHabitDate(date, -1)
  let streak = 0
  while (completedDates.has(current)) {
    streak++
    current = shiftHabitDate(current, -1)
  }
  return streak
}
