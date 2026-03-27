import { createClient } from '@supabase/supabase-js'
import {
  buildUserUpdateFromPromo,
  discountHumanLabel,
  normalizePromoCode,
  type PromoCodeRow,
  validatePromoCode,
} from './lib/promo'

type ApiRequest = {
  method?: string
  headers?: Record<string, string | undefined>
  body?: unknown
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
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

    const result = await validatePromoCode(admin, codeRaw, { tier, userId: user.id })

    if (!result.valid) {
      return res.status(400).json({ error: result.error })
    }

    const { data: row, error: fetchErr } = await admin
      .from('promo_codes')
      .select('*')
      .eq('id', result.promo_code_id)
      .single()

    if (fetchErr || !row) {
      return res.status(500).json({ error: fetchErr?.message ?? 'Promo lookup failed.' })
    }

    const promo = row as PromoCodeRow
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
      message: result.message,
      discount_applied,
      code: normalizePromoCode(promo.code),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown promo redemption error'
    return res.status(500).json({ error: `Promo redeem failed: ${message}` })
  }
}
