import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_COOKIE = 'slab_admin'

export function signAdminCookie (): string {
  const exp = Date.now() + 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyAdminCookie (token: string): boolean {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || ''
  if (!secret) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  } catch {
    return false
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp: number }
    return parsed.exp > Date.now()
  } catch {
    return false
  }
}

export function parseCookies (cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!cookieHeader) return out
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k) out[k] = decodeURIComponent(rest.join('='))
  }
  return out
}
