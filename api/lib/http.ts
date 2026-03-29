import type { IncomingHttpHeaders } from 'node:http'

export function getJson (body: unknown): Record<string, unknown> {
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

export function getBearerToken (authHeader?: string): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export function bearerFromHeaders (headers: IncomingHttpHeaders | undefined): string | null {
  const a = headers?.authorization
  const s = typeof a === 'string' ? a : Array.isArray(a) ? a[0] : undefined
  return getBearerToken(s)
}
