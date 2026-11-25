import { requireSupabase } from './supabase'

export type HabitDifficulty = 'easy' | 'medium' | 'hard'

export type HabitDraft = {
  icon: string
  title: string
  area: string
  difficulty: HabitDifficulty
  baseRoots: number
}

export type HabitRecord = HabitDraft & {
  id: number | string
  streak: number
  lastCompletedDay: number | string | null
  lastReward: number
  done: boolean
}

type Completion = {
  completed_on: string
  roots_awarded: number
}

function parseDifficulty(value: string): HabitDifficulty {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value
  throw new Error(`Unsupported habit difficulty: ${value}`)
}

function localDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDate(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDateString(date)
}

function countCurrentStreak(completedDates: Set<string>, today: string): number {
  let date = completedDates.has(today) ? today : shiftDate(today, -1)
  let streak = 0

  while (completedDates.has(date)) {
    streak += 1
    date = shiftDate(date, -1)
  }

  return streak
}

export async function fetchHabits(userId: string): Promise<HabitRecord[]> {
  const client = requireSupabase()
  const today = localDateString(new Date())
  const firstDate = shiftDate(today, -366)

  const [habitsResult, completionsResult] = await Promise.all([
    client
      .from('habits')
      .select('id, title, icon, area, difficulty, base_roots')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
    client
      .from('habit_completions')
      .select('habit_id, completed_on, roots_awarded')
      .eq('user_id', userId)
      .gte('completed_on', firstDate)
      .order('completed_on', { ascending: false }),
  ])

  if (habitsResult.error) throw habitsResult.error
  if (completionsResult.error) throw completionsResult.error

  const completionsByHabit = new Map<string, Completion[]>()
  for (const completion of completionsResult.data ?? []) {
    const records = completionsByHabit.get(completion.habit_id) ?? []
    records.push(completion)
    completionsByHabit.set(completion.habit_id, records)
  }

  return (habitsResult.data ?? []).map((habit) => {
    const completions = completionsByHabit.get(habit.id) ?? []
    const completedDates = new Set(completions.map((completion) => completion.completed_on))
    const todayCompletion = completions.find((completion) => completion.completed_on === today)

    return {
      id: habit.id,
      icon: habit.icon,
      title: habit.title,
      area: habit.area,
      difficulty: parseDifficulty(habit.difficulty),
      baseRoots: habit.base_roots,
      streak: countCurrentStreak(completedDates, today),
      lastCompletedDay: todayCompletion?.completed_on ?? null,
      lastReward: todayCompletion?.roots_awarded ?? 0,
      done: Boolean(todayCompletion),
    }
  })
}

export async function createHabit(userId: string, habit: HabitDraft): Promise<HabitRecord> {
  const { data, error } = await requireSupabase()
    .from('habits')
    .insert({
      user_id: userId,
      title: habit.title,
      icon: habit.icon,
      area: habit.area,
      difficulty: habit.difficulty,
      base_roots: habit.baseRoots,
    })
    .select('id, title, icon, area, difficulty, base_roots')
    .single()

  if (error) throw error
  if (!data) throw new Error('STILL could not confirm the habit was saved.')

  return {
    id: data.id,
    icon: data.icon,
    title: data.title,
    area: data.area,
    difficulty: parseDifficulty(data.difficulty),
    baseRoots: data.base_roots,
    streak: 0,
    lastCompletedDay: null,
    lastReward: 0,
    done: false,
  }
}

export async function archiveHabit(userId: string, habitId: string): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('habits')
    .update({ archived: true })
    .eq('id', habitId)
    .eq('user_id', userId)
    .select('id')
    .single()

  if (error) throw error
  if (!data) throw new Error('STILL could not confirm the habit was archived.')
}

export async function recordHabitCompletion(
  userId: string,
  habitId: string,
  rootsAwarded: number,
): Promise<Completion> {
  const { data, error } = await requireSupabase()
    .from('habit_completions')
    .insert({
      user_id: userId,
      habit_id: habitId,
      completed_on: localDateString(new Date()),
      roots_awarded: rootsAwarded,
    })
    .select('completed_on, roots_awarded')
    .single()

  if (error?.code === '23505') {
    throw new Error('This habit is already complete for today.')
  }
  if (error) throw error
  if (!data) throw new Error('STILL could not confirm the habit completion.')

  return data
}

export async function removeTodayHabitCompletion(userId: string, habitId: string): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('habit_completions')
    .delete()
    .eq('user_id', userId)
    .eq('habit_id', habitId)
    .eq('completed_on', localDateString(new Date()))
    .select('id')
    .single()

  if (error) throw error
  if (!data) throw new Error('STILL could not confirm the completion was removed.')
}
