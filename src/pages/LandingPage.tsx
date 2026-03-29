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

type ShowcaseSlab = {
  player: string
  setName: string
  cardNo: string
  company: 'PSA' | 'BGS'
  grade: string
  value: string
  /** Tailwind classes for the card-face gradient */
  face: string
  nameOnCard: string
}

const SHOWCASE_SLABS: ShowcaseSlab[] = [
  {
    player: 'Michael Jordan',
    setName: '1986 Fleer',
    cardNo: '#57',
    company: 'PSA',
    grade: '9',
    value: '$18,500',
    face: 'from-[#6B0F15] via-[#1a0a0c] to-[#0d0d12]',
    nameOnCard: 'MICHAEL·JORDAN',
  },
  {
    player: 'Tom Brady',
    setName: '2000 Bowman Chrome',
    cardNo: '#236',
    company: 'BGS',
    grade: '9',
    value: '$6,200',
    face: 'from-[#0c1929] via-[#1a2740] to-[#0a1628]',
    nameOnCard: 'TOM·BRADY',
  },
  {
    player: 'Shohei Ohtani',
    setName: '2018 Topps Chrome',
    cardNo: '#150',
    company: 'PSA',
    grade: '10',
    value: '$3,950',
    face: 'from-[#7f1d1d] via-[#1c1917] to-[#0c0a09]',
    nameOnCard: 'SHOHEI·OHTANI',
  },
]

const HOW_STEPS: { title: string; detail: string; icon: string }[] = [
  {
    title: 'Add cards',
    detail:
      'Upload front and back photos—or tap auto-identify and let AI read the slab. You review every field before it is saved.',
    icon: '📷',
  },
  {
    title: 'See your binder',
    detail:
      'Flip between a photo grid and a sortable table. Open any card full screen, front or back, like flipping through a real collection.',
    icon: '🗂️',
  },
  {
    title: 'Live market values',
    detail:
      'Estimates refresh from real eBay sold comps. Know what similar cards actually sold for—not a random guess.',
    icon: '📈',
  },
  {
    title: 'AI portfolio insights',
    detail:
      'Claude looks at your whole collection—grades, cost basis, and trends—and surfaces ideas worth a second look.',
    icon: '✨',
  },
  {
    title: 'Buy & sell smarter',
    detail:
      'Track gain or loss vs what you paid. Use the full picture—photos, values, and insights—when you decide to move a card.',
    icon: '🎯',
  },
]

function LandingCollectionMockup () {
  return (
    <div className="relative rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4 shadow-2xl shadow-black/50 sm:p-5">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slab-teal-light">Your collection</p>
          <p className="text-[11px] text-[var(--slab-text-muted)]">Slabs with photos · live estimates</p>
        </div>
        <div className="rounded-full bg-slab-teal/15 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-slab-teal-light">
          +$1,248 <span className="font-normal opacity-80">est. week</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {SHOWCASE_SLABS.map((c) => (
          <div key={c.player} className="flex flex-col items-center">
            <div className="relative w-full max-w-[112px] sm:max-w-[128px]">
              {/* Frosted slab holder */}
              <div className="rounded-lg bg-gradient-to-b from-zinc-400/25 via-zinc-500/10 to-zinc-600/20 p-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-white/5">
                <div className="rounded-[6px] bg-zinc-950/95 p-1 sm:p-1.5">
                  {/* Grading label strip */}
                  <div
                    className={[
                      'mb-1 flex items-center justify-between rounded px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider sm:text-[8px]',
                      c.company === 'PSA'
                        ? 'bg-[#c41e1e] text-white shadow-sm shadow-red-900/50'
                        : 'bg-gradient-to-r from-zinc-900 to-black text-amber-100 ring-1 ring-amber-600/40',
                    ].join(' ')}
                  >
                    <span>{c.company}</span>
                    <span className="tabular-nums">{c.grade}</span>
                  </div>

                  {/* Card face — trading card proportions */}
                  <div
                    className={[
                      'relative aspect-[2.5/3.5] overflow-hidden rounded-sm border border-white/[0.12] shadow-inner shadow-black/60',
                      'bg-gradient-to-br',
                      c.face,
                    ].join(' ')}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.15)_0%,transparent_45%,transparent_60%,rgba(255,255,255,0.06)_100%)]"
                      aria-hidden
                    />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent" aria-hidden />

                    <div className="absolute inset-x-1 top-2 text-center sm:inset-x-1.5 sm:top-2.5">
                      <p className="text-[5px] font-bold uppercase tracking-[0.2em] text-white/55 sm:text-[6px]">
                        {c.setName}
                      </p>
                    </div>

                    <div className="absolute inset-x-1 bottom-5 flex flex-col items-center justify-end text-center sm:bottom-6">
                      <p className="max-w-full truncate text-[6px] font-black uppercase leading-tight tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-[7px]">
                        {c.nameOnCard}
                      </p>
                      <p className="mt-0.5 text-[5px] font-semibold tabular-nums text-white/70 sm:text-[6px]">{c.cardNo}</p>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-[18%] bg-gradient-to-t from-black/75 to-transparent" aria-hidden />
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-2.5 w-full truncate text-center text-[10px] font-semibold text-zinc-100 sm:text-[11px]">{c.player}</p>
            <p className="w-full truncate text-center text-[9px] text-zinc-500">{c.setName}</p>
            <p className="mt-1 text-center text-[11px] font-bold tabular-nums text-slab-teal-light sm:text-xs">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-3 sm:p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slab-teal-light/90">AI insight</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--slab-text)] sm:text-[13px]">
          Jordan and Brady estimates ticked up this week. Ohtani shows strong sold volume—worth watching if you are
          trimming or doubling down.
        </p>
      </div>
    </div>
  )
}

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
            <LandingCollectionMockup />
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
        <section
          id="how"
          ref={howRef}
          className="scroll-mt-24 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/35 px-6 py-20 sm:px-10"
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--slab-text)] sm:text-4xl">
              How SlabBook works
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--slab-text-muted)] sm:text-lg">
              Five steps from your first photo to a portfolio you can actually use—no spreadsheet required.
            </p>
          </div>

          <div className="relative mx-auto mt-14 max-w-3xl">
            <div
              className="pointer-events-none absolute left-[22px] top-10 bottom-10 w-px bg-gradient-to-b from-slab-teal/45 via-slab-teal/20 to-slab-teal/5 sm:left-[26px]"
              aria-hidden
            />
            <ol className="relative list-none pl-0">
              {HOW_STEPS.map((step, i) => (
                <li key={step.title} className="relative flex gap-5 pb-12 last:pb-0 sm:gap-8">
                  <div className="relative z-[1] flex w-11 shrink-0 justify-center sm:w-[52px]">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slab-teal/30 bg-[var(--color-surface)] text-lg shadow-md shadow-black/25 ring-2 ring-[var(--color-surface)] sm:h-[52px] sm:w-[52px] sm:text-xl"
                      aria-hidden
                    >
                      {step.icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="rounded-md bg-slab-teal/15 px-2 py-0.5 text-[11px] font-bold tabular-nums uppercase tracking-wide text-slab-teal-light">
                        Step {i + 1}
                      </span>
                      <h3 className="text-lg font-semibold text-[var(--slab-text)] sm:text-xl">{step.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--slab-text-muted)] sm:text-[15px] sm:leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
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
