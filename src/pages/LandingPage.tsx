import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SlabBookLogo } from '../components/SlabBookLogo'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

export function LandingPage () {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'SlabBook — Sports card portfolio'
  }, [])

  useEffect(() => {
    if (!loading && user && isSupabaseConfigured) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, loading, navigate])

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-surface)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(29,158,117,0.18),transparent)]"
        aria-hidden
      />
      <header className="relative flex items-center justify-between px-6 py-5 sm:px-10">
        <Link
          to="/"
          className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slab-teal/50"
        >
          <SlabBookLogo size="sm" />
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link
            to="/login"
            className="rounded-lg px-3 py-2 text-[var(--slab-text-muted)] transition hover:text-[var(--slab-text)]"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-slab-teal px-4 py-2 font-semibold text-zinc-950 transition hover:bg-slab-teal-light"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-8 text-center sm:px-10">
        <div className="mb-10 flex justify-center">
          <SlabBookLogo size="md" />
        </div>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-[var(--slab-text)] sm:text-4xl">
          Your slabs, your market edge
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--slab-text-muted)] sm:text-lg">
          Track graded and raw cards, cost basis, and live comps — with AI insights built for collectors.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-xl bg-slab-teal px-8 py-3.5 text-base font-semibold text-zinc-950 shadow-lg shadow-slab-teal/15 transition hover:bg-slab-teal-light"
          >
            Create free account
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-8 py-3.5 text-base font-medium text-[var(--slab-text)] transition hover:border-slab-teal/40"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  )
}
