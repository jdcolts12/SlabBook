/**
 * Central pricing entry point. Currently uses Claude for market estimates.
 * TODO: Replace getCardValue implementation with a real pricing API (e.g. 130point, eBay sold API)
 * when available — callers should keep using this module only.
 */

export type CardEstimateInput = {
  player_name: string
  year: number | null
  set_name: string | null
  card_number: string | null
  variation: string | null
  sport: string | null
  is_graded: boolean
  grade: number | null
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

const SYSTEM_PROMPT = `You are an expert sports card pricing analyst with deep knowledge of the NFL, NBA, and MLB trading card market. You have extensive knowledge of eBay sold listings, PSA population data, and collector demand trends for cards up to your training cutoff. Your job is to estimate current market values for sports cards. Always return honest estimates with appropriate confidence levels. Never fabricate specific sale prices. Return ONLY valid JSON, no other text.`

function buildUserPrompt (card: CardEstimateInput): string {
  const gradeLine =
    card.is_graded && card.grade != null
      ? `${card.grade}${card.grading_company ? ` (${card.grading_company})` : ''}`
      : 'N/A (raw)'

  return `Estimate the current market value for this sports card:

Player: ${card.player_name}
Year: ${card.year ?? 'Unknown'}
Set: ${card.set_name ?? 'Unknown'}
Card Number: ${card.card_number ?? 'N/A'}
Variation: ${card.variation ?? 'None'}
Sport: ${card.sport ?? 'Unknown'}
Graded: ${card.is_graded}
Grade: ${gradeLine}
Condition if raw: ${card.condition ?? 'N/A'}

Consider:
- Recent eBay sold listing ranges for this card
- PSA population (scarcity at this grade)
- Current player performance and market demand
- Set prestige (Prizm, Optic, Topps Chrome etc)
- Grade premium (PSA 10 vs PSA 9 price gap)

Return ONLY this JSON object, nothing else:
{
  "low": number,
  "mid": number,
  "high": number,
  "confidence": "high" | "medium" | "low",
  "reasoning": "One sentence explaining the estimate",
  "trend": "rising" | "stable" | "declining",
  "data_source": "Claude AI estimate"
}`
}

function extractJsonObject (raw: string): string {
  const t = raw.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) return fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) return t.slice(start, end + 1)
  return t
}

function normalizeEstimate (parsed: Record<string, unknown>): CardEstimateResult | null {
  const low = Number(parsed.low)
  const mid = Number(parsed.mid)
  const high = Number(parsed.high)
  if (![low, mid, high].every((n) => Number.isFinite(n) && n >= 0)) return null

  const confidence = parsed.confidence
  const trend = parsed.trend
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : ''
  const data_source =
    typeof parsed.data_source === 'string' ? parsed.data_source.trim() : 'Claude AI estimate'

  if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') return null
  if (trend !== 'rising' && trend !== 'stable' && trend !== 'declining') return null
  if (!reasoning) return null

  return {
    low: Math.round(low * 100) / 100,
    mid: Math.round(mid * 100) / 100,
    high: Math.round(high * 100) / 100,
    confidence,
    reasoning,
    trend,
    data_source,
  }
}

export async function getCardValue (
  card: CardEstimateInput,
  anthropicApiKey: string,
): Promise<{ ok: true; estimate: CardEstimateResult } | { ok: false; error: string }> {
  const userPrompt = buildUserPrompt(card)

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      temperature: 0.25,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  const payload = (await anthropicResponse.json().catch(() => null)) as {
    content?: { type?: string; text?: string }[]
    error?: { message?: string }
    message?: string
  } | null

  if (!anthropicResponse.ok) {
    const msg =
      payload?.error?.message || payload?.message || 'Claude API request failed.'
    return { ok: false, error: msg }
  }

  const text =
    payload?.content
      ?.filter((item) => item?.type === 'text')
      .map((item) => item?.text ?? '')
      .join('\n')
      .trim() ?? ''

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(extractJsonObject(text)) as Record<string, unknown>
  } catch {
    return { ok: false, error: 'Could not parse Claude response as JSON.' }
  }

  const estimate = normalizeEstimate(parsed)
  if (!estimate) {
    return { ok: false, error: 'Claude returned invalid estimate shape.' }
  }

  return { ok: true, estimate }
}
