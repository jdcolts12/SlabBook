import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CollectionSubnav } from '../components/collection/CollectionSubnav'
import { PokemonCardCompLinks, SportsCardCompLinks } from '../components/collection/CardCompLinks'
import { formatPokemonGradeLine } from '../lib/cardMetrics'
import { moneyFormatter } from '../lib/formatters'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Card } from '../types/card'
import type { PokemonCard } from '../types/pokemonCard'

const money = moneyFormatter

type CombinedRow =
  | { kind: 'sports'; card: Card; sort: number }
  | { kind: 'pokemon'; card: PokemonCard; sort: number }

export function CombinedCollectionPage () {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sports, setSports] = useState<Card[]>([])
  const [pokemon, setPokemon] = useState<PokemonCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const [a, b] = await Promise.all([
      supabase.from('cards').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase
        .from('pokemon_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])
    const errs = [a.error?.message, b.error?.message].filter(Boolean)
    if (errs.length) setError(errs.join(' · '))
    else setError(null)
    setSports(a.error ? [] : ((a.data ?? []) as Card[]))
    setPokemon(b.error ? [] : ((b.data ?? []) as PokemonCard[]))
    setLoading(false)
  }, [user])

  useEffect(() => {
    document.title = 'All cards — SlabBook'
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo<CombinedRow[]>(() => {
    const out: CombinedRow[] = [
      ...sports.map((card) => ({
        kind: 'sports' as const,
        card,
        sort: new Date(card.created_at).getTime(),
      })),
      ...pokemon.map((card) => ({
        kind: 'pokemon' as const,
        card,
        sort: new Date(card.created_at).getTime(),
      })),
    ]
    out.sort((x, y) => y.sort - x.sort)
    return out
  }, [sports, pokemon])

  function editRow (row: CombinedRow) {
    if (row.kind === 'sports') {
      navigate('/dashboard/collection', { state: { editCardId: row.card.id } })
    } else {
      navigate('/dashboard/collection/pokemon', { state: { editPokemonCardId: row.card.id } })
    }
  }

  const totalCount = sports.length + pokemon.length

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6">
      <CollectionSubnav />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">All cards</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Combined view for totals and exports. Editing opens the correct collection (sports vs Pokémon).
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
      ) : totalCount === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 px-6 py-14 text-center text-sm text-zinc-500">
          Nothing here yet — add sports cards or Pokémon from the other tabs.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border-subtle)]">
          <p className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/60 px-4 py-2 text-xs text-zinc-500">
            {sports.length} sports · {pokemon.length} Pokémon · {totalCount} total
          </p>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Set / details</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium text-right">Value</th>
                <th className="px-4 py-3 font-medium text-right">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {rows.map((row) => {
                if (row.kind === 'sports') {
                  const c = row.card
                  const grade = c.is_graded
                    ? [c.grading_company, c.grade].filter(Boolean).join(' ') || 'Graded'
                    : c.condition || 'Raw'
                  return (
                    <tr key={`s-${c.id}`} className="bg-[var(--color-surface-raised)]/40">
                      <td className="px-4 py-3 text-xs font-medium text-slab-teal-muted">Sports</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{c.player_name}</div>
                        <SportsCardCompLinks card={c} className="mt-1" />
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-zinc-400">
                        {[c.year, c.set_name].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{grade}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                        {c.current_value != null ? money.format(Number(c.current_value)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => editRow(row)}
                          className="text-xs font-medium text-slab-teal hover:text-slab-teal-light"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  )
                }
                const c = row.card
                return (
                  <tr key={`p-${c.id}`} className="bg-[var(--color-surface-raised)]/40">
                    <td className="px-4 py-3 text-xs font-medium text-amber-200/90">Pokémon</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{c.pokemon_name}</div>
                      <PokemonCardCompLinks card={c} className="mt-1" />
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-zinc-400">
                      {c.language === 'jp' ? 'JP' : 'EN'}
                      {c.set_name ? ` · ${c.set_name}` : ''}
                      {c.card_number ? ` #${c.card_number}` : ''}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{formatPokemonGradeLine(c)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                      {c.current_value != null ? money.format(Number(c.current_value)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => editRow(row)}
                        className="text-xs font-medium text-slab-teal hover:text-slab-teal-light"
                      >
                        Open
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
