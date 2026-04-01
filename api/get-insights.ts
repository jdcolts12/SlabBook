import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type ApiRequest = { method?: string; headers: Record<string, string | undefined> }
type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

type CardRowForInsights = {
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

type EnrichedCard = {
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
  card_age_years: number | null
  player_pro_rookie_year: number | null
  is_true_rookie_card: boolean
  rookie_years_ago: number | null
  career_stage: string
  value_change_percent: string | null
  holding_period_days: number | null
  holding_period_text: string | null
  is_up: boolean | null
  annualized_return_percent: string | null
}

type Summary = {
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

type AnthropicBlock = { type?: string; text?: string; [k: string]: unknown }
type AnthropicPayload = {
  content?: AnthropicBlock[]
  stop_reason?: string
  error?: { message?: string }
  message?: string
  usage?: { server_tool_use?: { web_search_requests?: number } }
}
type MessageRow = { role: 'user' | 'assistant'; content: unknown }

const EMPTY_MESSAGE = `Add a few cards to your collection first — then SlabBook AI can break down your portfolio, opportunities, and risks.`
const DEFAULT_CLAUDE_CAP = 50
const PAUSE_TURN_MAX = 8

const PLAYER_ROOKIE_YEARS: Record<string, number> = {
  'Patrick Mahomes': 2017, 'Josh Allen': 2018, 'Joe Burrow': 2020, 'Justin Herbert': 2020,
  'Trevor Lawrence': 2021, 'Justin Fields': 2021, 'Bryce Young': 2023, 'CJ Stroud': 2023,
  'Drake Maye': 2024, 'Caleb Williams': 2024, 'LeBron James': 2003, 'Stephen Curry': 2009,
  'Kevin Durant': 2007, 'Giannis Antetokounmpo': 2013, 'Luka Doncic': 2018, 'Ja Morant': 2019,
  'Zion Williamson': 2019, 'Cade Cunningham': 2021, 'Paolo Banchero': 2022, 'Victor Wembanyama': 2023,
  'Caitlin Clark': 2024, 'Mike Trout': 2011, 'Shohei Ohtani': 2018, 'Ronald Acuna Jr': 2018,
  'Ronald Acuña Jr': 2018, 'Juan Soto': 2018, 'Fernando Tatis Jr': 2019, 'Julio Rodriguez': 2022,
  'Paul Skenes': 2024, 'Connor McDavid': 2015, 'Auston Matthews': 2016, 'Connor Bedard': 2023,
  'Macklin Celebrini': 2024,
}

function isDemoMode (): boolean {
  const v = process.env.DEMO_MODE?.trim().toLowerCase()
  const v2 = process.env.VITE_DEMO_MODE?.trim().toLowerCase()
  return v === 'true' || v === '1' || v2 === 'true' || v2 === '1'
}

function getBearerToken (authHeader?: string): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

function formatInsightDate (d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

function appendHumanInsightFooter (content: string, opts: { now: Date; usedWebSearch: boolean; qualityVerify: boolean }): string {
  const lines = ['---', `*Generated ${formatInsightDate(opts.now)} based on current market data.*`]
  if (opts.usedWebSearch) lines.push('*Includes live market context for your top cards.*')
  if (opts.qualityVerify) lines.push('*Review these insights — some details may need verification.*')
  return `${content.trim()}\n\n${lines.join('\n')}`
}

function appendInsightMachineFooter (content: string, flags: { websearch: boolean; verify: boolean }): string {
  const parts = [content.trim()]
  if (flags.websearch) parts.push('<!--slabbook:flags:websearch-->')
  if (flags.verify) parts.push('<!--slabbook:flags:verify-->')
  return parts.join('\n\n')
}

function fakeInsightsMarkdown (): string {
  return `## Portfolio health
Demo mode — AI is disabled. This sample shows the ${new Date().getUTCFullYear()} layout.

## Sell candidates
1. Demo Player 2020 Demo Set PSA 10 — placeholder.

## Strong holds
1. Demo Player 2020 Demo Set PSA 10 — placeholder.

## Watch list
- Demo Player 2020 — placeholder.

## Hidden gem
Demo Player 2020 Demo Set — placeholder.

## This week's action
Turn off \`DEMO_MODE\` and run insights with a real collection.`
}

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

async function tryReserveClaudeCall (admin: SupabaseClient, route: string): Promise<{ ok: true } | { ok: false; reason: 'cap' }> {
  if (isDemoMode()) return { ok: true }
  const { count } = await admin.from('claude_api_calls').select('*', { count: 'exact', head: true }).gte('created_at', utcDayStartIso())
  if ((count ?? 0) >= dailyClaudeCap()) return { ok: false, reason: 'cap' }
  await admin.from('claude_api_calls').insert({ route })
  return { ok: true }
}

async function fetchUserPlan (admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('users')
    .select('subscription_tier, subscription_status, lifetime_access, trial_ends_at, subscription_ends_at')
    .eq('id', userId)
    .maybeSingle()
  return data ?? null
}

function canUseFeature (row: Awaited<ReturnType<typeof fetchUserPlan>>, feature: 'ai_insights'): boolean {
  if (feature !== 'ai_insights') return false
  if (!row) return false
  const tier = (row.subscription_tier ?? 'free').toLowerCase()
  if (row.lifetime_access || tier === 'lifetime') return true
  const active = ['active', 'trialing'].includes((row.subscription_status ?? '').toLowerCase())
  const inTrial = Boolean(row.trial_ends_at && new Date(row.trial_ends_at).getTime() > Date.now())
  return (tier === 'pro' || tier === 'collector' || tier === 'investor') && (active || inTrial)
}

function gradeLine (c: CardRowForInsights): string {
  if (!c.is_graded) return 'Raw'
  const bits = [c.grading_company, c.grade].filter(Boolean)
  return bits.length ? bits.join(' ') : 'Graded'
}

function playerProYear (name: string): number | null {
  if (PLAYER_ROOKIE_YEARS[name] != null) return PLAYER_ROOKIE_YEARS[name]
  const lower = name.toLowerCase()
  for (const [k, y] of Object.entries(PLAYER_ROOKIE_YEARS)) if (k.toLowerCase() === lower) return y
  return null
}

function holdingPeriodText (days: number): string {
  if (days < 1) return 'Less than a day'
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  const p: string[] = []
  if (y > 0) p.push(`${y} year${y === 1 ? '' : 's'}`)
  if (m > 0) p.push(`${m} month${m === 1 ? '' : 's'}`)
  if (p.length === 0) p.push(`${days} day${days === 1 ? '' : 's'}`)
  return p.join(' ')
}

function cardStage (age: number | null): string {
  if (age == null) return 'Unknown (missing card year)'
  if (age <= 1) return 'Current rookie era print'
  if (age <= 3) return 'Early career era print'
  if (age <= 7) return 'Established veteran era print'
  if (age <= 12) return 'Prime veteran era print'
  return 'Late career / retired era print'
}

function playerStage (yearsPro: number): string {
  if (yearsPro <= 1) return 'Current rookie / very early career'
  if (yearsPro <= 3) return 'Early career'
  if (yearsPro <= 7) return 'Established veteran'
  if (yearsPro <= 12) return 'Prime veteran'
  return 'Late career / retired'
}

function enrichCard (c: CardRowForInsights, now: Date): EnrichedCard {
  const cy = now.getUTCFullYear()
  const age = c.year != null ? Math.max(0, cy - c.year) : null
  const rookieYear = playerProYear(c.player_name)
  const yearsSincePro = rookieYear != null ? Math.max(0, cy - rookieYear) : null
  const rookieKeywords = /\brc\b|rookie|first year|1st year/i.test(`${c.variation ?? ''} ${c.set_name ?? ''} ${c.card_number ?? ''}`)
  const isTrueRookie = (c.year != null && rookieYear != null && c.year === rookieYear) || rookieKeywords
  const purchase = c.purchase_price != null ? Number(c.purchase_price) : null
  const current = c.current_value != null ? Number(c.current_value) : null
  let valuePct: string | null = null
  let isUp: boolean | null = null
  let annualized: string | null = null
  if (purchase != null && purchase > 0 && current != null) {
    valuePct = (((current - purchase) / purchase) * 100).toFixed(1)
    isUp = current > purchase
    if (c.purchase_date) {
      const p = new Date(c.purchase_date).getTime()
      if (!Number.isNaN(p)) {
        const days = Math.max(0, Math.floor((now.getTime() - p) / 86_400_000))
        if (days >= 30) annualized = ((((current / purchase) ** (1 / (days / 365))) - 1) * 100).toFixed(1)
      }
    }
  }
  let holdingDays: number | null = null
  if (c.purchase_date) {
    const p = new Date(c.purchase_date).getTime()
    if (!Number.isNaN(p)) holdingDays = Math.max(0, Math.floor((now.getTime() - p) / 86_400_000))
  }
  const ps = yearsSincePro != null ? playerStage(yearsSincePro) : null
  return {
    card_display_label: [c.player_name, c.year != null ? String(c.year) : null, c.set_name, gradeLine(c)].filter(Boolean).join(' · '),
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
    card_age_years: age,
    player_pro_rookie_year: rookieYear,
    is_true_rookie_card: isTrueRookie,
    rookie_years_ago: age,
    career_stage: ps ?? cardStage(age),
    value_change_percent: valuePct,
    holding_period_days: holdingDays,
    holding_period_text: holdingDays != null ? holdingPeriodText(holdingDays) : null,
    is_up: isUp,
    annualized_return_percent: annualized,
  }
}

function topByValue (cards: EnrichedCard[], n: number): EnrichedCard[] {
  return [...cards].filter((c) => c.current_value != null && c.current_value > 0).sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0)).slice(0, n)
}

function summaryFor (cards: EnrichedCard[]): Summary {
  let totalInvested = 0
  let totalValue = 0
  let best: { label: string; pct: number } | null = null
  let worst: { label: string; pct: number } | null = null
  for (const c of cards) {
    if (c.purchase_price != null && c.purchase_price > 0) totalInvested += c.purchase_price
    if (c.current_value != null) totalValue += c.current_value
    if (c.value_change_percent != null) {
      const pct = Number.parseFloat(c.value_change_percent)
      if (Number.isFinite(pct)) {
        const label = `${c.player_name}${c.year != null ? ` (${c.year})` : ''} · ${c.grade_line}`
        if (!best || pct > best.pct) best = { label, pct }
        if (!worst || pct < worst.pct) worst = { label, pct }
      }
    }
  }
  const gain = totalValue - totalInvested
  return {
    total_cards: cards.length,
    total_invested: totalInvested,
    total_value: totalValue,
    gain_loss: gain,
    gain_pct: totalInvested > 0 ? ((gain / totalInvested) * 100).toFixed(1) : '0.0',
    best_card_label: best?.label ?? 'N/A',
    best_pct: best != null ? best.pct.toFixed(1) : '0',
    worst_card_label: worst?.label ?? 'N/A',
    worst_pct: worst != null ? worst.pct.toFixed(1) : '0',
  }
}

function promptCardJson (c: EnrichedCard): Record<string, unknown> {
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
    card_age_years: c.card_age_years,
    player_pro_rookie_year: c.player_pro_rookie_year,
    is_true_rookie: c.is_true_rookie_card,
    rookie_years_ago: c.rookie_years_ago,
    career_stage: c.career_stage,
    value_change_percent: c.value_change_percent,
    holding_period_days: c.holding_period_days,
    holding_period_text: c.holding_period_text,
    is_up: c.is_up,
    annualized_return: c.annualized_return_percent,
  }
}

function webSearchTool (): Record<string, unknown> {
  const rawMax = process.env.INSIGHTS_WEB_SEARCH_MAX_USES?.trim()
  const maxUses = rawMax ? Number.parseInt(rawMax, 10) : 5
  const tool: Record<string, unknown> = { name: 'web_search', max_uses: Number.isFinite(maxUses) && maxUses > 0 ? Math.min(15, maxUses) : 5 }
  const ver = process.env.PRICING_WEB_SEARCH_VERSION?.trim() || process.env.INSIGHTS_WEB_SEARCH_VERSION?.trim()
  tool.type = ver === '20260209' ? 'web_search_20260209' : 'web_search_20250305'
  if (ver === '20260209') tool.allowed_callers = ['direct']
  return tool
}

function skipWebSearch (): boolean {
  if (process.env.INSIGHTS_SKIP_WEB_SEARCH === '1') return true
  if (process.env.PRICING_SKIP_WEB_SEARCH === '1') return true
  if (process.env.VERCEL !== '1') return false
  return process.env.INSIGHTS_ENABLE_WEB_SEARCH !== '1' && process.env.PRICING_ENABLE_WEB_SEARCH !== '1'
}

function anthropicHeaders (apiKey: string): Record<string, string> {
  const h: Record<string, string> = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
  const beta = process.env.ANTHROPIC_BETA?.trim()
  if (beta) h['anthropic-beta'] = beta
  return h
}

async function callAnthropic (apiKey: string, body: object): Promise<{ res: Response; payload: AnthropicPayload | null }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: anthropicHeaders(apiKey), body: JSON.stringify(body) })
  const payload = (await res.json().catch(() => null)) as AnthropicPayload | null
  return { res, payload }
}

function extractText (payload: AnthropicPayload | null): string {
  return payload?.content?.filter((i) => i?.type === 'text').map((i) => i?.text ?? '').join('\n').trim() ?? ''
}

async function runWithPauseTurn (apiKey: string, base: { model: string; max_tokens: number; temperature: number; system: string; tools: object[]; messages: MessageRow[] }) {
  const messages: MessageRow[] = [...base.messages]
  let lastOut: { res: Response; payload: AnthropicPayload | null } | undefined
  for (let i = 0; i < PAUSE_TURN_MAX; i++) {
    const out = await callAnthropic(apiKey, { ...base, messages })
    lastOut = out
    if (!out.res.ok) return out
    if (out.payload?.stop_reason !== 'pause_turn' || !out.payload?.content) return out
    messages.push({ role: 'assistant', content: out.payload.content })
  }
  return lastOut!
}

async function runTopCardsMarketResearch (args: { apiKey: string; model: string; topCards: EnrichedCard[]; now: Date }): Promise<{ ok: true; digest: string; usedWebSearch: boolean } | { ok: false; error: string }> {
  if (args.topCards.length === 0) return { ok: true, digest: '', usedWebSearch: false }
  const lines = args.topCards.map((c, i) => `${i + 1}. ${c.player_name} — ${c.card_display_label} (est. value $${(c.current_value ?? 0).toFixed(2)})`)
  const user = `Today is ${formatInsightDate(args.now)}. Gather concise facts:
- card market ${args.now.getUTCFullYear()}
- injury news ${args.now.getUTCFullYear()}
- performance stats ${args.now.getUTCFullYear()}
Top cards:
${lines.join('\n')}
Output plain text bullets only.`
  const out = await runWithPauseTurn(args.apiKey, {
    model: args.model,
    max_tokens: 4096,
    temperature: 0.2,
    system: 'You are a research assistant. Use web search to collect recent public facts.',
    tools: [webSearchTool()],
    messages: [{ role: 'user', content: user }],
  })
  if (!out.res.ok) return { ok: false, error: out.payload?.error?.message || out.payload?.message || 'Research request failed.' }
  const n = out.payload?.usage?.server_tool_use?.web_search_requests
  return { ok: true, digest: extractText(out.payload) || '(No digest text returned.)', usedWebSearch: typeof n === 'number' && n > 0 }
}

function systemPrompt (now: Date): string {
  const y = now.getUTCFullYear()
  return `You are SlabBook AI, an expert sports card market analyst with real-time market knowledge. Today's date is ${formatInsightDate(now)}.
Use current year ${y}. Be specific. Never mislabel veterans as rookies.`
}

function userPrompt (args: { now: Date; enrichedJson: string; webSearchResults: string; summary: Summary; repairNote?: string }): string {
  const repair = args.repairNote ? `\n\nIMPORTANT — FIX PREVIOUS OUTPUT:\n${args.repairNote}\nRegenerate the full report from scratch.\n` : ''
  return `Today is ${formatInsightDate(args.now)}.
Here is my sports card portfolio with full context:
${args.enrichedJson}
Recent market news for my top cards:
${args.webSearchResults || `(No live web context for this run — rely on portfolio data and general ${args.now.getUTCFullYear()} market knowledge.)`}
Portfolio summary:
- Total cards: ${args.summary.total_cards}
- Total invested: $${args.summary.total_invested.toFixed(2)}
- Current estimated value: $${args.summary.total_value.toFixed(2)}
- Overall gain/loss: $${args.summary.gain_loss.toFixed(2)} (${args.summary.gain_pct}%)
- Best performer: ${args.summary.best_card_label} (+${args.summary.best_pct}%)
- Worst performer: ${args.summary.worst_card_label} (${args.summary.worst_pct}%)
${repair}
Use exactly these Markdown section headers (##) in this order:
## Portfolio health
## Sell candidates
## Strong holds
## Watch list
## Hidden gem
## This week's action`
}

async function runInsightsGeneration (args: { apiKey: string; model: string; system: string; user: string }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const { res, payload } = await callAnthropic(args.apiKey, {
    model: args.model,
    max_tokens: 6144,
    temperature: 0.35,
    system: args.system,
    messages: [{ role: 'user', content: args.user }],
  })
  if (!res.ok) return { ok: false, error: payload?.error?.message || payload?.message || 'Claude API request failed.' }
  return { ok: true, text: extractText(payload) || 'No insight generated.' }
}

function runInsightQualityChecks (text: string, cards: EnrichedCard[], now: Date): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (/\brookie\b|first year|debut season/gi.test(text)) {
    const sentences = text.split(/[.!?]\s+/)
    for (const c of cards) {
      if (c.card_age_years == null || c.card_age_years <= 2) continue
      if (sentences.some((s) => s.includes(c.player_name) && /\brookie\b|first year|debut season/i.test(s))) {
        reasons.push(`Do not use rookie language for ${c.player_name} whose card is from ${c.year ?? 'unknown year'}.`)
        break
      }
    }
  }
  const y = now.getUTCFullYear()
  if (!new RegExp(`\\b${y}\\b`).test(text)) reasons.push(`Explicitly reference the current year ${y} in the analysis.`)
  const names = [...new Set(cards.map((c) => c.player_name).filter(Boolean))]
  const dollar = /\$\s*[\d][\d,]*(?:\.\d{1,2})?/
  const blocks = text.trim().split(/^##\s+/m).filter((b) => b.length > 0)
  for (const block of blocks) {
    const nl = block.indexOf('\n')
    const body = nl === -1 ? '' : block.slice(nl + 1).trim()
    const paras = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
    for (const p of paras) {
      if (p.length < 80) continue
      if (!dollar.test(p)) reasons.push('Be more specific — reference exact dollar amounts from portfolio data.')
      if (!names.some((n) => p.includes(n))) reasons.push('Be more specific — reference exact cards and player full names from portfolio data.')
      if (reasons.length > 0) break
    }
    if (reasons.length > 0) break
  }
  return { ok: reasons.length === 0, reasons }
}

export default async function handler (req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!supabaseUrl || !supabaseServiceRole || !anthropicApiKey) {
      return res.status(500).json({
        error: 'Missing server env vars. Required: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.',
      })
    }

    const token = getBearerToken(req.headers.authorization)
    if (!token) return res.status(401).json({ error: 'Missing bearer token.' })

    const admin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: { user }, error: userError } = await admin.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Invalid or expired auth token.' })

    const plan = await fetchUserPlan(admin, user.id)
    if (!canUseFeature(plan, 'ai_insights')) {
      return res.status(403).json({ error: 'AI insights require a Pro plan. Upgrade to unlock portfolio analysis.' })
    }

    const { data: cardsData, error: cardsError } = await admin
      .from('cards')
      .select('player_name, year, set_name, sport, is_graded, grade, grading_company, purchase_price, current_value, purchase_date, card_number, variation')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (cardsError) return res.status(500).json({ error: cardsError.message })

    const rows = (cardsData ?? []) as CardRowForInsights[]
    if (rows.length === 0) return res.status(200).json({ insight: EMPTY_MESSAGE, no_cards: true })

    const now = new Date()
    const enriched = rows.map((r) => enrichCard(r, now))
    const summary = summaryFor(enriched)
    const top5 = topByValue(enriched, 5)
    const enrichedJson = JSON.stringify(enriched.map(promptCardJson), null, 2)

    const reserve = await tryReserveClaudeCall(admin, 'get-insights')
    if (!reserve.ok) return res.status(503).json({ error: 'Daily Claude API limit reached for this deployment. Try again tomorrow (UTC).' })

    if (isDemoMode()) {
      const content = fakeInsightsMarkdown()
      const withFooter = appendHumanInsightFooter(content, { now, usedWebSearch: false, qualityVerify: false })
      const stored = appendInsightMachineFooter(withFooter, { websearch: false, verify: false })
      const { data: inserted, error: insertError } = await admin.from('ai_insights').insert({ user_id: user.id, content: stored, is_read: false }).select('id, created_at').single()
      if (insertError) return res.status(500).json({ error: insertError.message })
      return res.status(200).json({ insight: stored, id: inserted?.id, created_at: inserted?.created_at, used_web_search: false, quality_disclaimer: false })
    }

    const model = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514'
    let webDigest = ''
    let usedWebSearch = false
    if (!skipWebSearch() && top5.length > 0) {
      const rReserve = await tryReserveClaudeCall(admin, 'get-insights-research')
      if (rReserve.ok) {
        const research = await runTopCardsMarketResearch({ apiKey: anthropicApiKey, model, topCards: top5, now })
        if (research.ok) {
          webDigest = research.digest
          usedWebSearch = research.usedWebSearch
        }
      }
    }

    const system = systemPrompt(now)
    let bestText = ''
    let lastChecks: { ok: boolean; reasons: string[] } = { ok: true, reasons: [] }
    for (let attempt = 0; attempt < 3; attempt++) {
      const repairNote = attempt > 0 && lastChecks.reasons.length > 0 ? lastChecks.reasons.join(' ') : undefined
      const genReserve = await tryReserveClaudeCall(admin, `get-insights-gen-${attempt}`)
      if (!genReserve.ok) {
        if (bestText) break
        return res.status(503).json({ error: 'Daily Claude API limit reached for this deployment. Try again tomorrow (UTC).' })
      }
      const gen = await runInsightsGeneration({
        apiKey: anthropicApiKey,
        model,
        system,
        user: userPrompt({ now, enrichedJson, webSearchResults: webDigest, summary, repairNote }),
      })
      if (!gen.ok) {
        if (bestText) break
        return res.status(502).json({ error: gen.error })
      }
      bestText = gen.text
      lastChecks = runInsightQualityChecks(gen.text, enriched, now)
      if (lastChecks.ok) break
    }

    const qualityVerify = !lastChecks.ok && bestText.length > 0
    const withHuman = appendHumanInsightFooter(bestText, { now, usedWebSearch, qualityVerify })
    const content = appendInsightMachineFooter(withHuman, { websearch: usedWebSearch, verify: qualityVerify })
    const { data: inserted, error: insertError } = await admin.from('ai_insights').insert({ user_id: user.id, content, is_read: false }).select('id, created_at').single()
    if (insertError) return res.status(500).json({ error: insertError.message })
    return res.status(200).json({ insight: content, id: inserted?.id, created_at: inserted?.created_at, used_web_search: usedWebSearch, quality_disclaimer: qualityVerify })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error generating AI insights.'
    console.error('[get-insights] unhandled error:', err)
    return res.status(500).json({ error: message })
  }
}
