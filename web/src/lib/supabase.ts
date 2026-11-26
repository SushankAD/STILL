import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (Boolean(supabaseUrl) !== Boolean(supabaseAnonKey)) {
  throw new Error('Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to configure STILL.')
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
    // AuthGate subscribes before processing the URL so the recovery event cannot be missed.
    auth: { skipAutoInitialize: true },
  })
  : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error('STILL backend is not configured. Add the Supabase values to web/.env.local.')
  }

  return supabase
}
