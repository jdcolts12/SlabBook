import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout'
import { PromoCodeInput } from '../components/promo/PromoCodeInput'
import { useAuth } from '../hooks/useAuth'
import { redeemPromoRequest } from '../lib/promoApi'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function SignupPage () {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [promoCode, setPromoCode] = useState(() => searchParams.get('promo')?.trim().toUpperCase() ?? '')
  const [selectedTier] = useState(() => {
    const tier = searchParams.get('tier')?.trim().toLowerCase()
    if (tier === 'investor') return 'lifetime'
    if (tier === 'collector') return 'collector'
    return 'free'
  })
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Sign up — SlabBook'
  }, [])

  useEffect(() => {
    if (!authLoading && user && isSupabaseConfigured) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, authLoading, navigate])

  async function handleSubmit (e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add your URL and anon key to .env.local.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSubmitting(true)
    const redirectTo = `${window.location.origin}/auth/callback`
    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    })
    setSubmitting(false)
    if (signError) {
      setError(signError.message)
      return
    }
    if (data.user && !data.session) {
      setInfo('Check your email to confirm your account, then sign in.')
      return
    }
    if (data.session) {
      if (promoCode.trim()) {
        const redeem = await redeemPromoRequest(promoCode.trim(), data.session.access_token, selectedTier)
        if (redeem.error) {
          setInfo(`Account created. Promo: ${redeem.error}`)
        }
      }
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking your slabs and market value in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-slab-teal hover:text-slab-teal-light">
            Sign in
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
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-zinc-300">
            Email
          </label>
          <input
            id="signup-email"
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
        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-zinc-300">
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-[var(--color-surface)] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-slab-teal/50 focus:outline-none focus:ring-2 focus:ring-slab-teal/20"
          />
          <p className="mt-1 text-xs text-zinc-500">At least 8 characters.</p>
        </div>

        <details className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-[var(--slab-text-muted)]">
            Have a promo code?
          </summary>
          <div className="mt-3 pb-1">
            <PromoCodeInput value={promoCode} onChange={setPromoCode} placeholder="CODE" />
          </div>
        </details>

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
        <button
          type="submit"
          disabled={submitting || authLoading}
          className="w-full rounded-lg bg-slab-teal px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
        >
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </AuthLayout>
  )
}
