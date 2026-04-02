import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PromoCodeInput } from '../promo/PromoCodeInput'
import { validatePromoRequest, type ValidatePromoResponse } from '../../lib/promoApi'
import { createCheckoutSession } from '../../lib/stripeApi'
import { type EffectiveTier } from '../../lib/tierLimits'

export type TierId = 'free' | 'pro'

type Props = {
  selectedTier: TierId
  onSelectTier: (t: TierId) => void
  promoCode: string
  onPromoChange: (v: string) => void
  showFoundingBanner?: boolean
  checkoutLabel?: string
  ctaBasePath?: '/signup' | '/dashboard'
  /** When set with accessToken, paid tiers use Stripe Checkout instead of signup links. */
  accessToken?: string | null
  /** Effective plan for logged-in users (badges + “Current plan”). */
  currentEffectiveTier?: EffectiveTier | null
}

const TIERS: {
  id: TierId
  name: string
  price: number
  period: string
  highlight?: boolean
  features: string[]
  cta: string
}[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'mo',
    features: [
      'Up to 15 cards',
      'Basic portfolio dashboard',
      'Manual value updates',
      'Upgrade prompts when you hit limits',
    ],
    cta: 'Sign Up Free',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 5,
    period: 'mo',
    highlight: true,
    features: [
      'Unlimited cards',
      'AI photo identification',
      'AI price estimates (incl. web search)',
      'Daily AI portfolio insights',
      'Price alerts',
      'Market values tab',
      'Trade analyzer',
      'Tax export',
      'Community feed (coming soon)',
    ],
    cta: 'Get Pro',
  },
]

function formatMoney (n: number): string {
  return n.toFixed(n % 1 === 0 ? 0 : 2)
}

function displayPrice (
  base: number,
  meta: ValidatePromoResponse | null,
): { display: number; strikethrough?: number } {
  if (base === 0) return { display: 0 }
  if (!meta || !('valid' in meta) || !meta.valid) return { display: base }
  if (meta.discount_type === 'percent_off' && meta.discount_value != null) {
    const d = Number(meta.discount_value)
    return {
      display: Math.max(0, base * (1 - d / 100)),
      strikethrough: base,
    }
  }
  if (meta.discount_type === 'free_months' || meta.discount_type === 'lifetime_free') {
    return { display: 0, strikethrough: base }
  }
  return { display: base }
}

/** Promo validation tier key (matches server `normalizePromoTierKey`). */
function tierForValidation (t: TierId): string {
  if (t === 'pro') return 'pro'
  return 'free'
}

function buildCtaHref (tier: TierId, promoCode: string, ctaBasePath: '/signup' | '/dashboard'): string {
  const params = new URLSearchParams()
  params.set('tier', tier === 'pro' ? 'pro' : 'free')
  const promo = promoCode.trim()
  if (promo) params.set('promo', promo.toUpperCase())
  if (ctaBasePath === '/dashboard') {
    return `/dashboard?${params.toString()}#promo-upgrade`
  }
  return `/signup?${params.toString()}`
}

function buildFoundingSignupHref (promoCode: string, ctaBasePath: '/signup' | '/dashboard'): string {
  const params = new URLSearchParams()
  params.set('tier', 'founding')
  const promo = promoCode.trim()
  if (promo) params.set('promo', promo.toUpperCase())
  if (ctaBasePath === '/dashboard') {
    return `/dashboard?${params.toString()}#promo-upgrade`
  }
  return `/signup?${params.toString()}`
}

function isCurrentTier (tier: TierId, eff: EffectiveTier | null | undefined): boolean {
  if (eff == null) return false
  if (eff === 'free' && tier === 'free') return true
  if (eff === 'pro' && tier === 'pro') return true
  return false
}

export function PricingSection ({
  selectedTier,
  onSelectTier,
  promoCode,
  onPromoChange,
  showFoundingBanner = true,
  checkoutLabel = 'Pick a plan above — you can apply a promo code before checkout.',
  ctaBasePath = '/signup',
  accessToken = null,
  currentEffectiveTier = null,
}: Props) {
  const [promoMeta, setPromoMeta] = useState<ValidatePromoResponse | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [foundingLoading, setFoundingLoading] = useState(false)
  const tierKey = tierForValidation(selectedTier)
  const loggedInStripe = Boolean(accessToken)

  useEffect(() => {
    const trimmed = promoCode.trim()
    if (!trimmed) {
      const clear = window.setTimeout(() => setPromoMeta(null), 0)
      return () => clearTimeout(clear)
    }
    const t = setTimeout(() => {
      void (async () => {
        const res = await validatePromoRequest(trimmed, { tier: tierKey })
        if (promoCode.trim() !== trimmed) return
        setPromoMeta(res)
      })()
    }, 500)
    return () => clearTimeout(t)
  }, [promoCode, tierKey])

  async function startCheckout (tier: 'pro' | 'founding') {
    if (!accessToken) return
    setCheckoutLoading(tier)
    setFoundingLoading(tier === 'founding')
    try {
      const url = await createCheckoutSession(accessToken, tier, promoCode)
      window.location.href = url
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Checkout failed.')
    } finally {
      setCheckoutLoading(null)
      setFoundingLoading(false)
    }
  }

  const lifetimeActive = currentEffectiveTier === 'lifetime'

  return (
    <section id="pricing" className="scroll-mt-24 px-3 py-16 sm:px-6 sm:py-20 md:px-10">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-[var(--slab-text)] sm:text-4xl">
          Simple pricing
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[var(--slab-text-muted)]">
          Start free. Move to Pro when you want unlimited cards and full AI.
        </p>

        {showFoundingBanner && (
          <div className="mt-12 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-950/80 to-amber-900/40 p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-amber-100">
                  🏆 Founding Member — limited spots
                </p>
                <p className="mt-2 max-w-xl text-sm font-medium text-amber-50">
                  Lock in Pro access forever for a one-time $49 payment.
                </p>
                <p className="mt-2 max-w-xl text-sm text-amber-200/90">
                  Same as Pro forever: unlimited cards, full AI, alerts, market values, trade tools, and tax export.
                </p>
                <p className="mt-2 text-xs text-amber-200/70">Have a code? Enter it below — it applies before checkout.</p>
              </div>
              {loggedInStripe && accessToken ? (
                lifetimeActive ? (
                  <span className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 px-6 py-3 text-sm font-semibold text-amber-100 sm:w-auto">
                    Founding Member
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={foundingLoading}
                    onClick={() => void startCheckout('founding')}
                    className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center rounded-xl bg-amber-400 px-6 py-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-300 disabled:opacity-50 sm:w-auto sm:min-h-0"
                  >
                    {foundingLoading ? 'Redirecting…' : 'Claim Founding — $49'}
                  </button>
                )
              ) : (
                <Link
                  to={buildFoundingSignupHref(promoCode, ctaBasePath)}
                  className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center rounded-xl bg-amber-400 px-6 py-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-300 sm:w-auto sm:min-h-0"
                >
                  Claim Founding — $49
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="mt-10">
          <label htmlFor="tier-promo" className="mx-auto block max-w-md text-center text-xs font-medium text-[var(--slab-text-muted)]">
            Have a promo code? Apply it here (validates in real time)
          </label>
          <div className="mx-auto mt-2 max-w-md">
            <PromoCodeInput
              id="tier-promo"
              value={promoCode}
              onChange={onPromoChange}
              tier={tierKey}
              placeholder="CODE"
            />
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:max-w-4xl lg:mx-auto">
          {TIERS.map((t) => {
            const active = selectedTier === t.id
            const priced = displayPrice(t.price, promoMeta)
            const current = isCurrentTier(t.id, currentEffectiveTier)
            const showStripeCta = loggedInStripe && accessToken && t.id !== 'free'

            return (
              <div
                key={t.id}
                onClick={() => onSelectTier(t.id)}
                className={[
                  'rounded-2xl border p-6 text-left transition',
                  t.highlight
                    ? 'border-slab-teal/50 bg-slab-teal/5 ring-2 ring-slab-teal/25'
                    : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]',
                  active ? 'ring-2 ring-slab-teal/60' : 'hover:border-slab-teal/30',
                ].join(' ')}
              >
                {t.highlight && (
                  <span className="mb-6 inline-block rounded-full bg-slab-teal/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slab-teal-light">
                    ⭐ Most popular
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-[var(--slab-text)]">{t.name}</h3>
                  {current && (
                    <span className="rounded-full border border-slab-teal/40 bg-slab-teal/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slab-teal-light">
                      Current plan
                    </span>
                  )}
                </div>
                <div className="mt-1 flex min-h-[3rem] flex-wrap items-baseline gap-2">
                  {priced.strikethrough != null && (
                    <span className="text-lg text-[var(--slab-text-muted)] line-through">
                      ${formatMoney(priced.strikethrough)}
                    </span>
                  )}
                  <span className="text-3xl font-bold tabular-nums text-[var(--slab-text)]">
                    ${formatMoney(priced.display)}
                  </span>
                  <span className="text-[var(--slab-text-muted)]">/{t.period}</span>
                </div>
                <ul className="mt-6 space-y-2 text-sm text-[var(--slab-text-muted)]">
                  {t.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                {current && t.id !== 'free' ? (
                  <button
                    type="button"
                    disabled
                    className="mt-8 inline-flex min-h-[48px] w-full cursor-default items-center justify-center rounded-lg border border-slab-teal/40 bg-slab-teal/10 px-4 py-3 text-sm font-semibold text-slab-teal-light sm:w-auto sm:min-h-0 sm:py-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Current plan
                  </button>
                ) : t.id === 'free' ? (
                  loggedInStripe ? (
                    <button
                      type="button"
                      disabled={current}
                      className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 disabled:cursor-default disabled:opacity-80 sm:w-auto sm:min-h-0 sm:py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {current ? 'Current plan' : 'Included on free'}
                    </button>
                  ) : (
                    <Link
                      to={buildCtaHref(t.id, promoCode, ctaBasePath)}
                      className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-slab-teal px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light sm:w-auto sm:min-h-0 sm:py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t.cta}
                    </Link>
                  )
                ) : showStripeCta ? (
                  <button
                    type="button"
                    disabled={checkoutLoading !== null}
                    onClick={(e) => {
                      e.stopPropagation()
                      void startCheckout('pro')
                    }}
                    className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-slab-teal px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50 sm:w-auto sm:min-h-0 sm:py-2.5"
                  >
                    {checkoutLoading === 'pro' ? 'Redirecting…' : t.cta}
                  </button>
                ) : (
                  <Link
                    to={buildCtaHref(t.id, promoCode, ctaBasePath)}
                    className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-slab-teal px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light sm:w-auto sm:min-h-0 sm:py-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t.cta}
                  </Link>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-10 text-center text-sm text-[var(--slab-text-muted)]">{checkoutLabel}</p>
      </div>
    </section>
  )
}
