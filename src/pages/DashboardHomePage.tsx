import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PortfolioSummaryBar } from '../components/collection/PortfolioSummaryBar'
import { PromoCodeInput } from '../components/promo/PromoCodeInput'
import { useAuth } from '../hooks/useAuth'
import { computePortfolioMetrics } from '../lib/cardMetrics'
import { moneyFormatter, pctFormatter } from '../lib/formatters'
import { redeemPromoRequest } from '../lib/promoApi'
import { supabase } from '../lib/supabase'
import type { Card } from '../types/card'

const money = moneyFormatter

export function DashboardHomePage () {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshingValues, setRefreshingValues] = useState(false)
  const [promoCode, setPromoCode] = useState(() => searchParams.get('promo')?.trim().toUpperCase() ?? '')
  const [promoTier, setPromoTier] = useState(() => {
    const tier = searchParams.get('tier')?.trim().toLowerCase()
    if (tier === 'investor') return 'lifetime'
    if (tier === 'collector') return 'collector'
    return 'free'
  })
  const [applyingPromo, setApplyingPromo] = useState(false)
  const [promoResult, setPromoResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadCards = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) {
      setLoading(false)
      return
    }

    setError(null)
    if (!opts?.silent) setLoading(true)
    const { data, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (cardsError) {
      setError(cardsError.message)
      setCards([])
    } else {
      setCards((data ?? []) as Card[])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCards()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCards])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`dashboard-cards-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cards',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadCards({ silent: true })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, loadCards])

  const metrics = useMemo(() => computePortfolioMetrics(cards), [cards])

  useEffect(() => {
    document.title = 'Dashboard — SlabBook'
  }, [])

  async function refreshAllValues () {
    if (!user || cards.length === 0) return
    setError(null)
    setRefreshingValues(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Missing auth session. Please sign in again.')
      }

      for (const card of cards) {
        const response = await fetch('/api/fetch-card-value', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            card_id: card.id,
            sport: card.sport,
            player_name: card.player_name,
            year: card.year,
            set_name: card.set_name,
            card_number: card.card_number,
            variation: card.variation,
            is_graded: card.is_graded,
            grade: card.grade,
            grading_company: card.grading_company,
          }),
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null
          throw new Error(payload?.error ?? `Failed updating ${card.player_name}.`)
        }
      }

      await loadCards()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh card values.')
    } finally {
      setRefreshingValues(false)
    }
  }

  async function applyPromoCode () {
    const code = promoCode.trim()
    if (!user || !code) return
    setPromoResult(null)
    setApplyingPromo(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Missing auth session. Please sign in again.')
      }
      const redeem = await redeemPromoRequest(code, session.access_token, promoTier)
      if (redeem.error) {
        setPromoResult({ type: 'error', message: redeem.error })
      } else {
        setPromoResult({ type: 'success', message: redeem.message ?? 'Promo code applied successfully.' })
        window.dispatchEvent(new Event('subscription-updated'))
      }
    } catch (err) {
      setPromoResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to apply promo code.',
      })
    } finally {
      setApplyingPromo(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Portfolio snapshot and bulk refresh — manage cards in Collection.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAllValues()}
          disabled={refreshingValues || cards.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slab-teal px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
        >
          {refreshingValues ? 'Refreshing values…' : 'Refresh Values'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <PortfolioSummaryBar metrics={metrics} loading={loading} money={money} pct={pctFormatter} />

      <div id="promo-upgrade" className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-6">
        <h2 className="text-lg font-medium text-white">Apply promo code to this account</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Already signed up? Enter a promo code below to upgrade membership immediately.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <PromoCodeInput
            value={promoCode}
            onChange={setPromoCode}
            tier={promoTier}
            userId={user?.id ?? null}
            id="dashboard-promo-code"
            placeholder="CODE"
          />
          <select
            value={promoTier}
            onChange={(e) => setPromoTier(e.target.value)}
            className="h-10 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 text-sm text-[var(--slab-text)] focus:border-slab-teal/50 focus:outline-none focus:ring-2 focus:ring-slab-teal/20"
          >
            <option value="free">Free</option>
            <option value="collector">Collector</option>
            <option value="lifetime">Investor / Lifetime</option>
          </select>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void applyPromoCode()}
            disabled={applyingPromo || !promoCode.trim()}
            className="inline-flex items-center justify-center rounded-lg bg-slab-teal px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
          >
            {applyingPromo ? 'Applying…' : 'Apply Code'}
          </button>
          {promoResult && (
            <p className={promoResult.type === 'success' ? 'text-sm text-slab-teal-light' : 'text-sm text-red-400'}>
              {promoResult.message}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-6">
        <h2 className="text-lg font-medium text-white">Quick start</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-zinc-400">
          <li>
            Add Supabase keys in <code className="text-zinc-300">.env.local</code> and run{' '}
            <code className="text-zinc-300">supabase/schema.sql</code>.
          </li>
          <li>Use Collection for filters, table/grid views, and per-card value refresh.</li>
          <li>AI insights and price alerts connect when those routes are enabled.</li>
        </ul>
      </div>
    </div>
  )
}
