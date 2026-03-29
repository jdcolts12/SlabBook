/** Mirrors server `api/lib/userTier` for client-side gating. */

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

export type EffectiveTier = 'free' | 'collector' | 'investor' | 'lifetime'

function statusActive (status: string | null): boolean {
  const s = (status ?? '').toLowerCase()
  return s === 'active' || s === 'trialing'
}

export function effectiveTier (row: UserPlanFields | null): EffectiveTier {
  if (!row) return 'free'
  const t = (row.subscription_tier ?? 'free').toLowerCase()
  if (row.lifetime_access || t === 'lifetime') return 'lifetime'
  if (t === 'investor' && (statusActive(row.subscription_status) || row.subscription_ends_at == null)) {
    return 'investor'
  }
  if (t === 'collector') {
    if (statusActive(row.subscription_status)) return 'collector'
    if (row.trial_ends_at && new Date(row.trial_ends_at).getTime() > Date.now()) return 'collector'
  }
  if (t === 'investor' && row.trial_ends_at && new Date(row.trial_ends_at).getTime() > Date.now()) {
    return 'investor'
  }
  if (t === 'free') return 'free'
  return 'free'
}

export function maxCardsForUser (row: UserPlanFields | null): number {
  const tier = effectiveTier(row)
  switch (tier) {
    case 'free':
      return 15
    case 'collector':
      return 500
    default:
      return Number.POSITIVE_INFINITY
  }
}

export function canUseAiInsights (row: UserPlanFields | null): boolean {
  const tier = effectiveTier(row)
  return tier === 'collector' || tier === 'investor' || tier === 'lifetime'
}

export function canUseMarketValuesTab (row: UserPlanFields | null): boolean {
  const tier = effectiveTier(row)
  return tier === 'collector' || tier === 'investor' || tier === 'lifetime'
}

export function canUsePriceAlerts (row: UserPlanFields | null): boolean {
  const tier = effectiveTier(row)
  return tier === 'collector' || tier === 'investor' || tier === 'lifetime'
}

export function canUseTaxExport (row: UserPlanFields | null): boolean {
  const tier = effectiveTier(row)
  return tier === 'investor' || tier === 'lifetime'
}
