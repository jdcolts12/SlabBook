import { createClient } from '@supabase/supabase-js'
import { ADMIN_COOKIE, parseCookies, verifyAdminCookie } from '../server/adminAuth'

type ApiRequest = {
  method?: string
  headers: Record<string, string | undefined>
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

export default async function handler (req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cookies = parseCookies(req.headers.cookie)
  if (!verifyAdminCookie(cookies[ADMIN_COOKIE] ?? '')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceRole) {
    return res.status(500).json({ error: 'Missing Supabase configuration.' })
  }

  const admin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rows, error } = await admin
    .from('promo_redemptions')
    .select('id, promo_code_id, user_id, redeemed_at, discount_applied')
    .order('redeemed_at', { ascending: false })
    .limit(200)

  if (error) return res.status(500).json({ error: error.message })

  const list = rows ?? []
  const promoIds = [...new Set(list.map((r) => r.promo_code_id))]
  const userIds = [...new Set(list.map((r) => r.user_id))]

  const { data: codes } = await admin.from('promo_codes').select('id, code').in('id', promoIds)
  const { data: users } = await admin.from('users').select('id, email').in('id', userIds)

  const codeMap = new Map((codes ?? []).map((c) => [c.id, c.code as string]))
  const emailMap = new Map((users ?? []).map((u) => [u.id, u.email as string]))

  const redemptions = list.map((r) => ({
    id: r.id,
    redeemed_at: r.redeemed_at,
    discount_applied: r.discount_applied,
    code: codeMap.get(r.promo_code_id) ?? '',
    email: emailMap.get(r.user_id) ?? '',
  }))

  return res.status(200).json({ redemptions })
}
