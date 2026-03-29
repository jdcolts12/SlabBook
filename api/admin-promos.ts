import { createClient } from '@supabase/supabase-js'
import { ADMIN_COOKIE, parseCookies, verifyAdminCookie } from '../server/adminAuth'

type ApiRequest = {
  method?: string
  headers: Record<string, string | undefined>
  body?: unknown
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

function getJson (body: unknown): Record<string, unknown> {
  const isBufferBody = typeof Buffer !== 'undefined' && Buffer.isBuffer(body)
  if (body && typeof body === 'object' && !isBufferBody) return body as Record<string, unknown>
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

function requireAdmin (req: ApiRequest, res: ApiResponse): boolean {
  const cookies = parseCookies(req.headers.cookie)
  if (!verifyAdminCookie(cookies[ADMIN_COOKIE] ?? '')) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

export default async function handler (req: ApiRequest, res: ApiResponse) {
  if (!requireAdmin(req, res)) return

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceRole) {
    return res.status(500).json({ error: 'Missing Supabase configuration.' })
  }

  const admin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (req.method === 'GET') {
    const { data, error } = await admin.from('promo_codes').select('*').order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ codes: data ?? [] })
  }

  if (req.method === 'POST') {
    const json = getJson(req.body)
    const code = typeof json.code === 'string' ? json.code.trim().toUpperCase() : ''
    const type = typeof json.type === 'string' ? json.type : ''
    const rawVal = json.value
    let value: number | null = null
    if (rawVal === null || rawVal === '') value = null
    else if (typeof rawVal === 'number' && Number.isFinite(rawVal)) value = rawVal
    else if (typeof rawVal === 'string') {
      const n = Number(rawVal)
      value = Number.isFinite(n) ? n : null
    }
    const applicable_tier = typeof json.applicable_tier === 'string' ? json.applicable_tier : 'any'
    const rawMax = json.max_uses
    let max_uses: number | null = null
    if (rawMax === null || rawMax === '') max_uses = null
    else {
      const n = Number(rawMax)
      max_uses = Number.isFinite(n) ? n : null
    }
    const expires_at = typeof json.expires_at === 'string' ? json.expires_at : null
    const notes = typeof json.notes === 'string' ? json.notes : null

    if (!code || !type) {
      return res.status(400).json({ error: 'code and type are required.' })
    }

    const { data, error } = await admin
      .from('promo_codes')
      .insert({
        code,
        type,
        value,
        applicable_tier,
        max_uses: max_uses != null && Number.isFinite(max_uses) ? max_uses : null,
        expires_at,
        notes,
        is_active: true,
      })
      .select('*')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ code: data })
  }

  if (req.method === 'PATCH') {
    const json = getJson(req.body)
    const id = typeof json.id === 'string' ? json.id : ''
    const is_active = typeof json.is_active === 'boolean' ? json.is_active : undefined
    if (!id || is_active === undefined) {
      return res.status(400).json({ error: 'id and is_active are required.' })
    }
    const { error } = await admin.from('promo_codes').update({ is_active }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST, PATCH')
  return res.status(405).json({ error: 'Method not allowed' })
}
