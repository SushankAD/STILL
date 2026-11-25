import { requireSupabase } from './supabase'

export type DayState = 'steady' | 'heavy' | 'tiny'

export type CheckInDraft = {
  dayState: DayState
  mood: number
  mentalLoad: number
  reflection: string
}

export type CheckInRecord = CheckInDraft & {
  id: string
  checkInDate: string
  createdAt: string
}

function parseDayState(value: unknown): DayState {
  if (value === 'steady' || value === 'heavy' || value === 'tiny') {
    return value
  }
  return 'steady'
}

export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function fetchTodayCheckIn(userId: string): Promise<CheckInRecord | null> {
  const client = requireSupabase()
  const today = localDateString()

  const { data, error } = await client
    .from('check_ins')
    .select('id, user_id, check_in_date, day_state, mood, mental_load, reflection, created_at')
    .eq('user_id', userId)
    .eq('check_in_date', today)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    checkInDate: data.check_in_date,
    dayState: parseDayState(data.day_state),
    mood: typeof data.mood === 'number' ? data.mood : 50,
    mentalLoad: typeof data.mental_load === 'number' ? data.mental_load : 50,
    reflection: typeof data.reflection === 'string' ? data.reflection : '',
    createdAt: data.created_at,
  }
}

export async function fetchCheckInCount(userId: string): Promise<number> {
  const client = requireSupabase()
  const { count, error } = await client
    .from('check_ins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw error
  return count ?? 0
}

export async function saveCheckInRecord(
  userId: string,
  draft: CheckInDraft
): Promise<CheckInRecord> {
  const client = requireSupabase()
  const today = localDateString()

  const sanitizedMood = Math.max(0, Math.min(100, Math.round(draft.mood)))
  const sanitizedLoad = Math.max(0, Math.min(100, Math.round(draft.mentalLoad)))
  const sanitizedReflection = draft.reflection.slice(0, 2000)

  const { data, error } = await client
    .from('check_ins')
    .upsert(
      {
        user_id: userId,
        check_in_date: today,
        day_state: draft.dayState,
        mood: sanitizedMood,
        mental_load: sanitizedLoad,
        reflection: sanitizedReflection,
      },
      { onConflict: 'user_id,check_in_date' }
    )
    .select('id, user_id, check_in_date, day_state, mood, mental_load, reflection, created_at')
    .single()

  if (error) throw error
  if (!data) throw new Error('STILL could not save your check-in.')

  return {
    id: data.id,
    checkInDate: data.check_in_date,
    dayState: parseDayState(data.day_state),
    mood: data.mood,
    mentalLoad: data.mental_load,
    reflection: data.reflection,
    createdAt: data.created_at,
  }
}
