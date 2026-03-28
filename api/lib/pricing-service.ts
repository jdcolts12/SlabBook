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
  /** Numeric grade when parseable (e.g. 10 from "PSA 10"); optional hint for the model */
  grade: number | null
  /** Full slab label for the prompt (e.g. "PSA 10", "BGS 9.5", "SGC AUTH") */
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

const SYSTEM_PROMPT = `You are an expert sports card pricing analyst with deep knowledge of the NFL, NBA, and MLB trading card market. You have extensive knowledge of eBay sold listings, PSA population data, and collector demand trends for cards up to your training cutoff. Your job is to estimate current market values for sports cards. Always return honest estimates with appropriate confidence levels. Never fabricate specific sale prices.`

const SUBMIT_CARD_ESTIMATE_TOOL = {
  name: 'submit_card_estimate',
  description:
    'Submit the final USD value range and metadata for the sports card. Call this once with your best estimate.',
  input_schema: {
    type: 'object',
    properties: {
      low: {
        type: 'number',
        description: 'Low end of fair market range in USD (not cents)',
      },
      mid: {
        type: 'number',
        description: 'Most likely current value in USD',
      },
      high: {
        type: 'number',
        description: 'High end of fair market range in USD',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'How confident you are in this estimate',
      },
      reasoning: {
        type: 'string',
        description: 'One concise sentence explaining the estimate',
      },
      trend: {
        type: 'string',
        enum: ['rising', 'stable', 'declining'],
        description: 'Perceived near-term demand trend for this card',
      },
      data_source: {
        type: 'string',
        description: 'Always use the exact text: Claude AI estimate',
      },
    },
    required: ['low', 'mid', 'high', 'confidence', 'reasoning', 'trend'],
  },
} as const

function buildUserPrompt (card: CardEstimateInput): string {
  const gradeLine = card.is_graded
    ? card.grade_display?.trim() ||
      (card.grade != null
        ? `${card.grade}${card.grading_company ? ` (${card.grading_company})` : ''}`
        : 'Graded (details incomplete)')
    : 'N/A (raw)'

  return `Estimate the current market value for this sports card:

Player: ${card.player_name}
Year: ${card.year ?? 'Unknown'}
Set: ${card.set_name ?? 'Unknown'}
Card Number: ${card.card_number ?? 'N/A'}
Variation: ${card.variation ?? 'None'}
Sport: ${card.sport ?? 'Unknown'}
Graded: ${card.is_graded}
Grade / slab: ${gradeLine}
Condition if raw: ${card.condition ?? 'N/A'}

Consider:
- Recent eBay sold listing ranges for this card (conceptually, not fabricated exact comps)
- Scarcity at this grade if graded
- Current player performance and market demand
- Set prestige (Prizm, Optic, Topps Chrome, etc.)
- Grade premium (PSA 10 vs PSA 9, etc.)

Use the submit_card_estimate tool exactly once with dollar amounts as plain numbers (USD, not cents).`
}

function extractJsonFromFencedOrSlice (raw: string): string {
  const t = raw.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) return fence[1].trim()
  return t
}

/** First top-level {...} with balanced braces (reasoning text may contain { or }) */
function extractBalancedJsonObject (s: string): string | null {
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

function unwrapEstimatePayload (raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const inner = o.estimate ?? o.values ?? o.card_estimate ?? o.pricing ?? o.result
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>
  }
  return o
}

/** Accept plain numbers or strings like "$1,234" / "1234.50" */
function parseEstimateNumber (value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '').trim()
    if (!cleaned) return null
    const n = Number.parseFloat(cleaned)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return null
}

function normalizeConfidence (value: unknown): 'high' | 'medium' | 'low' {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (s === 'high' || s === 'very high') return 'high'
  if (s === 'medium' || s === 'med' || s === 'moderate' || s === 'average') return 'medium'
  if (s === 'low') return 'low'
  return 'medium'
}

function normalizeTrend (value: unknown): 'rising' | 'stable' | 'declining' {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (
    s === 'rising' ||
    s === 'up' ||
    s === 'increasing' ||
    s === 'growing' ||
    s === 'bullish'
  ) {
    return 'rising'
  }
  if (
    s === 'declining' ||
    s === 'down' ||
    s === 'falling' ||
    s === 'decreasing' ||
    s === 'bearish'
  ) {
    return 'declining'
  }
  if (
    s === 'stable' ||
    s === 'flat' ||
    s === 'sideways' ||
    s === 'steady' ||
    s === 'neutral' ||
    s === 'unchanged'
  ) {
    return 'stable'
  }
  return 'stable'
}

function pickEstimateFields (parsed: Record<string, unknown>): {
  low: number | null
  mid: number | null
  high: number | null
} {
  const low = parseEstimateNumber(
    parsed.low ?? parsed.min ?? parsed.floor ?? parsed.low_usd ?? parsed.low_end,
  )
  const mid = parseEstimateNumber(
    parsed.mid ??
      parsed.medium ??
      parsed.value ??
      parsed.current_value ??
      parsed.median ??
      parsed.estimate ??
      parsed.mid_usd ??
      parsed.estimated_value,
  )
  const high = parseEstimateNumber(
    parsed.high ?? parsed.max ?? parsed.ceiling ?? parsed.high_usd ?? parsed.high_end,
  )
  return { low, mid, high }
}

function normalizeEstimate (parsed: Record<string, unknown>): CardEstimateResult | null {
  let { low, mid, high } = pickEstimateFields(parsed)
  if (low == null || mid == null || high == null) return null

  if (low > high) {
    const t = low
    low = high
    high = t
  }
  mid = Math.min(high, Math.max(low, mid))

  const reasoning =
    typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
      ? parsed.reasoning.trim()
      : 'Estimate from card details and typical market behavior for this type of card.'
  const data_source =
    typeof parsed.data_source === 'string' && parsed.data_source.trim()
      ? parsed.data_source.trim()
      : 'Claude AI estimate'

  return {
    low: Math.round(low * 100) / 100,
    mid: Math.round(mid * 100) / 100,
    high: Math.round(high * 100) / 100,
    confidence: normalizeConfidence(parsed.confidence),
    reasoning,
    trend: normalizeTrend(parsed.trend),
    data_source,
  }
}

type AnthropicContentBlock = {
  type?: string
  text?: string
  name?: string
  input?: Record<string, unknown>
}

function recordFromToolUseBlocks (content: AnthropicContentBlock[] | undefined): Record<string, unknown> | null {
  if (!content?.length) return null
  for (const b of content) {
    if (b?.type !== 'tool_use') continue
    const inp = b.input
    if (!inp || typeof inp !== 'object') continue
    const rec = inp as Record<string, unknown>
    const { low, mid, high } = pickEstimateFields(rec)
    if (low != null && mid != null && high != null) return rec
    if (b.name === 'submit_card_estimate' && Object.keys(rec).length > 0) return rec
  }
  return null
}

function recordFromTextBlocks (content: AnthropicContentBlock[] | undefined): Record<string, unknown> | null {
  const text =
    content
      ?.filter((item) => item?.type === 'text')
      .map((item) => item?.text ?? '')
      .join('\n')
      .trim() ?? ''
  if (!text) return null

  const trimmed = extractJsonFromFencedOrSlice(text)
  const balanced = extractBalancedJsonObject(trimmed) ?? extractBalancedJsonObject(text)
  const attempts = [balanced, trimmed, text].filter(Boolean) as string[]

  for (const chunk of attempts) {
    try {
      const raw = JSON.parse(chunk) as unknown
      const unwrapped = unwrapEstimatePayload(raw)
      if (unwrapped) return unwrapped
    } catch {
      /* try next */
    }
  }
  return null
}

type AnthropicPayload = {
  content?: AnthropicContentBlock[]
  error?: { message?: string }
  message?: string
}

export async function getCardValue (
  card: CardEstimateInput,
  anthropicApiKey: string,
): Promise<{ ok: true; estimate: CardEstimateResult } | { ok: false; error: string }> {
  const userPrompt = buildUserPrompt(card)

  const model =
    typeof process.env.ANTHROPIC_MODEL === 'string' && process.env.ANTHROPIC_MODEL.trim()
      ? process.env.ANTHROPIC_MODEL.trim()
      : 'claude-sonnet-4-20250514'

  const useTools = process.env.PRICING_SKIP_TOOL_USE !== '1'

  const bodyWithTools = {
    model,
    max_tokens: 2048,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    tools: [SUBMIT_CARD_ESTIMATE_TOOL],
    tool_choice: { type: 'tool', name: 'submit_card_estimate' },
    messages: [{ role: 'user', content: userPrompt }],
  }

  const bodyTextOnly = {
    model,
    max_tokens: 2048,
    temperature: 0.2,
    system: `${SYSTEM_PROMPT} Return ONLY one JSON object, no markdown, with keys low, mid, high (numbers), confidence, reasoning, trend, data_source.`,
    messages: [{ role: 'user', content: `${userPrompt}\n\nReturn only valid JSON.` }],
  }

  async function callAnthropic (body: object): Promise<{ res: Response; payload: AnthropicPayload | null }> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const payload = (await res.json().catch(() => null)) as AnthropicPayload | null
    return { res, payload }
  }

  let { res: anthropicResponse, payload } = await callAnthropic(useTools ? bodyWithTools : bodyTextOnly)

  if (!anthropicResponse.ok && useTools && anthropicResponse.status === 400) {
    const hint = payload?.error?.message ?? ''
    if (/tool/i.test(hint) || /schema/i.test(hint)) {
      const second = await callAnthropic(bodyTextOnly)
      anthropicResponse = second.res
      payload = second.payload
    }
  }

  if (!anthropicResponse.ok) {
    const msg = payload?.error?.message || payload?.message || 'Claude API request failed.'
    return { ok: false, error: msg }
  }

  const record =
    recordFromToolUseBlocks(payload?.content) ?? recordFromTextBlocks(payload?.content)

  if (!record) {
    return {
      ok: false,
      error: useTools
        ? 'Could not read an estimate from Claude (no tool result and no parseable JSON). Retry, or set PRICING_SKIP_TOOL_USE=1 for JSON-only mode.'
        : 'Could not read an estimate from Claude (response was not valid JSON).',
    }
  }

  const estimate = normalizeEstimate(record)
  if (!estimate) {
    return {
      ok: false,
      error:
        'Claude returned fields that could not be turned into low/mid/high dollar amounts. Check model output format.',
    }
  }

  return { ok: true, estimate }
}
