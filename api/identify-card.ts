import { createClient } from '@supabase/supabase-js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | undefined>
  body?: unknown
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

type AnthropicTextBlock = {
  type: string
  text?: string
}

type AnthropicMessageResponse = {
  content?: AnthropicTextBlock[]
  error?: { message?: string }
}

const IDENTIFY_PROMPT = `You are an expert sports card identifier.
Analyze this trading card image and extract all visible information.

Return ONLY this JSON object, nothing else:
{
  "player_name": "<string>",
  "year": "<string>",
  "set_name": "<string>",
  "card_number": "<string>",
  "variation": "<string>",
  "sport": "<NFL|NBA|MLB|NHL>",
  "grading_company": "<string or null>",
  "grade": "<string or null>",
  "is_graded": <boolean>,
  "confidence": "<high|medium|low>",
  "notes": "<any other relevant details>"
}`

function getBearerToken (authHeader?: string): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

function parseJsonFromModelText (text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = (fence ? fence[1] : trimmed)?.trim() ?? ''
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

function asStr (v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return undefined
}

function normalizeSport (raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const u = raw.trim().toUpperCase()
  if (u === 'NFL' || u === 'NBA' || u === 'MLB' || u === 'NHL') return u
  if (u.includes('FOOTBALL')) return 'NFL'
  if (u.includes('BASKETBALL')) return 'NBA'
  if (u.includes('BASEBALL')) return 'MLB'
  if (u.includes('HOCKEY')) return 'NHL'
  return undefined
}

function normalizeConfidence (v: unknown): 'high' | 'medium' | 'low' | undefined {
  if (v !== 'high' && v !== 'medium' && v !== 'low') return undefined
  return v
}

/** Vercel may pass JSON as a string, Buffer, or pre-parsed object — match other api/*.ts handlers. */
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

  const raw = getJson(req.body)
  const b64 = typeof raw.image_base64 === 'string' ? raw.image_base64.trim() : ''
  const mediaType = typeof raw.media_type === 'string' ? raw.media_type.trim() : ''
  if (!b64 || !mediaType) {
    return res.status(400).json({ error: 'image_base64 and media_type are required.' })
  }
  if (
    mediaType !== 'image/jpeg' &&
    mediaType !== 'image/png' &&
    mediaType !== 'image/webp'
  ) {
    return res.status(400).json({ error: 'media_type must be image/jpeg, image/png, or image/webp.' })
  }

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: b64,
              },
            },
            { type: 'text', text: IDENTIFY_PROMPT },
          ],
        },
      ],
    }),
  })

  const anthropicJson = (await anthropicResponse.json()) as AnthropicMessageResponse

  if (!anthropicResponse.ok) {
    const msg =
      anthropicJson.error?.message ??
      (typeof anthropicJson === 'object' ? JSON.stringify(anthropicJson) : 'Anthropic request failed')
    return res.status(502).json({ error: msg })
  }

  const textBlock = anthropicJson.content?.find((b) => b.type === 'text')
  const text = textBlock?.text?.trim() ?? ''
  const parsed = parseJsonFromModelText(text)
  if (!parsed) {
    return res.status(502).json({ error: 'Could not parse card identification response.' })
  }

  const sport = normalizeSport(asStr(parsed.sport))
  const confidence = normalizeConfidence(parsed.confidence)

  return res.status(200).json({
    player_name: asStr(parsed.player_name),
    year: asStr(parsed.year),
    set_name: asStr(parsed.set_name),
    card_number: asStr(parsed.card_number),
    variation: asStr(parsed.variation),
    sport,
    grading_company:
      parsed.grading_company === null ? null : (asStr(parsed.grading_company) ?? null),
    grade: parsed.grade === null ? null : (asStr(parsed.grade) ?? null),
    is_graded: typeof parsed.is_graded === 'boolean' ? parsed.is_graded : undefined,
    confidence,
    notes: asStr(parsed.notes),
  })
}
