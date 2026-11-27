import { requireSupabase } from './supabase'
import { calendarMonthBounds } from './calendar'
import type { PreparedImage } from './proof-ai'

export type ProofPhotoSource =
  | { kind: 'focus'; focusSessionId: string }
  | { kind: 'habit'; habitCompletionId: string }

export type CollectionPhoto = {
  id: string
  label: string
  kind: 'focus' | 'habit'
  createdAt: string
  imageUrl: string
  objectPath?: string
}

const PROOF_BUCKET = 'proof-photos'
const SIGNED_URL_LIFETIME = 3600

export async function refreshCollectionImageUrl(objectPath: string): Promise<string> {
  const { data, error } = await requireSupabase().storage
    .from(PROOF_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_LIFETIME)
  if (error) throw error
  return data.signedUrl
}

export async function uploadProofPhoto(
  userId: string,
  image: PreparedImage,
  source: ProofPhotoSource,
  label: string,
): Promise<CollectionPhoto> {
  const client = requireSupabase()
  const photoId = crypto.randomUUID()
  const objectPath = `${userId}/${photoId}.jpg`

  const { error: uploadError } = await client.storage
    .from(PROOF_BUCKET)
    .upload(objectPath, image.blob, {
      contentType: image.mimeType,
      upsert: false,
    })

  if (uploadError) throw uploadError

  const insertPayload = {
    id: photoId,
    user_id: userId,
    object_path: objectPath,
    focus_session_id: source.kind === 'focus' ? source.focusSessionId : null,
    habit_completion_id: source.kind === 'habit' ? source.habitCompletionId : null,
    content_type: image.mimeType,
    byte_size: image.byteSize,
  }

  const { data, error: dbError } = await client
    .from('proof_photos')
    .insert(insertPayload)
    .select('id, object_path, created_at')
    .single()

  if (dbError) {
    // Clean up orphaned storage object if metadata insert fails
    await client.storage.from(PROOF_BUCKET).remove([objectPath])
    throw dbError
  }

  const imageUrl = await refreshCollectionImageUrl(data.object_path).catch(() => image.dataUrl)

  return {
    id: data.id,
    label,
    kind: source.kind,
    createdAt: data.created_at,
    imageUrl,
    objectPath: data.object_path,
  }
}

type ProofRow = {
  id: string
  object_path: string
  focus_session_id: string | null
  habit_completion_id: string | null
  created_at: string
  focus_sessions: { intention: string } | { intention: string }[] | null
  habit_completions: { habits: { title: string; icon: string } | { title: string; icon: string }[] | null } | { habits: { title: string; icon: string } | { title: string; icon: string }[] | null }[] | null
}

function extractLabel(row: ProofRow): { label: string; kind: 'focus' | 'habit' } {
  if (row.focus_session_id) {
    const fs = Array.isArray(row.focus_sessions) ? row.focus_sessions[0] : row.focus_sessions
    return {
      kind: 'focus',
      label: fs?.intention || 'Focus session',
    }
  }
  const hc = Array.isArray(row.habit_completions) ? row.habit_completions[0] : row.habit_completions
  const habit = hc ? (Array.isArray(hc.habits) ? hc.habits[0] : hc.habits) : null
  return {
    kind: 'habit',
    label: habit ? `${habit.icon} ${habit.title}` : 'Habit proof',
  }
}

export async function fetchCollectionPhotos(userId: string, month?: Date): Promise<CollectionPhoto[]> {
  const client = requireSupabase()

  const rows: ProofRow[] = []
  const bounds = month ? calendarMonthBounds(month) : null
  const pageSize = month ? 1000 : 60
  for (;;) {
    let query = client.from('proof_photos')
      .select(`
        id, object_path, focus_session_id, habit_completion_id, created_at,
        focus_sessions ( intention ),
        habit_completions ( habits ( title, icon ) )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(rows.length, rows.length + pageSize - 1)
    if (bounds) query = query.gte('created_at', bounds.start).lt('created_at', bounds.end)
    const { data, error } = await query
    if (error) throw error
    const page = (data ?? []) as unknown as ProofRow[]
    rows.push(...page)
    if (!month || page.length < pageSize) break
  }
  if (rows.length === 0) return []

  const paths = rows.map((row) => row.object_path)
  const { data: signedUrls, error: signError } = await client.storage
    .from(PROOF_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_LIFETIME)

  if (signError) throw signError

  const urlMap = new Map<string, string>()
  for (const item of signedUrls ?? []) {
    if (item.path && item.signedUrl) {
      urlMap.set(item.path, item.signedUrl)
    }
  }

  return rows.map((row) => {
    const { label, kind } = extractLabel(row)
    return {
      id: row.id,
      label,
      kind,
      createdAt: row.created_at,
      imageUrl: urlMap.get(row.object_path) ?? '',
      objectPath: row.object_path,
    }
  })
}
