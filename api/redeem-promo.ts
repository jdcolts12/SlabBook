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

function getBearerToken (authHeader?: string): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
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

function discountHumanLabel (row: PromoCodeRow): string {
  switch (row.type) {
    case 'lifetime_free':
      return 'Lifetime membership free'
    case 'free_months':
      return `${Number(row.value ?? 0)} months free`
    case 'percent_off':
      if (Number(row.value) >= 100) return 'First month free'
      return `${Number(row.value)}% off`
    case 'fixed_off':
      return `$${Number(row.value ?? 0)} off`
    default:
      return row.code
  }
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

function buildUserUpdateFromPromo (row: PromoCodeRow, now = new Date()): Record<string, unknown> {
  switch (row.type) {
    case 'lifetime_free':
      return {
        subscription_tier: 'lifetime',
        subscription_ends_at: null,
        trial_ends_at: null,
        promo_code_used: row.code,
      }
    case 'free_months': {
      const months = Number(row.value ?? 0)
      const end = new Date(now)
      end.setMonth(end.getMonth() + months)
      return {
        subscription_tier: 'collector',
        trial_ends_at: end.toISOString(),
        promo_code_used: row.code,
      }
    }
    case 'percent_off': {
      const v = Number(row.value ?? 0)
      if (v >= 100) {
        const end = new Date(now)
        end.setMonth(end.getMonth() + 1)
        return {
          subscription_tier: 'collector',
          trial_ends_at: end.toISOString(),
          promo_code_used: row.code,
        }
      }
      if (row.applicable_tier === 'lifetime') {
        return {
          subscription_tier: 'investor',
          subscription_ends_at: null,
          trial_ends_at: null,
          promo_code_used: row.code,
        }
      }
      return {
        subscription_tier: 'collector',
        promo_code_used: row.code,
      }
    }
    case 'fixed_off':
      return { promo_code_used: row.code }
    default:
      return { promo_code_used: row.code }
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

    const token = getBearerToken(req.headers?.authorization)
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token.' })
    }

    const admin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token)

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired auth token.' })
    }

    const json = getJson(req.body)
    const codeRaw = typeof json.code === 'string' ? json.code : ''
    const tier = typeof json.tier === 'string' ? json.tier : undefined

    const code = normalizePromoCode(codeRaw)
    if (!code) {
      return res.status(400).json({ error: 'Code not found' })
    }

    const { data: row, error: promoErr } = await admin.from('promo_codes').select('*').eq('code', code).maybeSingle()
    if (promoErr || !row) {
      return res.status(400).json({ error: 'Code not found' })
    }
    const promo = row as PromoCodeRow

    if (!promo.is_active) {
      return res.status(400).json({ error: 'Code expired' })
    }
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Code expired' })
    }
    if (promo.max_uses != null && promo.uses_count >= promo.max_uses) {
      return res.status(400).json({ error: 'Code expired' })
    }

    if (promo.applicable_tier !== 'any' && tier && tier !== 'free' && promo.applicable_tier !== tier) {
      return res.status(400).json({ error: 'Code not found' })
    }

    const { data: existing } = await admin
      .from('promo_redemptions')
      .select('id')
      .eq('promo_code_id', promo.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) {
      return res.status(400).json({ error: 'Code already used' })
    }
    const discount_applied = discountHumanLabel(promo)
    const userUpdate = buildUserUpdateFromPromo(promo)

    const { error: redeemErr } = await admin.from('promo_redemptions').insert({
      promo_code_id: promo.id,
      user_id: user.id,
      discount_applied,
    })

    if (redeemErr) {
      if (redeemErr.code === '23505') {
        return res.status(400).json({ error: 'Code already used' })
      }
      return res.status(500).json({ error: redeemErr.message })
    }

    await admin
      .from('promo_codes')
      .update({ uses_count: promo.uses_count + 1 })
      .eq('id', promo.id)

    const { error: upErr } = await admin.from('users').update(userUpdate).eq('id', user.id)

    if (upErr) {
      return res.status(500).json({ error: upErr.message })
    }

    return res.status(200).json({
      ok: true,
      message: discountSuccessMessage(promo),
      discount_applied,
      code: normalizePromoCode(promo.code),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown promo redemption error'
    return res.status(500).json({ error: `Promo redeem failed: ${message}` })
  }
}
