/** Mirrors server `server/userTier` for client-side gating. */

export type UserPlanFields = {
  subscription_tier: string | null
  subscription_status: string | null
  lifetime_access: boolean | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
  stripe_customer_id?: string | null
  subscription_id?: string | null
  current_period_end?: string | null
  promo_code_used?: string | null
}

/** free · paid Pro subscription · lifetime (incl. Founding $49) */
export type EffectiveTier = 'free' | 'pro' | 'lifetime'

function statusActive (status: string | null): boolean {
  const s = (status ?? '').toLowerCase()
  return s === 'active' || s === 'trialing'
}

/** Map legacy DB values to effective tier. */
export function effectiveTier (row: UserPlanFields | null): EffectiveTier {
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

/** Sidebar / settings: human label for the current plan. */
export function planDisplayLabel (row: UserPlanFields | null): string {
  if (!row) return 'Free'
  if (row.lifetime_access && effectiveTier(row) === 'lifetime') {
    return 'Founding Member'
  }
  const e = effectiveTier(row)
  if (e === 'lifetime') return 'Pro (lifetime)'
  if (e === 'pro') return 'Pro'
  return 'Free'
}

export function maxCardsForUser (row: UserPlanFields | null): number {
  const tier = effectiveTier(row)
  if (tier === 'free') return 15
  return Number.POSITIVE_INFINITY
}

export function canUseAiInsights (row: UserPlanFields | null): boolean {
  const tier = effectiveTier(row)
  return tier === 'pro' || tier === 'lifetime'
}

export function canUseMarketValuesTab (row: UserPlanFields | null): boolean {
  const tier = effectiveTier(row)
  return tier === 'pro' || tier === 'lifetime'
}

export function canUsePriceAlerts (row: UserPlanFields | null): boolean {
  const tier = effectiveTier(row)
  return tier === 'pro' || tier === 'lifetime'
}

export function canUseTaxExport (row: UserPlanFields | null): boolean {
  const tier = effectiveTier(row)
  return tier === 'pro' || tier === 'lifetime'
}
