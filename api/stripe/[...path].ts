import type { VercelRequest, VercelResponse } from '@vercel/node'

const KNOWN = new Set([
  'create-checkout-session',
  'create-portal-session',
  'list-invoices',
])

const MAX_ROUTE_LEN = 128

/** Strip leading/trailing slashes, collapse repeats, lowercase for matching. */
function normalizeStripeRoute (segment: string): string {
  return segment
    .trim()
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
}

/**
 * Single segment, slug-only (hyphens allowed). Rejects traversal, weird chars, multi-segment paths.
 */
function parseSafeRouteToken (normalized: string): string | null {
  if (!normalized || normalized.length > MAX_ROUTE_LEN) return null
  if (normalized.includes('..') || normalized.includes('\\')) return null
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length !== 1) return null
  const seg = parts[0]!
  if (!/^[a-z0-9-]+$/.test(seg)) return null
  return seg
}

/** Pull the path after `/api/stripe/` from a URL or path string. */
function stripAfterApiStripe (raw: string): string {
  const withoutQuery = raw.split('?')[0] ?? ''
  const lower = withoutQuery.toLowerCase()
  const needle = '/api/stripe/'
  const idx = lower.indexOf(needle)
  if (idx === -1) return ''
  const after = withoutQuery.slice(idx + needle.length)
  try {
    return decodeURIComponent(after).replace(/\/$/, '')
  } catch {
    return after.replace(/\/$/, '')
  }
}

function routeFromQueryPath (req: VercelRequest): string {
  const raw = req.query?.path
  const segments = Array.isArray(raw) ? raw : raw != null ? [String(raw)] : []
  return segments
    .map((s) => String(s))
    .filter(Boolean)
    .join('/')
}

/** Last resort: some proxies set these; client-spoofable — use only if URL/query empty. */
function routeFromHeaders (req: VercelRequest): string {
  const h = req.headers
  const candidates: Array<string | string[] | undefined> = [
    h['x-forwarded-uri'],
    h['x-invoke-path'],
    h['x-vercel-path'],
    h['x-matched-path'],
  ]
  for (const c of candidates) {
    const s = typeof c === 'string' ? c : Array.isArray(c) ? c[0] : ''
    if (s) {
      const r = stripAfterApiStripe(s)
      if (r) return r
    }
  }
  return ''
}

function jsonError (res: VercelResponse, status: number, body: Record<string, unknown>) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.status(status).json(body)
}

function safeJson500 (res: VercelResponse, message: string) {
  const r = res as VercelResponse & { headersSent?: boolean; writableEnded?: boolean }
  if (r.headersSent || r.writableEnded) return
  return jsonError(res, 500, { error: message })
}

/**
 * Fallback catch-all for /api/stripe/* JSON routes when explicit files
 * don’t match (or Vercel passes odd `req.url` / query shapes).
 */
export default async function handler (req: VercelRequest, res: VercelResponse) {
  try {
    const rawUrl = typeof req.url === 'string' ? req.url : ''

    /** Prefer router-provided query (Vercel) over raw URL, then untrusted headers last. */
    const routeFromQuery = routeFromQueryPath(req)
    const routeFromUrl = stripAfterApiStripe(rawUrl)
    const routeFromHdr = routeFromHeaders(req)

    const rawRoute = routeFromQuery || routeFromUrl || routeFromHdr
    const normalized = normalizeStripeRoute(rawRoute)
    const token = parseSafeRouteToken(normalized)

    if (token === null && normalized.length > 0) {
      return jsonError(res, 400, {
        error: 'Invalid Stripe API path.',
      })
    }

    if (token === 'create-checkout-session') {
      const { handleStripeCheckout } = await import('../../server/stripeJsonHandlers')
      return handleStripeCheckout(req, res)
    }
    if (token === 'create-portal-session') {
      const { handleStripePortal } = await import('../../server/stripeJsonHandlers')
      return handleStripePortal(req, res)
    }
    if (token === 'list-invoices') {
      const { handleStripeInvoices } = await import('../../server/stripeJsonHandlers')
      return handleStripeInvoices(req, res)
    }

    res.setHeader('Allow', 'POST')
    return jsonError(res, 404, {
      error: 'Unknown Stripe route.',
      route: token ?? '',
      hint:
        !token
          ? 'Could not parse route after /api/stripe/ — check proxy, rewrites, and Vercel function URL.'
          : !KNOWN.has(token)
            ? `Expected one of: ${[...KNOWN].join(', ')}`
            : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe route failed'
    console.error('[stripe catch-all]', e)
    return safeJson500(res, message)
  }
}
