import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getCardValue, type CardEstimateInput } from './pricing'

export const config = { maxDuration: 300 }

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
  return /504|abort|deadline|timeout|exceeded|time budget|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
    error,
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
function jsonError (res: VercelResponse, status: number, error: string) {
  const safe =
    error.length > 8000 ? `${error.slice(0, 8000)}…` : error.replace(/\u2028|\u2029/g, ' ')
  if (res.writableEnded || res.headersSent) return
  res.status(status).json({ error: safe })
}

function jsonOk (res: VercelResponse, status: number, body: Record<string, unknown>) {
  if (res.writableEnded || res.headersSent) return
  res.status(status).json(body)
}

export default async function handler (req: VercelRequest, res: VercelResponse) {
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

      const canRetryFastPath =
        !noAutoRetry &&
        process.env.PRICING_SKIP_WEB_SEARCH !== '1' &&
        !result.ok &&
        shouldRetryEstimateWithoutWebSearch(result.error)

      if (canRetryFastPath) {
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
        res.end(JSON.stringify({ error: safe }))
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
