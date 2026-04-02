import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WatchlistItemCompLinks } from '../components/collection/CardCompLinks'
import { CollectionSubnav } from '../components/collection/CollectionSubnav'
import { removeCardImageByPublicUrl } from '../lib/cardImageStorage'
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

  async function removeItem (row: WatchlistItem) {
    if (!user) return
    setDeletingId(row.id)
    setError(null)
    try {
      if (row.image_front_url?.trim()) {
        await removeCardImageByPublicUrl(supabase, row.image_front_url)
      }
      const { error: delErr } = await supabase.from('watchlist_items').delete().eq('id', row.id)
      if (delErr) throw new Error(delErr.message)
      setItems((prev) => prev.filter((x) => x.id !== row.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove item.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6">
      <CollectionSubnav />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Watchlist</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Cards you saved from scan without adding to your collection.{' '}
          <Link
            to="/dashboard/collection?scan=1"
            className="font-semibold text-emerald-400 underline-offset-4 hover:text-emerald-300 hover:underline"
          >
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-12 px-2 py-2 font-medium" aria-label="Thumbnail" />
                <th className="px-3 py-2 font-medium">Card</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Set / #</th>
                <th className="px-3 py-2 font-medium">Est.</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {items.map((row) => {
                const thumb = row.image_front_url?.trim()
                return (
                  <tr key={row.id} className="bg-[var(--color-surface-raised)]/40">
                    <td className="w-12 px-2 py-2 align-middle">
                      <div
                        className="mx-auto flex h-11 w-8 shrink-0 overflow-hidden rounded border border-zinc-700/80 bg-zinc-900/80"
                        title={thumb ? 'Scan photo' : 'No photo saved'}
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="m-auto text-[9px] leading-none text-zinc-600">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-white">{row.player_name}</p>
                      <WatchlistItemCompLinks item={row} className="mt-1" />
                    </td>
                    <td className="px-3 py-2 align-top text-zinc-400">{rowLabel(row)}</td>
                    <td className="px-3 py-2 align-top text-zinc-300">
                      {[row.set_name, row.card_number].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-2 align-top tabular-nums text-zinc-200">
                      {row.current_value != null
                        ? money.format(Number(row.current_value))
                        : '—'}
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <button
                        type="button"
                        onClick={() => void removeItem(row)}
                        disabled={deletingId === row.id}
                        className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        {deletingId === row.id ? 'Removing…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
