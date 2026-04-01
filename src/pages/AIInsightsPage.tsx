import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { parseInsightSections, stripInsightMachineMetadata } from '../lib/parseInsightSections'
import { formatLastAnalyzed } from '../lib/relativeTime'
import { createCheckoutSession } from '../lib/stripeApi'
import { supabase } from '../lib/supabase'
import { canUseAiInsights } from '../lib/tierLimits'
import type { AIInsight } from '../types/insight'

function formatDate (value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

function formatGeneratedDateLine (value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCompactDate (value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

type GeneratingPhase = 'idle' | 'market' | 'insights'

function sectionSurfaceClass (title: string): string {
  const t = title.toLowerCase()
  if (t.includes('sell')) {
    return 'rounded-xl border border-orange-500/25 bg-orange-500/[0.07] pl-4 pr-4 py-4 sm:pl-5'
  }
  if (t.includes('strong hold')) {
    return 'rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] pl-4 pr-4 py-4 sm:pl-5'
  }
  if (t.includes('watch')) {
    return 'rounded-xl border border-yellow-500/25 bg-yellow-500/[0.06] pl-4 pr-4 py-4 sm:pl-5'
  }
  if (t.includes('hidden gem')) {
    return 'rounded-xl border border-violet-500/30 bg-violet-500/[0.08] pl-4 pr-4 py-4 sm:pl-5'
  }
  if (t.includes("this week")) {
    return 'rounded-xl border border-teal-500/40 bg-teal-500/15 pl-4 pr-4 py-4 sm:pl-5 ring-1 ring-teal-500/20'
  }
  return 'pl-0 pr-0 py-1'
}

function sectionHeadingClass (title: string): string {
  const t = title.toLowerCase()
  if (t.includes('sell')) return 'text-orange-200'
  if (t.includes('strong hold')) return 'text-emerald-200'
  if (t.includes('watch')) return 'text-yellow-100'
  if (t.includes('hidden gem')) return 'text-violet-200'
  if (t.includes("this week")) return 'text-teal-200'
  return 'text-white'
}

export function AIInsightsPage () {
  const { user, session } = useAuth()
  const { profile, loading: profileLoading } = useUserProfile(user?.id)
  const [gateCheckout, setGateCheckout] = useState(false)
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [readingIds, setReadingIds] = useState<Record<string, boolean>>({})
  const [cardCount, setCardCount] = useState<number | null>(null)
  const [infoBanner, setInfoBanner] = useState<string | null>(null)
  const [generatingPhase, setGeneratingPhase] = useState<GeneratingPhase>('idle')
  const [sessionInsightMeta, setSessionInsightMeta] = useState<{
    used_web_search?: boolean
    quality_disclaimer?: boolean
  } | null>(null)

  const loadInsights = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) {
      setLoading(false)
      return
    }
    if (!opts?.silent) setLoading(true)
    setError(null)
    const { data, error: insightsError } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (insightsError) {
      setError(insightsError.message)
      setInsights([])
    } else {
      setInsights((data ?? []) as AIInsight[])
    }
    setLoading(false)
  }, [user])

  const loadCardCount = useCallback(async () => {
    if (!user) return
    const { count, error: countError } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (!countError) setCardCount(count ?? 0)
  }, [user])

  useEffect(() => {
    document.title = 'AI Insights — SlabBook'
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInsights()
      void loadCardCount()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadInsights, loadCardCount])

  useEffect(() => {
    if (!generating) {
      setGeneratingPhase('idle')
      return
    }
    setGeneratingPhase('market')
    const t = window.setTimeout(() => setGeneratingPhase('insights'), 2800)
    return () => window.clearTimeout(t)
  }, [generating])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`insights-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_insights',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadInsights({ silent: true })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, loadInsights])

  const latest = insights[0]
  const latestDisplay = useMemo(() => {
    if (!latest) {
      return {
        displayContent: '',
        flags: { usedWebSearch: false, qualityVerify: false },
      }
    }
    return stripInsightMachineMetadata(latest.content)
  }, [latest])

  const latestSections = useMemo(
    () => (latest ? parseInsightSections(latestDisplay.displayContent) : []),
    [latest, latestDisplay.displayContent],
  )

  const usedWebSearchForLatest =
    sessionInsightMeta?.used_web_search ?? latestDisplay.flags.usedWebSearch
  const qualityDisclaimerForLatest =
    sessionInsightMeta?.quality_disclaimer ?? latestDisplay.flags.qualityVerify

  const unreadCount = insights.filter((insight) => !insight.is_read).length

  async function handleGetInsights () {
    if (!user) return
    setGenerating(true)
    setError(null)
    setInfoBanner(null)
    setSessionInsightMeta(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Missing auth session. Please sign in again and retry.')
      }

      const response = await fetch('/api/get-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })

      const contentType = response.headers.get('content-type') || ''
      const payload = (contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null) as
        | {
            error?: string
            no_cards?: boolean
            insight?: string
            used_web_search?: boolean
            quality_disclaimer?: boolean
          }
        | null

      if (!response.ok) {
        if (payload?.error) throw new Error(payload.error)
        const textBody = await response.text().catch(() => '')
        const brief = textBody.trim().slice(0, 240)
        throw new Error(
          brief
            ? `Insights request failed (${response.status}): ${brief}`
            : `Insights request failed (${response.status}).`,
        )
      }

      if (payload?.no_cards && payload.insight) {
        setInfoBanner(payload.insight)
        return
      }

      if (payload && typeof payload.used_web_search === 'boolean') {
        setSessionInsightMeta({
          used_web_search: payload.used_web_search,
          quality_disclaimer: Boolean(payload.quality_disclaimer),
        })
      }

      await loadInsights({ silent: true })
      await loadCardCount()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to get insights.')
    } finally {
      setGenerating(false)
    }
  }

  async function markAsRead (id: string) {
    if (!user) return
    setError(null)
    setReadingIds((prev) => ({ ...prev, [id]: true }))
    setInsights((prev) =>
      prev.map((insight) => (insight.id === id ? { ...insight, is_read: true } : insight)),
    )

    const { error: updateError } = await supabase
      .from('ai_insights')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
      setInsights((prev) =>
        prev.map((insight) => (insight.id === id ? { ...insight, is_read: false } : insight)),
      )
      setReadingIds((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    setReadingIds((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  /** Disable only when we know the collection is empty */
  const canAnalyze = cardCount !== 0
  const insightsAccess = canUseAiInsights(profile)

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

  if (user && !insightsAccess) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">AI Insights</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Daily AI portfolio analysis is included with Pro. Get Pro to unlock personalized sell opportunities,
          risks, and actions based on your slabs.
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

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">AI Insights</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Portfolio analysis powered by Claude — tailored to your slabs and pricing.
          </p>
          {unreadCount > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              {unreadCount} unread insight{unreadCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => void handleGetInsights()}
            disabled={generating || !canAnalyze}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slab-teal px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
          >
            {generating ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900"
                  aria-hidden
                />
                {generatingPhase === 'insights'
                  ? 'Generating your insights…'
                  : 'Analyzing current market…'}
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
                {latest ? `Refresh insights (${formatCompactDate(latest.created_at)})` : 'Get insights'}
              </>
            )}
          </button>
          {!canAnalyze && cardCount === 0 && (
            <p className="text-xs text-amber-400/90">Add cards in Collection first.</p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {infoBanner && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {infoBanner}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-slab-teal"
            role="status"
            aria-label="Loading insights"
          />
        </div>
      ) : !latest ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-[var(--color-surface-raised)]/60 px-6 py-16 text-center sm:py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slab-teal/10 ring-1 ring-slab-teal/25">
            <svg className="h-7 w-7 text-slab-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.176 7.176 0 00-3.726-1.728 7.176 7.176 0 00-3.726 1.728c.85.493 1.508 1.333 1.508 2.316V18"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-lg font-semibold text-white">No analysis yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            We&apos;ll pull your collection from Supabase, send it to SlabBook AI, and return portfolio health,
            sell opportunities, risks, a sleeper, and one action for this week.
          </p>
          <button
            type="button"
            onClick={() => void handleGetInsights()}
            disabled={generating || !canAnalyze}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-slab-teal px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
          >
            {generating
              ? generatingPhase === 'insights'
                ? 'Generating your insights…'
                : 'Analyzing current market…'
              : 'Get insights'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 text-sm text-zinc-500">
              <p>
                Last run:{' '}
                <span className="font-medium text-zinc-300">{formatLastAnalyzed(latest.created_at)}</span>
                <span className="text-zinc-600"> · </span>
                <span className="text-zinc-500">{formatDate(latest.created_at)}</span>
              </p>
              <p className="text-xs text-zinc-500">
                Generated {formatGeneratedDateLine(latest.created_at)} based on current market data.
              </p>
              {usedWebSearchForLatest && (
                <p className="text-xs font-medium text-teal-400/90">
                  Includes live market data for your top cards
                </p>
              )}
            </div>
            {latest && !latest.is_read && (
              <button
                type="button"
                onClick={() => void markAsRead(latest.id)}
                disabled={Boolean(readingIds[latest.id])}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50"
              >
                {readingIds[latest.id] ? 'Saving…' : 'Mark as read'}
              </button>
            )}
          </div>

          <div
            className={[
              'rounded-2xl border bg-[var(--color-surface-raised)] p-6 sm:p-8',
              latest.is_read
                ? 'border-[var(--color-border-subtle)]'
                : 'border-slab-teal/35 ring-1 ring-slab-teal/15',
            ].join(' ')}
          >
            <div className="mb-6 flex items-center gap-2">
              <span className="rounded-full bg-slab-teal/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slab-teal-light">
                Latest analysis
              </span>
              {!latest.is_read && (
                <span className="rounded-full bg-slab-teal/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slab-teal-light">
                  New
                </span>
              )}
            </div>

            <div className="space-y-8">
              {latestSections.length === 0 ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                  {latestDisplay.displayContent}
                </div>
              ) : (
                latestSections.map((section) => (
                  <section key={section.title} className={sectionSurfaceClass(section.title)}>
                    <h3
                      className={[
                        'border-b border-[var(--color-border-subtle)] pb-2 text-base font-semibold',
                        sectionHeadingClass(section.title),
                      ].join(' ')}
                    >
                      {section.title}
                    </h3>
                    <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                      {section.body || '—'}
                    </div>
                  </section>
                ))
              )}
            </div>

            {qualityDisclaimerForLatest && (
              <p className="mt-6 text-xs text-amber-200/90">
                Review these insights — some details may need verification.
              </p>
            )}
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              AI insights are educational and not financial advice. Always verify before acting on
              recommendations.
            </p>
          </div>

          {insights.length > 1 && (
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">Previous runs</h2>
              <ul className="mt-3 space-y-2">
                {insights.slice(1).map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]/80 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm text-zinc-400">
                        {stripInsightMachineMetadata(row.content)
                          .displayContent.replace(/^##[^\n]+\n?/m, '')
                          .trim()}
                      </p>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[10px] text-zinc-500">{formatLastAnalyzed(row.created_at)}</span>
                        {!row.is_read && (
                          <button
                            type="button"
                            onClick={() => void markAsRead(row.id)}
                            disabled={Boolean(readingIds[row.id])}
                            className="text-xs text-slab-teal hover:text-slab-teal-light disabled:opacity-50"
                          >
                            {readingIds[row.id] ? '…' : 'Mark read'}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-600">{formatDate(row.created_at)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
