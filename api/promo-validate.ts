import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function safeJson500 (res: VercelResponse, message: string) {
  const r = res as VercelResponse & { headersSent?: boolean; writableEnded?: boolean }
  if (r.headersSent || r.writableEnded) return
  return res.status(500).json({ valid: false, error: message })
}

/** POST /api/promo-validate — avoids Vercel issues with /api/promo/[action] for some deployments. */
export default async function handler (req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ valid: false, error: 'Method not allowed' })
    }
    const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim()
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!supabaseUrl || !serviceRole) {
      return res.status(200).json({ valid: false, error: 'Promo is temporarily unavailable. Please try again in a few minutes.' })
    }
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const body = (req.body && typeof req.body === 'object') ? (req.body as Record<string, unknown>) : {}
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    const tier = typeof body.tier === 'string' ? body.tier.trim().toLowerCase() : ''
    const userId = typeof body.user_id === 'string' ? body.user_id : null
    if (!code) return res.status(200).json({ valid: false, error: 'Code not found' })

    const { data: row, error } = await admin.from('promo_codes').select('*').eq('code', code).maybeSingle()
    if (error || !row) return res.status(200).json({ valid: false, error: 'Code not found' })
    const promo = row as {
      id: string; type: string; value: number | null; applicable_tier: string; max_uses: number | null; uses_count: number; expires_at: string | null; is_active: boolean
    }
    if (!promo.is_active) return res.status(200).json({ valid: false, error: 'Code expired' })
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) return res.status(200).json({ valid: false, error: 'Code expired' })
    if (promo.max_uses != null && promo.uses_count >= promo.max_uses) return res.status(200).json({ valid: false, error: 'Code expired' })
    const normalizedTier = tier === 'collector' || tier === 'investor' ? 'pro' : tier
    const normalizedApplicable = promo.applicable_tier === 'collector' || promo.applicable_tier === 'investor' ? 'pro' : promo.applicable_tier
    if (normalizedApplicable !== 'any' && normalizedTier && normalizedTier !== 'free' && normalizedApplicable !== normalizedTier) {
      return res.status(200).json({ valid: false, error: 'Code not found' })
    }
    if (userId) {
      const { data: existing } = await admin.from('promo_redemptions').select('id').eq('promo_code_id', promo.id).eq('user_id', userId).maybeSingle()
      if (existing) return res.status(200).json({ valid: false, error: 'Code already used' })
    }
    const message =
      promo.type === 'lifetime_free' ? 'Lifetime access applied!' :
      promo.type === 'free_months' ? `${Number(promo.value ?? 0)} months free applied!` :
      promo.type === 'percent_off' ? (Number(promo.value ?? 0) >= 100 ? 'First month free applied!' : `${Number(promo.value ?? 0)}% discount applied!`) :
      promo.type === 'fixed_off' ? `$${Number(promo.value ?? 0)} off applied!` :
      'Promo applied!'
    return res.status(200).json({ valid: true, discount_type: promo.type, discount_value: promo.value, message })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Promo validation failed'
    console.error('[promo-validate]', e)
    safeJson500(res, message)
  }
}
