import { createClient } from '@supabase/supabase-js'
import { validatePromoCode } from './lib/promo'

type ApiRequest = {
  method?: string
  headers: Record<string, string | undefined>
  body?: unknown
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

function getJson (body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body as Record<string, unknown>
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

export default async function handler (req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRole) {
    return res.status(500).json({ error: 'Missing Supabase server configuration.' })
  }

  const admin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const json = getJson(req.body)
  const code = typeof json.code === 'string' ? json.code : ''
  const tier = typeof json.tier === 'string' ? json.tier : undefined
  const user_id = typeof json.user_id === 'string' ? json.user_id : null

  const result = await validatePromoCode(admin, code, { tier, userId: user_id })

  if (!result.valid) {
    return res.status(200).json({
      valid: false,
      error: result.error,
    })
  }

  return res.status(200).json({
    valid: true,
    discount_type: result.discount_type,
    discount_value: result.discount_value,
    message: result.message,
  })
}
