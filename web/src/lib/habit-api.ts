import { requireSupabase } from './supabase'
import { currentHabitStreak, DEFAULT_SOCIAL_WINDOW, findTemplate, habitDate, habitRoots, shiftHabitDate } from '../../supabase/functions/_shared/habit-policy'
import type {
  CompletionMethod, EvidenceResult, HabitDifficulty, HabitPolicy, SocialWindow, TemplateKey,
} from '../../supabase/functions/_shared/habit-policy'
import type { PreparedImage } from './proof-ai'

export type HabitDraft = { icon: string; title: string; area: string; difficulty: HabitDifficulty; baseRoots: number }

export type HabitRecord = HabitDraft & {
  id: number | string
  streak: number
  lastCompletedDay: number | string | null
  lastReward: number
  done: boolean
  completionId?: string
  lastMethod?: CompletionMethod
  timezone?: string
  policyDateBasis?: HabitPolicy['dateBasis']
  socialWindow?: SocialWindow
  activeDate?: string
}

export type HabitCompletion = {
  id: string
  completed_on: string
  roots_awarded: number
  verification_method: CompletionMethod
}

type HabitRow = {
  id: string
  title: string
  icon: string
  area: string
  difficulty: HabitDifficulty
  verification_timezone: string | null
  verification_policy: HabitPolicy | null
  verification_template: TemplateKey | null
  social_limit_minutes: number
  social_window_end_hour: number
}

export type HabitProofContext = {
  policy: HabitPolicy
  timezone: string
  habitDate: string
  policyRevision: string
  template: TemplateKey | null
  socialWindow: SocialWindow
  selfReportAllowed: boolean
}

export type HabitProofResult = {
  result: Pick<EvidenceResult, 'status' | 'userMessage' | 'retryInstruction'>
  verificationId: string | null
  method: 'photo' | 'tracked' | null
}

export const completionLabels: Record<CompletionMethod, string> = {
  legacy: 'Recorded completion',
  photo: 'Image evidence accepted',
  tracked: 'Tracked completion',
  self_report: 'Self-reported completion',
}

export const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const habitFields = 'id,title,icon,area,difficulty,verification_timezone,verification_policy,verification_template,social_limit_minutes,social_window_end_hour'

export function activeHabitDate(habit: HabitRecord, now: Date, fallback = deviceTimezone()) {
  return habitDate(now, habit.timezone ?? fallback, findTemplate(habit.title), habit.policyDateBasis, habit.socialWindow?.endHour)
}

function toHabit(row: HabitRow, completions: HabitCompletion[] = [], now = new Date(), timezone = deviceTimezone()): HabitRecord {
  const localZone = row.verification_timezone ?? timezone
  const settings = { limitMinutes: row.social_limit_minutes, endHour: row.social_window_end_hour }
  const date = habitDate(now, localZone, row.verification_template, row.verification_policy?.dateBasis, settings.endHour)
  const streak = currentHabitStreak(new Set(completions.map((entry) => entry.completed_on)), date)
  const entry = completions.find((item) => item.completed_on === date)
  return {
    id: row.id,
    icon: row.icon,
    title: row.title,
    area: row.area,
    difficulty: row.difficulty,
    baseRoots: habitRoots[row.difficulty],
    timezone: localZone,
    policyDateBasis: row.verification_policy?.dateBasis,
    socialWindow: settings,
    activeDate: date,
    streak,
    lastCompletedDay: entry?.completed_on ?? null,
    lastReward: entry?.roots_awarded ?? 0,
    completionId: entry?.id,
    lastMethod: entry?.verification_method,
    done: Boolean(entry),
  }
}

export async function fetchHabits(userId: string): Promise<HabitRecord[]> {
  const client = requireSupabase()
  const now = new Date()
  const timezone = deviceTimezone()
  const firstDate = shiftHabitDate(habitDate(now, timezone, null), -368)
  const [habitsResult, completionsResult] = await Promise.all([
    client.from('habits').select(habitFields).eq('user_id', userId).eq('archived', false).order('created_at'),
    client.from('habit_completions').select('id, habit_id, completed_on, roots_awarded, verification_method')
      .eq('user_id', userId).gte('completed_on', firstDate).order('completed_on', { ascending: false }),
  ])
  if (habitsResult.error) throw habitsResult.error
  if (completionsResult.error) throw completionsResult.error

  const byHabit = new Map<string, HabitCompletion[]>()
  for (const completion of completionsResult.data ?? []) {
    const records = byHabit.get(completion.habit_id) ?? []
    records.push(completion as HabitCompletion)
    byHabit.set(completion.habit_id, records)
  }
  return (habitsResult.data ?? []).map((row) => toHabit(row, byHabit.get(row.id), now, timezone))
}

export async function callProof<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke<T>('verify-proof', { body, timeout: 40_000 })
  if (error?.context instanceof Response) {
    const details = await error.context.json().catch(() => null)
    if (typeof details?.error === 'string') throw new Error(details.error)
  }
  if (error || !data) throw new Error('Could not reach STILL verification. Please try again.')
  return data
}

export async function createHabit(habit: HabitDraft, habitId: string): Promise<HabitRecord> {
  const { habit: row } = await callProof<{ habit: HabitRow }>({
    action: 'create', habitId, title: habit.title, icon: habit.icon, difficulty: habit.difficulty, timezone: deviceTimezone(),
  })
  return toHabit(row)
}

export async function editHabit(habitId: string, title: string, social: SocialWindow = DEFAULT_SOCIAL_WINDOW) {
  const { habit } = await callProof<{ habit: HabitRow }>({
    action: 'edit', habitId, title, ...social, timezone: deviceTimezone(),
  })
  return toHabit(habit)
}

export function archiveHabit(habitId: string): Promise<unknown> {
  return callProof({ action: 'archive', habitId })
}

const pendingPolicies = new Map<string, Promise<HabitProofContext>>()

export function fetchHabitPolicy(userId: string, habitId: string): Promise<HabitProofContext> {
  const key = `${userId}:${habitId}`
  const pending = pendingPolicies.get(key)
  if (pending) return pending
  const request = callProof<HabitProofContext>({ action: 'policy', habitId, timezone: deviceTimezone() })
    .finally(() => pendingPolicies.delete(key))
  pendingPolicies.set(key, request)
  return request
}

export function verifyHabitProof(habitId: string, context: HabitProofContext, image: PreparedImage): Promise<HabitProofResult> {
  return callProof({
    action: 'verify', habitId, habitDate: context.habitDate, policyRevision: context.policyRevision, timezone: context.timezone,
    imageBase64: image.base64, mimeType: image.mimeType,
  })
}

export function recordHabitCompletion(habitId: string, context: HabitProofContext, attemptId: string, selfReport: boolean, keepImage?: PreparedImage) {
  return callProof<{ completion: HabitCompletion; photoSaved?: boolean }>({
    action: 'complete', habitId, habitDate: context.habitDate, policyRevision: context.policyRevision,
    attemptId, selfReport,
    ...(keepImage ? { keepPhoto: true, imageBase64: keepImage.base64, mimeType: keepImage.mimeType } : {}),
  })
}

export function removeHabitCompletion(habitId: string, completionId: string) {
  return callProof<{ storageWarning?: boolean }>({ action: 'undo', habitId, completionId, timezone: deviceTimezone() })
}
