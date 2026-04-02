import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MarketingFooter } from '../components/marketing/MarketingFooter'
import { MarketingNav } from '../components/marketing/MarketingNav'
import { PricingSection, type TierId } from '../components/marketing/PricingSection'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { effectiveTier } from '../lib/tierLimits'
import { scanCtaSurface } from '../lib/scanCtaStyles'

const FAQ = [
  {
    q: 'Where does the pricing data come from?',
    a: 'We pull real sold listing data directly from eBay — the same prices collectors actually pay.',
  },
  {
    q: 'What sports and cards are supported?',
    a: 'Sports and trading cards: NFL, NBA, MLB, NHL, Soccer, MMA, and any other league you type in — raw and graded (PSA, BGS, SGC, CGC). Pokémon TCG has its own collection area with English and Japanese cards and PSA/CGC-style tracking, kept separate from sports.',
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
  company: 'PSA' | 'BGS' | 'CGC'
  grade: string
  value: string
  /** Tailwind classes for the card-face gradient */
  face: string
  nameOnCard: string
}

const SHOWCASE_SPORTS_SLABS: ShowcaseSlab[] = [
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

const SHOWCASE_POKEMON_SLABS: ShowcaseSlab[] = [
  {
    player: 'Charizard',
    setName: 'Base Set · JP',
    cardNo: '#6',
    company: 'PSA',
    grade: '10',
    value: '$4,200',
    face: 'from-[#b45309] via-[#7c2d12] to-[#1c1917]',
    nameOnCard: 'CHARIZARD',
  },
  {
    player: 'Pikachu',
    setName: 'Celebrations',
    cardNo: '#005',
    company: 'CGC',
    grade: '9.5',
    value: '$185',
    face: 'from-[#ca8a04] via-[#713f12] to-[#1c1917]',
    nameOnCard: 'PIKACHU',
  },
  {
    player: 'Umbreon',
    setName: 'Moonbreon',
    cardNo: '#215/203',
    company: 'PSA',
    grade: '10',
    value: '$920',
    face: 'from-[#312e81] via-[#1e1b4b] to-[#0f172a]',
    nameOnCard: 'UMBREON',
  },
]

type LandingShowcaseSlide = {
  key: string
  title: string
  subtitle: string
  weekMain: string
  weekSub: string
  slabs: ShowcaseSlab[]
  insightTitle: string
  insightBody: string
}

const LANDING_SHOWCASE_SLIDES: LandingShowcaseSlide[] = [
  {
    key: 'sports',
    title: 'Sports cards',
    subtitle: 'Slabs with photos · live estimates',
    weekMain: '+$1,248',
    weekSub: 'est. week',
    slabs: SHOWCASE_SPORTS_SLABS,
    insightTitle: 'AI insight',
    insightBody:
      'Jordan and Brady estimates ticked up this week. Ohtani shows strong sold volume—worth watching if you are trimming or doubling down.',
  },
  {
    key: 'pokemon',
    title: 'Pokémon TCG',
    subtitle: 'English & Japanese · own tab — not mixed with sports',
    weekMain: '+$892',
    weekSub: 'est. week',
    slabs: SHOWCASE_POKEMON_SLABS,
    insightTitle: 'AI insight',
    insightBody:
      'Charizard and Moonbreon slabs are up in recent sales. Pikachu promos are moving fast—good moment to review what you are holding vs flipping.',
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

function companyStripClass (company: ShowcaseSlab['company']): string {
  if (company === 'PSA') {
    return 'bg-[#c41e1e] text-white shadow-sm shadow-red-900/50'
  }
  if (company === 'CGC') {
    return 'bg-gradient-to-r from-[#1e3a5f] to-[#0f2744] text-sky-100 ring-1 ring-sky-500/35'
  }
  return 'bg-gradient-to-r from-zinc-900 to-black text-amber-100 ring-1 ring-amber-600/40'
}

function ShowcaseSlabColumn ({ c }: { c: ShowcaseSlab }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[112px] sm:max-w-[128px]">
        <div className="rounded-lg bg-gradient-to-b from-zinc-400/25 via-zinc-500/10 to-zinc-600/20 p-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-white/5">
          <div className="rounded-[6px] bg-zinc-950/95 p-1 sm:p-1.5">
            <div
              className={[
                'mb-1 flex items-center justify-between rounded px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider sm:text-[8px]',
                companyStripClass(c.company),
              ].join(' ')}
            >
              <span>{c.company}</span>
              <span className="tabular-nums">{c.grade}</span>
            </div>

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
                <p className="text-[5px] font-bold uppercase tracking-[0.2em] text-white/55 sm:text-[6px]">{c.setName}</p>
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
  )
}

const SHOWCASE_AUTO_MS = 4500

function HeroCollectionSlideshow () {
  const [active, setActive] = useState(0)
  const [pause, setPause] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (reduceMotion || pause || LANDING_SHOWCASE_SLIDES.length < 2) return
    const t = window.setInterval(() => {
      setActive((i) => (i + 1) % LANDING_SHOWCASE_SLIDES.length)
    }, SHOWCASE_AUTO_MS)
    return () => window.clearInterval(t)
  }, [reduceMotion, pause])

  const slide = LANDING_SHOWCASE_SLIDES[active]

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Collection preview"
      className="relative rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4 shadow-2xl shadow-black/50 sm:p-5"
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocusCapture={() => setPause(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setPause(false)
      }}
    >
      <p className="sr-only" aria-live={reduceMotion ? 'polite' : 'off'}>
        {slide.title}. {slide.subtitle}
      </p>
      <div className="mb-3 flex flex-col gap-3 border-b border-[var(--color-border-subtle)] pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Your collection</p>
          <div className="relative mt-1 min-h-[2.75rem] sm:min-h-[3rem]">
            <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
              {LANDING_SHOWCASE_SLIDES.map((s, i) => (
                <div
                  key={s.key}
                  className={[
                    i === active ? 'opacity-100' : 'opacity-0',
                    i === active ? 'z-10' : 'z-0 pointer-events-none',
                    reduceMotion ? '' : 'transition-opacity duration-500 ease-out',
                  ].join(' ')}
                  aria-hidden={i !== active}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slab-teal-light">{s.title}</p>
                  <p className="text-[11px] text-[var(--slab-text-muted)]">{s.subtitle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <div className="self-start rounded-full bg-slab-teal/15 px-2.5 py-1.5 text-[10px] font-semibold tabular-nums text-slab-teal-light sm:self-auto sm:py-1">
            {slide.weekMain} <span className="font-normal opacity-80">{slide.weekSub}</span>
          </div>
          <div
            className="flex items-center justify-center gap-1.5 sm:justify-end"
            role="group"
            aria-label="Choose sports or Pokémon preview"
          >
            {LANDING_SHOWCASE_SLIDES.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show ${s.title} preview`}
                aria-pressed={i === active}
                className={[
                  'h-2 rounded-full transition-all duration-300',
                  i === active ? 'w-6 bg-slab-teal' : 'w-2 bg-zinc-600 hover:bg-zinc-500',
                ].join(' ')}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
          {LANDING_SHOWCASE_SLIDES.map((s, i) => (
            <div
              key={s.key}
              className={[
                i === active ? 'opacity-100' : 'opacity-0',
                i === active ? 'relative z-10' : 'z-0 pointer-events-none',
                reduceMotion ? '' : 'transition-opacity duration-500 ease-out',
              ].join(' ')}
              aria-hidden={i !== active}
            >
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                {s.slabs.map((c) => (
                  <ShowcaseSlabColumn key={`${s.key}-${c.player}`} c={c} />
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-3 sm:p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slab-teal-light/90">
                  {s.insightTitle}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--slab-text)] sm:text-[13px]">{s.insightBody}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!reduceMotion && (
        <p className="mt-3 text-center text-[10px] text-zinc-600">Pauses on hover · use dots to switch</p>
      )}
    </div>
  )
}

export function LandingPage () {
  const { user, session } = useAuth()
  const { profile } = useUserProfile(user?.id)
  const howRef = useRef<HTMLElement>(null)
  const [promoCode, setPromoCode] = useState('')
  const [selectedTier, setSelectedTier] = useState<TierId>('pro')

  useEffect(() => {
    document.title = 'SlabBook — Your graded cards, priced with real market data'
  }, [])

  function scrollToHow () {
    howRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="relative min-h-dvh min-w-0 overflow-x-clip bg-[var(--color-surface)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(29,158,117,0.14),transparent)]"
        aria-hidden
      />

      <MarketingNav />

      <main className="min-w-0 overflow-x-clip">
        {/* Hero */}
        <section className="relative px-3 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10 md:px-10 lg:pt-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14">
            <h1 className="text-[1.65rem] font-semibold leading-[1.15] tracking-tight text-[var(--slab-text)] min-[400px]:text-3xl sm:text-4xl sm:leading-tight md:text-5xl lg:col-start-1 lg:row-start-1">
              Your Card Collection. Tracked. Valued. Intelligent.
            </h1>

            <Link
              to={user ? '/dashboard/collection?scan=1' : '/signup'}
              className={[
                'inline-flex min-h-[48px] w-full max-w-md items-center justify-center rounded-xl px-6 py-3.5 text-base lg:hidden',
                scanCtaSurface,
              ].join(' ')}
            >
              Scan &amp; price
            </Link>

            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <HeroCollectionSlideshow />
            </div>

            <div className="flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap lg:col-start-1 lg:row-start-2 lg:mt-0 lg:max-w-none">
              {user ? (
                <>
                  <Link
                    to="/dashboard/collection"
                    className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-slab-teal px-6 py-3.5 text-base font-semibold text-zinc-950 shadow-lg shadow-slab-teal/15 transition hover:bg-slab-teal-light sm:w-auto sm:min-w-[11rem] sm:px-8"
                  >
                    My dashboard
                  </Link>
                  <Link
                    to="/dashboard/collection?scan=1"
                    className={[
                      'hidden min-h-[48px] w-full items-center justify-center rounded-xl px-6 py-3.5 text-base sm:w-auto sm:min-w-[11rem] sm:px-8 lg:inline-flex',
                      scanCtaSurface,
                    ].join(' ')}
                  >
                    Scan & price
                  </Link>
                  <button
                    type="button"
                    onClick={scrollToHow}
                    className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-transparent px-4 py-3 text-base font-medium text-[var(--slab-text-muted)] underline-offset-4 transition hover:text-[var(--slab-text)] hover:underline sm:w-auto sm:min-h-0 sm:px-4"
                  >
                    How it works
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-slab-teal px-6 py-3.5 text-base font-semibold text-zinc-950 shadow-lg shadow-slab-teal/15 transition hover:bg-slab-teal-light sm:w-auto sm:min-w-[12rem] sm:px-8"
                  >
                    Start Free
                  </Link>
                  <button
                    type="button"
                    onClick={scrollToHow}
                    className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-6 py-3.5 text-base font-medium text-[var(--slab-text)] transition hover:border-slab-teal/40 sm:w-auto sm:min-w-[12rem] sm:px-8"
                  >
                    See How It Works
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="border-y border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/50 px-3 py-8 sm:px-6 md:px-10">
          <p className="mx-auto max-w-md text-center text-sm font-medium leading-snug text-[var(--slab-text-muted)] sm:max-w-none">
            NFL · NBA · MLB · NHL · Soccer · MMA · Pokémon TCG — photos, binder grid, and AI in one place
          </p>
          <div className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-2 text-center text-sm text-[var(--slab-text)] sm:mt-6 sm:gap-x-6 sm:gap-y-2">
            {[
              'Card photos',
              'Auto-identify',
              'Live eBay comps',
              'Pokémon tab',
              'AI insights',
            ].map((label) => (
              <span
                key={label}
                className="rounded-lg bg-[var(--color-surface)]/80 px-3 py-2.5 ring-1 ring-[var(--color-border-subtle)] sm:bg-transparent sm:px-0 sm:py-0 sm:ring-0"
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 px-3 py-16 sm:px-6 sm:py-20 md:px-10">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-[var(--slab-text)] sm:text-3xl">Features</h2>
          <div className="mx-auto mt-10 grid max-w-6xl gap-6 sm:mt-12 sm:gap-8 md:grid-cols-3">
            {[
              {
                icon: '📊',
                title: 'Portfolio Tracking',
                body: 'Sports and Pokémon in separate tabs so nothing gets mixed up — plus an “all cards” view when you want totals across both. Every grade, optional photos, value at a glance.',
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
                className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-5 sm:p-6"
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
          className="scroll-mt-24 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/35 px-3 py-16 sm:px-6 sm:py-20 md:px-10"
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--slab-text)] sm:text-3xl md:text-4xl">
              How SlabBook works
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--slab-text-muted)] sm:text-lg">
              Five steps from your first photo to a portfolio you can actually use—no spreadsheet required.
            </p>
          </div>

          <div className="relative mx-auto mt-10 max-w-3xl sm:mt-14">
            <div
              className="pointer-events-none absolute left-[22px] top-10 hidden bottom-10 w-px bg-gradient-to-b from-slab-teal/45 via-slab-teal/20 to-slab-teal/5 sm:left-[26px] sm:block"
              aria-hidden
            />
            <ol className="relative list-none space-y-4 pl-0 sm:space-y-0">
              {HOW_STEPS.map((step, i) => (
                <li key={step.title} className="relative pb-0 last:pb-0 sm:flex sm:gap-8 sm:pb-12">
                  {/* Narrow screens: full-width cards */}
                  <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/90 p-4 shadow-sm sm:hidden">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slab-teal/30 bg-[var(--color-surface-raised)] text-xl shadow-sm"
                        aria-hidden
                      >
                        {step.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slab-teal-light">
                          Step {i + 1}
                        </p>
                        <h3 className="mt-0.5 text-lg font-semibold text-[var(--slab-text)]">{step.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--slab-text-muted)]">{step.detail}</p>
                      </div>
                    </div>
                  </div>

                  {/* sm+: timeline row */}
                  <div className="relative z-[1] hidden w-11 shrink-0 justify-center sm:flex sm:w-[52px]">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slab-teal/30 bg-[var(--color-surface)] text-lg shadow-md shadow-black/25 ring-2 ring-[var(--color-surface)] sm:h-[52px] sm:w-[52px] sm:text-xl"
                      aria-hidden
                    >
                      {step.icon}
                    </span>
                  </div>
                  <div className="hidden min-w-0 flex-1 pt-0.5 sm:block">
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
          ctaBasePath={user ? '/dashboard' : '/signup'}
          accessToken={session?.access_token ?? null}
          currentEffectiveTier={effectiveTier(profile)}
        />

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 border-t border-[var(--color-border-subtle)] px-3 py-16 sm:px-6 sm:py-20 md:px-10">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-[var(--slab-text)] sm:text-3xl">FAQ</h2>
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
