import { Link } from 'react-router-dom'
import { SlabBookLogo } from '../SlabBookLogo'

export function MarketingFooter () {
  return (
    <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-6 py-12 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SlabBookLogo size="sm" />
          <p className="mt-3 max-w-xs text-sm text-[var(--slab-text-muted)]">
            Track, value, and understand your slab collection.
          </p>
        </div>
        <div className="flex flex-wrap gap-8 text-sm">
          <a href="/#features" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
            Features
          </a>
          <Link to="/pricing" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
            Pricing
          </Link>
          <Link to="/login" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
            Login
          </Link>
          <Link to="/signup" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
            Sign Up
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-center text-sm text-[var(--slab-text-muted)]">
        Built for collectors, by collectors.
      </p>
      <p className="mt-4 text-center text-xs text-[var(--slab-text-muted)]">© {new Date().getFullYear()} SlabBook</p>
    </footer>
  )
}
