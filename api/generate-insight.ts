import { createClient } from '@supabase/supabase-js'

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
  card_number: string | null
  variation: string | null
  is_graded: boolean
  grade: string | null
  grading_company: string | null
  purchase_price: number | null
  current_value: number | null
}

function getBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

function serializeCards(cards: CardRow[]): string {
  return cards
    .slice(0, 60)
    .map((card, index) => {
      const grade = card.is_graded
        ? `${card.grading_company ?? 'Graded'} ${card.grade ?? ''}`.trim()
        : 'Raw'
      const setBits = [card.year, card.set_name, card.card_number].filter(Boolean).join(' ')
      const pricing = `purchase=${card.purchase_price ?? 'n/a'} current=${card.current_value ?? 'n/a'}`
      const variation = card.variation ? `variation=${card.variation}` : ''
      return `${index + 1}. ${card.player_name} | ${setBits} | ${grade} | ${pricing} ${variation}`.trim()
    })
    .join('\n')
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

export default async function handler(req: ApiRequest, res: ApiResponse) {
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

  const { data: cardsData, error: cardsError } = await admin
    .from('cards')
    .select(
      'player_name, year, set_name, card_number, variation, is_graded, grade, grading_company, purchase_price, current_value',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (cardsError) {
    return res.status(500).json({ error: cardsError.message })
  }

  const cards = (cardsData ?? []) as CardRow[]

  if (cards.length === 0) {
    const starter = 'Start by adding a few cards to your collection so I can generate tailored SlabBook insights.'
    const { error: insertError } = await admin.from('ai_insights').insert({
      user_id: user.id,
      content: starter,
      is_read: false,
    })
    if (insertError) return res.status(500).json({ error: insertError.message })
    return res.status(200).json({ insight: starter })
  }

  const prompt = [
    'You are the SlabBook AI analyst for a sports card portfolio.',
    'Generate one concise, specific insight in 1-2 sentences.',
    'Use only information present in the cards list.',
    'Prioritize actionable observations: concentration risk, gain/loss gaps, grading strategy, or value trends.',
    'Do not mention missing data policies or generic disclaimers.',
    '',
    'Cards:',
    serializeCards(cards),
  ].join('\n')

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 220,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const anthropicPayload: AnthropicErrorPayload | null =
    await anthropicResponse.json().catch(() => null)
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

  const { error: insertError } = await admin.from('ai_insights').insert({
    user_id: user.id,
    content,
    is_read: false,
  })
  if (insertError) return res.status(500).json({ error: insertError.message })

  return res.status(200).json({ insight: content })
}
