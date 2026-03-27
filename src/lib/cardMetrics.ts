import type { Card } from '../types/card'

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
  totalInvested: number
  gainLossDollars: number
  gainLossPercent: number | null
  count: number
  bestPerformer: { card: Card; gainPercent: number } | null
}

export function computePortfolioMetrics (cards: Card[]): PortfolioMetrics {
  let totalValue = 0
  let totalInvested = 0

  for (const c of cards) {
    totalValue += Number(c.current_value ?? 0)
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
    totalInvested,
    gainLossDollars,
    gainLossPercent,
    count: cards.length,
    bestPerformer: best,
  }
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
