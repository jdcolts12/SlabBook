import type { SupabaseClient } from '@supabase/supabase-js'

/** Row subset from public.users for plan checks */
export type UserPlanRow = {
  subscription_tier: string | null
  subscription_status: string | null
  lifetime_access: boolean | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
}

export type PlanFeature =
  | 'ai_insights'
  | 'market_values'
  | 'identify_card'
  | 'price_alerts'
  | 'weekly_digest'
  | 'tax_export'

export async function fetchUserPlan (
  admin: SupabaseClient,
  userId: string,
): Promise<UserPlanRow | null> {
  const { data, error } = await admin
    .from('users')
    .select('subscription_tier, subscription_status, lifetime_access, trial_ends_at, subscription_ends_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as UserPlanRow
}

function statusActive (status: string | null): boolean {
  const s = (status ?? '').toLowerCase()
  return s === 'active' || s === 'trialing'
}

/** Effective paid tier for feature gating (matches client tierLimits). */
export function effectiveTier (row: UserPlanRow | null): 'free' | 'pro' | 'lifetime' {
  if (!row) return 'free'
  const t = (row.subscription_tier ?? 'free').toLowerCase()
  if (row.lifetime_access || t === 'lifetime') return 'lifetime'
  if (t === 'pro' || t === 'collector' || t === 'investor') {
    if (statusActive(row.subscription_status)) return 'pro'
    if (row.trial_ends_at && new Date(row.trial_ends_at).getTime() > Date.now()) return 'pro'
  }
  if (t === 'free') return 'free'
  return 'free'
}

export function maxCardsForTier (tier: ReturnType<typeof effectiveTier>): number {
  switch (tier) {
    case 'free':
      return 15
    default:
      return Number.POSITIVE_INFINITY
  }
}

export function canUseFeature (row: UserPlanRow | null, feature: PlanFeature): boolean {
  const tier = effectiveTier(row)
  if (tier === 'lifetime' || tier === 'pro') {
    return true
  }
  switch (feature) {
    case 'ai_insights':
    case 'market_values':
    case 'identify_card':
    case 'price_alerts':
    case 'weekly_digest':
    case 'tax_export':
      return false
    default:
      return false
  }
}
