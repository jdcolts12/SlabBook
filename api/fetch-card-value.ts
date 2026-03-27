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

type CardValueInput = {
  card_id?: string
  sport?: string | null
  player_name: string
  year?: number | null
  set_name?: string | null
  card_number?: string | null
  variation?: string | null
  is_graded?: boolean
  grade?: string | null
  grading_company?: string | null
}

type SoldComp = {
  price: number
  soldDate: string | null
  itemUrl: string | null
}

type RapidApiObject = Record<string, unknown>

function getBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function buildQuery(input: CardValueInput): string {
  const baseParts = [
    input.sport ?? '',
    input.year ? String(input.year) : '',
    input.set_name ?? '',
    input.player_name ?? '',
    input.card_number ? `#${input.card_number}` : '',
    input.variation ?? '',
  ]
  const gradedPart = input.is_graded
    ? `${input.grading_company ?? 'graded'} ${input.grade ?? ''}`.trim()
    : 'raw rookie RC'

  return normalizeWhitespace([...baseParts, gradedPart].filter(Boolean).join(' '))
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[$,]/g, '').trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'object' && value) {
    const obj = value as RapidApiObject
    return asNumber(obj.value ?? obj.amount ?? obj.currentPrice)
  }
  return null
}

function asDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function collectCandidateArrays(payload: RapidApiObject): unknown[] {
  const keys = ['data', 'results', 'items', 'listings', 'soldItems', 'products']
  const candidates: unknown[] = []

  for (const key of keys) {
    const entry = payload[key]
    if (Array.isArray(entry)) candidates.push(...entry)
    if (entry && typeof entry === 'object') {
      const nested = entry as RapidApiObject
      for (const nestedKey of keys) {
        const nestedEntry = nested[nestedKey]
        if (Array.isArray(nestedEntry)) candidates.push(...nestedEntry)
      }
    }
  }

  return candidates
}

function parseSoldComps(payload: RapidApiObject): SoldComp[] {
  const rows = collectCandidateArrays(payload)
  const comps: SoldComp[] = []

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const obj = row as RapidApiObject
    const price = asNumber(
      obj.price ??
        obj.salePrice ??
        obj.sold_price ??
        obj.soldPrice ??
        obj.currentPrice ??
        obj.bidPrice,
    )
    if (price == null) continue

    const soldDate = asDate(
      obj.soldDate ?? obj.sold_date ?? obj.endDate ?? obj.end_date ?? obj.date,
    )
    const itemUrlValue = obj.itemWebUrl ?? obj.itemUrl ?? obj.url ?? obj.item_url
    const itemUrl = typeof itemUrlValue === 'string' ? itemUrlValue : null
    comps.push({ price, soldDate, itemUrl })
  }

  return comps
}

function computeMetrics(comps: SoldComp[]) {
  const prices = comps.map((comp) => comp.price)
  const sum = prices.reduce((total, value) => total + value, 0)
  const average = sum / prices.length
  const lowest = Math.min(...prices)
  const highest = Math.max(...prices)
  const latest = [...comps]
    .sort((a, b) => (b.soldDate ?? '').localeCompare(a.soldDate ?? ''))[0]

  return {
    average_sale_price: Number(average.toFixed(2)),
    lowest_recent_sale: Number(lowest.toFixed(2)),
    highest_recent_sale: Number(highest.toFixed(2)),
    last_sold_date: latest?.soldDate ?? null,
    last_sold_price: Number((latest?.price ?? average).toFixed(2)),
    ebay_search_url: latest?.itemUrl ?? '',
  }
}

function ensureSearchUrl(url: string, query: string): string {
  if (url) return url
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
    query,
  )}&LH_Sold=1&LH_Complete=1`
}

function parseBody(body: unknown): CardValueInput | null {
  if (!body || typeof body !== 'object') return null
  const obj = body as Record<string, unknown>
  if (typeof obj.player_name !== 'string' || obj.player_name.trim().length === 0) {
    return null
  }

  return {
    card_id: typeof obj.card_id === 'string' ? obj.card_id : undefined,
    sport: typeof obj.sport === 'string' ? obj.sport : null,
    player_name: obj.player_name,
    year: typeof obj.year === 'number' ? obj.year : null,
    set_name: typeof obj.set_name === 'string' ? obj.set_name : null,
    card_number: typeof obj.card_number === 'string' ? obj.card_number : null,
    variation: typeof obj.variation === 'string' ? obj.variation : null,
    is_graded: Boolean(obj.is_graded),
    grade: typeof obj.grade === 'string' ? obj.grade : null,
    grading_company:
      typeof obj.grading_company === 'string' ? obj.grading_company : null,
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rapidApiKey = process.env.RAPIDAPI_KEY
  const rapidApiHost =
    process.env.RAPIDAPI_EBAY_HOST ?? 'real-time-ebay-data.p.rapidapi.com'
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!rapidApiKey || !supabaseUrl || !supabaseServiceRole) {
    return res.status(500).json({
      error:
        'Missing server env vars. Required: RAPIDAPI_KEY, VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.',
    })
  }

  const token = getBearerToken(req.headers.authorization)
  if (!token) return res.status(401).json({ error: 'Missing bearer token.' })

  const input = parseBody(req.body)
  if (!input) {
    return res.status(400).json({ error: 'Invalid payload. player_name is required.' })
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

  const searchQuery = buildQuery(input)
  const rapidUrl = new URL(`https://${rapidApiHost}/search-sold-items`)
  rapidUrl.searchParams.set('query', searchQuery)
  rapidUrl.searchParams.set('limit', '5')
  rapidUrl.searchParams.set('country', 'US')
  rapidUrl.searchParams.set('sort_by', 'date')

  const rapidResponse = await fetch(rapidUrl.toString(), {
    method: 'GET',
    headers: {
      'x-rapidapi-key': rapidApiKey,
      'x-rapidapi-host': rapidApiHost,
    },
  })

  const rapidPayload = (await rapidResponse.json().catch(() => null)) as
    | RapidApiObject
    | null

  if (!rapidResponse.ok || !rapidPayload) {
    const message =
      (rapidPayload?.message as string | undefined) ||
      (rapidPayload?.error as string | undefined) ||
      'Failed to fetch sold listings from RapidAPI.'
    return res.status(502).json({ error: message })
  }

  const comps = parseSoldComps(rapidPayload).slice(0, 5)
  if (comps.length === 0) {
    return res.status(404).json({
      error: `No recent sold listings found for "${searchQuery}".`,
    })
  }

  const metrics = computeMetrics(comps)
  const updatedAt = new Date().toISOString()
  const ebaySearchUrl = ensureSearchUrl(metrics.ebay_search_url, searchQuery)

  if (input.card_id) {
    const { error: updateError } = await admin
      .from('cards')
      .update({
        current_value: metrics.average_sale_price,
        last_updated: updatedAt,
      })
      .eq('id', input.card_id)
      .eq('user_id', user.id)

    if (updateError) return res.status(500).json({ error: updateError.message })
  }

  return res.status(200).json({
    ...metrics,
    ebay_search_url: ebaySearchUrl,
    updated_at: updatedAt,
    search_query: searchQuery,
  })
}
