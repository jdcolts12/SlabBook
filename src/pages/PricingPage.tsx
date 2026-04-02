import { useEffect, useState } from 'react'
import { MarketingFooter } from '../components/marketing/MarketingFooter'
import { MarketingNav } from '../components/marketing/MarketingNav'
import { PricingSection, type TierId } from '../components/marketing/PricingSection'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { effectiveTier } from '../lib/tierLimits'

export function PricingPage () {
  const { user, session } = useAuth()
  const { profile } = useUserProfile(user?.id)
  const [promoCode, setPromoCode] = useState('')
  const [selectedTier, setSelectedTier] = useState<TierId>('pro')

  useEffect(() => {
    document.title = 'Pricing — SlabBook'
  }, [])

  return (
    <div className="min-h-dvh min-w-0 overflow-x-clip bg-[var(--color-surface)]">
      <MarketingNav />
      <PricingSection
        selectedTier={selectedTier}
        onSelectTier={setSelectedTier}
        promoCode={promoCode}
        onPromoChange={setPromoCode}
        ctaBasePath={user ? '/dashboard' : '/signup'}
        accessToken={session?.access_token ?? null}
        currentEffectiveTier={effectiveTier(profile)}
        checkoutLabel={
          user
            ? 'Already signed in? Apply promo codes directly to your account from this page.'
            : 'Sign up to lock in your plan — promo codes apply at registration.'
        }
      />
      <MarketingFooter />
    </div>
  )
}
