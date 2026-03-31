import { useEffect, useState } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

/**
 * Landing page for Supabase email confirmation / magic-link redirects.
 * Uses implicit auth flow (see supabase.ts) so confirmation works on any device — PKCE-only links
 * can fail and leave a previous session in place, which used to send people to the wrong account.
 */
export function AuthCallbackPage () {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [timedOut, setTimedOut] = useState(false)
  const [callbackError, setCallbackError] = useState<string | null>(null)

  const err =
    searchParams.get('error') ??
    searchParams.get('error_code') ??
    ''
  const errDesc =
    searchParams.get('error_description')?.replace(/\+/g, ' ') ?? ''

  useEffect(() => {
    document.title = 'Confirming — SlabBook'
  }, [])

  /** Custom email templates: /auth/callback?token_hash=…&type=signup */
  useEffect(() => {
    let cancelled = false
    const token_hash = searchParams.get('token_hash')
    const typeRaw = searchParams.get('type')
    if (!token_hash || !typeRaw) return

    const type = typeRaw as EmailOtpType
    void (async () => {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash })
      if (cancelled) return
      if (error) {
        setCallbackError(error.message)
        return
      }
      const u = new URL(window.location.href)
      u.searchParams.delete('token_hash')
      u.searchParams.delete('type')
      window.history.replaceState({}, document.title, `${u.pathname}${u.search}${u.hash}`)
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  /**
   * If a PKCE ?code= is still present after the client runs, exchange failed (e.g. old email link).
   * Supabase keeps the prior session on purpose — sign out so we do not redirect as the wrong user.
   */
  useEffect(() => {
    let cancelled = false
    const t = window.setTimeout(async () => {
      if (cancelled) return
      const u = new URL(window.location.href)
      if (!u.searchParams.has('code')) return
      await supabase.auth.signOut({ scope: 'local' })
      u.searchParams.delete('code')
      window.history.replaceState({}, document.title, `${u.pathname}${u.search}${u.hash}`)
      setCallbackError(
        'This confirmation link could not be completed. It may be expired or was opened in the wrong browser. We signed you out so you are not stuck in someone else’s session. Request a new confirmation email from sign up, or sign in below.',
      )
    }, 900)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (!loading && user && !callbackError) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, loading, navigate, callbackError])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!loading && !user && !err && !callbackError) {
        setTimedOut(true)
      }
    }, 12_000)
    return () => window.clearTimeout(t)
  }, [loading, user, err, callbackError])

  if (!isSupabaseConfigured) {
    return (
      <AuthLayout title="Configuration" subtitle="Supabase is not configured." footer={null}>
        <p className="text-sm text-zinc-400">
          Add <code className="rounded bg-black/30 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-black/30 px-1">VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-slab-teal hover:text-slab-teal-light">
          Back to sign in
        </Link>
      </AuthLayout>
    )
  }

  if (callbackError) {
    return (
      <AuthLayout title="Could not confirm" subtitle="This link did not finish signing you in." footer={null}>
        <p className="text-sm text-red-400" role="alert">
          {callbackError}
        </p>
        <p className="mt-4 text-sm text-zinc-500">
          If you already verified, try signing in. Otherwise start sign up again to get a fresh email.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block text-sm font-medium text-slab-teal hover:text-slab-teal-light"
        >
          Go to sign in
        </Link>
      </AuthLayout>
    )
  }

  if (err || errDesc) {
    return (
      <AuthLayout title="Could not confirm" subtitle="Something went wrong with this link." footer={null}>
        <p className="text-sm text-red-400" role="alert">
          {errDesc || err || 'Invalid or expired confirmation link.'}
        </p>
        <p className="mt-4 text-sm text-zinc-500">
          Try signing in if you already confirmed, or request a new confirmation email from the sign-in page.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block text-sm font-medium text-slab-teal hover:text-slab-teal-light"
        >
          Go to sign in
        </Link>
      </AuthLayout>
    )
  }

  if (timedOut && !user && !loading) {
    return (
      <AuthLayout
        title="Still confirming?"
        subtitle="Try signing in with the email and password you used. If you never set a password flow, request a new confirmation email from the sign-up page."
        footer={null}
      >
        <Link to="/login" className="inline-block text-sm font-medium text-slab-teal hover:text-slab-teal-light">
          Go to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Confirming your account" subtitle="Hang tight — redirecting you to the dashboard." footer={null}>
      <div className="flex justify-center py-8">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-slab-teal"
          role="status"
          aria-label="Loading"
        />
      </div>
    </AuthLayout>
  )
}
