import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { AIInsight } from '../types/insight'

function formatDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export function AIInsightsPage() {
  const { user } = useAuth()
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [readingIds, setReadingIds] = useState<Record<string, boolean>>({})

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

  useEffect(() => {
    document.title = 'AI Insights — SlabBook'
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInsights()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadInsights])

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

  async function handleGenerateInsight() {
    if (!user) return
    setGenerating(true)
    setError(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Missing auth session. Please sign in again and retry.')
      }

      const response = await fetch('/api/generate-insight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to generate AI insight.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate insight.')
    } finally {
      setGenerating(false)
    }
  }

  async function markAsRead(id: string) {
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

  const unreadCount = insights.filter((insight) => !insight.is_read).length

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">AI insights</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Personalized commentary based on your collection data via Claude.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {unreadCount} unread insight{unreadCount === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleGenerateInsight()}
          disabled={generating}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate insight'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400"
            role="status"
            aria-label="Loading insights"
          />
        </div>
      ) : insights.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-[var(--color-surface-raised)]/50 px-6 py-16 text-center">
          <p className="text-zinc-300">No insights yet.</p>
          <p className="mt-2 text-sm text-zinc-500">
            Generate your first insight from the cards currently in your collection.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <article
              key={insight.id}
              className={[
                'rounded-xl border bg-[var(--color-surface-raised)] p-4',
                insight.is_read
                  ? 'border-[var(--color-border-subtle)]'
                  : 'border-emerald-500/40 ring-1 ring-emerald-500/20',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm leading-6 text-zinc-200">{insight.content}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={[
                      'rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wider',
                      insight.is_read
                        ? 'bg-zinc-700/50 text-zinc-300'
                        : 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
                    ].join(' ')}
                  >
                    {insight.is_read ? 'Read' : 'Unread'}
                  </span>
                  {!insight.is_read && (
                    <button
                      type="button"
                      onClick={() => void markAsRead(insight.id)}
                      disabled={Boolean(readingIds[insight.id])}
                      className="rounded-md border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                    >
                      {readingIds[insight.id] ? 'Saving…' : 'Mark read'}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-500">{formatDate(insight.created_at)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
