import { createClient } from '@supabase/supabase-js'
import {
  buildPortfolioSummary,
  canUseFeature,
  cardToInsightsPromptJson,
  enrichCardForInsights,
  fakeInsightsMarkdown,
  fetchUserPlan,
  isDemoMode,
  topCardsByValue,
  tryReserveClaudeCall,
  type CardRowForInsights,
  appendInsightMachineFooter,
  buildInsightsSystemPrompt,
  buildInsightsUserPrompt,
  formatInsightDate,
  resolveInsightsSkipWebSearch,
  runInsightQualityChecks,
  runInsightsGeneration,
  runTopCardsMarketResearch,
} from './_insights'

type ApiRequest = {
  method?: string
  headers: Record<string, string | undefined>
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

function getBearerToken (authHeader?: string): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

function appendHumanInsightFooter (
  content: string,
  opts: { now: Date; usedWebSearch: boolean; qualityVerify: boolean },
): string {
  const lines = ['---', `*Generated ${formatInsightDate(opts.now)} based on current market data.*`]
  if (opts.usedWebSearch) {
    lines.push('*Includes live market context for your top cards.*')
  }
  if (opts.qualityVerify) {
    lines.push('*Review these insights — some details may need verification.*')
  }
  return `${content.trim()}\n\n${lines.join('\n')}`
}

const EMPTY_MESSAGE = `Add a few cards to your collection first — then SlabBook AI can break down your portfolio, opportunities, and risks.`

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
      error:
        'Missing server env vars. Required: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.',
    })
  }

  const token = getBearerToken(req.headers.authorization)
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' })
  }

  const admin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token)

  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid or expired auth token.' })
  }

  const plan = await fetchUserPlan(admin, user.id)
  if (!canUseFeature(plan, 'ai_insights')) {
    return res.status(403).json({
      error: 'AI insights require a Pro plan. Upgrade to unlock portfolio analysis.',
    })
  }

  const { data: cardsData, error: cardsError } = await admin
    .from('cards')
    .select(
      'player_name, year, set_name, sport, is_graded, grade, grading_company, purchase_price, current_value, purchase_date, card_number, variation',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (cardsError) {
    return res.status(500).json({ error: cardsError.message })
  }

  const rows = (cardsData ?? []) as CardRowForInsights[]

  if (rows.length === 0) {
    return res.status(200).json({
      insight: EMPTY_MESSAGE,
      no_cards: true,
    })
  }

  const now = new Date()
  const enriched = rows.map((r) => enrichCardForInsights(r, now))
  const summary = buildPortfolioSummary(enriched)
  const top5 = topCardsByValue(enriched, 5)
  const enrichedJson = JSON.stringify(enriched.map(cardToInsightsPromptJson), null, 2)

  const reserve = await tryReserveClaudeCall(admin, 'get-insights')
  if (!reserve.ok) {
    return res.status(503).json({
      error: 'Daily Claude API limit reached for this deployment. Try again tomorrow (UTC).',
    })
  }

  if (isDemoMode()) {
    const content = fakeInsightsMarkdown()
    const withFooter = appendHumanInsightFooter(content, {
      now,
      usedWebSearch: false,
      qualityVerify: false,
    })
    const stored = appendInsightMachineFooter(withFooter, { websearch: false, verify: false })
    const { data: inserted, error: insertError } = await admin
      .from('ai_insights')
      .insert({
        user_id: user.id,
        content: stored,
        is_read: false,
      })
      .select('id, created_at')
      .single()

    if (insertError) return res.status(500).json({ error: insertError.message })

    return res.status(200).json({
      insight: stored,
      id: inserted?.id,
      created_at: inserted?.created_at,
      used_web_search: false,
      quality_disclaimer: false,
    })
  }

  const model =
    typeof process.env.ANTHROPIC_MODEL === 'string' && process.env.ANTHROPIC_MODEL.trim()
      ? process.env.ANTHROPIC_MODEL.trim()
      : 'claude-sonnet-4-20250514'

  const skipWeb = resolveInsightsSkipWebSearch()
  let webDigest = ''
  let usedWebSearch = false

  if (!skipWeb && top5.length > 0) {
    const rReserve = await tryReserveClaudeCall(admin, 'get-insights-research')
    if (rReserve.ok) {
      const research = await runTopCardsMarketResearch({
        apiKey: anthropicApiKey,
        model,
        topCards: top5,
        now,
      })
      if (research.ok) {
        webDigest = research.digest
        usedWebSearch = research.usedWebSearch
      } else {
        console.warn('[get-insights] market research failed:', research.error)
      }
    } else {
      console.warn('[get-insights] skipped market research (daily cap)')
    }
  }

  const system = buildInsightsSystemPrompt(now)
  let bestText = ''
  let lastChecks: { ok: boolean; reasons: string[] } = { ok: true, reasons: [] }
  const maxAttempts = 3

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const repairNote =
      attempt > 0 && lastChecks.reasons.length > 0 ? lastChecks.reasons.join(' ') : undefined

    const genReserve = await tryReserveClaudeCall(admin, `get-insights-gen-${attempt}`)
    if (!genReserve.ok) {
      if (bestText) break
      return res.status(503).json({
        error: 'Daily Claude API limit reached for this deployment. Try again tomorrow (UTC).',
      })
    }

    const userPrompt = buildInsightsUserPrompt({
      now,
      enrichedJson,
      webSearchResults: webDigest,
      summary,
      repairNote,
    })

    const gen = await runInsightsGeneration({
      apiKey: anthropicApiKey,
      model,
      system,
      user: userPrompt,
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
  const withHuman = appendHumanInsightFooter(bestText, {
    now,
    usedWebSearch,
    qualityVerify,
  })
  const content = appendInsightMachineFooter(withHuman, {
    websearch: usedWebSearch,
    verify: qualityVerify,
  })

  const { data: inserted, error: insertError } = await admin
    .from('ai_insights')
    .insert({
      user_id: user.id,
      content,
      is_read: false,
    })
    .select('id, created_at')
    .single()

  if (insertError) return res.status(500).json({ error: insertError.message })

    return res.status(200).json({
      insight: content,
      id: inserted?.id,
      created_at: inserted?.created_at,
      used_web_search: usedWebSearch,
      quality_disclaimer: qualityVerify,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error generating AI insights.'
    console.error('[get-insights] unhandled error:', err)
    return res.status(500).json({ error: message })
  }
}
