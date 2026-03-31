import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CardImageModal } from '../components/collection/CardImageModal'
import { CollectionGridView } from '../components/collection/CollectionGridView'
import { CollectionTableView } from '../components/collection/CollectionTableView'
import { PortfolioSummaryBar } from '../components/collection/PortfolioSummaryBar'
import type { ViewMode } from '../components/collection/CollectionToolbar'
import { useAuth } from '../hooks/useAuth'
import { AI_VALUE_DISCLAIMER } from '../lib/aiValueCopy'
import { mergeEstimateIntoCard } from '../lib/estimateCardValueApi'
import { getCardValue } from '../lib/pricing-service'
import { computePortfolioMetrics } from '../lib/cardMetrics'
import { moneyFormatter, pctFormatter } from '../lib/formatters'
import { isEstimateStale } from '../lib/pricingConstants'
import { removeCardImageByPublicUrl } from '../lib/cardImageStorage'
import { sleep } from '../lib/sleep'
import { supabase } from '../lib/supabase'
import type { Card } from '../types/card'

const money = moneyFormatter

const DASH_VIEW_KEY = 'slabbook.dashboardView'

function readDashboardView (): ViewMode {
  try {
    const v = localStorage.getItem(DASH_VIEW_KEY)
    return v === 'grid' ? 'grid' : 'table'
  } catch {
    return 'grid'
  }
}

export function DashboardHomePage () {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({})
  const [refreshingValues, setRefreshingValues] = useState(false)
  const [estimateProgress, setEstimateProgress] = useState<{ current: number; total: number } | null>(null)
  const [estimateDone, setEstimateDone] = useState<string | null>(null)
  const [dashView, setDashView] = useState<ViewMode>(() => readDashboardView())
  const [imageModalCard, setImageModalCard] = useState<Card | null>(null)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  useEffect(() => {
    if (searchParams.get('upgrade') === 'success') {
      setUpgradeSuccess(true)
      const next = new URLSearchParams(searchParams)
      next.delete('upgrade')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    try {
      localStorage.setItem(DASH_VIEW_KEY, dashView)
    } catch {
      /* ignore */
    }
  }, [dashView])

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
  const recentCards = useMemo(() => cards.slice(0, 12), [cards])

  useEffect(() => {
    document.title = 'Dashboard — SlabBook'
  }, [])

  async function refreshSingleCardValue (card: Card) {
    setError(null)
    setRefreshingIds((prev) => ({ ...prev, [card.id]: true }))
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Missing auth session. Please sign in again.')
      }
      const est = await getCardValue(card, session.access_token, { force_refresh: true })
      if (est.error) {
        throw new Error(est.error)
      }
      setCards((prev) => prev.map((c) => (c.id === card.id ? mergeEstimateIntoCard(c, est) : c)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh value.')
    } finally {
      setRefreshingIds((prev) => {
        const next = { ...prev }
        delete next[card.id]
        return next
      })
    }
  }

  function openEditOnCollection (c: Card) {
    navigate('/dashboard/collection', { state: { editCardId: c.id } })
  }

  async function handleDelete (c: Card) {
    if (!user) return
    const ok = window.confirm(`Remove "${c.player_name}" from your collection?`)
    if (!ok) return
    try {
      await removeCardImageByPublicUrl(supabase, c.image_front_url)
      await removeCardImageByPublicUrl(supabase, c.image_back_url)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not remove card images from storage.')
      return
    }
    const { error: delErr } = await supabase.from('cards').delete().eq('id', c.id).eq('user_id', user.id)
    if (delErr) {
      window.alert(delErr.message)
      return
    }
    await loadCards({ silent: true })
  }

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
      {upgradeSuccess && (
        <div className="rounded-lg border border-slab-teal/35 bg-slab-teal/10 px-4 py-3 text-sm text-slab-teal-light">
          Payment successful — your plan will update in a moment. Refresh if you don&apos;t see new features yet.
        </div>
      )}
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
        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            to="/dashboard/collection?scan=1"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slab-teal px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-slab-teal/25 transition hover:bg-slab-teal-light sm:w-auto"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5A2.25 2.25 0 016 5.25h2.172c.597 0 1.17-.237 1.592-.659l.486-.486a2.25 2.25 0 011.592-.659h.316a2.25 2.25 0 011.592.659l.486.486a2.25 2.25 0 001.592.659H18A2.25 2.25 0 0120.25 7.5v9A2.25 2.25 0 0118 18.75H6a2.25 2.25 0 01-2.25-2.25v-9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
            Scan & Add
          </Link>
          <button
            type="button"
            onClick={() => void estimateAllValues()}
            disabled={refreshingValues || cards.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slab-teal/30 bg-slab-teal/10 px-4 py-2 text-sm font-semibold text-slab-teal-light transition hover:bg-slab-teal/20 disabled:opacity-50"
          >
            {refreshingValues && estimateProgress
              ? `Estimating ${estimateProgress.current} of ${estimateProgress.total} cards…`
              : refreshingValues
                ? 'Working…'
                : 'Estimate All Values'}
          </button>
        </div>
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

      {!loading && cards.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent cards</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Latest additions — same binder layout as Collection.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border border-[var(--color-border-subtle)] p-0.5">
                <button
                  type="button"
                  onClick={() => setDashView('table')}
                  className={[
                    'rounded-md px-3 py-1.5 text-sm font-medium transition',
                    dashView === 'table'
                      ? 'bg-slab-teal/20 text-slab-teal-muted'
                      : 'text-zinc-400 hover:text-zinc-200',
                  ].join(' ')}
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setDashView('grid')}
                  className={[
                    'rounded-md px-3 py-1.5 text-sm font-medium transition',
                    dashView === 'grid'
                      ? 'bg-slab-teal/20 text-slab-teal-muted'
                      : 'text-zinc-400 hover:text-zinc-200',
                  ].join(' ')}
                >
                  Grid
                </button>
              </div>
              <Link
                to="/dashboard/collection"
                className="text-sm font-medium text-slab-teal hover:text-slab-teal-light"
              >
                Open full collection →
              </Link>
            </div>
          </div>

          {dashView === 'table' ? (
            <CollectionTableView
              cards={recentCards}
              money={money}
              refreshingIds={refreshingIds}
              onRefresh={(c) => void refreshSingleCardValue(c)}
              onEdit={openEditOnCollection}
              onDelete={(c) => void handleDelete(c)}
              onViewImage={setImageModalCard}
            />
          ) : (
            <CollectionGridView
              cards={recentCards}
              money={money}
              refreshingIds={refreshingIds}
              onRefresh={(c) => void refreshSingleCardValue(c)}
              onEdit={openEditOnCollection}
              onDelete={(c) => void handleDelete(c)}
              onViewImage={setImageModalCard}
            />
          )}
        </section>
      )}

      <CardImageModal
        card={imageModalCard}
        open={imageModalCard != null}
        onClose={() => setImageModalCard(null)}
      />
    </div>
  )
}
