import { useCallback, useEffect, useMemo, useState } from 'react'
import { PortfolioSummaryBar } from '../components/collection/PortfolioSummaryBar'
import { useAuth } from '../hooks/useAuth'
import { AI_VALUE_DISCLAIMER } from '../lib/aiValueCopy'
import { mergeEstimateIntoCard } from '../lib/estimateCardValueApi'
import { getCardValue } from '../lib/pricing-service'
import { computePortfolioMetrics } from '../lib/cardMetrics'
import { moneyFormatter, pctFormatter } from '../lib/formatters'
import { isEstimateStale } from '../lib/pricingConstants'
import { sleep } from '../lib/sleep'
import { supabase } from '../lib/supabase'
import type { Card } from '../types/card'

const money = moneyFormatter

export function DashboardHomePage () {
  const { user } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshingValues, setRefreshingValues] = useState(false)
  const [estimateProgress, setEstimateProgress] = useState<{ current: number; total: number } | null>(null)
  const [estimateDone, setEstimateDone] = useState<string | null>(null)

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

  async function estimateAllValues () {
    if (!user || cards.length === 0) return
    setError(null)
    setEstimateDone(null)
    const targets = cards.filter((c) => isEstimateStale(c))
    if (targets.length === 0) {
      setEstimateDone('All card values are fresh (updated within 48 hours).')
      window.setTimeout(() => setEstimateDone(null), 5000)
      return
    }

    setRefreshingValues(true)
    setEstimateProgress({ current: 0, total: targets.length })
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Missing auth session. Please sign in again.')
      }

      for (let i = 0; i < targets.length; i++) {
        const id = targets[i].id
        const est = await getCardValue({ id }, session.access_token, { force_refresh: false })
        if (est.error) {
          throw new Error(est.error)
        }
        setCards((prev) => prev.map((c) => (c.id === id ? mergeEstimateIntoCard(c, est) : c)))
        setEstimateProgress({ current: i + 1, total: targets.length })
        if (i < targets.length - 1) {
          await sleep(1000)
        }
      }

      await loadCards({ silent: true })
      setEstimateDone('All values updated!')
      window.setTimeout(() => setEstimateDone(null), 6000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to estimate card values.')
    } finally {
      setRefreshingValues(false)
      setEstimateProgress(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <p className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-4 py-2.5 text-xs leading-relaxed text-zinc-500">
        {AI_VALUE_DISCLAIMER}
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Portfolio snapshot and AI value estimates — manage cards in Collection.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void estimateAllValues()}
          disabled={refreshingValues || cards.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slab-teal px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
        >
          {refreshingValues && estimateProgress
            ? `Estimating ${estimateProgress.current} of ${estimateProgress.total} cards…`
            : refreshingValues
              ? 'Working…'
              : 'Estimate All Values'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {estimateDone && (
        <div className="rounded-lg border border-slab-teal/30 bg-slab-teal/10 px-4 py-3 text-sm text-slab-teal-light">
          {estimateDone}
        </div>
      )}

      <PortfolioSummaryBar metrics={metrics} loading={loading} money={money} pct={pctFormatter} />
    </div>
  )
}
