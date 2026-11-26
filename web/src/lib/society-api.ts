import { requireSupabase } from './supabase'

export type ReactionType = 'like' | 'love' | 'same' | 'proud'

export type SocietyComment = {
  id: number | string
  text: string
}

export type SocietyPost = {
  id: number | string
  icon: string
  text: string
  reactions: Record<ReactionType, number>
  reacted: ReactionType | null
  comments: SocietyComment[]
}

type RawPostRow = {
  id: string
  icon: string
  body: string
  reactions: Record<ReactionType, number>
  reacted: ReactionType | null
  comments: SocietyComment[]
}

export async function fetchSocietyPosts(): Promise<SocietyPost[]> {
  const { data, error } = await requireSupabase()
    .rpc('get_society_feed')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw error

  return ((data ?? []) as RawPostRow[]).map((row) => ({
    id: row.id,
    icon: row.icon || '🌱',
    text: row.body,
    reactions: row.reactions,
    reacted: row.reacted,
    comments: row.comments,
  }))
}

export async function createSocietyPost(
  userId: string,
  icon: string,
  text: string,
): Promise<SocietyPost> {
  const client = requireSupabase()
  const trimmed = text.trim().slice(0, 180)
  if (!trimmed) throw new Error('Write the small win first.')

  const { data, error } = await client
    .from('society_posts')
    .insert({
      user_id: userId,
      icon: icon || '🌱',
      body: trimmed,
    })
    .select('id, icon, body')
    .single()

  if (error) throw error
  if (!data) throw new Error('Could not share your post.')

  return {
    id: data.id,
    icon: data.icon,
    text: data.body,
    reactions: { like: 0, love: 0, same: 0, proud: 0 },
    reacted: null,
    comments: [],
  }
}

export async function toggleSocietyReaction(
  userId: string,
  postId: string,
  currentReaction: ReactionType | null,
  nextReaction: ReactionType,
): Promise<void> {
  const client = requireSupabase()

  if (currentReaction === nextReaction) {
    const { error } = await client
      .from('society_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw error
    return
  }

  const { error } = await client
    .from('society_reactions')
    .upsert(
      {
        post_id: postId,
        user_id: userId,
        reaction: nextReaction,
      },
      { onConflict: 'post_id,user_id' },
    )

  if (error) throw error
}

export async function addSocietyComment(
  userId: string,
  postId: string,
  text: string,
): Promise<SocietyComment> {
  const client = requireSupabase()
  const trimmed = text.trim().slice(0, 240)
  if (!trimmed) throw new Error('Write a short reply first.')

  const { data, error } = await client
    .from('society_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      body: trimmed,
    })
    .select('id, body')
    .single()

  if (error) throw error
  if (!data) throw new Error('Could not post your reply.')

  return { id: data.id, text: data.body }
}
