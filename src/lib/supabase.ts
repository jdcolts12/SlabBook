import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[SlabBook] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local.',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Must match GoTrue email/OAuth links (PKCE uses ?code=). Implicit-only clients fail on confirm links.
    flowType: 'pkce',
  },
})
