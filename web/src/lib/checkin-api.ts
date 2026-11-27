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

export { localDateString } from './calendar'

export async function fetchTodayCheckIn(userId: string, today: string): Promise<CheckInRecord | null> {
  const client = requireSupabase()

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

export function reflectionWords(text: string): number {
  return text.split(/\s+/u).filter(word => /[\p{L}\p{N}]/u.test(word)).length
}

export async function saveCheckInRecord(draft: CheckInDraft): Promise<{ checkInDate: string; earned: number }> {
  const { data, error } = await requireSupabase().rpc('save_daily_checkin', {
    p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    p_state: draft.dayState,
    p_mood: draft.mood,
    p_load: draft.mentalLoad,
    p_reflection: draft.reflection.trim(),
  })
  if (error) throw error
  return data
}
