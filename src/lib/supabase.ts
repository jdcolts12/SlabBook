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
    /**
     * Default is `implicit` — email confirmation puts tokens in the URL hash so the link works on
     * any device. `pkce` requires a code verifier in the *same* browser as signup; if exchange fails,
     * Supabase keeps the previous session, so testers stayed logged in and new users saw the wrong account.
     */
    flowType: 'implicit',
  },
})
