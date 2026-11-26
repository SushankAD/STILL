import { seedMilestonesFromCredits } from './seed-growth'
import type { RootCredit, SeedMilestones } from './seed-growth'
import { requireSupabase } from './supabase'

export type UserStats = {
  roots: number
  focusMinutes: number
  checkins: number
  day: number
  seedMilestones: SeedMilestones
}

const CHECKIN_ROOTS = 12
const PAGE_SIZE = 1000

async function readStatsPages<Row extends { id: string }>(
  fetchPage: (after: string | undefined) => PromiseLike<{ data: Row[] | null; error: unknown }>,
): Promise<Row[]> {
  const rows: Row[] = []
  for (;;) {
    const { data, error } = await fetchPage(rows.at(-1)?.id)
    if (error) throw error
    if (!data?.length) return rows
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

export async function fetchUserStats(userId: string): Promise<UserStats> {
  const client = requireSupabase()

  const [habits, focusSessions, checkIns] = await Promise.all([
    readStatsPages((after) => {
      const query = client.from('habit_completions').select('id, roots_awarded, completed_on, created_at')
        .eq('user_id', userId).order('id').limit(PAGE_SIZE)
      return after ? query.gt('id', after) : query
    }),
    readStatsPages((after) => {
      const query = client.from('focus_sessions').select('id, roots_awarded, planned_minutes, completed_at, started_at')
        .eq('user_id', userId).eq('status', 'completed').order('id').limit(PAGE_SIZE)
      return after ? query.gt('id', after) : query
    }),
    readStatsPages((after) => {
      const query = client.from('check_ins').select('id, check_in_date, created_at')
        .eq('user_id', userId).order('id').limit(PAGE_SIZE)
      return after ? query.gt('id', after) : query
    }),
  ])

  const activeDays = new Set<string>()
  const credits: RootCredit[] = []
  let roots = 0
  let focusMinutes = 0

  function recordRoots(amount: number, earnedAt: string) {
    roots += amount
    const timestamp = Date.parse(earnedAt)
    if (amount > 0 && Number.isFinite(timestamp)) credits.push({ roots: amount, earnedAt: timestamp })
  }

  for (const row of habits) {
    recordRoots(row.roots_awarded || 0, row.created_at)
    if (row.completed_on) activeDays.add(row.completed_on)
  }

  for (const row of focusSessions) {
    recordRoots(row.roots_awarded || 0, row.completed_at ?? row.started_at)
    focusMinutes += row.planned_minutes || 0
    if (row.completed_at) activeDays.add(row.completed_at.slice(0, 10))
  }

  for (const row of checkIns) {
    recordRoots(CHECKIN_ROOTS, row.created_at)
    if (row.check_in_date) activeDays.add(row.check_in_date)
  }

  return {
    roots,
    focusMinutes,
    checkins: checkIns.length,
    day: Math.max(1, activeDays.size),
    seedMilestones: seedMilestonesFromCredits(credits),
  }
}
