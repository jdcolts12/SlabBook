import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { createCheckoutSession, createPortalSession, listStripeInvoices, type StripeInvoiceRow } from '../lib/stripeApi'
import { effectiveTier, planDisplayLabel, type UserPlanFields } from '../lib/tierLimits'
import { moneyFormatter } from '../lib/formatters'

function formatPeriodEnd (iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function BillingSettingsPage () {
  const { user, session } = useAuth()
  const { profile, loading } = useUserProfile(user?.id)
  const [invoices, setInvoices] = useState<StripeInvoiceRow[]>([])
  const [invLoading, setInvLoading] = useState(false)
  const [invError, setInvError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const tier = effectiveTier(profile as UserPlanFields | null)
  const lifetime = Boolean(profile?.lifetime_access) || tier === 'lifetime'

  useEffect(() => {
    document.title = 'Billing — SlabBook'
  }, [])

  const loadInvoices = useCallback(async () => {
    if (!session?.access_token) return
    setInvLoading(true)
    setInvError(null)
    try {
      const list = await listStripeInvoices(session.access_token)
      setInvoices(list)
    } catch (e) {
      setInvError(e instanceof Error ? e.message : 'Could not load invoices.')
      setInvoices([])
    } finally {
      setInvLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    if (profile?.stripe_customer_id) {
      void loadInvoices()
    }
  }, [profile?.stripe_customer_id, loadInvoices])

  async function openPortal () {
    if (!session?.access_token) return
    setActionError(null)
    setPortalLoading(true)
    try {
      const url = await createPortalSession(session.access_token)
      window.location.href = url
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Portal failed.')
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleUpgrade () {
    if (!session?.access_token) return
    setActionError(null)
    setCheckoutLoading(true)
    try {
      const url = await createCheckoutSession(session.access_token, 'pro', '')
      window.location.href = url
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Checkout failed.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Billing &amp; plan</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage your subscription, payment method, and invoices.</p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-slab-teal"
            role="status"
            aria-label="Loading"
          />
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Current plan</h2>
            {lifetime && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                {profile?.lifetime_access ? 'Founding Member' : 'Lifetime'}
              </span>
            )}
          </div>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Plan</dt>
              <dd className="font-medium text-white">{planDisplayLabel(profile as UserPlanFields | null)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Status</dt>
              <dd className="text-zinc-200">{profile?.subscription_status ?? '—'}</dd>
            </div>
            {!lifetime && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Next billing</dt>
                <dd className="text-zinc-200">{formatPeriodEnd(profile?.current_period_end ?? null)}</dd>
              </div>
            )}
            {profile?.promo_code_used && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Promo</dt>
                <dd className="font-mono text-zinc-200">{profile.promo_code_used}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {tier === 'free' && (
              <button
                type="button"
                onClick={() => void handleUpgrade()}
                disabled={checkoutLoading}
                className="inline-flex items-center justify-center rounded-lg bg-slab-teal px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
              >
                {checkoutLoading ? 'Redirecting…' : 'Get Pro'}
              </button>
            )}
            {profile?.stripe_customer_id && !lifetime && (
              <>
                <button
                  type="button"
                  onClick={() => void openPortal()}
                  disabled={portalLoading}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
                >
                  {portalLoading ? 'Opening…' : 'Manage subscription'}
                </button>
                <button
                  type="button"
                  onClick={() => void openPortal()}
                  disabled={portalLoading}
                  className="inline-flex items-center justify-center rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  Cancel or update payment
                </button>
              </>
            )}
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-slab-teal hover:text-slab-teal-light"
            >
              View pricing
            </Link>
          </div>

          <p className="text-xs text-zinc-500">
            Subscription changes and cancellations are handled securely in the Stripe billing portal.
          </p>
        </div>
      )}

      {profile?.stripe_customer_id && (
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-6">
          <h2 className="text-lg font-semibold text-white">Recent invoices</h2>
          {invLoading && <p className="mt-4 text-sm text-zinc-500">Loading…</p>}
          {invError && <p className="mt-4 text-sm text-red-200">{invError}</p>}
          {!invLoading && !invError && invoices.length === 0 && (
            <p className="mt-4 text-sm text-zinc-500">No invoices yet.</p>
          )}
          {!invLoading && invoices.length > 0 && (
            <ul className="mt-4 divide-y divide-[var(--color-border-subtle)]">
              {invoices.map((inv) => (
                <li key={inv.id ?? inv.number ?? String(inv.created)} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium text-zinc-200">
                      {inv.number ?? inv.id ?? 'Invoice'}{' '}
                      <span className="text-zinc-500">· {new Date(inv.created * 1000).toLocaleDateString()}</span>
                    </p>
                    <p className="text-xs capitalize text-zinc-500">{inv.status ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-zinc-400">
                      {moneyFormatter.format((inv.amount_paid ?? 0) / 100)}
                    </span>
                    {inv.hosted_invoice_url && (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slab-teal hover:text-slab-teal-light"
                      >
                        View
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

    </div>
  )
}
