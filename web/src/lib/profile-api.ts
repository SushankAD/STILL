import { requireSupabase } from './supabase'

export type Profile = {
  id: string
  display_name: string
}

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .single()

  if (error) throw error
  if (!data || typeof data.id !== 'string' || typeof data.display_name !== 'string') {
    throw new Error('The signed-in account does not have a valid STILL profile.')
  }

  return { id: data.id, display_name: data.display_name }
}

export async function updateProfileName(userId: string, displayName: string): Promise<void> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select('id')
    .single()

  if (error) throw error
  if (!data) throw new Error('STILL could not confirm the profile update.')
}
