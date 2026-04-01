import type { EnrichedCardForInsights } from './insightsEnrichment'

type InsightSection = { title: string; body: string }

function splitInsightSections (content: string): InsightSection[] {
  const trimmed = content.trim()
  if (!trimmed) return []
  if (!trimmed.includes('##')) {
    return [{ title: 'Insights', body: trimmed }]
  }
  const blocks = trimmed.split(/^##\s+/m).filter((b) => b.length > 0)
  const sections: InsightSection[] = []
  for (const block of blocks) {
    const nl = block.indexOf('\n')
    if (nl === -1) {
      sections.push({ title: block.trim(), body: '' })
    } else {
      sections.push({
        title: block.slice(0, nl).trim(),
        body: block.slice(nl + 1).trim(),
      })
    }
  }
  return sections
}

type AnthropicContentBlock = {
  type?: string
  text?: string
  [key: string]: unknown
}

type AnthropicPayload = {
  content?: AnthropicContentBlock[]
  stop_reason?: string
  error?: { message?: string }
  message?: string
  usage?: { server_tool_use?: { web_search_requests?: number } }
}

type MessageRow = { role: 'user' | 'assistant'; content: unknown }

const PAUSE_TURN_MAX = 8

export function getInsightsWebSearchTool (): Record<string, unknown> {
  const rawMax = process.env.INSIGHTS_WEB_SEARCH_MAX_USES?.trim()
  const maxUses = rawMax ? Number.parseInt(rawMax, 10) : 5
  const tool: Record<string, unknown> = {
    name: 'web_search',
    max_uses: Number.isFinite(maxUses) && maxUses > 0 ? Math.min(15, maxUses) : 5,
  }
  const ver = process.env.PRICING_WEB_SEARCH_VERSION?.trim() || process.env.INSIGHTS_WEB_SEARCH_VERSION?.trim()
  if (ver === '20260209') {
    tool.type = 'web_search_20260209'
    tool.allowed_callers = ['direct']
  } else {
    tool.type = 'web_search_20250305'
  }
  const domains =
    process.env.INSIGHTS_WEB_SEARCH_ALLOWED_DOMAINS?.trim() ||
    process.env.PRICING_WEB_SEARCH_ALLOWED_DOMAINS?.trim()
  if (domains) {
    tool.allowed_domains = domains.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return tool
}

/**
 * On Vercel, web search defaults off (same policy as pricing) unless explicitly enabled.
 */
export function resolveInsightsSkipWebSearch (): boolean {
  if (process.env.INSIGHTS_SKIP_WEB_SEARCH === '1') return true
  if (process.env.PRICING_SKIP_WEB_SEARCH === '1') return true
  if (process.env.VERCEL !== '1') return false
  const wantsWeb =
    process.env.INSIGHTS_ENABLE_WEB_SEARCH === '1' ||
    process.env.PRICING_ENABLE_WEB_SEARCH === '1' ||
    process.env.PRICING_WEB_SEARCH_EBAY_ONLY === '1' ||
    Boolean(process.env.PRICING_WEB_SEARCH_ALLOWED_DOMAINS?.trim()) ||
    Boolean(process.env.INSIGHTS_WEB_SEARCH_ALLOWED_DOMAINS?.trim())
  return !wantsWeb
}

function anthropicHeaders (apiKey: string): Record<string, string> {
  const h: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  }
  const beta = process.env.ANTHROPIC_BETA?.trim()
  if (beta) h['anthropic-beta'] = beta
  return h
}

function extractText (payload: AnthropicPayload | null): string {
  return (
    payload?.content
      ?.filter((item) => item?.type === 'text')
      .map((item) => item?.text ?? '')
      .join('\n')
      .trim() ?? ''
  )
}

async function callAnthropic (apiKey: string, body: object): Promise<{ res: Response; payload: AnthropicPayload | null }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify(body),
  })
  const payload = (await res.json().catch(() => null)) as AnthropicPayload | null
  return { res, payload }
}

async function runWithPauseTurn (
  apiKey: string,
  base: {
    model: string
    max_tokens: number
    temperature: number
    system: string
    tools: object[]
    messages: MessageRow[]
  },
): Promise<{ res: Response; payload: AnthropicPayload | null }> {
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

    const out = await callAnthropic(apiKey, body)
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

export function formatInsightDate (d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function buildInsightsSystemPrompt (now: Date): string {
  const y = now.getUTCFullYear()
  const currentDate = formatInsightDate(now)
  return `You are SlabBook AI, an expert sports card market analyst with real-time market knowledge. Today's date is ${currentDate}.

CRITICAL RULES you must follow:
1. NEVER refer to a player as a rookie unless their card year is within 1-2 years of today (or the card is clearly a true rookie-year issue per the portfolio data).
2. Always reference how long ago a card was produced — a 2017 Mahomes card is now ${y - 2017} years old, not a rookie card.
3. Use the career_stage field to describe players accurately — 'established veteran', 'prime years', 'late career' etc.
4. Reference actual holding periods — 'you've held this for 3 years' not vague 'recently purchased'.
5. Base buy/sell/hold advice on current market conditions from the web search context provided when present.
6. Never give generic hobby advice — every insight must reference a specific card in their collection by name (use card_display_label when helpful).
7. If a player is injured, retired, or in decline say so directly — do not sugarcoat.
8. Annualized returns matter — a card up 50% over 5 years is different from up 50% in 6 months.
9. Consider PSA population when giving advice when provided — high pop cards are harder to sell at premium.
10. Always reference the current year (${y}) in your analysis so the user knows the advice is current.`
}

const REQUIRED_SECTIONS = `## Portfolio health
## Sell candidates
## Strong holds
## Watch list
## Hidden gem
## This week's action`

export function buildInsightsUserPrompt (args: {
  now: Date
  enrichedJson: string
  webSearchResults: string
  summary: {
    total_cards: number
    total_invested: number
    total_value: number
    gain_loss: number
    gain_pct: string
    best_card_label: string
    best_pct: string
    worst_card_label: string
    worst_pct: string
  }
  repairNote?: string
}): string {
  const { now, enrichedJson, webSearchResults, summary, repairNote } = args
  const currentDate = formatInsightDate(now)
  const ti = summary.total_invested.toFixed(2)
  const tv = summary.total_value.toFixed(2)
  const gl = summary.gain_loss.toFixed(2)

  const repair = repairNote
    ? `\n\nIMPORTANT — FIX PREVIOUS OUTPUT:\n${repairNote}\nRegenerate the full report from scratch with the corrections.\n`
    : ''

  return `Today is ${currentDate}.

Here is my sports card portfolio with full context:

${enrichedJson}

Recent market news for my top cards:
${webSearchResults || `(No live web context for this run — rely on portfolio data and general ${now.getUTCFullYear()} market knowledge.)`}

Portfolio summary:
- Total cards: ${summary.total_cards}
- Total invested: $${ti}
- Current estimated value: $${tv}
- Overall gain/loss: $${gl} (${summary.gain_pct}%)
- Best performer: ${summary.best_card_label} (+${summary.best_pct}%)
- Worst performer: ${summary.worst_card_label} (${summary.worst_pct}%)
${repair}
Please give me a detailed portfolio analysis:

1. PORTFOLIO HEALTH (3-4 sentences)
   - Overall assessment with specific numbers
   - Diversification analysis (sports, years, players)
   - Risk assessment

2. SELL CANDIDATES (top 2-3 cards)
   For each card include:
   - Exact card name and grade
   - How long held and annualized return
   - Specific reason to sell NOW based on current market or player situation
   - Suggested timing (sell before X event, etc)

3. STRONG HOLDS (top 2-3 cards)
   For each card include:
   - Exact card name and grade
   - Why this card has upside from HERE
   - What catalyst could drive value higher
   - Target timeframe

4. WATCH LIST (1-2 cards showing weakness)
   Cards to monitor closely that may need action soon

5. HIDDEN GEM
   One card in the collection that may be undervalued based on current market

6. THIS WEEK'S ACTION
   ONE specific thing to do this week — be direct and specific

IMPORTANT FORMATTING RULES:
- Always use the player's FULL name and card year
- Never call established players rookies
- Reference specific prices:
  'Your 2017 Mahomes Prizm PSA 10 (held 4 years)'
  not just 'your Mahomes card'
- Use exact numbers from the portfolio data (purchase_price, current_value, percentages)
- Reference today's date when relevant
- Keep tone like a knowledgeable friend — direct, specific, no fluff

Use exactly these Markdown section headers (##) in this order:
${REQUIRED_SECTIONS}`
}

function buildResearchPrompt (top: EnrichedCardForInsights[], now: Date): string {
  const y = now.getUTCFullYear()
  const lines = top.map((c, i) => {
    return `${i + 1}. ${c.player_name} — ${c.card_display_label} (est. value $${(c.current_value ?? 0).toFixed(2)})`
  })
  return `Today is ${formatInsightDate(now)}. You are gathering facts for a sports card portfolio briefing.

For each player listed, use web search and produce a concise factual digest (no buy/sell recommendations). Group by player. Cover:
- Card market / hobby sentiment in ${y} (liquidity, demand)
- Recent injury or team/news items in ${y} if relevant
- On-field or on-court performance level in ${y} (brief)

Prioritize searches like:
"{player} card market ${y}"
"{player} injury news ${y}"
"{player} performance stats ${y}"

Top cards in this portfolio:
${lines.join('\n')}

Output plain text bullet points only.`
}

export async function runTopCardsMarketResearch (args: {
  apiKey: string
  model: string
  topCards: EnrichedCardForInsights[]
  now: Date
}): Promise<{ ok: true; digest: string; usedWebSearch: boolean } | { ok: false; error: string }> {
  const { apiKey, model, topCards, now } = args
  if (topCards.length === 0) {
    return { ok: true, digest: '', usedWebSearch: false }
  }

  const system =
    'You are a research assistant. Use web search to collect recent public facts. No investment advice. Be concise.'
  const user = buildResearchPrompt(topCards, now)

  const out = await runWithPauseTurn(apiKey, {
    model,
    max_tokens: 4096,
    temperature: 0.2,
    system,
    tools: [getInsightsWebSearchTool()],
    messages: [{ role: 'user', content: user }],
  })

  if (!out.res.ok) {
    const msg = out.payload?.error?.message || out.payload?.message || 'Research request failed.'
    return { ok: false, error: msg }
  }

  const digest = extractText(out.payload)
  const n = out.payload?.usage?.server_tool_use?.web_search_requests
  const usedWebSearch = typeof n === 'number' && n > 0
  return { ok: true, digest: digest || '(No digest text returned.)', usedWebSearch }
}

export async function runInsightsGeneration (args: {
  apiKey: string
  model: string
  system: string
  user: string
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const { res, payload } = await callAnthropic(args.apiKey, {
    model: args.model,
    max_tokens: 6144,
    temperature: 0.35,
    system: args.system,
    messages: [{ role: 'user', content: args.user }],
  })

  if (!res.ok) {
    const msg = payload?.error?.message || payload?.message || 'Claude API request failed.'
    return { ok: false, error: msg }
  }

  const text = extractText(payload)
  return { ok: true, text: text || 'No insight generated.' }
}

function rookieLanguageViolation (text: string, cards: EnrichedCardForInsights[]): string | null {
  const rookieRe = /\brookie\b|first year|debut season/gi
  if (!rookieRe.test(text)) return null

  const sentences = text.split(/(?<=[.!?])\s+/)
  for (const c of cards) {
    if (c.card_age_years == null || c.card_age_years <= 2) continue
    const name = c.player_name
    for (const s of sentences) {
      if (!s.includes(name)) continue
      if (/\brookie\b|first year|debut season/i.test(s)) {
        return `Do not use rookie language for ${name} whose card is from ${c.year ?? 'unknown year'}.`
      }
    }
  }
  return null
}

function staleYearViolation (text: string, now: Date): string | null {
  const currentYear = now.getUTCFullYear()
  if (!new RegExp(`\\b${currentYear}\\b`).test(text)) {
    return `Explicitly reference the current year ${currentYear} in the analysis.`
  }
  const staleFraming = /\b(?:as of|we are in|it is currently|right now in)\s+(20[0-2][0-9])\b/gi
  let m: RegExpExecArray | null
  while ((m = staleFraming.exec(text)) !== null) {
    const y = Number.parseInt(m[1], 10)
    if (y < currentYear - 1) {
      return `Do not frame the analysis as year ${y}; the user needs ${currentYear} context.`
    }
  }
  return null
}

function specificityViolation (text: string, cards: EnrichedCardForInsights[]): string | null {
  const sections = splitInsightSections(text)
  const names = [...new Set(cards.map((c) => c.player_name).filter(Boolean))]
  const dollar = /\$\s*[\d][\d,]*(?:\.\d{1,2})?/

  for (const s of sections) {
    const paras = s.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
    for (const p of paras) {
      if (p.length < 80) continue
      if (!dollar.test(p)) {
        return 'Be more specific — reference exact dollar amounts from the portfolio data in each substantive paragraph.'
      }
      const hasName = names.some((n) => p.includes(n))
      if (!hasName) {
        return 'Be more specific — reference exact cards and player full names from the portfolio data.'
      }
    }
  }
  return null
}

export function runInsightQualityChecks (
  text: string,
  cards: EnrichedCardForInsights[],
  now: Date,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  const r1 = rookieLanguageViolation(text, cards)
  if (r1) reasons.push(r1)
  const r2 = staleYearViolation(text, now)
  if (r2) reasons.push(r2)
  const r3 = specificityViolation(text, cards)
  if (r3) reasons.push(r3)
  return { ok: reasons.length === 0, reasons }
}

export type InsightStoreFlags = {
  websearch: boolean
  verify: boolean
}

export function appendInsightMachineFooter (content: string, flags: InsightStoreFlags): string {
  const parts: string[] = [content.trim()]
  if (flags.websearch) parts.push('<!--slabbook:flags:websearch-->')
  if (flags.verify) parts.push('<!--slabbook:flags:verify-->')
  return parts.filter(Boolean).join('\n\n')
}
