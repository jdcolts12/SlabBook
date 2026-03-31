import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function safeJson500 (res: VercelResponse, message: string) {
  const r = res as VercelResponse & { headersSent?: boolean; writableEnded?: boolean }
  if (r.headersSent || r.writableEnded) return
  return res.status(500).json({ error: message })
}

/** POST /api/promo-redeem — avoids Vercel issues with /api/promo/[action] for some deployments. */
export default async function handler (req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method not allowed' })
    }
    const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim()
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!supabaseUrl || !serviceRole) return res.status(503).json({ error: 'Missing Supabase server configuration.' })

    const authHeader = req.headers.authorization
    const auth = typeof authHeader === 'string' ? authHeader : Array.isArray(authHeader) ? authHeader[0] : ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Missing bearer token.' })

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Invalid or expired auth token.' })

    const body = (req.body && typeof req.body === 'object') ? (req.body as Record<string, unknown>) : {}
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    const tier = typeof body.tier === 'string' ? body.tier.trim().toLowerCase() : ''
    if (!code) return res.status(400).json({ error: 'Code not found' })

    const { data: row, error: promoErr } = await admin.from('promo_codes').select('*').eq('code', code).maybeSingle()
    if (promoErr || !row) return res.status(400).json({ error: 'Code not found' })
    const promo = row as {
      id: string; code: string; type: string; value: number | null; applicable_tier: string; max_uses: number | null; uses_count: number; expires_at: string | null; is_active: boolean
    }
    if (!promo.is_active) return res.status(400).json({ error: 'Code expired' })
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Code expired' })
    if (promo.max_uses != null && promo.uses_count >= promo.max_uses) return res.status(400).json({ error: 'Code expired' })
    const normalizedTier = tier === 'collector' || tier === 'investor' ? 'pro' : tier
    const normalizedApplicable = promo.applicable_tier === 'collector' || promo.applicable_tier === 'investor' ? 'pro' : promo.applicable_tier
    if (normalizedApplicable !== 'any' && normalizedTier && normalizedTier !== 'free' && normalizedApplicable !== normalizedTier) {
      return res.status(400).json({ error: 'Code not found' })
    }

    const { data: existing } = await admin.from('promo_redemptions').select('id').eq('promo_code_id', promo.id).eq('user_id', user.id).maybeSingle()
    if (existing) return res.status(400).json({ error: 'Code already used' })

    const discountApplied =
      promo.type === 'lifetime_free' ? 'Lifetime membership free' :
      promo.type === 'free_months' ? `${Number(promo.value ?? 0)} months free` :
      promo.type === 'percent_off' ? (Number(promo.value ?? 0) >= 100 ? 'First month free' : `${Number(promo.value ?? 0)}% off`) :
      promo.type === 'fixed_off' ? `$${Number(promo.value ?? 0)} off` :
      promo.code

    const { error: redeemErr } = await admin.from('promo_redemptions').insert({
      promo_code_id: promo.id,
      user_id: user.id,
      discount_applied: discountApplied,
    })
    if (redeemErr) {
      if (redeemErr.code === '23505') return res.status(400).json({ error: 'Code already used' })
      return res.status(500).json({ error: redeemErr.message })
    }

    await admin.from('promo_codes').update({ uses_count: promo.uses_count + 1 }).eq('id', promo.id)

    const userUpdate: Record<string, unknown> = { promo_code_used: promo.code }
    if (promo.type === 'lifetime_free') {
      userUpdate.subscription_tier = 'lifetime'
      userUpdate.subscription_status = 'active'
      userUpdate.lifetime_access = true
      userUpdate.subscription_id = null
      userUpdate.current_period_end = null
    }
    const { error: upErr } = await admin.from('users').update(userUpdate).eq('id', user.id)
    if (upErr) return res.status(500).json({ error: upErr.message })

    const message =
      promo.type === 'lifetime_free' ? 'Lifetime access applied!' :
      promo.type === 'free_months' ? `${Number(promo.value ?? 0)} months free applied!` :
      promo.type === 'percent_off' ? (Number(promo.value ?? 0) >= 100 ? 'First month free applied!' : `${Number(promo.value ?? 0)}% discount applied!`) :
      promo.type === 'fixed_off' ? `$${Number(promo.value ?? 0)} off applied!` :
      'Promo applied!'
    return res.status(200).json({ ok: true, message, discount_applied: discountApplied, code: promo.code })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Promo redeem failed'
    console.error('[promo-redeem]', e)
    safeJson500(res, message)
  }
}
