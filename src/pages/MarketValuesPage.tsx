import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CardImageModal } from '../components/collection/CardImageModal'
import { SportsCardCompLinks } from '../components/collection/CardCompLinks'
import { CardThumbnail } from '../components/collection/CardThumbnail'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { MARKET_VALUES_BANNER } from '../lib/aiValueCopy'
import {
  cardGainDollars,
  cardGainPercent,
  computePortfolioMetrics,
  formatGradeLine,
} from '../lib/cardMetrics'
import { mergeEstimateIntoCard } from '../lib/estimateCardValueApi'
import { getCardValue } from '../lib/pricing-service'
import { moneyFormatter, pctFormatter } from '../lib/formatters'
import { isEstimateStale } from '../lib/pricingConstants'
import { formatRelativeTime } from '../lib/relativeTime'
import { sleep } from '../lib/sleep'
import { createCheckoutSession } from '../lib/stripeApi'
import { supabase } from '../lib/supabase'
import { canUseMarketValuesTab } from '../lib/tierLimits'
import type { Card } from '../types/card'

const money = moneyFormatter
const pct = pctFormatter

type SortKey =
  | 'player'
  | 'purchased'
  | 'est_low'
  | 'est_mid'
  | 'est_high'
  | 'confidence'
  | 'trend'
  | 'gain_pct'
  | 'last_updated'

type SortDir = 'asc' | 'desc'

function confidenceRank (c: string | null): number {
  const x = (c ?? '').toLowerCase()
  if (x === 'high') return 3
  if (x === 'medium') return 2
  if (x === 'low') return 1
  return 0
}

function trendRank (t: string | null): number {
  const x = (t ?? '').toLowerCase()
  if (x === 'rising') return 3
  if (x === 'stable') return 2
  if (x === 'declining') return 1
  return 0
}

function cmpNullableNum (
  a: number | null,
  b: number | null,
  dir: SortDir,
  nullsLast: boolean,
): number {
  if (a == null && b == null) return 0
  if (a == null) return nullsLast ? 1 : -1
  if (b == null) return nullsLast ? -1 : 1
  const diff = a - b
  return dir === 'asc' ? diff : -diff
}

function sortCardsMarket (
  list: Card[],
  key: SortKey,
  dir: SortDir,
): Card[] {
  const next = [...list]
  const nullsLast = true
  next.sort((a, b) => {
    switch (key) {
      case 'player': {
        const r = a.player_name.localeCompare(b.player_name, undefined, { sensitivity: 'base' })
        return dir === 'asc' ? r : -r
      }
      case 'purchased':
        return cmpNullableNum(
          a.purchase_price != null ? Number(a.purchase_price) : null,
          b.purchase_price != null ? Number(b.purchase_price) : null,
          dir,
          nullsLast,
        )
      case 'est_low':
        return cmpNullableNum(
          a.value_low != null ? Number(a.value_low) : null,
          b.value_low != null ? Number(b.value_low) : null,
          dir,
          nullsLast,
        )
      case 'est_mid':
        return cmpNullableNum(
          a.current_value != null ? Number(a.current_value) : null,
          b.current_value != null ? Number(b.current_value) : null,
          dir,
          nullsLast,
        )
      case 'est_high':
        return cmpNullableNum(
          a.value_high != null ? Number(a.value_high) : null,
          b.value_high != null ? Number(b.value_high) : null,
          dir,
          nullsLast,
        )
      case 'confidence': {
        const diff = confidenceRank(a.confidence) - confidenceRank(b.confidence)
        return dir === 'asc' ? diff : -diff
      }
      case 'trend': {
        const diff = trendRank(a.trend) - trendRank(b.trend)
        return dir === 'asc' ? diff : -diff
      }
      case 'gain_pct':
        return cmpNullableNum(cardGainPercent(a), cardGainPercent(b), dir, nullsLast)
      case 'last_updated': {
        const ta = a.last_updated ? new Date(a.last_updated).getTime() : NaN
        const tb = b.last_updated ? new Date(b.last_updated).getTime() : NaN
        const va = Number.isFinite(ta) ? ta : null
        const vb = Number.isFinite(tb) ? tb : null
        return cmpNullableNum(va, vb, dir, nullsLast)
      }
      default:
        return 0
    }
  })
  return next
}

function ConfidenceBadgeCell ({ confidence }: { confidence: string | null }) {
  const c = (confidence ?? '').toLowerCase()
  if (c === 'high') {
    return (
      <span className="inline-flex rounded-md border border-slab-teal/40 bg-slab-teal/15 px-2 py-0.5 text-[11px] font-medium text-slab-teal-light">
        High
      </span>
    )
  }
  if (c === 'medium') {
    return (
      <span className="inline-flex rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200/90">
        Est.
      </span>
    )
  }
  if (c === 'low') {
    return (
      <span className="inline-flex rounded-md border border-zinc-600 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
        Rough
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-md border border-zinc-600/50 bg-zinc-800/50 px-2 py-0.5 text-[11px] text-zinc-400">
      Est.
    </span>
  )
}

function TrendCell ({ trend }: { trend: string | null }) {
  const t = (trend ?? '').toLowerCase()
  if (t === 'rising') {
    return (
      <span className="text-slab-teal-light" title="Trending up">
        ↑
      </span>
    )
  }
  if (t === 'stable') {
    return (
      <span className="text-zinc-500" title="Stable market">
        →
      </span>
    )
  }
  if (t === 'declining') {
    return (
      <span className="text-red-400" title="Trending down">
        ↓
      </span>
    )
  }
  return <span className="text-zinc-600">—</span>
}

function GainLossCell ({ c }: { c: Card }) {
  const d = cardGainDollars(c)
  const p = cardGainPercent(c)
  const paid = c.purchase_price != null ? Number(c.purchase_price) : null
  const est = c.current_value != null ? Number(c.current_value) : null

  if (paid != null && est != null && d != null && p != null) {
    const pos = d >= 0
    return (
      <div className="text-right text-[11px] leading-snug">
        <div className="text-zinc-500">
          Paid {money.format(paid)} → Est. {money.format(est)}
        </div>
        <div className={[pos ? 'text-slab-teal' : 'text-red-400', 'mt-0.5 font-semibold tabular-nums'].join(' ')}>
          {d >= 0 ? '+' : ''}
          {money.format(d)}
          <span className="ml-1 font-normal text-zinc-500 tabular-nums">{pct.format(p / 100)}</span>
        </div>
      </div>
    )
  }

  if (d == null || p == null) {
    return <span className="text-zinc-500">—</span>
  }
  const pos = d >= 0
  return (
    <div className="text-right tabular-nums">
      <div className={[pos ? 'text-slab-teal' : 'text-red-400', 'font-medium'].join(' ')}>
        {d >= 0 ? '+' : ''}
        {money.format(d)}
      </div>
      <div className="text-[11px] text-zinc-500">{pct.format(p / 100)}</div>
    </div>
  )
}

function CardDetailsCell ({
  c,
  onViewImage,
}: {
  c: Card
  onViewImage: () => void
}) {
  const bits = [c.year != null ? String(c.year) : null, c.set_name?.trim() || null].filter(Boolean)
  const sub = bits.join(' · ')
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CardThumbnail card={c} variant="table" onClick={onViewImage} />
      <div className="min-w-0">
        <p className="font-medium text-white">{c.player_name}</p>
        {sub && <p className="mt-0.5 truncate text-[11px] text-zinc-500" title={sub}>{sub}</p>}
        <p className="text-[11px] text-zinc-500">
          {formatGradeLine(c)}
          {c.card_number ? ` · #${c.card_number}` : ''}
        </p>
        <SportsCardCompLinks card={c} className="mt-1.5" />
      </div>
    </div>
  )
}

function SummaryStat ({
  label,
  children,
  sub,
  valueTone,
}: {
  label: string
  children: ReactNode
  sub?: ReactNode
  valueTone?: 'positive' | 'negative' | 'neutral'
}) {
  const toneCls =
    valueTone === 'positive'
      ? 'text-slab-teal'
      : valueTone === 'negative'
        ? 'text-red-400'
        : 'text-white'
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <div className={['mt-1 truncate text-lg font-semibold tabular-nums sm:text-xl', toneCls].join(' ')}>
        {children}
      </div>
      {sub ? <p className="mt-0.5 truncate text-xs text-zinc-500">{sub}</p> : null}
    </div>
  )
}

export function MarketValuesPage () {
  const { user, session } = useAuth()
  const { profile, loading: profileLoading } = useUserProfile(user?.id)
  const [gateCheckout, setGateCheckout] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshingValues, setRefreshingValues] = useState(false)
  const [estimateProgress, setEstimateProgress] = useState<{ current: number; total: number } | null>(null)
  const [estimateDone, setEstimateDone] = useState<string | null>(null)
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({})
  const [imageModalCard, setImageModalCard] = useState<Card | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('gain_pct')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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
      .channel(`market-values-cards-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: `user_id=eq.${user.id}` },
        () => {
          void loadCards({ silent: true })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, loadCards])

  useEffect(() => {
    document.title = 'Market Values — SlabBook'
  }, [])

  const metrics = useMemo(() => computePortfolioMetrics(cards), [cards])
  const sortedCards = useMemo(
    () => sortCardsMarket(cards, sortKey, sortDir),
    [cards, sortKey, sortDir],
  )

  const estimatedCount = useMemo(
    () => cards.filter((c) => c.current_value != null).length,
    [cards],
  )
  const hasNoEstimates = cards.length > 0 && estimatedCount === 0

  const gainPositive = metrics.gainLossDollars >= 0
  const gainPctStr =
    metrics.gainLossPercent != null ? pct.format(metrics.gainLossPercent / 100) : '—'

  function toggleSort (key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'player' ? 'asc' : 'desc')
    }
  }

  function sortIndicator (key: SortKey): string {
    if (key !== sortKey) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
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

  async function refreshSingle (card: Card) {
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
      setError(err instanceof Error ? err.message : 'Unable to refresh estimate.')
    } finally {
      setRefreshingIds((prev) => {
        const next = { ...prev }
        delete next[card.id]
        return next
      })
    }
  }

  const progressPct =
    estimateProgress && estimateProgress.total > 0
      ? Math.round((estimateProgress.current / estimateProgress.total) * 100)
      : 0

  const marketAccess = canUseMarketValuesTab(profile)

  if (user && profileLoading) {
    return (
      <div className="flex justify-center py-24">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-slab-teal"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (user && !marketAccess) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Market Values</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Live market value tracking and the Market Values dashboard are included with Pro. Get Pro to see comps,
          trends, and bulk estimates across your collection.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/pricing"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-600 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
          >
            View all plans
          </Link>
          <button
            type="button"
            disabled={gateCheckout || !session?.access_token}
            onClick={() => {
              if (!session?.access_token) return
              setGateCheckout(true)
              void (async () => {
                try {
                  const url = await createCheckoutSession(session.access_token, 'pro', '')
                  window.location.href = url
                } catch (e) {
                  window.alert(e instanceof Error ? e.message : 'Checkout failed.')
                } finally {
                  setGateCheckout(false)
                }
              })()
            }}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slab-teal px-5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
          >
            {gateCheckout ? 'Redirecting…' : 'Get Pro'}
          </button>
        </div>
      </div>
    )
  }

  function SortTh ({
    k,
    label,
    className = '',
  }: {
    k: SortKey
    label: string
    className?: string
  }) {
    return (
      <th scope="col" className={className}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="flex w-full items-center gap-1 text-left font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
        >
          {label}
          <span className="tabular-nums text-slab-teal-light/80">{sortIndicator(k)}</span>
        </button>
      </th>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Market Values</h1>
            <p className="mt-1 text-sm text-zinc-400">
              AI-estimated values based on historical card market data
            </p>
          </div>
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-2.5 text-xs leading-relaxed text-amber-100/85">
            {MARKET_VALUES_BANNER}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
          <button
            type="button"
            onClick={() => void estimateAllValues()}
            disabled={refreshingValues || cards.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slab-teal px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50 sm:w-auto"
          >
            {refreshingValues && estimateProgress
              ? `Estimating ${estimateProgress.current} of ${estimateProgress.total} cards…`
              : refreshingValues
                ? 'Working…'
                : 'Estimate All Values'}
          </button>
          {refreshingValues && estimateProgress && (
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-zinc-800 sm:ml-auto">
              <div
                className="h-full rounded-full bg-slab-teal transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={estimateProgress.current}
                aria-valuemin={0}
                aria-valuemax={estimateProgress.total}
              />
            </div>
          )}
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

      {cards.length === 0 && !loading && (
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-6 py-12 text-center">
          <p className="text-lg font-medium text-white">No cards yet</p>
          <p className="mt-2 text-sm text-zinc-400">
            Add cards in your collection to see market value estimates here.
          </p>
          <Link
            to="/dashboard/collection"
            className="mt-6 inline-flex rounded-lg bg-slab-teal px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-slab-teal-light"
          >
            Go to Collection
          </Link>
        </div>
      )}

      {hasNoEstimates && !loading && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-6 py-8 text-center">
          <p className="text-lg font-semibold text-amber-100/95">No estimates yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
            SlabBook uses Claude to suggest low, mid, and high values from training knowledge of the hobby market.
            Run a bulk estimate to fill in the table, or refresh one card at a time after each estimate completes.
          </p>
          <button
            type="button"
            onClick={() => void estimateAllValues()}
            disabled={refreshingValues}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-slab-teal px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
          >
            Estimate All Values
          </button>
        </div>
      )}

      {cards.length > 0 && (
        <>
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
              <SummaryStat label="Total estimated value">
                {loading ? '—' : money.format(metrics.totalValue)}
              </SummaryStat>
              <SummaryStat label="Total invested">{loading ? '—' : money.format(metrics.totalInvested)}</SummaryStat>
              <SummaryStat
                label="Total gain / loss"
                sub={
                  metrics.gainLossPercent != null ? (
                    <span className={gainPositive ? 'text-slab-teal/90' : 'text-red-400/90'}>
                      {gainPctStr} portfolio
                    </span>
                  ) : (
                    <span>Add purchase prices for %</span>
                  )
                }
                valueTone={loading ? 'neutral' : gainPositive ? 'positive' : 'negative'}
              >
                {loading ? '—' : money.format(metrics.gainLossDollars)}
              </SummaryStat>
              <SummaryStat
                label="Best performer"
                sub={
                  metrics.bestPerformer ? (
                    <span
                      className={
                        metrics.bestPerformer.gainPercent >= 0 ? 'text-slab-teal/90' : 'text-red-400/90'
                      }
                    >
                      {pct.format(metrics.bestPerformer.gainPercent / 100)} vs cost
                    </span>
                  ) : (
                    <span>Needs paid + estimate</span>
                  )
                }
              >
                {loading ? (
                  '—'
                ) : metrics.bestPerformer ? (
                  <span className="truncate text-zinc-100" title={metrics.bestPerformer.card.player_name}>
                    {metrics.bestPerformer.card.player_name}
                  </span>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </SummaryStat>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)] text-xs">
                    <SortTh k="player" label="Player / card" className="px-3 py-3 lg:px-4" />
                    <SortTh k="purchased" label="Purchased" className="px-3 py-3 text-right lg:px-4" />
                    <SortTh k="est_low" label="Est. low" className="px-3 py-3 text-right lg:px-4" />
                    <SortTh k="est_mid" label="Est. value" className="px-3 py-3 text-right lg:px-4" />
                    <SortTh k="est_high" label="Est. high" className="px-3 py-3 text-right lg:px-4" />
                    <SortTh k="confidence" label="Confidence" className="px-3 py-3 lg:px-4" />
                    <SortTh k="trend" label="Trend" className="px-3 py-3 lg:px-4" />
                    <SortTh k="gain_pct" label="Gain / loss" className="px-3 py-3 text-right lg:px-4" />
                    <SortTh k="last_updated" label="Last updated" className="px-3 py-3 lg:px-4" />
                    <th scope="col" className="px-3 py-3 text-right font-medium uppercase tracking-wider text-zinc-500 lg:px-4">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {sortedCards.map((c) => {
                    const missingEst = c.current_value == null
                    const note = c.value_note?.trim() ?? ''
                    const busy = Boolean(refreshingIds[c.id])
                    return (
                      <tr
                        key={c.id}
                        className={[
                          'text-zinc-200',
                          missingEst ? 'bg-amber-500/[0.04]' : '',
                          busy ? 'bg-slab-teal/[0.06] shadow-[inset_3px_0_0_0_rgba(45,212,191,0.55)]' : '',
                          'hover:bg-white/[0.03]',
                        ].join(' ')}
                      >
                        <td className="px-3 py-3 lg:px-4">
                          <CardDetailsCell c={c} onViewImage={() => setImageModalCard(c)} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-zinc-300 lg:px-4">
                          {c.purchase_price != null ? money.format(Number(c.purchase_price)) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums lg:px-4">
                          {c.value_low != null ? money.format(Number(c.value_low)) : '—'}
                        </td>
                        <td className="px-3 py-3 text-right lg:px-4">
                          {c.current_value != null ? (
                            <span className="text-base font-bold tabular-nums text-white">
                              {money.format(Number(c.current_value))}
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums lg:px-4">
                          {c.value_high != null ? money.format(Number(c.value_high)) : '—'}
                        </td>
                        <td className="px-3 py-3 lg:px-4">
                          {missingEst ? (
                            <span className="inline-flex rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200/80">
                              Not estimated
                            </span>
                          ) : (
                            <ConfidenceBadgeCell confidence={c.confidence} />
                          )}
                        </td>
                        <td className="px-3 py-3 text-lg lg:px-4">
                          {missingEst ? <span className="text-zinc-600">—</span> : <TrendCell trend={c.trend} />}
                        </td>
                        <td className="px-3 py-3 lg:px-4">
                          <GainLossCell c={c} />
                        </td>
                        <td className="px-3 py-3 text-xs text-zinc-500 lg:px-4">
                          {formatRelativeTime(c.last_updated)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right lg:px-4">
                          <button
                            type="button"
                            onClick={() => void refreshSingle(c)}
                            disabled={busy}
                            className="inline-flex rounded-md p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                            title="Re-estimate this card"
                            aria-label="Re-estimate this card"
                          >
                            {busy ? (
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-slab-teal" />
                            ) : (
                              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={!note}
                            className={[
                              'ml-1 inline-flex rounded-md p-2 align-middle',
                              note
                                ? 'cursor-help text-zinc-400 hover:bg-white/5 hover:text-white'
                                : 'cursor-not-allowed text-zinc-700 opacity-40',
                            ].join(' ')}
                            title={note || 'No reasoning available yet'}
                            aria-label={note ? 'Show AI reasoning (tooltip)' : 'No reasoning available yet'}
                          >
                            <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-center text-[11px] leading-relaxed text-zinc-600">
            Powered by Claude AI · Values update every 48 hours · Switch to live eBay pricing coming soon
          </p>
        </>
      )}

      <CardImageModal
        card={imageModalCard}
        open={imageModalCard != null}
        onClose={() => setImageModalCard(null)}
        money={money}
        refreshing={Boolean(imageModalCard && refreshingIds[imageModalCard.id])}
        onRefreshValue={(c) => void refreshSingle(c)}
      />
    </div>
  )
}
