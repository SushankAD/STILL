import { callProof } from './habit-api'
import { requireSupabase } from './supabase'

export type FocusDepth = 'light' | 'medium' | 'deep'

type StartedFocus = {
  id: string
  intention: string
  plannedMinutes: number
}

type CompletedFocus = {
  newlyCompleted: boolean
  roots: number
  minutes: number
}

export function startFocusSession(intention: string, depth: FocusDepth): Promise<StartedFocus> {
  return callProof({ context: 'focus', action: 'start', intention: intention.trim() || 'Focus session', depth })
}

export function completeFocusSession(focusSessionId: string, verificationId: string): Promise<CompletedFocus> {
  return callProof({ context: 'focus', action: 'complete', focusSessionId, verificationId })
}

export async function abandonFocusSession(focusSessionId: string): Promise<boolean> {
  const { abandoned } = await callProof<{ abandoned: boolean }>({ context: 'focus', action: 'abandon', focusSessionId })
  return abandoned
}

export async function fetchTotalFocusMinutes(userId: string): Promise<number> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('focus_sessions')
    .select('planned_minutes')
    .eq('user_id', userId)
    .eq('status', 'completed')

  if (error) throw error
  if (!data) return 0

  return data.reduce((sum, row) => sum + (row.planned_minutes || 0), 0)
}
