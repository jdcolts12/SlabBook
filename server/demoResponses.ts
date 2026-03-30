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
  return `## Portfolio health summary
Demo mode — AI is disabled. This is placeholder copy for layout and QA.

## Top 3 opportunities
1. Example card A — review comps when AI is on.
2. Example card B
3. Example card C

## Top 3 risks
1. Market volatility on rookies
2. Grade sensitivity
3. Liquidity on niche sets

## Sleeper pick
Pick a card you like — real analysis requires Pro + live AI.

## Action this week
Turn off \`DEMO_MODE\` when you are ready to test real estimates.`
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
