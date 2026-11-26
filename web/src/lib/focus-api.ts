import { requireSupabase } from './supabase'

export type FocusDepth = 'light' | 'medium' | 'deep'
export type FocusStatus = 'in_progress' | 'completed' | 'abandoned'

export type FocusSessionRecord = {
  id: string
  userId: string
  intention: string
  depth: FocusDepth
  plannedMinutes: number
  status: FocusStatus
  rootsAwarded: number
  startedAt: string
  completedAt: string | null
}

function parseDepth(value: string): FocusDepth {
  if (value === 'light' || value === 'medium' || value === 'deep') return value
  return 'light'
}

function parsePlannedMinutes(value: number): number {
  if (value === 25 || value === 50 || value === 90) return value
  return 25
}

export async function startFocusSession(
  userId: string,
  intention: string,
  depth: FocusDepth,
  plannedMinutes: number
): Promise<FocusSessionRecord> {
  const client = requireSupabase()
  const sanitizedIntention = (intention.trim() || 'Focus session').slice(0, 72)
  const validMinutes = parsePlannedMinutes(plannedMinutes)

  const { data, error } = await client
    .from('focus_sessions')
    .insert({
      user_id: userId,
      intention: sanitizedIntention,
      depth: parseDepth(depth),
      planned_minutes: validMinutes,
      status: 'in_progress',
      roots_awarded: 0,
    })
    .select('id, user_id, intention, depth, planned_minutes, status, roots_awarded, started_at, completed_at')
    .single()

  if (error) throw error
  if (!data) throw new Error('Could not start focus session on server.')

  return {
    id: data.id,
    userId: data.user_id,
    intention: data.intention,
    depth: parseDepth(data.depth),
    plannedMinutes: data.planned_minutes,
    status: data.status as FocusStatus,
    rootsAwarded: data.roots_awarded,
    startedAt: data.started_at,
    completedAt: data.completed_at,
  }
}

async function savedFocusStatus(userId: string, sessionId: string): Promise<FocusStatus | undefined> {
  const { data, error } = await requireSupabase().from('focus_sessions').select('status')
    .eq('id', sessionId).eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.status
}

export async function completeFocusSession(
  userId: string,
  sessionId: string,
  rootsAwarded: number
): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from('focus_sessions')
    .update({
      status: 'completed',
      roots_awarded: Math.max(0, rootsAwarded),
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (data) return true
  if (await savedFocusStatus(userId, sessionId) === 'completed') return false
  throw new Error('This focus session is no longer active.')
}

export async function abandonFocusSession(userId: string, sessionId: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from('focus_sessions')
    .update({
      status: 'abandoned',
      roots_awarded: 0,
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .select('id')
    .maybeSingle()

  if (error) throw error
  return Boolean(data) || await savedFocusStatus(userId, sessionId) !== 'completed'
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
