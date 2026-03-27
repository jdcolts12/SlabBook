import { ADMIN_COOKIE, parseCookies, signAdminCookie, verifyAdminCookie } from './lib/adminAuth'

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
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body as Record<string, unknown>
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

export default async function handler (req: ApiRequest, res: ApiResponse) {
  if (req.method === 'POST') {
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      return res.status(500).json({ error: 'ADMIN_PASSWORD is not configured.' })
    }
    const json = getJson(req.body)
    const password = typeof json.password === 'string' ? json.password : ''
    if (password !== adminPassword) {
      return res.status(401).json({ error: 'Invalid password.' })
    }
    const token = signAdminCookie()
    const isProd =
      process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
    const secure = isProd ? '; Secure' : ''
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`,
    )
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const isProd =
      process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
    const secure = isProd ? '; Secure' : ''
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    )
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'GET') {
    const cookies = parseCookies(req.headers.cookie)
    const ok = verifyAdminCookie(cookies[ADMIN_COOKIE] ?? '')
    return res.status(200).json({ authenticated: ok })
  }

  res.setHeader('Allow', 'GET, POST, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
