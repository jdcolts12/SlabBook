type CardEstimateInput = {
  player_name: string
  year: number | null
  set_name: string | null
  card_number: string | null
  variation: string | null
  sport: string | null
  is_graded: boolean
  grade: number | null
  grade_display: string | null
  grading_company: string | null
  condition: string | null
}

export type CardEstimateResult = {
  low: number
  mid: number
  high: number
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  trend: 'rising' | 'stable' | 'declining'
  data_source: string
}

export function fakeCardEstimate (card: CardEstimateInput): CardEstimateResult {
  const label = [card.player_name, card.year, card.set_name].filter(Boolean).join(' · ') || 'this card'
  return {
    low: 18,
    mid: 42,
    high: 95,
    confidence: 'medium',
    reasoning: `Demo mode — not a real estimate. Example range for ${label}.`,
    trend: 'stable',
    data_source: 'demo_mode',
  }
}

export function fakeInsightsMarkdown (): string {
  return `## Portfolio health
Demo mode — AI is disabled. This sample shows the ${new Date().getUTCFullYear()} layout: your portfolio has $0.00 invested across 0 live cards until you turn off \`DEMO_MODE\`. Diversification and risk notes will reference real player names and dollar amounts once connected.

## Sell candidates
1. Demo Player 2020 Demo Set PSA 10 — if this were real at $500 purchase and $650 value, we would cite holding period and annualized return here with a sell rationale tied to ${new Date().getUTCFullYear()} market context.

## Strong holds
1. Demo Player 2020 Demo Set PSA 10 — upside would be explained with a catalyst and timeframe, using exact labels from your collection.

## Watch list
- Demo Player 2020 — monitor for injury or performance shifts; placeholder until live data runs.

## Hidden gem
Demo Player 2020 Demo Set — undervalued narrative would cite comps and population when available.

## This week's action
Turn off \`DEMO_MODE\` and run insights with a real collection to test web context + Claude.`
}

export function fakeIdentifyPayload (): Record<string, unknown> {
  return {
    player_name: 'Demo Player',
    year: '2020',
    set_name: 'Demo Set',
    card_number: '1',
    variation: '',
    sport: 'MLB',
    grading_company: null,
    grade: null,
    is_graded: false,
    confidence: 'low',
    notes: 'Demo mode — image was not analyzed. Disable DEMO_MODE for real identification.',
  }
}
