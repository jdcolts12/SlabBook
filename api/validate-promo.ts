import { createClient } from '@supabase/supabase-js'

type ApiRequest = {
  method?: string
  headers?: Record<string, string | undefined>
  body?: unknown
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

type PromoCodeRow = {
  id: string
  code: string
  type: string
  value: number | null
  applicable_tier: string
  max_uses: number | null
  uses_count: number
  expires_at: string | null
  is_active: boolean
}

function getJson (body: unknown): Record<string, unknown> {
  const isBufferBody = typeof Buffer !== 'undefined' && Buffer.isBuffer(body)
  if (body && typeof body === 'object' && !isBufferBody) return body as Record<string, unknown>
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

function normalizePromoCode (raw: string): string {
  return raw.trim().toUpperCase()
}

function discountSuccessMessage (row: PromoCodeRow): string {
  switch (row.type) {
    case 'lifetime_free':
      return 'Lifetime access applied!'
    case 'free_months':
      return `${Number(row.value ?? 0)} months free applied!`
    case 'percent_off':
      if (Number(row.value) >= 100) return 'First month free applied!'
      return `${Number(row.value)}% discount applied!`
    case 'fixed_off':
      return `$${Number(row.value ?? 0)} off applied!`
    default:
      return 'Promo applied!'
  }
}

export default async function handler (req: ApiRequest, res: ApiResponse) {
  try {
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
    const code = normalizePromoCode(typeof json.code === 'string' ? json.code : '')
    const tier = typeof json.tier === 'string' ? json.tier : undefined
    const user_id = typeof json.user_id === 'string' ? json.user_id : null

    if (!code) {
      return res.status(200).json({ valid: false, error: 'Code not found' })
    }

    const { data: row, error } = await admin.from('promo_codes').select('*').eq('code', code).maybeSingle()

    if (error || !row) {
      return res.status(200).json({ valid: false, error: 'Code not found' })
    }

    const promo = row as PromoCodeRow

    if (!promo.is_active) {
      return res.status(200).json({ valid: false, error: 'Code expired' })
    }

    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
      return res.status(200).json({ valid: false, error: 'Code expired' })
    }

    if (promo.max_uses != null && promo.uses_count >= promo.max_uses) {
      return res.status(200).json({ valid: false, error: 'Code expired' })
    }

    if (promo.applicable_tier !== 'any' && tier && tier !== 'free' && promo.applicable_tier !== tier) {
      return res.status(200).json({ valid: false, error: 'Code not found' })
    }

    if (user_id) {
      const { data: existing } = await admin
        .from('promo_redemptions')
        .select('id')
        .eq('promo_code_id', promo.id)
        .eq('user_id', user_id)
        .maybeSingle()

      if (existing) {
        return res.status(200).json({ valid: false, error: 'Code already used' })
      }
    }

    return res.status(200).json({
      valid: true,
      discount_type: promo.type,
      discount_value: promo.value,
      message: discountSuccessMessage(promo),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown promo validation error'
    return res.status(500).json({ error: `Promo validation failed: ${message}` })
  }
}
