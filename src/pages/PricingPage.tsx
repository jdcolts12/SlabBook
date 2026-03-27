import { useEffect, useState } from 'react'
import { MarketingFooter } from '../components/marketing/MarketingFooter'
import { MarketingNav } from '../components/marketing/MarketingNav'
import { PricingSection, type TierId } from '../components/marketing/PricingSection'

export function PricingPage () {
  const [promoCode, setPromoCode] = useState('')
  const [selectedTier, setSelectedTier] = useState<TierId>('collector')

  useEffect(() => {
    document.title = 'Pricing — SlabBook'
  }, [])

  return (
    <div className="min-h-dvh bg-[var(--color-surface)]">
      <MarketingNav />
      <PricingSection
        selectedTier={selectedTier}
        onSelectTier={setSelectedTier}
        promoCode={promoCode}
        onPromoChange={setPromoCode}
        checkoutLabel="Sign up to lock in your plan — promo codes apply at registration."
      />
      <MarketingFooter />
    </div>
  )
}
