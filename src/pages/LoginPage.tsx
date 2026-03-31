import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function LoginPage () {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const mode = new URLSearchParams(location.search).get('mode')
  const resetMode = mode === 'reset'

  useEffect(() => {
    document.title = 'Sign in — SlabBook'
  }, [])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const desc = sp.get('error_description')?.replace(/\+/g, ' ')
    const code = sp.get('error')
    if (desc || code) {
      setError(desc || code || null)
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      url.searchParams.delete('error_description')
      url.searchParams.delete('error_code')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user && isSupabaseConfigured) {
      navigate(from, { replace: true })
    }
  }, [user, authLoading, navigate, from])

  async function handleSubmit (e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add your URL and anon key to .env.local.')
      return
    }
    setSubmitting(true)
    const { error: signError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (signError) {
      setError(signError.message)
      return
    }
    navigate(from, { replace: true })
  }

  async function handleResetPassword (e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add your URL and anon key to .env.local.')
      return
    }
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    setSubmitting(true)
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setSubmitting(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setInfo('If this email exists, a password reset link has been sent.')
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to track your collection and insights."
      footer={
        <>
          New to SlabBook?{' '}
          <Link to="/signup" className="font-medium text-slab-teal hover:text-slab-teal-light">
            Create an account
          </Link>
        </>
      }
    >
      {!isSupabaseConfigured && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Add <code className="rounded bg-black/30 px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 text-xs">.env.local</code>, then restart the dev server.
        </div>
      )}
      <form onSubmit={resetMode ? handleResetPassword : handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-[var(--color-surface)] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-slab-teal/50 focus:outline-none focus:ring-2 focus:ring-slab-teal/20"
            placeholder="you@example.com"
          />
        </div>
        {!resetMode && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-[var(--color-surface)] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-slab-teal/50 focus:outline-none focus:ring-2 focus:ring-slab-teal/20"
            />
          </div>
        )}
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="text-sm text-slab-teal-light" role="status">
            {info}
          </p>
        )}
        {resetMode ? (
          <>
            <button
              type="submit"
              disabled={submitting || authLoading}
              className="w-full rounded-lg bg-slab-teal px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send password reset email'}
            </button>
            <Link to="/login" className="block text-center text-xs text-zinc-400 hover:text-zinc-300">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <button
              type="submit"
              disabled={submitting || authLoading}
              className="w-full rounded-lg bg-slab-teal px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
            <Link to="/login?mode=reset" className="block text-center text-xs text-zinc-400 hover:text-zinc-300">
              Forgot password?
            </Link>
          </>
        )}
      </form>
    </AuthLayout>
  )
}
