import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function getSupabaseUrl (): string | null {
  const u = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  return u?.trim() || null
}

export function getServiceRole (): string | null {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  return k?.trim() || null
}

export function createSupabaseAdmin (): SupabaseClient | null {
  const url = getSupabaseUrl()
  const key = getServiceRole()
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
