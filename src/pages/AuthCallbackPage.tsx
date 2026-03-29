import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * Landing page for Supabase email confirmation / magic-link redirects.
 * PKCE requires opening the link in the same browser where signup started (code verifier in storage).
 */
export function AuthCallbackPage () {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [timedOut, setTimedOut] = useState(false)

  const err =
    searchParams.get('error') ??
    searchParams.get('error_code') ??
    ''
  const errDesc =
    searchParams.get('error_description')?.replace(/\+/g, ' ') ?? ''

  useEffect(() => {
    document.title = 'Confirming — SlabBook'
  }, [])

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, loading, navigate])

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!loading && !user && !err) {
        setTimedOut(true)
      }
    }, 12_000)
    return () => window.clearTimeout(t)
  }, [loading, user, err])

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
        subtitle="If you opened this link on another device or browser than where you signed up, try again from the same one — or sign in below."
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
