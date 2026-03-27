import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Card } from '../types/card'

export function DashboardHomePage () {
  const { user } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshingValues, setRefreshingValues] = useState(false)

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

  const metrics = useMemo(() => {
    const totalValue = cards.reduce((sum, c) => sum + Number(c.current_value ?? 0), 0)
    const totalCost = cards.reduce((sum, c) => sum + Number(c.purchase_price ?? 0), 0)
    const gainLoss = totalValue - totalCost
    const topByValue = [...cards]
      .filter((c) => c.current_value != null)
      .sort((a, b) => Number(b.current_value) - Number(a.current_value))
      .slice(0, 3)

    return {
      totalValue,
      totalCost,
      gainLoss,
      count: cards.length,
      topByValue,
    }
  }, [cards])

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

  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Portfolio overview, movers, and performance from your live collection.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAllValues()}
          disabled={refreshingValues || cards.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {refreshingValues ? 'Refreshing values…' : 'Refresh Values'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total value</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
            {loading ? '—' : money.format(metrics.totalValue)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{metrics.count} card{metrics.count === 1 ? '' : 's'} tracked</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Gain / loss</p>
          <p
            className={[
              'mt-2 text-3xl font-semibold tabular-nums',
              metrics.gainLoss >= 0 ? 'text-emerald-400' : 'text-red-400',
            ].join(' ')}
          >
            {loading ? '—' : money.format(metrics.gainLoss)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Cost basis: {loading ? '—' : money.format(metrics.totalCost)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-5 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Top cards by value</p>
          {loading ? (
            <p className="mt-3 text-sm text-zinc-500">Loading cards...</p>
          ) : metrics.topByValue.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Add current values to see top cards.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {metrics.topByValue.map((card) => (
                <li key={card.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-zinc-300">{card.player_name}</span>
                  <span className="shrink-0 tabular-nums text-emerald-300">
                    {money.format(Number(card.current_value ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-6">
        <h2 className="text-lg font-medium text-white">Quick start</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-zinc-400">
          <li>Add your Supabase keys in <code className="text-zinc-300">.env.local</code> and run the SQL in <code className="text-zinc-300">supabase/schema.sql</code>.</li>
          <li>Build out your collection under Collection — fields match your schema (graded/raw, grades, pricing).</li>
          <li>AI insights and price alerts will connect to Claude and email once those pieces are enabled.</li>
        </ul>
      </div>
    </div>
  )
}
