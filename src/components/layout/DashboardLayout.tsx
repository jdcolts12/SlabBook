import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { SlabBookLogo } from '../SlabBookLogo'

const nav = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/collection', label: 'Collection', end: false },
  { to: '/dashboard/insights', label: 'AI Insights', end: false },
  { to: '/dashboard/alerts', label: 'Price Alerts', end: false },
] as const

function NavIcon ({ name }: { name: (typeof nav)[number]['label'] }) {
  const cls = 'h-5 w-5 shrink-0'
  switch (name) {
    case 'Dashboard':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      )
    case 'Collection':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 11.25v7.5a2.25 2.25 0 01-2.25 2.25h-15A2.25 2.25 0 013 18.75v-7.5a2.25 2.25 0 012.25-2.25z" />
        </svg>
      )
    case 'AI Insights':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
        </svg>
      )
    case 'Price Alerts':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.082M12 18h.01M5.25 6H9m-4 4h6m-6 4h6M9 3h.008v.008H9V3zm0 18h.008v.008H9V21zm12-9h.008v.008H21V12z" />
        </svg>
      )
    default:
      return null
  }
}

export function DashboardLayout () {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null)
  const [promoCodeUsed, setPromoCodeUsed] = useState<string | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      const clear = window.setTimeout(() => {
        setSubscriptionTier(null)
        setPromoCodeUsed(null)
        setTrialEndsAt(null)
        setSubscriptionEndsAt(null)
      }, 0)
      return () => window.clearTimeout(clear)
    }

    if (!user.id) {
      return
    }

    let active = true
    void (async () => {
      const { data } = await supabase
        .from('users')
        .select('subscription_tier, promo_code_used, trial_ends_at, subscription_ends_at')
        .eq('id', user.id)
        .maybeSingle()
      if (!active) return
      const tier = typeof data?.subscription_tier === 'string' ? data.subscription_tier : null
      const promo = typeof data?.promo_code_used === 'string' ? data.promo_code_used : null
      const trial = typeof data?.trial_ends_at === 'string' ? data.trial_ends_at : null
      const subEnd = typeof data?.subscription_ends_at === 'string' ? data.subscription_ends_at : null
      setSubscriptionTier(tier)
      setPromoCodeUsed(promo)
      setTrialEndsAt(trial)
      setSubscriptionEndsAt(subEnd)
    })()

    return () => {
      active = false
    }
  }, [user])

  function prettyDate (iso: string | null): string | null {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString()
  }

  async function handleSignOut () {
    await signOut()
    navigate('/login', { replace: true })
  }

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]">
      <div className="flex h-16 items-center border-b border-[var(--color-border-subtle)] px-5">
        <Link
          to="/dashboard"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-slab-teal/40 rounded-lg"
        >
          <SlabBookLogo size="md" />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Main">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slab-teal/10 text-slab-teal-light'
                  : 'text-[var(--slab-text-muted)] hover:bg-white/5 hover:text-[var(--slab-text)]',
              ].join(' ')
            }
          >
            <NavIcon name={item.label} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-[var(--color-border-subtle)] p-4">
        <p className="truncate text-xs text-zinc-500">{user?.email}</p>
        {subscriptionTier && (
          <p className="mt-2">
            <span className="inline-flex items-center rounded-full border border-slab-teal/40 bg-slab-teal/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slab-teal-light">
              Plan: {subscriptionTier}
            </span>
          </p>
        )}
        <p className="mt-1 text-[11px] text-zinc-400">
          Promo: {promoCodeUsed ?? 'None'}
        </p>
        {trialEndsAt && (
          <p className="mt-1 text-[11px] text-zinc-500">Trial ends: {prettyDate(trialEndsAt) ?? trialEndsAt}</p>
        )}
        {subscriptionEndsAt && (
          <p className="mt-1 text-[11px] text-zinc-500">Sub ends: {prettyDate(subscriptionEndsAt) ?? subscriptionEndsAt}</p>
        )}
        {import.meta.env.VITE_GIT_SHA ? (
          <p className="mt-2 font-mono text-[10px] text-zinc-600" title="Vercel build commit">
            Build {import.meta.env.VITE_GIT_SHA.slice(0, 7)}
            {import.meta.env.VITE_VERCEL_ENV
              ? ` · ${import.meta.env.VITE_VERCEL_ENV}`
              : ''}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 w-full rounded-lg border border-zinc-700/80 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-dvh bg-[var(--color-surface)]">
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex">{sidebar}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {sidebar}
      </div>

      <div className="flex min-h-dvh flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <Link to="/dashboard" className="min-w-0">
            <SlabBookLogo size="sm" />
          </Link>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
