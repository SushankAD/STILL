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
  created_at: string
  society_reactions: { user_id: string; reaction: string }[] | null
  society_comments: { id: string; body: string; created_at: string }[] | null
}

function isReactionType(value: string): value is ReactionType {
  return value === 'like' || value === 'love' || value === 'same' || value === 'proud'
}

export async function fetchSocietyPosts(userId: string): Promise<SocietyPost[]> {
  const client = requireSupabase()

  const { data, error } = await client
    .from('society_posts')
    .select(`
      id,
      icon,
      body,
      created_at,
      society_reactions ( user_id, reaction ),
      society_comments ( id, body, created_at )
    `)
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) throw error

  return ((data ?? []) as unknown as RawPostRow[]).map((row) => {
    const counts: Record<ReactionType, number> = { like: 0, love: 0, same: 0, proud: 0 }
    let reacted: ReactionType | null = null

    for (const r of row.society_reactions ?? []) {
      if (isReactionType(r.reaction)) {
        counts[r.reaction] += 1
        if (r.user_id === userId) {
          reacted = r.reaction
        }
      }
    }

    const comments = [...(row.society_comments ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({ id: c.id, text: c.body }))

    return {
      id: row.id,
      icon: row.icon || '🌱',
      text: row.body,
      reactions: counts,
      reacted,
      comments,
    }
  })
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
