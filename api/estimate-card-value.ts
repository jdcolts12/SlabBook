import { createClient } from '@supabase/supabase-js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
  writableEnded?: boolean
  headersSent?: boolean
  statusCode?: number
  end?: (chunk: string, encoding?: BufferEncoding, cb?: () => void) => void
}

type CardEstimateInput = {
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

type CardEstimateResult = {
  low: number
  mid: number
  high: number
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  trend: 'rising' | 'stable' | 'declining'
  data_source: string
}

const SYSTEM_PROMPT = `Sports card analyst (NFL/NBA/MLB). Use web search for eBay sold/listing comps when available. Ground USD low/mid/high in findings; wider range + lower confidence if comps thin. Do not invent exact sold prices.`

/** Anthropic server tool — executed by Anthropic (see web search tool docs) */
function getWebSearchTool (): Record<string, unknown> {
  const rawMax = process.env.PRICING_WEB_SEARCH_MAX_USES?.trim()
  const maxUses = rawMax ? Number.parseInt(rawMax, 10) : 3
  const tool: Record<string, unknown> = {
    name: 'web_search',
    /** Fewer searches = lower input TPM (org rate limits). Override via PRICING_WEB_SEARCH_MAX_USES. */
    max_uses: Number.isFinite(maxUses) && maxUses > 0 ? Math.min(10, maxUses) : 3,
  }
  const ver = process.env.PRICING_WEB_SEARCH_VERSION?.trim()
  if (ver === '20260209') {
    tool.type = 'web_search_20260209'
    /** Use direct-only invocation so dynamic filtering (code execution) is not required. */
    tool.allowed_callers = ['direct']
  } else {
    tool.type = 'web_search_20250305'
  }
  const domains = process.env.PRICING_WEB_SEARCH_ALLOWED_DOMAINS?.trim()
  if (domains) {
    tool.allowed_domains = domains.split(',').map((s) => s.trim()).filter(Boolean)
  } else if (process.env.PRICING_WEB_SEARCH_EBAY_ONLY === '1') {
    tool.allowed_domains = ['ebay.com']
  }
  return tool
}

/** Client-executed structured output tool */
const SUBMIT_CARD_ESTIMATE_TOOL = {
  name: 'submit_card_estimate',
  description:
    'Submit final USD low/mid/high once. After web_search if enabled; else from card context.',
  input_schema: {
    type: 'object',
    properties: {
      low: { type: 'number', description: 'Low USD' },
      mid: { type: 'number', description: 'Mid USD' },
      high: { type: 'number', description: 'High USD' },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Confidence',
      },
      reasoning: {
        type: 'string',
        description: 'One short sentence',
      },
      trend: {
        type: 'string',
        enum: ['rising', 'stable', 'declining'],
        description: 'Trend',
      },
      data_source: {
        type: 'string',
        description: 'Use: Claude AI estimate',
      },
    },
    required: ['low', 'mid', 'high', 'confidence', 'reasoning', 'trend'],
  },
}

function buildUserPrompt (card: CardEstimateInput): string {
  const gradeLine = card.is_graded
    ? card.grade_display?.trim() ||
      (card.grade != null
        ? `${card.grade}${card.grading_company ? ` (${card.grading_company})` : ''}`
        : 'Graded (details incomplete)')
    : 'N/A (raw)'

  return `Estimate market USD value:
Player ${card.player_name} | Yr ${card.year ?? '?'} | Set ${card.set_name ?? '?'} | #${card.card_number ?? '—'} | Var ${card.variation ?? '—'} | Sport ${card.sport ?? '?'}
Graded ${card.is_graded} | Slab ${gradeLine} | Raw cond ${card.condition ?? '—'}
If web_search: 1–3 tight eBay sold queries max, then submit_card_estimate once. No comps → wider range, low confidence.`
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
  input?: Record<string, unknown> | string
}

/** Anthropic sometimes delivers tool `input` as a JSON string */
function coerceToolInput (input: unknown): Record<string, unknown> | null {
  if (input != null && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>
  }
  if (typeof input === 'string') {
    try {
      const p = JSON.parse(input) as unknown
      if (p != null && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}

function recordFromToolUseBlocks (content: AnthropicContentBlock[] | undefined): Record<string, unknown> | null {
  if (!content?.length) return null
  for (const b of content) {
    if (b?.type !== 'tool_use') continue
    const rec = coerceToolInput(b.input)
    if (!rec) continue
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
  stop_reason?: string
  error?: { message?: string }
  message?: string
  usage?: {
    server_tool_use?: { web_search_requests?: number }
  }
}

type MessageRow = { role: 'user' | 'assistant'; content: unknown }

const PAUSE_TURN_MAX = 8

type GetCardValueOptions = {
  /** When aborted, in-flight Anthropic fetches stop (e.g. Vercel wall-clock budget). */
  signal?: AbortSignal
  /** When set, overrides PRICING_SKIP_WEB_SEARCH for this call only. */
  skipWebSearch?: boolean
}

/**
 * On Vercel, web search + tools often exceeds hobby function limits → platform 500 with a non-JSON
 * body. Default to no web search unless the project explicitly opts in (or uses eBay/domain hints).
 */
function resolveSkipWebSearch (options?: GetCardValueOptions): boolean {
  if (options?.skipWebSearch === true) return true
  if (options?.skipWebSearch === false) return false
  if (process.env.PRICING_SKIP_WEB_SEARCH === '1') return true
  if (process.env.VERCEL !== '1') return false
  const wantsWeb =
    process.env.PRICING_ENABLE_WEB_SEARCH === '1' ||
    process.env.PRICING_WEB_SEARCH_EBAY_ONLY === '1' ||
    Boolean(process.env.PRICING_WEB_SEARCH_ALLOWED_DOMAINS?.trim())
  return !wantsWeb
}

/** Parent wall + optional per-fetch cap; whichever fires first aborts the request. */
function createAnthropicFetchAbort (
  parentSignal: AbortSignal | undefined,
  perFetchTimeoutMs: number,
): { signal: AbortSignal | undefined; dispose: () => void } {
  const hasTimeout = Number.isFinite(perFetchTimeoutMs) && perFetchTimeoutMs > 0
  if (!parentSignal && !hasTimeout) {
    return { signal: undefined, dispose: () => {} }
  }
  if (parentSignal && !hasTimeout) {
    return { signal: parentSignal, dispose: () => {} }
  }
  if (!parentSignal && hasTimeout) {
    const combined = new AbortController()
    const t = setTimeout(() => combined.abort(), perFetchTimeoutMs)
    return {
      signal: combined.signal,
      dispose: () => clearTimeout(t),
    }
  }
  const combined = new AbortController()
  const cleanups: (() => void)[] = []
  const parent = parentSignal!
  if (parent.aborted) combined.abort()
  else {
    const onParentAbort = () => combined.abort()
    parent.addEventListener('abort', onParentAbort, { once: true })
    cleanups.push(() => parent.removeEventListener('abort', onParentAbort))
  }
  const t = setTimeout(() => combined.abort(), perFetchTimeoutMs)
  cleanups.push(() => clearTimeout(t))
  return {
    signal: combined.signal,
    dispose: () => {
      cleanups.forEach((fn) => fn())
    },
  }
}

async function getCardValue (
  card: CardEstimateInput,
  anthropicApiKey: string,
  options?: GetCardValueOptions,
): Promise<{ ok: true; estimate: CardEstimateResult } | { ok: false; error: string }> {
  try {
    return await getCardValueInner(card, anthropicApiKey, options)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected pricing error.'
    console.error('[pricing-service] getCardValue:', e)
    return { ok: false, error: msg }
  }
}

async function getCardValueInner (
  card: CardEstimateInput,
  anthropicApiKey: string,
  options?: GetCardValueOptions,
): Promise<{ ok: true; estimate: CardEstimateResult } | { ok: false; error: string }> {
  const userPrompt = buildUserPrompt(card)
  const requestSignal = options?.signal

  const model =
    typeof process.env.ANTHROPIC_MODEL === 'string' && process.env.ANTHROPIC_MODEL.trim()
      ? process.env.ANTHROPIC_MODEL.trim()
      : 'claude-sonnet-4-20250514'

  const skipWebSearch = resolveSkipWebSearch(options)
  const useSubmitTool = process.env.PRICING_SKIP_TOOL_USE !== '1'

  const toolsWithWeb = [getWebSearchTool(), SUBMIT_CARD_ESTIMATE_TOOL]
  const toolsSubmitOnly = [SUBMIT_CARD_ESTIMATE_TOOL]

  const maxOutWeb = Math.min(
    8192,
    Math.max(512, Number.parseInt(process.env.PRICING_MAX_OUTPUT_TOKENS_WEB?.trim() ?? '4096', 10) || 4096),
  )
  const maxOutFast = Math.min(
    4096,
    Math.max(512, Number.parseInt(process.env.PRICING_MAX_OUTPUT_TOKENS_FAST?.trim() ?? '2048', 10) || 2048),
  )
  const maxOutJson = Math.min(
    4096,
    Math.max(256, Number.parseInt(process.env.PRICING_MAX_OUTPUT_TOKENS_JSON?.trim() ?? '2048', 10) || 2048),
  )

  const bodyTextOnly = {
    model,
    max_tokens: maxOutJson,
    temperature: 0.2,
    system: `${SYSTEM_PROMPT} Reply with one JSON object only: low, mid, high, confidence, reasoning, trend, data_source.`,
    messages: [{ role: 'user', content: `${userPrompt}\nJSON only.` }],
  }

  function sleepMs (ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function callAnthropic (body: object): Promise<{ res: Response; payload: AnthropicPayload | null }> {
    let serialized: string
    try {
      serialized = JSON.stringify(body)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'serialize failed'
      console.error('[pricing-service] JSON.stringify(messages) failed:', msg)
      return {
        res: new Response(JSON.stringify({ error: { message: msg } }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
        payload: { error: { message: `Request serialization failed: ${msg}` } },
      }
    }

    const headers: Record<string, string> = {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }
    const beta = process.env.ANTHROPIC_BETA?.trim()
    if (beta) headers['anthropic-beta'] = beta

    const timeoutRaw = process.env.PRICING_ANTHROPIC_TIMEOUT_MS?.trim()
    const perFetchTimeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : 0
    const max429 = Math.min(
      6,
      Math.max(0, Number.parseInt(process.env.PRICING_429_MAX_RETRIES?.trim() ?? '2', 10) || 2),
    )

    let last: { res: Response; payload: AnthropicPayload | null } | undefined

    for (let attempt = 0; attempt <= max429; attempt++) {
      const { signal: fetchSignal, dispose } = createAnthropicFetchAbort(
        requestSignal,
        perFetchTimeoutMs,
      )

      const init: RequestInit = { method: 'POST', headers, body: serialized }
      if (fetchSignal) init.signal = fetchSignal

      let res: Response
      try {
        res = await fetch('https://api.anthropic.com/v1/messages', init)
      } catch (e) {
        dispose()
        const aborted = e instanceof Error && e.name === 'AbortError'
        if (aborted) {
          const wall = requestSignal?.aborted === true
          const msg = wall
            ? 'Estimate aborted (function time budget). Retrying without web search, or set ESTIMATE_MAX_MS=0 / upgrade Vercel limits / enable Fluid Compute.'
            : `Anthropic fetch aborted (timeout or signal). PRICING_ANTHROPIC_TIMEOUT_MS=${perFetchTimeoutMs || 'off'}.`
          return {
            res: new Response(null, { status: 504 }),
            payload: { error: { message: msg } },
          }
        }
        throw e
      }
      dispose()

      const payload = (await res.json().catch(() => null)) as AnthropicPayload | null
      last = { res, payload }

      if (res.status !== 429 || attempt >= max429) {
        return last
      }

      const ra = res.headers.get('retry-after')
      const fromHeader = ra ? Number.parseInt(ra, 10) : Number.NaN
      /** Keep waits bounded so Vercel hobby (~60s) can still finish after a 429. */
      const capMs = Math.min(
        45_000,
        Math.max(5000, Number.parseInt(process.env.PRICING_429_BACKOFF_CAP_MS?.trim() ?? '20000', 10) || 20_000),
      )
      const backoff = Number.isFinite(fromHeader)
        ? Math.min(capMs, Math.max(2000, fromHeader * 1000))
        : Math.min(capMs, 3000 * 2 ** attempt)
      console.warn(
        `[pricing-service] Anthropic 429 rate limit; waiting ${Math.round(backoff / 1000)}s then retry ${attempt + 1}/${max429}`,
      )
      await sleepMs(backoff)
    }

    return last!
  }

  async function runWithPauseTurn (base: {
    model: string
    max_tokens: number
    temperature: number
    system: string
    tools: object[]
    tool_choice?: object
    messages: MessageRow[]
  }): Promise<{ res: Response; payload: AnthropicPayload | null }> {
    const messages: MessageRow[] = [...base.messages]
    let lastOut: { res: Response; payload: AnthropicPayload | null } | undefined

    for (let i = 0; i < PAUSE_TURN_MAX; i++) {
      const body: Record<string, unknown> = {
        model: base.model,
        max_tokens: base.max_tokens,
        temperature: base.temperature,
        system: base.system,
        tools: base.tools,
        messages,
      }
      if (base.tool_choice) body.tool_choice = base.tool_choice

      const out = await callAnthropic(body)
      lastOut = out
      if (!out.res.ok) return out

      const stop = out.payload?.stop_reason
      if (stop !== 'pause_turn' || !out.payload?.content) {
        return out
      }

      messages.push({ role: 'assistant', content: out.payload.content })
    }

    return (
      lastOut ?? {
        res: new Response(null, { status: 500 }),
        payload: { error: { message: 'Web search turn limit exceeded (pause_turn).' } },
      }
    )
  }

  let anthropicResponse: Response
  let payload: AnthropicPayload | null
  /** True when the successful HTTP response came from a request that included the web_search tool (not the submit-only fallback). */
  let completedWithWebSearchTools = false

  if (useSubmitTool && !skipWebSearch) {
    const first = await runWithPauseTurn({
      model,
      max_tokens: maxOutWeb,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      tools: toolsWithWeb,
      messages: [{ role: 'user', content: userPrompt }],
    })
    anthropicResponse = first.res
    payload = first.payload

    const errMsg = payload?.error?.message ?? ''
    const tookSubmitOnlyFallback =
      !anthropicResponse.ok &&
      (anthropicResponse.status === 400 || anthropicResponse.status === 404) &&
      (/web_search|tool|schema|model|not_found/i.test(errMsg) || anthropicResponse.status === 404)

    if (tookSubmitOnlyFallback) {
      console.warn(
        '[pricing-service] Web search tool rejected by Claude API; retrying without live search. Error:',
        errMsg || anthropicResponse.status,
      )
      const second = await runWithPauseTurn({
        model,
        max_tokens: maxOutWeb,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        tools: toolsSubmitOnly,
        tool_choice: { type: 'tool', name: 'submit_card_estimate' },
        messages: [{ role: 'user', content: userPrompt }],
      })
      anthropicResponse = second.res
      payload = second.payload
    } else if (anthropicResponse.ok) {
      completedWithWebSearchTools = true
    }
  } else if (useSubmitTool && skipWebSearch) {
    const r = await runWithPauseTurn({
      model,
      max_tokens: maxOutFast,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      tools: toolsSubmitOnly,
      tool_choice: { type: 'tool', name: 'submit_card_estimate' },
      messages: [{ role: 'user', content: userPrompt }],
    })
    anthropicResponse = r.res
    payload = r.payload
  } else {
    const r = await callAnthropic(bodyTextOnly)
    anthropicResponse = r.res
    payload = r.payload
  }

  if (!anthropicResponse.ok) {
    const msg = payload?.error?.message || payload?.message || 'Claude API request failed.'
    return { ok: false, error: `[${anthropicResponse.status}] ${msg}` }
  }

  if (completedWithWebSearchTools) {
    const n = payload?.usage?.server_tool_use?.web_search_requests
    if (typeof n === 'number' && n === 0) {
      console.warn(
        '[pricing-service] Response had 0 web_search_requests. Use a model that supports web search (e.g. claude-sonnet-4-20250514+), ensure Web search is enabled in the Anthropic Console (org settings), and avoid PRICING_SKIP_WEB_SEARCH=1 on the server.',
      )
    }
  }

  let record =
    recordFromToolUseBlocks(payload?.content) ?? recordFromTextBlocks(payload?.content)

  if (!record && useSubmitTool && !skipWebSearch) {
    const fallback = await callAnthropic(bodyTextOnly)
    if (fallback.res.ok) {
      record =
        recordFromToolUseBlocks(fallback.payload?.content) ??
        recordFromTextBlocks(fallback.payload?.content)
    }
  }

  if (!record) {
    return {
      ok: false,
      error: useSubmitTool
        ? 'Could not read an estimate from Claude (no submit_card_estimate tool result and no parseable JSON). Enable web search in the Anthropic Console, set PRICING_SKIP_WEB_SEARCH=1 to disable search, or PRICING_SKIP_TOOL_USE=1 for JSON-only.'
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


const CACHE_MS = 48 * 60 * 60 * 1000

/**
 * Hard cap for the whole estimate (all Anthropic round-trips). On Vercel, defaults to 52s so we
 * finish with JSON before the ~60s hobby wall kills the invocation with a non-JSON 500.
 * Set ESTIMATE_MAX_MS=0 to disable (Pro / Fluid with higher limits).
 */
function createEstimateWall (): { signal: AbortSignal; clear: () => void } | undefined {
  const raw = process.env.ESTIMATE_MAX_MS?.trim()
  const ms =
    raw !== undefined && raw !== ''
      ? Number.parseInt(raw, 10)
      : process.env.VERCEL
        ? 52_000
        : 0
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  return {
    signal: ac.signal,
    clear: () => clearTimeout(t),
  }
}

function shouldRetryEstimateWithoutWebSearch (error: string): boolean {
  return (
    /504|abort|deadline|timeout|exceeded|time budget|ECONNRESET|ETIMEDOUT|fetch failed/i.test(error) ||
    /\[(?:429|50[0-9]|502|503|504|529)\]/.test(error) ||
    /rate limit|tokens per minute/i.test(error) ||
    /Could not read an estimate from Claude/i.test(error)
  )
}

function firstEstimatePassUsesWebSearch (): boolean {
  if (process.env.PRICING_SKIP_WEB_SEARCH === '1') return false
  if (process.env.VERCEL !== '1') return true
  return (
    process.env.PRICING_ENABLE_WEB_SEARCH === '1' ||
    process.env.PRICING_WEB_SEARCH_EBAY_ONLY === '1' ||
    Boolean(process.env.PRICING_WEB_SEARCH_ALLOWED_DOMAINS?.trim())
  )
}

function headerString (v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined
  return Array.isArray(v) ? v[0] : v
}

function getBearerToken (authHeader: string | undefined): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

function getJson (body: unknown): Record<string, unknown> {
  if (body == null || body === '') return {}
  const isBufferBody = typeof Buffer !== 'undefined' && Buffer.isBuffer(body)
  if (body && typeof body === 'object' && !isBufferBody) return body as Record<string, unknown>
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (isBufferBody) {
    try {
      return JSON.parse(body.toString('utf8')) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

function parseGradeNumber (grade: string | null | undefined): number | null {
  if (!grade) return null
  const n = Number.parseFloat(String(grade).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

type CardRow = {
  id: string
  user_id: string
  sport: string | null
  player_name: string
  year: number | null
  set_name: string | null
  card_number: string | null
  variation: string | null
  is_graded: boolean
  grade: string | null
  grading_company: string | null
  condition: string | null
  current_value: number | null
  last_updated: string | null
  pricing_source: string | null
}

/** Use Express-style .json() — matches other api/* routes and @vercel/node expectations. */
function jsonError (res: ApiResponse, status: number, error: string) {
  const safe =
    error.length > 8000 ? `${error.slice(0, 8000)}…` : error.replace(/\u2028|\u2029/g, ' ')
  if (res.writableEnded || res.headersSent) return
  res.status(status).json({ error: safe })
}

function jsonOk (res: ApiResponse, status: number, body: Record<string, unknown>) {
  if (res.writableEnded || res.headersSent) return
  res.status(status).json(body)
}

export default async function handler (req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return jsonError(res, 405, 'Method not allowed')
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY

    if (!supabaseUrl || !supabaseServiceRole) {
      return jsonError(res, 500, 'Missing Supabase server configuration.')
    }
    if (!anthropicApiKey) {
      return jsonError(res, 500, 'Missing ANTHROPIC_API_KEY.')
    }

    const token = getBearerToken(headerString(req.headers.authorization))
    if (!token) {
      return jsonError(res, 401, 'Missing bearer token.')
    }

    const admin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token)

    if (userError || !user) {
      return jsonError(res, 401, 'Invalid or expired auth token.')
    }

    const json = getJson(req.body)
    const cardId = typeof json.card_id === 'string' ? json.card_id : ''
    const forceRefresh = json.force_refresh === true

    if (!cardId) {
      return jsonError(res, 400, 'card_id is required.')
    }

    const { data: row, error: fetchErr } = await admin
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchErr || !row) {
      return jsonError(res, 404, 'Card not found.')
    }

    const card = row as CardRow
    const lastAt = card.last_updated ? new Date(card.last_updated).getTime() : 0
    const fresh =
      Number.isFinite(lastAt) &&
      Date.now() - lastAt < CACHE_MS &&
      card.pricing_source === 'claude_estimate' &&
      card.current_value != null

    if (fresh && !forceRefresh) {
      return jsonOk(res, 200, {
        cached: true,
        current_value: card.current_value,
        value_low: (row as { value_low?: number | null }).value_low ?? null,
        value_high: (row as { value_high?: number | null }).value_high ?? null,
        confidence: (row as { confidence?: string | null }).confidence ?? null,
        trend: (row as { trend?: string | null }).trend ?? null,
        value_note: (row as { value_note?: string | null }).value_note ?? null,
        pricing_source: card.pricing_source,
        last_updated: card.last_updated,
      })
    }

    const gradeDisplay =
      card.is_graded
        ? [card.grading_company?.trim(), card.grade?.trim()].filter(Boolean).join(' ') || null
        : null

    const estimateInput: CardEstimateInput = {
      player_name: card.player_name,
      year: card.year,
      set_name: card.set_name,
      card_number: card.card_number,
      variation: card.variation,
      sport: card.sport,
      is_graded: card.is_graded,
      grade: parseGradeNumber(card.grade),
      grade_display: gradeDisplay,
      grading_company: card.grading_company,
      condition: card.condition,
    }

    let result: Awaited<ReturnType<typeof getCardValue>>
    const wall = createEstimateWall()
    const noAutoRetry = process.env.PRICING_NO_SEARCH_RETRY === '1'

    try {
      try {
        result = await getCardValue(estimateInput, anthropicApiKey, {
          signal: wall?.signal,
        })
      } catch (pricingErr) {
        const msg =
          pricingErr instanceof Error
            ? pricingErr.message
            : 'Pricing service threw an unexpected error.'
        console.error('[estimate-card-value] getCardValue:', pricingErr)
        return jsonError(res, 502, msg)
      }

      let canRetryFastPath = false
      if (!result.ok) {
        canRetryFastPath =
          !noAutoRetry &&
          firstEstimatePassUsesWebSearch() &&
          shouldRetryEstimateWithoutWebSearch(result.error)
      }

      if (canRetryFastPath && !result.ok) {
        console.warn(
          '[estimate-card-value] Retrying estimate without web search after:',
          result.error.slice(0, 200),
        )
        try {
          result = await getCardValue(estimateInput, anthropicApiKey, { skipWebSearch: true })
        } catch (retryErr) {
          const msg =
            retryErr instanceof Error
              ? retryErr.message
              : 'Pricing retry threw an unexpected error.'
          console.error('[estimate-card-value] getCardValue retry:', retryErr)
          return jsonError(res, 502, msg)
        }
      }

      if (!result.ok) {
        return jsonError(res, 502, result.error)
      }
    } finally {
      wall?.clear()
    }

    const { estimate } = result
    const nowIso = new Date().toISOString()

    const updatePayload = {
      current_value: estimate.mid,
      value_low: estimate.low,
      value_high: estimate.high,
      confidence: estimate.confidence,
      trend: estimate.trend,
      value_note: estimate.reasoning,
      pricing_source: 'claude_estimate',
      last_updated: nowIso,
    }

    const { error: upErr } = await admin.from('cards').update(updatePayload).eq('id', card.id)

    if (upErr) {
      return jsonError(res, 500, upErr.message)
    }

    const { error: histErr } = await admin.from('price_history').insert({
      card_id: card.id,
      recorded_value: estimate.mid,
      recorded_at: nowIso,
      source: estimate.data_source || 'claude_estimate',
    })

    if (histErr) {
      console.error('[estimate-card-value] price_history insert skipped:', histErr.message)
    }

    return jsonOk(res, 200, {
      cached: false,
      current_value: estimate.mid,
      value_low: estimate.low,
      value_high: estimate.high,
      confidence: estimate.confidence,
      trend: estimate.trend,
      value_note: estimate.reasoning,
      pricing_source: 'claude_estimate',
      last_updated: nowIso,
      data_source: estimate.data_source,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Estimate failed.'
    console.error('[estimate-card-value] unhandled:', error)
    const safe = message.slice(0, 4000).replace(/\u2028|\u2029/g, ' ')
    try {
      if (!res.headersSent && !res.writableEnded) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        if (typeof res.end === 'function') {
          res.end(JSON.stringify({ error: safe }))
        }
      }
    } catch (sendErr) {
      console.error('[estimate-card-value] failed to send JSON error:', sendErr)
      try {
        jsonError(res, 500, safe)
      } catch {
        /* last resort */
      }
    }
  }
}
