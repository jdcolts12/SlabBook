import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function safeJson500 (res: VercelResponse, message: string) {
  const r = res as VercelResponse & { headersSent?: boolean; writableEnded?: boolean }
  if (r.headersSent || r.writableEnded) return
  return res.status(500).json({ error: message })
}

function appOrigin (): string {
  const o = process.env.APP_ORIGIN?.trim()
  if (o) return o.replace(/\/$/, '')
  const v = process.env.VERCEL_URL?.trim()
  if (v) return `https://${v.replace(/^https?:\/\//, '')}`
  return 'http://localhost:5173'
}

function bearerToken (authHeader?: string): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

type InstantEstimateRequest = {
  card_kind: 'sports' | 'pokemon_tcg' | 'other_tcg'
  sport: string | null
  player_name: string
  year: string | null
  set_name: string | null
  card_number: string | null
  variation: string | null
  is_graded: boolean
  grade: string | null
  grading_company: string | null
  condition: string | null
}

export default async function handler (req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim()
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!supabaseUrl || !serviceRole) {
      return res.status(503).json({ error: 'Missing Supabase server configuration.' })
    }

    const token = bearerToken(req.headers.authorization)
    if (!token) return res.status(401).json({ error: 'Missing bearer token.' })

    const body = (req.body && typeof req.body === 'object') ? (req.body as Record<string, unknown>) : {}
    const payload: InstantEstimateRequest = {
      card_kind:
        body.card_kind === 'sports' || body.card_kind === 'pokemon_tcg' || body.card_kind === 'other_tcg'
          ? body.card_kind
          : 'sports',
      sport: typeof body.sport === 'string' ? body.sport : null,
      player_name: typeof body.player_name === 'string' ? body.player_name : '',
      year: typeof body.year === 'string' ? body.year : null,
      set_name: typeof body.set_name === 'string' ? body.set_name : null,
      card_number: typeof body.card_number === 'string' ? body.card_number : null,
      variation: typeof body.variation === 'string' ? body.variation : null,
      is_graded: typeof body.is_graded === 'boolean' ? body.is_graded : false,
      grade: typeof body.grade === 'string' ? body.grade : null,
      grading_company: typeof body.grading_company === 'string' ? body.grading_company : null,
      condition: typeof body.condition === 'string' ? body.condition : null,
    }

    if (!payload.player_name.trim()) {
      return res.status(400).json({ error: 'player_name is required.' })
    }

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const {
      data: { user: authUser },
      error: userErr,
    } = await admin.auth.getUser(token)
    if (userErr || !authUser) return res.status(401).json({ error: 'Invalid or expired auth token.' })

    const yearInt =
      payload.year && payload.year.trim()
        ? (() => {
          const n = Number.parseInt(payload.year.trim(), 10)
          return Number.isFinite(n) ? n : null
        })()
        : null

    const shouldBeSports = payload.card_kind === 'sports'

    // Create a temporary sports-card row so we can reuse the existing estimate-card-value endpoint.
    // This temporary row is deleted immediately after the estimate completes.
    const { data: tmpRow, error: insertErr } = await admin
      .from('cards')
      .insert({
        user_id: authUser.id,
        sport: shouldBeSports ? payload.sport : null,
        player_name: payload.player_name.trim(),
        year: yearInt,
        set_name: payload.set_name?.trim() || null,
        card_number: payload.card_number?.trim() || null,
        variation: payload.variation?.trim() || null,
        is_graded: payload.is_graded,
        grade: payload.is_graded ? payload.grade?.trim() || null : null,
        grading_company: payload.is_graded ? payload.grading_company?.trim() || null : null,
        condition: payload.is_graded ? null : payload.condition?.trim() || null,
        // Not important for estimation (but required to satisfy our schema assumptions).
        image_front_url: null,
        image_back_url: null,
        purchase_price: null,
        purchase_date: null,
        current_value: null,
        value_low: null,
        value_high: null,
        confidence: null,
        trend: null,
        value_note: null,
        pricing_source: null,
        last_updated: new Date().toISOString(),
      })
      .select('*')
      .maybeSingle()

    if (insertErr || !tmpRow) {
      return res.status(500).json({ error: insertErr?.message ?? 'Could not create temp row for estimation.' })
    }

    const tmpCardId = typeof tmpRow.id === 'string' ? tmpRow.id : ''
    if (!tmpCardId) {
      return res.status(500).json({ error: 'Temporary estimate card id missing.' })
    }

    const estimateUrl = `${appOrigin()}/api/estimate-card-value`
    const estimateRes = await fetch(estimateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ card_id: tmpCardId, force_refresh: true }),
    })

    const raw = await estimateRes.text()
    let estimateJson: any = null
    try {
      estimateJson = raw ? JSON.parse(raw) : null
    } catch {
      estimateJson = null
    }

    // Best-effort cleanup (even if estimate fails).
    void admin.from('cards').delete().eq('id', tmpCardId).eq('user_id', authUser.id)

    if (!estimateRes.ok) {
      return res.status(estimateRes.status).json({
        error: estimateJson?.error ?? `Instant estimate failed (${estimateRes.status}).`,
      })
    }

    return res.status(200).json(estimateJson)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Instant estimate failed.'
    console.error('[instant-estimate]', e)
    safeJson500(res, msg)
  }
}

