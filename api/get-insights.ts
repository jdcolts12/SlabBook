import { createClient } from '@supabase/supabase-js'
import { canUseFeature, fetchUserPlan } from './lib/userTier'

type ApiRequest = {
  method?: string
  headers: Record<string, string | undefined>
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

type CardRow = {
  player_name: string
  year: number | null
  set_name: string | null
  sport: string | null
  is_graded: boolean
  grade: string | null
  grading_company: string | null
  purchase_price: number | null
  current_value: number | null
}

type AnthropicTextBlock = {
  type: string
  text?: string
}

type AnthropicErrorPayload = {
  error?: { message?: string }
  message?: string
  content?: AnthropicTextBlock[]
}

const SYSTEM_PROMPT = `You are SlabBook AI, an expert sports card analyst and collector advisor. You analyze a user's card portfolio and provide personalized, actionable insights. You know current market trends, player performance impacts on card values, and collecting strategy. Be specific, conversational, and helpful. Reference actual cards in their collection by name.`

function getBearerToken (authHeader?: string): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

function gradeLine (c: CardRow): string {
  if (!c.is_graded) return 'Raw'
  const bits = [c.grading_company, c.grade].filter(Boolean)
  return bits.length ? bits.join(' ') : 'Graded'
}

function cardsToJsonPayload (cards: CardRow[]): unknown[] {
  return cards.map((c) => ({
    player: c.player_name,
    year: c.year,
    set: c.set_name,
    sport: c.sport,
    grade: gradeLine(c),
    purchase_price: c.purchase_price != null ? Number(c.purchase_price) : null,
    current_value: c.current_value != null ? Number(c.current_value) : null,
  }))
}

const EMPTY_MESSAGE = `Add a few cards to your collection first — then SlabBook AI can break down your portfolio, opportunities, and risks.`

export default async function handler (req: ApiRequest, res: ApiResponse) {
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
      error: 'AI insights require a Collector plan or higher. Upgrade to unlock portfolio analysis.',
    })
  }

  const { data: cardsData, error: cardsError } = await admin
    .from('cards')
    .select(
      'player_name, year, set_name, sport, is_graded, grade, grading_company, purchase_price, current_value',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (cardsError) {
    return res.status(500).json({ error: cardsError.message })
  }

  const cards = (cardsData ?? []) as CardRow[]

  if (cards.length === 0) {
    return res.status(200).json({
      insight: EMPTY_MESSAGE,
      no_cards: true,
    })
  }

  const collectionJson = JSON.stringify(cardsToJsonPayload(cards), null, 2)

  const userPrompt = `Here is my sports card collection: ${collectionJson}

Please give me:
- Portfolio health summary (2-3 sentences)
- Top 3 opportunities (cards to potentially sell now)
- Top 3 risks (cards that may be losing value)
- One sleeper pick from my collection with upside
- One actionable thing I should do this week

Format each section with a clear header and keep the tone like a knowledgeable friend, not a robot.

Use exactly these Markdown section headers (##) in this order:
## Portfolio health summary
## Top 3 opportunities
## Top 3 risks
## Sleeper pick
## Action this week`

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.35,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  const anthropicPayload = (await anthropicResponse.json().catch(() => null)) as AnthropicErrorPayload | null
  if (!anthropicResponse.ok) {
    const msg =
      anthropicPayload?.error?.message ||
      anthropicPayload?.message ||
      'Claude API request failed.'
    return res.status(502).json({ error: msg })
  }

  const content: string =
    anthropicPayload?.content
      ?.filter((item) => item?.type === 'text')
      .map((item) => item?.text ?? '')
      .join('\n')
      .trim() || 'No insight generated.'

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
  })
}
