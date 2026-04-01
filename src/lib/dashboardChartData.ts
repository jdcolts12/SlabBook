import type { Card } from '../types/card'
import type { PokemonCard } from '../types/pokemonCard'

/** Cumulative estimated portfolio value after each item was added (uses today’s estimates). */
export type PortfolioTimelinePoint = {
  at: number
  label: string
  value: number
}

export function buildPortfolioTimeline (
  cards: Card[],
  pokemon: PokemonCard[],
): PortfolioTimelinePoint[] {
  type Row = { at: number; v: number }
  const rows: Row[] = []
  for (const c of cards) {
    rows.push({ at: new Date(c.created_at).getTime(), v: Number(c.current_value ?? 0) })
  }
  for (const c of pokemon) {
    rows.push({ at: new Date(c.created_at).getTime(), v: Number(c.current_value ?? 0) })
  }
  rows.sort((a, b) => a.at - b.at)

  const label = (ms: number) =>
    new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const out: PortfolioTimelinePoint[] = []
  let cum = 0
  for (const r of rows) {
    cum += r.v
    out.push({ at: r.at, label: label(r.at), value: cum })
  }

  if (out.length === 1) {
    const only = out[0]
    return [
      { at: only.at - 86_400_000, label: label(only.at - 86_400_000), value: 0 },
      only,
    ]
  }

  return out
}

export type AllocationSlice = {
  name: string
  value: number
  color: string
}

const ALLOC_COLORS = [
  '#1d9e75',
  '#5dcaa5',
  '#3b82f6',
  '#a855f7',
  '#f59e0b',
  '#f43f5e',
  '#06b6d4',
  '#eab308',
]

/** By sport + Pokémon; uses current_value only. */
export function buildAllocationSlices (
  cards: Card[],
  pokemon: PokemonCard[],
): AllocationSlice[] {
  const map = new Map<string, number>()
  for (const c of cards) {
    const k = (c.sport?.trim() || 'Other sports').replace(/\s+/g, ' ')
    map.set(k, (map.get(k) ?? 0) + Number(c.current_value ?? 0))
  }
  const pkTotal = pokemon.reduce((s, c) => s + Number(c.current_value ?? 0), 0)
  if (pkTotal > 0) {
    map.set('Pokémon TCG', (map.get('Pokémon TCG') ?? 0) + pkTotal)
  }
  return [...map.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value,
      color: ALLOC_COLORS[i % ALLOC_COLORS.length]!,
    }))
}
