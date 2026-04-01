import { Link } from 'react-router-dom'
import { SlabBookLogo } from '../SlabBookLogo'
import { useAuth } from '../../hooks/useAuth'

const footerLink =
  'inline-flex min-h-[44px] items-center text-sm text-[var(--slab-text-muted)] transition hover:text-[var(--slab-text)]'

export function MarketingFooter () {
  const { user } = useAuth()

  return (
    <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-12 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SlabBookLogo size="sm" />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--slab-text-muted)]">
            Track, value, and understand your slab collection.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-6 gap-y-1 sm:flex sm:flex-wrap sm:gap-8" aria-label="Footer">
          <a href="/#features" className={footerLink}>
            Features
          </a>
          <Link to="/pricing" className={footerLink}>
            Pricing
          </Link>
          {user ? (
            <Link to="/dashboard/collection" className={footerLink}>
              Collection
            </Link>
          ) : (
            <>
              <Link to="/login" className={footerLink}>
                Login
              </Link>
              <Link to="/signup" className={footerLink}>
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-center text-sm text-[var(--slab-text-muted)]">
        Built for collectors, by collectors.
      </p>
      <p className="mt-4 text-center text-xs text-[var(--slab-text-muted)]">© {new Date().getFullYear()} SlabBook</p>
    </footer>
  )
}
