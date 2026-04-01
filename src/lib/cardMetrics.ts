import type { Card } from '../types/card'
import type { PokemonCard } from '../types/pokemonCard'

export function cardGainDollars (c: Card): number | null {
  const v = c.current_value != null ? Number(c.current_value) : null
  const p = c.purchase_price != null ? Number(c.purchase_price) : null
  if (v == null || p == null) return null
  return v - p
}

export function cardGainPercent (c: Card): number | null {
  const p = c.purchase_price != null ? Number(c.purchase_price) : null
  if (p == null || p <= 0) return null
  const v = c.current_value != null ? Number(c.current_value) : null
  if (v == null) return null
  return ((v - p) / p) * 100
}

export type PortfolioMetrics = {
  totalValue: number
  totalValueLow: number
  totalValueHigh: number
  totalInvested: number
  gainLossDollars: number
  gainLossPercent: number | null
  count: number
  bestPerformer: { card: Card; gainPercent: number } | null
}

export function computePortfolioMetrics (cards: Card[]): PortfolioMetrics {
  let totalValue = 0
  let totalValueLow = 0
  let totalValueHigh = 0
  let totalInvested = 0

  for (const c of cards) {
    const mid = Number(c.current_value ?? 0)
    const low = c.value_low != null ? Number(c.value_low) : mid
    const high = c.value_high != null ? Number(c.value_high) : mid
    totalValue += mid
    totalValueLow += low
    totalValueHigh += high
    totalInvested += Number(c.purchase_price ?? 0)
  }

  const gainLossDollars = totalValue - totalInvested
  const gainLossPercent =
    totalInvested > 0 ? (gainLossDollars / totalInvested) * 100 : null

  let best: { card: Card; gainPercent: number } | null = null
  for (const c of cards) {
    const g = cardGainPercent(c)
    if (g == null) continue
    if (!best || g > best.gainPercent) best = { card: c, gainPercent: g }
  }

  return {
    totalValue,
    totalValueLow,
    totalValueHigh,
    totalInvested,
    gainLossDollars,
    gainLossPercent,
    count: cards.length,
    bestPerformer: best,
  }
}

export function sumPokemonFinancials (pokemon: PokemonCard[]): {
  totalValue: number
  totalInvested: number
  count: number
} {
  let totalValue = 0
  let totalInvested = 0
  for (const c of pokemon) {
    totalValue += Number(c.current_value ?? 0)
    totalInvested += Number(c.purchase_price ?? 0)
  }
  return { totalValue, totalInvested, count: pokemon.length }
}

/** Dashboard-style rollup; Pokémon uses mid value only for low/high range. */
export function mergeSportsAndPokemonMetrics (
  sports: PortfolioMetrics,
  pokemon: PokemonCard[],
): PortfolioMetrics {
  const p = sumPokemonFinancials(pokemon)
  const totalValue = sports.totalValue + p.totalValue
  const totalInvested = sports.totalInvested + p.totalInvested
  const gainLossDollars = totalValue - totalInvested
  const gainLossPercent =
    totalInvested > 0 ? (gainLossDollars / totalInvested) * 100 : null
  return {
    totalValue,
    totalValueLow: sports.totalValueLow + p.totalValue,
    totalValueHigh: sports.totalValueHigh + p.totalValue,
    totalInvested,
    gainLossDollars,
    gainLossPercent,
    count: sports.count + p.count,
    bestPerformer: sports.bestPerformer,
  }
}

export function formatPokemonGradeLine (c: PokemonCard): string {
  if (!c.is_graded) return 'Raw'
  const bits = [c.grading_company, c.grade].filter(Boolean)
  return bits.length ? bits.join(' ') : 'Graded'
}

export type SortKey = 'value' | 'gain_pct' | 'player' | 'date_added'

export function sortCards (cards: Card[], sortBy: SortKey): Card[] {
  const next = [...cards]
  switch (sortBy) {
    case 'value':
      return next.sort((a, b) => {
        const va = a.current_value != null ? Number(a.current_value) : -Infinity
        const vb = b.current_value != null ? Number(b.current_value) : -Infinity
        return vb - va
      })
    case 'gain_pct': {
      return next.sort((a, b) => {
        const ga = cardGainPercent(a)
        const gb = cardGainPercent(b)
        const va = ga ?? -Infinity
        const vb = gb ?? -Infinity
        return vb - va
      })
    }
    case 'player':
      return next.sort((a, b) =>
        a.player_name.localeCompare(b.player_name, undefined, { sensitivity: 'base' }),
      )
    case 'date_added':
      return next.sort((a, b) => {
        const ta = new Date(a.created_at).getTime()
        const tb = new Date(b.created_at).getTime()
        return tb - ta
      })
    default:
      return next
  }
}

export function formatGradeLine (c: Card): string {
  if (!c.is_graded) return 'Raw'
  const bits = [c.grading_company, c.grade].filter(Boolean)
  return bits.length ? bits.join(' ') : 'Graded'
}
