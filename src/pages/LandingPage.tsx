import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MarketingFooter } from '../components/marketing/MarketingFooter'
import { MarketingNav } from '../components/marketing/MarketingNav'
import { PricingSection, type TierId } from '../components/marketing/PricingSection'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

const FAQ = [
  {
    q: 'Where does the pricing data come from?',
    a: 'We pull real sold listing data directly from eBay — the same prices collectors actually pay.',
  },
  {
    q: 'What sports and cards are supported?',
    a: 'NFL, NBA, MLB, and NHL cards. Raw and graded (PSA, BGS, SGC, CGC).',
  },
  {
    q: 'Can I add photos of my cards?',
    a: 'Yes. Upload front and back images (or use your phone camera), optional on every card. Your binder and tables show real thumbnails; tap to view full size.',
  },
  {
    q: 'What is auto-identify?',
    a: 'Point Claude at a front photo and it reads the card — player, year, set, number, grade, sport — so you spend less time typing. You always review before saving.',
  },
  {
    q: 'How does the AI know about my collection?',
    a: 'Claude analyzes your actual cards, grades, purchase prices, and current market values to give personalized advice.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Your collection data is private to your account and never shared.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts, cancel anytime from your account settings.',
  },
]

export function LandingPage () {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const howRef = useRef<HTMLElement>(null)
  const [promoCode, setPromoCode] = useState('')
  const [selectedTier, setSelectedTier] = useState<TierId>('collector')

  useEffect(() => {
    document.title = 'SlabBook — Photos, AI identify & live card values'
  }, [])

  useEffect(() => {
    if (!loading && user && isSupabaseConfigured) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, loading, navigate])

  function scrollToHow () {
    howRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[var(--color-surface)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(29,158,117,0.14),transparent)]"
        aria-hidden
      />

      <MarketingNav />

      <main>
        {/* Hero */}
        <section className="relative px-6 pb-20 pt-10 sm:px-10 lg:pt-16">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-[var(--slab-text)] sm:text-5xl">
                Your Card Collection. Tracked. Valued. Intelligent.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-[var(--slab-text-muted)]">
                Track your slabs with photos, a binder-style grid or sortable table, and AI that estimates value from
                live eBay comps. Snap a card — optional auto-identify fills the details — then get portfolio insights
                that help you buy and sell smarter.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-xl bg-slab-teal px-8 py-3.5 text-base font-semibold text-zinc-950 shadow-lg shadow-slab-teal/15 transition hover:bg-slab-teal-light"
                >
                  Start Free
                </Link>
                <button
                  type="button"
                  onClick={scrollToHow}
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-8 py-3.5 text-base font-medium text-[var(--slab-text)] transition hover:border-slab-teal/40"
                >
                  See How It Works
                </button>
              </div>
            </div>
            {/* Mockup */}
            <div className="relative rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4 shadow-2xl shadow-black/50">
              <div className="mb-3 flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slab-teal-light">Collection</p>
                  <p className="text-[11px] text-[var(--slab-text-muted)]">Photos · grid or table · live values</p>
                </div>
                <div className="rounded-full bg-slab-teal/15 px-2 py-1 text-[10px] font-medium text-slab-teal-light">+$1,248</div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'Michael Jordan', set: '1986 Fleer', grade: 'PSA 9', value: '$18,500', sport: '🏀' },
                  { name: 'Tom Brady', set: '2000 Bowman', grade: 'BGS 9', value: '$6,200', sport: '🏈' },
                  { name: 'Shohei Ohtani', set: '2018 Topps', grade: 'PSA 10', value: '$3,950', sport: '⚾' },
                ].map((card) => (
                  <div
                    key={card.name}
                    className="rounded-xl border border-slab-teal/30 bg-[linear-gradient(180deg,#1A1F27_0%,#101318_100%)] p-2.5 shadow-lg shadow-black/30"
                  >
                    <div className="relative aspect-[5/7] max-h-[72px] overflow-hidden rounded-md border border-zinc-700/70 bg-gradient-to-br from-zinc-800 to-zinc-950">
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                        <span className="text-lg opacity-80" aria-hidden>
                          {card.sport}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-tight text-zinc-400">Photo</span>
                      </div>
                    </div>
                    <p className="mt-2 truncate text-[10px] font-semibold text-zinc-100">{card.name}</p>
                    <p className="truncate text-[9px] text-zinc-500">{card.set}</p>
                    <div className="mt-1.5 rounded-md bg-slab-teal/15 px-1.5 py-0.5 text-[9px] text-slab-teal-light">
                      {card.grade}
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-white">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-3">
                <p className="text-xs text-[var(--slab-text-muted)]">AI Insight</p>
                <p className="mt-1 text-xs text-[var(--slab-text)]">
                  Jordan + Brady are up 6.2% this week. Ohtani volume is rising with strong sold comps.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="border-y border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/50 px-6 py-8 sm:px-10">
          <p className="text-center text-sm font-medium text-[var(--slab-text-muted)]">
            NFL · NBA · MLB · NHL — photos, binder grid, and AI in one place
          </p>
          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-3 text-center text-sm text-[var(--slab-text)] sm:gap-x-8">
            <span>Card photos</span>
            <span className="hidden text-[var(--slab-border)] sm:inline">|</span>
            <span>Auto-identify</span>
            <span className="hidden text-[var(--slab-border)] sm:inline">|</span>
            <span>Live eBay comps</span>
            <span className="hidden text-[var(--slab-border)] sm:inline">|</span>
            <span>AI insights</span>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 px-6 py-20 sm:px-10">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-[var(--slab-text)]">Features</h2>
          <div className="mx-auto mt-12 grid max-w-6xl gap-8 md:grid-cols-3">
            {[
              {
                icon: '📊',
                title: 'Portfolio Tracking',
                body: 'Every card. Every grade. Your total collection value at a glance. Raw cards, PSA, BGS, SGC — all in one place.',
              },
              {
                icon: '💰',
                title: 'Live eBay Pricing',
                body: 'Real sold listing data automatically updates what your cards are actually worth today. No more guessing.',
              },
              {
                icon: '🤖',
                title: 'AI Insights',
                body: 'Claude AI analyzes your collection and tells you what to hold, what to sell, and what\'s quietly gaining value.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-6"
              >
                <span className="text-2xl" aria-hidden>
                  {f.icon}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-[var(--slab-text)]">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--slab-text-muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" ref={howRef} className="scroll-mt-24 border-t border-[var(--color-border-subtle)] px-6 py-20 sm:px-10">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-[var(--slab-text)]">How it works</h2>
          <ol className="mx-auto mt-12 grid max-w-3xl gap-8">
            {[
              'Add cards with photos — or use auto-identify from a front picture to pre-fill details',
              'Organize in grid or table; optional back photos and full-size viewer',
              'SlabBook refreshes values using live eBay sold comps',
              'AI analyzes your portfolio and surfaces insights',
              'Make smarter buy and sell decisions',
            ].map((step, i) => (
              <li key={step} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slab-teal/20 text-sm font-bold text-slab-teal-light">
                  {i + 1}
                </span>
                <p className="pt-1.5 text-[var(--slab-text)]">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <PricingSection
          selectedTier={selectedTier}
          onSelectTier={setSelectedTier}
          promoCode={promoCode}
          onPromoChange={setPromoCode}
        />

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 border-t border-[var(--color-border-subtle)] px-6 py-20 sm:px-10">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-[var(--slab-text)]">FAQ</h2>
          <div className="mx-auto mt-10 max-w-2xl space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="font-medium text-[var(--slab-text)]">Q: {item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--slab-text-muted)]">A: {item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
