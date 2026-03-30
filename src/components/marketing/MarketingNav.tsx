import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SlabBookLogo } from '../SlabBookLogo'
import { useAuth } from '../../hooks/useAuth'
import { useUserProfile } from '../../hooks/useUserProfile'
import { effectiveTier, type UserPlanFields } from '../../lib/tierLimits'

const navMutedClass =
  'rounded-lg px-3 py-3 text-base font-medium text-[var(--slab-text-muted)] transition hover:bg-white/5 hover:text-[var(--slab-text)] active:bg-white/10 sm:py-2 sm:text-sm'

export function MarketingNav () {
  const { user } = useAuth()
  const { profile } = useUserProfile(user?.id)
  const showUpgrade = user && effectiveTier(profile as UserPlanFields | null) === 'free'
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4 md:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link
          to="/"
          className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slab-teal/50"
          onClick={() => setMenuOpen(false)}
        >
          <SlabBookLogo size="sm" />
        </Link>

        <button
          type="button"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] text-[var(--slab-text)] md:hidden"
          aria-expanded={menuOpen}
          aria-controls="marketing-mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>

        <nav className="hidden flex-wrap items-center justify-end gap-3 text-sm font-medium md:flex md:gap-6" aria-label="Main">
          <a href="/#features" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
            Features
          </a>
          <Link to="/pricing" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
            Pricing
          </Link>
          {showUpgrade && (
            <Link
              to="/pricing"
              className="rounded-lg border border-slab-teal/40 bg-slab-teal/10 px-3 py-1.5 font-semibold text-slab-teal-light transition hover:bg-slab-teal/20"
            >
              Upgrade
            </Link>
          )}
          {user ? (
            <>
              <Link to="/dashboard/collection" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
                Collection
              </Link>
              <Link
                to="/dashboard"
                className="rounded-lg bg-slab-teal px-4 py-2 font-semibold text-zinc-950 transition hover:bg-slab-teal-light"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-slab-teal px-4 py-2 font-semibold text-zinc-950 transition hover:bg-slab-teal-light"
              >
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[45] bg-black/60 md:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            id="marketing-mobile-menu"
            className="fixed inset-x-0 top-14 z-[60] max-h-[min(80dvh,calc(100dvh-3.5rem))] overflow-y-auto overscroll-contain border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-4 pb-8 shadow-xl md:hidden"
          >
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              <a href="/#features" className={navMutedClass} onClick={() => setMenuOpen(false)}>
                Features
              </a>
              <Link to="/pricing" className={navMutedClass} onClick={() => setMenuOpen(false)}>
                Pricing
              </Link>
              {showUpgrade && (
                <Link
                  to="/pricing"
                  className="mt-1 inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slab-teal/40 bg-slab-teal/15 px-4 text-base font-semibold text-slab-teal-light"
                  onClick={() => setMenuOpen(false)}
                >
                  Upgrade
                </Link>
              )}
              {user ? (
                <>
                  <Link to="/dashboard/collection" className={navMutedClass} onClick={() => setMenuOpen(false)}>
                    Collection
                  </Link>
                  <Link
                    to="/dashboard"
                    className="mt-2 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-slab-teal px-4 text-base font-semibold text-zinc-950"
                    onClick={() => setMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className={navMutedClass} onClick={() => setMenuOpen(false)}>
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="mt-2 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-slab-teal px-4 text-base font-semibold text-zinc-950"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </>
      )}
    </header>
  )
}
