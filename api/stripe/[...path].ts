import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  handleStripeCheckout,
  handleStripeInvoices,
  handleStripePortal,
} from '../../server/stripeJsonHandlers'

const KNOWN = new Set([
  'create-checkout-session',
  'create-portal-session',
  'list-invoices',
])

/** Strip leading/trailing slashes, collapse repeats, lowercase for matching. */
function normalizeStripeRoute (segment: string): string {
  return segment
    .trim()
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
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

/**
 * Fallback catch-all for /api/stripe/* JSON routes when explicit files
 * don’t match (or Vercel passes odd `req.url` / query shapes).
 */
export default async function handler (req: VercelRequest, res: VercelResponse) {
  const rawUrl = typeof req.url === 'string' ? req.url : ''

  const routeFromUrl = stripAfterApiStripe(rawUrl)
  const routeFromQuery = routeFromQueryPath(req)
  const routeFromHdr = routeFromHeaders(req)

  const rawRoute = routeFromUrl || routeFromQuery || routeFromHdr
  const normalized = normalizeStripeRoute(rawRoute)

  if (normalized === 'create-checkout-session') return handleStripeCheckout(req, res)
  if (normalized === 'create-portal-session') return handleStripePortal(req, res)
  if (normalized === 'list-invoices') return handleStripeInvoices(req, res)

  res.setHeader('Allow', 'POST')
  return res.status(404).json({
    error: `Unknown Stripe route: "${normalized || rawRoute}" (query="${routeFromQuery}", url="${routeFromUrl}", header="${routeFromHdr}")`,
    route: normalized || rawRoute,
    from: {
      query: routeFromQuery,
      url: routeFromUrl,
      header: routeFromHdr,
      rawUrl: rawUrl.slice(0, 200),
    },
    hint:
      !normalized
        ? 'Could not parse route after /api/stripe/ — check proxy, rewrites, and Vercel function URL.'
        : !KNOWN.has(normalized)
          ? `Expected one of: ${[...KNOWN].join(', ')}`
          : undefined,
  })
}
