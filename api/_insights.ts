import type { SupabaseClient } from '@supabase/supabase-js'

export const PLAYER_ROOKIE_YEARS: Record<string, number> = {
  'Patrick Mahomes': 2017,
  'Josh Allen': 2018,
  'Joe Burrow': 2020,
  'Justin Herbert': 2020,
  'Trevor Lawrence': 2021,
  'Justin Fields': 2021,
  'Bryce Young': 2023,
  'CJ Stroud': 2023,
  'Drake Maye': 2024,
  'Caleb Williams': 2024,
  'LeBron James': 2003,
  'Stephen Curry': 2009,
  'Kevin Durant': 2007,
  'Giannis Antetokounmpo': 2013,
  'Luka Doncic': 2018,
  'Ja Morant': 2019,
  'Zion Williamson': 2019,
  'Cade Cunningham': 2021,
  'Paolo Banchero': 2022,
  'Victor Wembanyama': 2023,
  'Caitlin Clark': 2024,
  'Mike Trout': 2011,
  'Shohei Ohtani': 2018,
  'Ronald Acuna Jr': 2018,
  'Ronald Acuña Jr': 2018,
  'Juan Soto': 2018,
  'Fernando Tatis Jr': 2019,
  'Julio Rodriguez': 2022,
  'Paul Skenes': 2024,
  'Connor McDavid': 2015,
  'Auston Matthews': 2016,
  'Connor Bedard': 2023,
  'Macklin Celebrini': 2024,
}

const ROOKIE_KEYS = Object.keys(PLAYER_ROOKIE_YEARS)

export type CardRowForInsights = {
  player_name: string
  year: number | null
  set_name: string | null
  sport: string | null
  is_graded: boolean
  grade: string | null
  grading_company: string | null
  purchase_price: number | null
  current_value: number | null
  purchase_date: string | null
  card_number: string | null
  variation: string | null
}

export type EnrichedCardForInsights = {
  card_display_label: string
  player_name: string
  year: number | null
  set_name: string | null
  sport: string | null
  grade_line: string
  card_number: string | null
  variation: string | null
  purchase_price: number | null
  current_value: number | null
  purchase_date: string | null
  psa_population: number | null
  card_age_years: number | null
  player_pro_rookie_year: number | null
  years_since_player_pro_debut: number | null
  is_true_rookie_card: boolean
  rookie_years_ago: number | null
  career_stage: string
  card_print_career_stage: string
  player_career_stage: string | null
  value_change_percent: string | null
  holding_period_days: number | null
  holding_period_text: string | null
  is_up: boolean | null
  annualized_return_percent: string | null
}

function findPlayerProRookieYear (playerName: string): number | null {
  const n = playerName.trim().replace(/\s+/g, ' ')
  if (!n) return null
  if (PLAYER_ROOKIE_YEARS[n] != null) return PLAYER_ROOKIE_YEARS[n]
  const lower = n.toLowerCase()
  for (const k of ROOKIE_KEYS) {
    if (k.toLowerCase() === lower) return PLAYER_ROOKIE_YEARS[k]
  }
  return null
}

function gradeLine (c: CardRowForInsights): string {
  if (!c.is_graded) return 'Raw'
  const bits = [c.grading_company, c.grade].filter(Boolean)
  return bits.length ? bits.join(' ') : 'Graded'
}

function cardPrintCareerStage (cardAgeYears: number | null): string {
  if (cardAgeYears == null || !Number.isFinite(cardAgeYears)) return 'Unknown (missing card year)'
  if (cardAgeYears <= 1) return 'Current rookie era print'
  if (cardAgeYears <= 3) return 'Early career era print'
  if (cardAgeYears <= 7) return 'Established veteran era print'
  if (cardAgeYears <= 12) return 'Prime veteran era print'
  return 'Late career / retired era print'
}

function playerCareerStageFromYears (yearsPro: number): string {
  if (yearsPro <= 1) return 'Current rookie / very early career'
  if (yearsPro <= 3) return 'Early career'
  if (yearsPro <= 7) return 'Established veteran'
  if (yearsPro <= 12) return 'Prime veteran'
  return 'Late career / retired'
}

function holdingPeriodText (days: number): string {
  if (days < 1) return 'Less than a day'
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  const parts: string[] = []
  if (y > 0) parts.push(`${y} year${y === 1 ? '' : 's'}`)
  if (m > 0) parts.push(`${m} month${m === 1 ? '' : 's'}`)
  if (parts.length === 0) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  return parts.join(' ')
}

function hasRookieKeywords (c: CardRowForInsights): boolean {
  const blob = `${c.variation ?? ''} ${c.set_name ?? ''} ${c.card_number ?? ''}`
  return /\brc\b|rookie|first year|1st year/i.test(blob)
}

export function enrichCardForInsights (c: CardRowForInsights, now: Date): EnrichedCardForInsights {
  const cy = now.getUTCFullYear()
  const cardYear = c.year
  const cardAgeYears =
    cardYear != null && Number.isFinite(cardYear) ? Math.max(0, cy - cardYear) : null

  const playerPro = findPlayerProRookieYear(c.player_name)
  const yearsSincePro =
    playerPro != null ? Math.max(0, cy - playerPro) : null

  const isTrueRookieCard =
    (cardYear != null && playerPro != null && cardYear === playerPro) || hasRookieKeywords(c)

  const rookieYearsAgo = cardAgeYears
  const purchase = c.purchase_price != null ? Number(c.purchase_price) : null
  const current = c.current_value != null ? Number(c.current_value) : null
  let valueChangePercent: string | null = null
  let isUp: boolean | null = null
  let annualized: string | null = null

  if (purchase != null && purchase > 0 && current != null && Number.isFinite(current)) {
    const pct = ((current - purchase) / purchase) * 100
    valueChangePercent = pct.toFixed(1)
    isUp = current > purchase
    let days: number | null = null
    if (c.purchase_date) {
      const p = new Date(c.purchase_date).getTime()
      if (!Number.isNaN(p)) days = Math.max(0, Math.floor((now.getTime() - p) / 86_400_000))
    }
    if (days != null && days >= 30) {
      const years = days / 365
      if (years > 0 && current > 0) {
        const r = (current / purchase) ** (1 / years) - 1
        annualized = (r * 100).toFixed(1)
      }
    }
  }

  let holdingDays: number | null = null
  if (c.purchase_date) {
    const p = new Date(c.purchase_date).getTime()
    if (!Number.isNaN(p)) holdingDays = Math.max(0, Math.floor((now.getTime() - p) / 86_400_000))
  }

  const cardPrintStage = cardPrintCareerStage(cardAgeYears)
  const playerStage = yearsSincePro != null ? playerCareerStageFromYears(yearsSincePro) : null
  const careerStage = playerStage ?? cardPrintStage
  const labelParts = [
    c.player_name,
    c.year != null ? String(c.year) : null,
    c.set_name,
    gradeLine(c),
  ].filter(Boolean)

  return {
    card_display_label: labelParts.join(' · '),
    player_name: c.player_name,
    year: c.year,
    set_name: c.set_name,
    sport: c.sport,
    grade_line: gradeLine(c),
    card_number: c.card_number,
    variation: c.variation,
    purchase_price: purchase,
    current_value: current,
    purchase_date: c.purchase_date,
    psa_population: null,
    card_age_years: cardAgeYears,
    player_pro_rookie_year: playerPro,
    years_since_player_pro_debut: yearsSincePro,
    is_true_rookie_card: isTrueRookieCard,
    rookie_years_ago: rookieYearsAgo,
    career_stage: careerStage,
    card_print_career_stage: cardPrintStage,
    player_career_stage: playerStage,
    value_change_percent: valueChangePercent,
    holding_period_days: holdingDays,
    holding_period_text: holdingDays != null ? holdingPeriodText(holdingDays) : null,
    is_up: isUp,
    annualized_return_percent: annualized,
  }
}

export type PortfolioSummaryForInsights = {
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

export function buildPortfolioSummary (enriched: EnrichedCardForInsights[]): PortfolioSummaryForInsights {
  const total_cards = enriched.length
  let total_invested = 0
  let total_value = 0
  let best: { label: string; pct: number } | null = null
  let worst: { label: string; pct: number } | null = null

  for (const c of enriched) {
    if (c.purchase_price != null && c.purchase_price > 0) total_invested += c.purchase_price
    if (c.current_value != null) total_value += c.current_value

    const pctStr = c.value_change_percent
    if (pctStr != null && c.purchase_price != null && c.purchase_price > 0) {
      const pct = Number.parseFloat(pctStr)
      if (Number.isFinite(pct)) {
        const label = `${c.player_name}${c.year != null ? ` (${c.year})` : ''} · ${c.grade_line}`
        if (!best || pct > best.pct) best = { label, pct }
        if (!worst || pct < worst.pct) worst = { label, pct }
      }
    }
  }

  const gain_loss = total_value - total_invested
  const gain_pct = total_invested > 0 ? ((gain_loss / total_invested) * 100).toFixed(1) : '0.0'
  return {
    total_cards,
    total_invested,
    total_value,
    gain_loss,
    gain_pct,
    best_card_label: best?.label ?? 'N/A',
    best_pct: best != null ? best.pct.toFixed(1) : '0',
    worst_card_label: worst?.label ?? 'N/A',
    worst_pct: worst != null ? worst.pct.toFixed(1) : '0',
  }
}

export function topCardsByValue (enriched: EnrichedCardForInsights[], n: number): EnrichedCardForInsights[] {
  return [...enriched]
    .filter((c) => c.current_value != null && c.current_value > 0)
    .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0))
    .slice(0, n)
}

export function cardToInsightsPromptJson (c: EnrichedCardForInsights): Record<string, unknown> {
  return {
    card_display_label: c.card_display_label,
    player_name: c.player_name,
    year: c.year,
    set_name: c.set_name,
    sport: c.sport,
    grade_line: c.grade_line,
    card_number: c.card_number,
    variation: c.variation,
    purchase_price: c.purchase_price,
    current_value: c.current_value,
    purchase_date: c.purchase_date,
    psa_population: c.psa_population,
    card_age_years: c.card_age_years,
    player_pro_rookie_year: c.player_pro_rookie_year,
    is_true_rookie: c.is_true_rookie_card,
    rookie_years_ago: c.rookie_years_ago,
    career_stage: c.career_stage,
    card_print_career_stage: c.card_print_career_stage,
    player_career_stage: c.player_pro_rookie_year != null ? c.player_career_stage : null,
    value_change_percent: c.value_change_percent,
    holding_period_days: c.holding_period_days,
    holding_period_text: c.holding_period_text,
    is_up: c.is_up,
    annualized_return: c.annualized_return_percent,
  }
}

type AnthropicContentBlock = { type?: string; text?: string; [key: string]: unknown }
type AnthropicPayload = {
  content?: AnthropicContentBlock[]
  stop_reason?: string
  error?: { message?: string }
  message?: string
  usage?: { server_tool_use?: { web_search_requests?: number } }
}
type MessageRow = { role: 'user' | 'assistant'; content: unknown }
type InsightSection = { title: string; body: string }
const PAUSE_TURN_MAX = 8

function splitInsightSections (content: string): InsightSection[] {
  const trimmed = content.trim()
  if (!trimmed) return []
  if (!trimmed.includes('##')) return [{ title: 'Insights', body: trimmed }]
  const blocks = trimmed.split(/^##\s+/m).filter((b) => b.length > 0)
  const sections: InsightSection[] = []
  for (const block of blocks) {
    const nl = block.indexOf('\n')
    if (nl === -1) sections.push({ title: block.trim(), body: '' })
    else sections.push({ title: block.slice(0, nl).trim(), body: block.slice(nl + 1).trim() })
  }
  return sections
}

export function getInsightsWebSearchTool (): Record<string, unknown> {
  const rawMax = process.env.INSIGHTS_WEB_SEARCH_MAX_USES?.trim()
  const maxUses = rawMax ? Number.parseInt(rawMax, 10) : 5
  const tool: Record<string, unknown> = {
    name: 'web_search',
    max_uses: Number.isFinite(maxUses) && maxUses > 0 ? Math.min(15, maxUses) : 5,
  }
  const ver = process.env.PRICING_WEB_SEARCH_VERSION?.trim() || process.env.INSIGHTS_WEB_SEARCH_VERSION?.trim()
  tool.type = ver === '20260209' ? 'web_search_20260209' : 'web_search_20250305'
  if (ver === '20260209') tool.allowed_callers = ['direct']
  const domains = process.env.INSIGHTS_WEB_SEARCH_ALLOWED_DOMAINS?.trim() || process.env.PRICING_WEB_SEARCH_ALLOWED_DOMAINS?.trim()
  if (domains) tool.allowed_domains = domains.split(',').map((s) => s.trim()).filter(Boolean)
  return tool
}

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
  return payload?.content?.filter((i) => i?.type === 'text').map((i) => i?.text ?? '').join('\n').trim() ?? ''
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

async function runWithPauseTurn (apiKey: string, base: {
  model: string
  max_tokens: number
  temperature: number
  system: string
  tools: object[]
  messages: MessageRow[]
}): Promise<{ res: Response; payload: AnthropicPayload | null }> {
  const messages: MessageRow[] = [...base.messages]
  let lastOut: { res: Response; payload: AnthropicPayload | null } | undefined
  for (let i = 0; i < PAUSE_TURN_MAX; i++) {
    const out = await callAnthropic(apiKey, { ...base, messages })
    lastOut = out
    if (!out.res.ok) return out
    const stop = out.payload?.stop_reason
    if (stop !== 'pause_turn' || !out.payload?.content) return out
    messages.push({ role: 'assistant', content: out.payload.content })
  }
  return lastOut ?? {
    res: new Response(null, { status: 500 }),
    payload: { error: { message: 'Web search turn limit exceeded (pause_turn).' } },
  }
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
  return `You are SlabBook AI, an expert sports card market analyst with real-time market knowledge. Today's date is ${formatInsightDate(now)}.

CRITICAL RULES you must follow:
1. NEVER refer to a player as a rookie unless their card year is within 1-2 years of today (or the card is clearly a true rookie-year issue per the portfolio data).
2. Always reference how long ago a card was produced — a 2017 Mahomes card is now ${y - 2017} years old, not a rookie card.
3. Use the career_stage field to describe players accurately.
4. Reference actual holding periods.
5. Base buy/sell/hold advice on current market conditions from web context when present.
6. Never give generic hobby advice — every insight must reference a specific card by name.
7. If a player is injured, retired, or in decline say so directly.
8. Annualized returns matter.
9. Consider PSA population when provided.
10. Always reference the current year (${y}) in your analysis.`
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
  summary: PortfolioSummaryForInsights
  repairNote?: string
}): string {
  const { now, enrichedJson, webSearchResults, summary, repairNote } = args
  const repair = repairNote
    ? `\n\nIMPORTANT — FIX PREVIOUS OUTPUT:\n${repairNote}\nRegenerate the full report from scratch with the corrections.\n`
    : ''
  return `Today is ${formatInsightDate(now)}.

Here is my sports card portfolio with full context:

${enrichedJson}

Recent market news for my top cards:
${webSearchResults || `(No live web context for this run — rely on portfolio data and general ${now.getUTCFullYear()} market knowledge.)`}

Portfolio summary:
- Total cards: ${summary.total_cards}
- Total invested: $${summary.total_invested.toFixed(2)}
- Current estimated value: $${summary.total_value.toFixed(2)}
- Overall gain/loss: $${summary.gain_loss.toFixed(2)} (${summary.gain_pct}%)
- Best performer: ${summary.best_card_label} (+${summary.best_pct}%)
- Worst performer: ${summary.worst_card_label} (${summary.worst_pct}%)
${repair}
Use exactly these Markdown section headers (##) in this order:
${REQUIRED_SECTIONS}`
}

function buildResearchPrompt (top: EnrichedCardForInsights[], now: Date): string {
  const y = now.getUTCFullYear()
  const lines = top.map((c, i) => `${i + 1}. ${c.player_name} — ${c.card_display_label} (est. value $${(c.current_value ?? 0).toFixed(2)})`)
  return `Today is ${formatInsightDate(now)}. Gather concise facts for each player:
- card market ${y}
- injury news ${y}
- performance stats ${y}

Top cards:
${lines.join('\n')}

Output plain text bullet points only.`
}

export async function runTopCardsMarketResearch (args: {
  apiKey: string
  model: string
  topCards: EnrichedCardForInsights[]
  now: Date
}): Promise<{ ok: true; digest: string; usedWebSearch: boolean } | { ok: false; error: string }> {
  if (args.topCards.length === 0) return { ok: true, digest: '', usedWebSearch: false }
  const out = await runWithPauseTurn(args.apiKey, {
    model: args.model,
    max_tokens: 4096,
    temperature: 0.2,
    system: 'You are a research assistant. Use web search to collect recent public facts. No investment advice.',
    tools: [getInsightsWebSearchTool()],
    messages: [{ role: 'user', content: buildResearchPrompt(args.topCards, args.now) }],
  })
  if (!out.res.ok) {
    const msg = out.payload?.error?.message || out.payload?.message || 'Research request failed.'
    return { ok: false, error: msg }
  }
  const n = out.payload?.usage?.server_tool_use?.web_search_requests
  return { ok: true, digest: extractText(out.payload) || '(No digest text returned.)', usedWebSearch: typeof n === 'number' && n > 0 }
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
  return { ok: true, text: extractText(payload) || 'No insight generated.' }
}

function rookieLanguageViolation (text: string, cards: EnrichedCardForInsights[]): string | null {
  if (!/\brookie\b|first year|debut season/gi.test(text)) return null
  const sentences = text.split(/[.!?]\s+/)
  for (const c of cards) {
    if (c.card_age_years == null || c.card_age_years <= 2) continue
    for (const s of sentences) {
      if (s.includes(c.player_name) && /\brookie\b|first year|debut season/i.test(s)) {
        return `Do not use rookie language for ${c.player_name} whose card is from ${c.year ?? 'unknown year'}.`
      }
    }
  }
  return null
}

function staleYearViolation (text: string, now: Date): string | null {
  const currentYear = now.getUTCFullYear()
  if (!new RegExp(`\\b${currentYear}\\b`).test(text)) return `Explicitly reference the current year ${currentYear} in the analysis.`
  const staleFraming = /\b(?:as of|we are in|it is currently|right now in)\s+(20[0-2][0-9])\b/gi
  let m: RegExpExecArray | null
  while ((m = staleFraming.exec(text)) !== null) {
    const y = Number.parseInt(m[1], 10)
    if (y < currentYear - 1) return `Do not frame the analysis as year ${y}; the user needs ${currentYear} context.`
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
      if (!dollar.test(p)) return 'Be more specific — reference exact dollar amounts from portfolio data.'
      if (!names.some((n) => p.includes(n))) return 'Be more specific — reference exact cards and player full names from portfolio data.'
    }
  }
  return null
}

export function runInsightQualityChecks (text: string, cards: EnrichedCardForInsights[], now: Date): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  const r1 = rookieLanguageViolation(text, cards)
  if (r1) reasons.push(r1)
  const r2 = staleYearViolation(text, now)
  if (r2) reasons.push(r2)
  const r3 = specificityViolation(text, cards)
  if (r3) reasons.push(r3)
  return { ok: reasons.length === 0, reasons }
}

export function appendInsightMachineFooter (content: string, flags: { websearch: boolean; verify: boolean }): string {
  const parts: string[] = [content.trim()]
  if (flags.websearch) parts.push('<!--slabbook:flags:websearch-->')
  if (flags.verify) parts.push('<!--slabbook:flags:verify-->')
  return parts.filter(Boolean).join('\n\n')
}

export type UserPlanRow = {
  subscription_tier: string | null
  subscription_status: string | null
  lifetime_access: boolean | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
}

export function isDemoMode (): boolean {
  const v = process.env.DEMO_MODE?.trim().toLowerCase()
  const v2 = process.env.VITE_DEMO_MODE?.trim().toLowerCase()
  return v === 'true' || v === '1' || v2 === 'true' || v2 === '1'
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

function statusActive (status: string | null): boolean {
  const s = (status ?? '').toLowerCase()
  return s === 'active' || s === 'trialing'
}

function effectiveTier (row: UserPlanRow | null): 'free' | 'pro' | 'lifetime' {
  if (!row) return 'free'
  const t = (row.subscription_tier ?? 'free').toLowerCase()
  if (row.lifetime_access || t === 'lifetime') return 'lifetime'
  if (t === 'pro' || t === 'collector' || t === 'investor') {
    if (statusActive(row.subscription_status)) return 'pro'
    if (row.trial_ends_at && new Date(row.trial_ends_at).getTime() > Date.now()) return 'pro'
  }
  return 'free'
}

export async function fetchUserPlan (admin: SupabaseClient, userId: string): Promise<UserPlanRow | null> {
  const { data, error } = await admin
    .from('users')
    .select('subscription_tier, subscription_status, lifetime_access, trial_ends_at, subscription_ends_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as UserPlanRow
}

export function canUseFeature (row: UserPlanRow | null, feature: 'ai_insights'): boolean {
  if (feature !== 'ai_insights') return false
  const tier = effectiveTier(row)
  return tier === 'lifetime' || tier === 'pro'
}

const DEFAULT_CLAUDE_CAP = 50

function dailyClaudeCap (): number {
  const raw = process.env.CLAUDE_DAILY_CAP?.trim()
  if (!raw) return DEFAULT_CLAUDE_CAP
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CLAUDE_CAP
}

function utcDayStartIso (): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString()
}

async function sendCapAlertEmailIfNeeded (admin: SupabaseClient): Promise<void> {
  const to = process.env.ALERT_EMAIL?.trim() || process.env.CLAUDE_CAP_ALERT_EMAIL?.trim()
  if (!to) return
  const day = new Date().toISOString().slice(0, 10)

  const { data: existing } = await admin.from('claude_cap_alert_sent').select('day').eq('day', day).maybeSingle()
  if (existing) return

  const { error: insErr } = await admin.from('claude_cap_alert_sent').insert({ day })
  if (insErr) {
    if ((insErr as { code?: string }).code === '23505') return
    console.warn('[claude cap] could not record alert row', insErr.message)
    return
  }

  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return
  const from = process.env.RESEND_FROM?.trim() ?? 'SlabBook <onboarding@resend.dev>'
  const cap = dailyClaudeCap()
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `SlabBook — Claude daily cap reached (${cap}/day)`,
      text: `The app hit ${cap} Claude API calls today (UTC) and is blocking further calls until tomorrow.\n\nCheck logs for loops or bugs.\n\n— SlabBook`,
    }),
  }).catch(() => null)

  if (res && !res.ok) {
    const t = await res.text().catch(() => '')
    console.warn('[claude cap] Resend error', res.status, t)
  }
}

export async function tryReserveClaudeCall (
  admin: SupabaseClient,
  route: string,
): Promise<{ ok: true } | { ok: false; reason: 'cap' }> {
  if (isDemoMode()) return { ok: true }

  const cap = dailyClaudeCap()
  const since = utcDayStartIso()
  const { count, error: countErr } = await admin
    .from('claude_api_calls')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since)

  if (countErr) {
    console.error('[claude cap] count failed', countErr.message)
    return { ok: true }
  }

  const n = count ?? 0
  if (n >= cap) {
    void sendCapAlertEmailIfNeeded(admin)
    return { ok: false, reason: 'cap' }
  }

  const { error: insErr } = await admin.from('claude_api_calls').insert({ route })
  if (insErr) {
    console.error('[claude cap] insert failed', insErr.message)
    return { ok: true }
  }
  return { ok: true }
}
