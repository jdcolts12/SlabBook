import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Inlined from server/* — Vercel does not reliably bundle ../server into this Lambda. */
const DEFAULT_CLAUDE_CAP = 50

function isDemoMode (): boolean {
  const v = process.env.DEMO_MODE?.trim().toLowerCase()
  const v2 = process.env.VITE_DEMO_MODE?.trim().toLowerCase()
  return v === 'true' || v === '1' || v2 === 'true' || v2 === '1'
}

function fakeIdentifyPayload (): Record<string, unknown> {
  return {
    card_type: 'sports',
    player_name: 'Demo Player',
    year: '2020',
    set_name: 'Demo Set',
    card_number: '1',
    variation: '',
    sport: 'MLB',
    grading_company: null,
    grade: null,
    is_graded: false,
    confidence: 'low',
    notes: 'Demo mode — image was not analyzed. Disable DEMO_MODE for real identification.',
  }
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

async function sendClaudeCapAlertIfNeeded (admin: SupabaseClient): Promise<void> {
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
  if (!key) {
    console.warn('[claude cap] ALERT_EMAIL set but RESEND_API_KEY missing — cannot send email')
    return
  }

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
  }).catch((e) => {
    console.warn('[claude cap] Resend fetch failed', e)
    return null
  })

  if (res && !res.ok) {
    const t = await res.text().catch(() => '')
    console.warn('[claude cap] Resend error', res.status, t)
  }
}

async function tryReserveClaudeCall (
  admin: SupabaseClient,
  route: string,
): Promise<{ ok: true } | { ok: false; reason: 'cap' }> {
  if (isDemoMode()) {
    return { ok: true }
  }

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
    console.warn(
      `[claude cap] Daily limit reached (${n}/${cap} since ${since}). Route would be: ${route}`,
    )
    void sendClaudeCapAlertIfNeeded(admin)
    return { ok: false, reason: 'cap' }
  }

  const { error: insErr } = await admin.from('claude_api_calls').insert({ route })
  if (insErr) {
    console.error('[claude cap] insert failed', insErr.message)
    return { ok: true }
  }

  return { ok: true }
}

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

const IDENTIFY_PROMPT = `Before anything else, determine card category from the photo:

A) SPORTS card ("sports"): real human athlete photo, team logo/jersey/stadium, Panini/Topps/Upper Deck/Bowman branding, PSA/BGS slab with player name, position listed, statistics on the back.
B) POKEMON card ("pokemon_tcg"): Pokémon creature illustration (not a human), Pokémon logo, HP number, attack moves with damage numbers, weakness/resistance/retreat section, set symbol, card number like "4/102" or "025/198", energy icons, Basic/Stage 1/Stage 2/EX/GX/V markers.
C) Other TCG ("other_tcg"): Magic, Yu-Gi-Oh, Lorcana, etc. (NOT Pokémon, NOT US sports).

STEP 1: Output only one field first by setting:
- "card_type" to exactly "sports" | "pokemon_tcg" | "other_tcg".

STEP 2: Only after card_type is set, extract the rest:
- YEAR: if visible on front/back/slab.
- SET: expansion/set name text or logos.
- CARD NUMBER: if visible (e.g. 4/102, 025/198, #161, etc).
- VARIATION: holo/full art/alt art/numbered/rookie/parallel language.
- Graded slabs: read grading_company + grade when present.

SPORTS extraction:
- player_name = the athlete/player name on the card.
- sport = one of NFL, NBA, MLB, NHL (infer from logos/uniforms/team).

POKEMON/OTHER extraction:
- Put the Pokémon character / card name into "player_name" (so your JSON stays compatible with the app).
- sport = "" (empty string) — never NFL/NBA/MLB/NHL on non-sports cards.

Output requirements:
- Return ONLY valid JSON (no markdown, no explanation).
- If uncertain, provide best estimates and set confidence to lower value.
- Do not invent invisible details. Unknown strings: "". grading_company/grade: null when unknown.
- card_type is required: exactly "sports" | "pokemon_tcg" | "other_tcg".
- When card_type is "sports", sport must be one of NFL, NBA, MLB, NHL.
- When card_type is "pokemon_tcg" or "other_tcg", set sport to "".

Return ONLY this JSON object:
{
  "card_type": "sports" | "pokemon_tcg" | "other_tcg",
  "player_name": "<string>",
  "year": "<string>",
  "set_name": "<string>",
  "card_number": "<string>",
  "variation": "<string>",
  "sport": "<NFL|NBA|MLB|NHL or empty string when not sports>",
  "grading_company": "<string or null>",
  "grade": "<string or null>",
  "is_graded": <boolean>,
  "confidence": "<high|medium|low>",
  "notes": "<slab details, ambiguity>"
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

type IdentifyCardType = 'sports' | 'pokemon_tcg' | 'other_tcg'

function normalizeCardType (v: unknown): IdentifyCardType {
  const s = (asStr(v) ?? '').trim().toLowerCase().replace(/\s+/g, '_')
  if (s === 'pokemon_tcg' || s === 'pokemon' || s.startsWith('pokemon')) return 'pokemon_tcg'
  if (s === 'other_tcg' || s === 'tcg' || s === 'magic' || s === 'yugioh' || s === 'ygo') return 'other_tcg'
  return 'sports'
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
  try {
    return await handleIdentifyCard(req, res)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error'
    return res.status(500).json({ error: msg })
  }
}

async function handleIdentifyCard (req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (!supabaseUrl || !supabaseServiceRole) {
    return res.status(500).json({
      error: 'Missing server env vars. Required: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.',
    })
  }
  if (!isDemoMode() && !anthropicApiKey) {
    return res.status(500).json({
      error: 'Missing ANTHROPIC_API_KEY (not required when DEMO_MODE is enabled).',
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

  const reserve = await tryReserveClaudeCall(admin, 'identify-card')
  if (!reserve.ok) {
    return res.status(503).json({
      error: 'Daily Claude API limit reached for this deployment. Try again tomorrow (UTC).',
    })
  }

  if (isDemoMode()) {
    const f = fakeIdentifyPayload()
    const cardType = normalizeCardType(f.card_type)
    const sport =
      cardType === 'sports' ? normalizeSport(asStr(f.sport)) : undefined
    const confidence = normalizeConfidence(f.confidence)
    return res.status(200).json({
      card_type: cardType,
      player_name: asStr(f.player_name),
      year: asStr(f.year),
      set_name: asStr(f.set_name),
      card_number: asStr(f.card_number),
      variation: asStr(f.variation),
      sport,
      grading_company:
        f.grading_company === null ? null : (asStr(f.grading_company) ?? null),
      grade: f.grade === null ? null : (asStr(f.grade) ?? null),
      is_graded: typeof f.is_graded === 'boolean' ? f.is_graded : undefined,
      confidence,
      notes: asStr(f.notes),
    })
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

  const apiKey = anthropicApiKey
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY.' })
  }

  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
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

  const anthropicBody = await anthropicResponse.text()
  let anthropicJson: AnthropicMessageResponse
  try {
    anthropicJson = JSON.parse(anthropicBody) as AnthropicMessageResponse
  } catch {
    return res.status(502).json({
      error: 'Card identification service returned an invalid response. Try again.',
    })
  }

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

  const cardType = normalizeCardType(parsed.card_type)
  const sport =
    cardType === 'sports' ? normalizeSport(asStr(parsed.sport)) : undefined
  const confidence = normalizeConfidence(parsed.confidence)

  return res.status(200).json({
    card_type: cardType,
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
