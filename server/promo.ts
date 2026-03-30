import type { SupabaseClient } from '@supabase/supabase-js'

export type PromoCodeRow = {
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

export function normalizePromoCode (raw: string): string {
  return raw.trim().toUpperCase()
}

/** Maps legacy DB tiers and request keys to canonical promo keys. */
export function normalizePromoTierKey (raw: string): string {
  const x = raw.trim().toLowerCase()
  if (x === 'collector' || x === 'investor') return 'pro'
  return x
}

export function discountSuccessMessage (row: PromoCodeRow): string {
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

export function discountHumanLabel (row: PromoCodeRow): string {
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

export type ValidateResult =
  | {
      valid: true
      discount_type: string
      discount_value: number | null
      message: string
      promo_code_id: string
    }
  | { valid: false; error: string }

export async function validatePromoCode (
  admin: SupabaseClient,
  rawCode: string,
  opts: { tier?: string; userId?: string | null },
): Promise<ValidateResult> {
  const code = normalizePromoCode(rawCode)
  if (!code) {
    return { valid: false, error: 'Code not found' }
  }

  const { data: row, error } = await admin
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle()

  if (error || !row) {
    return { valid: false, error: 'Code not found' }
  }

  const promo = row as PromoCodeRow

  if (!promo.is_active) {
    return { valid: false, error: 'Code expired' }
  }

  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
    return { valid: false, error: 'Code expired' }
  }

  if (promo.max_uses != null && promo.uses_count >= promo.max_uses) {
    return { valid: false, error: 'Code expired' }
  }

  const tier = opts.tier
  if (promo.applicable_tier !== 'any' && tier && tier !== 'free') {
    const want = normalizePromoTierKey(promo.applicable_tier)
    const got = normalizePromoTierKey(tier)
    if (want !== got) {
      return { valid: false, error: 'Code not found' }
    }
  }

  if (opts.userId) {
    const { data: existing } = await admin
      .from('promo_redemptions')
      .select('id')
      .eq('promo_code_id', promo.id)
      .eq('user_id', opts.userId)
      .maybeSingle()

    if (existing) {
      return { valid: false, error: 'Code already used' }
    }
  }

  return {
    valid: true,
    discount_type: promo.type,
    discount_value: promo.value,
    message: discountSuccessMessage(promo),
    promo_code_id: promo.id,
  }
}

export function buildUserUpdateFromPromo (row: PromoCodeRow, now = new Date()): Record<string, unknown> {
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
        subscription_tier: 'pro',
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
          subscription_tier: 'pro',
          trial_ends_at: end.toISOString(),
          promo_code_used: row.code,
        }
      }
      if (row.applicable_tier === 'lifetime') {
        return {
          subscription_tier: 'pro',
          subscription_ends_at: null,
          trial_ends_at: null,
          promo_code_used: row.code,
        }
      }
      return {
        subscription_tier: 'pro',
        promo_code_used: row.code,
      }
    }
    case 'fixed_off':
      return { promo_code_used: row.code }
    default:
      return { promo_code_used: row.code }
  }
}
