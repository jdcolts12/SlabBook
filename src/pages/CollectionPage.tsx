import { useCallback, useEffect, useState } from 'react'
import { CardFormDialog } from '../components/collection/CardFormDialog'
import { type CardFormValues, variationFromFormValues } from '../lib/cardForm'
import { Toast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Card } from '../types/card'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

type CardValueResponse = {
  average_sale_price: number
  lowest_recent_sale: number
  highest_recent_sale: number
  last_sold_date: string | null
  last_sold_price: number
  ebay_search_url: string
  updated_at: string
}

function formatRelativeTime(value: string | null): string {
  if (!value) return 'Never'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Unknown'
  const diffMs = Date.now() - timestamp
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return 'Updated <1 hour ago'
  if (hours === 1) return 'Updated 1 hour ago'
  if (hours < 24) return `Updated ${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Updated 1 day ago' : `Updated ${days} days ago`
}

function parseOptionalNumber (raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number.parseFloat(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseOptionalInt (raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

function formValuesToPayload (
  userId: string,
  v: CardFormValues,
): Omit<Card, 'id' | 'created_at' | 'last_updated'> {
  return {
    user_id: userId,
    sport: v.sport,
    player_name: v.player_name.trim(),
    year: parseOptionalInt(v.year),
    set_name: v.set_name.trim() || null,
    card_number: v.card_number.trim() || null,
    variation: variationFromFormValues(v),
    is_graded: v.is_graded,
    grade: v.is_graded && v.grade.trim() ? v.grade.trim() : null,
    grading_company: v.is_graded && v.grading_company.trim() ? v.grading_company.trim() : null,
    condition: v.is_graded ? null : v.condition.trim() || null,
    purchase_price: parseOptionalNumber(v.purchase_price),
    purchase_date: v.purchase_date.trim() || null,
    current_value: parseOptionalNumber(v.current_value),
  }
}

export function CollectionPage () {
  const { user } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add')
  const [editing, setEditing] = useState<Card | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const loadCards = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) {
      setLoading(false)
      return
    }
    if (!opts?.silent) setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError(error.message)
        setCards([])
      } else {
        setCards((data ?? []) as Card[])
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    document.title = 'Collection — SlabBook'
  }, [])

  useEffect(() => {
    void loadCards()
  }, [loadCards])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`collection-cards-${user.id}`)
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

  function openAdd () {
    setDialogMode('add')
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit (c: Card) {
    setDialogMode('edit')
    setEditing(c)
    setDialogOpen(true)
  }

  async function handleSubmit (values: CardFormValues) {
    if (!user) throw new Error('Not signed in.')
    const payload = formValuesToPayload(user.id, values)

    if (dialogMode === 'add') {
      const { error } = await supabase.from('cards').insert({
        ...payload,
        last_updated: new Date().toISOString(),
      })
      if (error) throw new Error(error.message)
      setToastMessage('Card added to your collection.')
    } else if (editing) {
      const { error } = await supabase
        .from('cards')
        .update({
          ...payload,
          last_updated: new Date().toISOString(),
        })
        .eq('id', editing.id)
        .eq('user_id', user.id)
      if (error) throw new Error(error.message)
    }

    await loadCards({ silent: true })
  }

  async function handleDelete (c: Card) {
    if (!user) return
    const ok = window.confirm(`Remove "${c.player_name}" from your collection?`)
    if (!ok) return
    const { error } = await supabase.from('cards').delete().eq('id', c.id).eq('user_id', user.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await loadCards({ silent: true })
  }

  async function refreshSingleCardValue (card: Card) {
    setLoadError(null)
    setRefreshingIds((prev) => ({ ...prev, [card.id]: true }))

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Missing auth session. Please sign in again.')
      }

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

      const payload = (await response.json().catch(() => null)) as
        | (CardValueResponse & { error?: string })
        | null
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to refresh value.')
      }

      setCards((prev) =>
        prev.map((entry) =>
          entry.id === card.id
            ? {
                ...entry,
                current_value: payload?.average_sale_price ?? entry.current_value,
                last_updated: payload?.updated_at ?? new Date().toISOString(),
              }
            : entry,
        ),
      )
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to refresh value.')
    } finally {
      setRefreshingIds((prev) => {
        const next = { ...prev }
        delete next[card.id]
        return next
      })
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Collection</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track players, sets, grading, and cost basis — market values can follow from comps later.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add card
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400"
            role="status"
            aria-label="Loading collection"
          />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-[var(--color-surface-raised)]/50 px-6 py-16 text-center">
          <p className="text-zinc-300">No cards yet.</p>
          <p className="mt-2 text-sm text-zinc-500">Add your first card to start building your portfolio.</p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-6 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
          >
            Add a card
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)] text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Set / #</th>
                  <th className="px-4 py-3 font-medium">Grading</th>
                  <th className="px-4 py-3 font-medium text-right">Purchase</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {cards.map((c) => (
                  <tr key={c.id} className="text-zinc-200 hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{c.player_name}</div>
                      {c.year != null && <div className="text-xs text-zinc-500">{c.year}</div>}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      <div>{c.set_name ?? '—'}</div>
                      <div className="text-xs text-zinc-500">{c.card_number ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {c.is_graded ? (
                        <>
                          <div>{[c.grading_company, c.grade].filter(Boolean).join(' ') || 'Graded'}</div>
                        </>
                      ) : (
                        <span className="text-zinc-500">Raw</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                      {c.purchase_price != null ? money.format(Number(c.purchase_price)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-300/90">
                      {c.current_value != null ? money.format(Number(c.current_value)) : '—'}
                      <div className="mt-1 text-[11px] text-zinc-500">{formatRelativeTime(c.last_updated)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void refreshSingleCardValue(c)}
                        disabled={Boolean(refreshingIds[c.id])}
                        className="mr-2 rounded-md px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                        title="Refresh market value"
                        aria-label="Refresh card value"
                      >
                        {refreshingIds[c.id] ? '...' : '↻'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="mr-2 rounded-md px-2 py-1 text-emerald-400 hover:bg-white/5 hover:text-emerald-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(c)}
                        className="rounded-md px-2 py-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CardFormDialog
        open={dialogOpen}
        mode={dialogMode}
        initial={editing}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
