import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CollectionSubnav } from '../components/collection/CollectionSubnav'
import { moneyFormatter } from '../lib/formatters'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { WatchlistItem } from '../types/watchlistItem'

const money = moneyFormatter

function rowLabel (row: WatchlistItem): string {
  if (row.detected_card_kind === 'pokemon_tcg') return 'Pokémon'
  if (row.sport) return row.sport
  return 'Sports'
}

export function WatchlistPage () {
  const { user } = useAuth()
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (qErr) setError(qErr.message)
    else setError(null)
    setItems(qErr ? [] : ((data ?? []) as WatchlistItem[]))
    setLoading(false)
  }, [user])

  useEffect(() => {
    document.title = 'Watchlist — SlabBook'
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function removeItem (id: string) {
    if (!user) return
    setDeletingId(id)
    setError(null)
    try {
      const { error: delErr } = await supabase.from('watchlist_items').delete().eq('id', id)
      if (delErr) throw new Error(delErr.message)
      setItems((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove item.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CollectionSubnav />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Watchlist</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Cards you saved from scan without adding to your collection.{' '}
          <Link to="/dashboard/collection?scan=1" className="text-slab-teal-muted hover:underline">
            Scan &amp; price
          </Link>
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-slab-teal"
            role="status"
            aria-label="Loading"
          />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 px-6 py-14 text-center text-sm text-zinc-500">
          Nothing on your watchlist yet. After a scan, choose &quot;Add to watchlist&quot; to save a snapshot
          here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-subtle)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Set / #</th>
                <th className="px-4 py-3 font-medium">Est.</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {items.map((row) => (
                <tr key={row.id} className="bg-[var(--color-surface-raised)]/40">
                  <td className="px-4 py-3 text-zinc-400">{rowLabel(row)}</td>
                  <td className="px-4 py-3 font-medium text-white">{row.player_name}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {[row.set_name, row.card_number].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-200">
                    {row.current_value != null
                      ? money.format(Number(row.current_value))
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void removeItem(row.id)}
                      disabled={deletingId === row.id}
                      className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                    >
                      {deletingId === row.id ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
