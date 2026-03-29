import type { SupabaseClient } from '@supabase/supabase-js'
import type { PromoCodeRow } from './promo'
import { discountHumanLabel } from './promo'
import { normalizePromoCode } from './promo'

/**
 * Record promo redemption after successful Stripe checkout (webhook).
 * No-op if code empty or already redeemed.
 */
export async function redeemPromoAfterCheckout (
  admin: SupabaseClient,
  userId: string,
  rawCode: string,
): Promise<void> {
  const code = normalizePromoCode(rawCode)
  if (!code) return

  const { data: row, error } = await admin.from('promo_codes').select('*').eq('code', code).maybeSingle()
  if (error || !row) return

  const promo = row as PromoCodeRow

  const { data: existing } = await admin
    .from('promo_redemptions')
    .select('id')
    .eq('promo_code_id', promo.id)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return

  const discount_applied = discountHumanLabel(promo)
  const { error: insErr } = await admin.from('promo_redemptions').insert({
    promo_code_id: promo.id,
    user_id: userId,
    discount_applied,
  })
  if (insErr) {
    if (insErr.code === '23505') return
    console.warn('[SlabBook] promo redemption insert failed', insErr.message)
    return
  }
  await admin
    .from('promo_codes')
    .update({ uses_count: promo.uses_count + 1 })
    .eq('id', promo.id)

  await admin.from('users').update({ promo_code_used: promo.code }).eq('id', userId)
}
