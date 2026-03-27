import { Link } from 'react-router-dom'
import { SlabBookLogo } from '../SlabBookLogo'

export function MarketingNav () {
  return (
    <header className="relative z-20 flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/90 px-6 py-4 backdrop-blur sm:px-10">
      <Link
        to="/"
        className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slab-teal/50"
      >
        <SlabBookLogo size="sm" />
      </Link>
      <nav className="flex flex-wrap items-center justify-end gap-4 text-sm font-medium sm:gap-6">
        <a href="/#features" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
          Features
        </a>
        <Link to="/pricing" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
          Pricing
        </Link>
        <Link to="/login" className="text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]">
          Login
        </Link>
        <Link
          to="/signup"
          className="rounded-lg bg-slab-teal px-4 py-2 font-semibold text-zinc-950 transition hover:bg-slab-teal-light"
        >
          Sign Up
        </Link>
      </nav>
    </header>
  )
}
