import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  handleStripeCheckout,
  handleStripeInvoices,
  handleStripePortal,
} from '../../server/stripeJsonHandlers'

/**
 * Fallback catch-all for /api/stripe/* JSON routes.
 *
 * Some Vercel builds can behave oddly with catch-all query params; this handler
 * also parses `req.url` so requests like:
 *   /api/stripe/create-checkout-session
 * still map correctly.
 */
export default async function handler (req: VercelRequest, res: VercelResponse) {
  const raw = req.query?.path
  const segments = Array.isArray(raw) ? raw : raw != null ? [String(raw)] : []
  const cleaned = segments.map((s) => String(s)).filter(Boolean)
  // If Vercel provides the route via query params, normalize it into "a/b/c" format.
  const routeFromQuery = cleaned.join('/')

  // Prefer `req.url` parsing since some deployments may pass empty query params.
  const rawUrl = typeof req.url === 'string' ? req.url : ''
  const routeFromUrl = (() => {
    // rawUrl can be either:
    // - "/api/stripe/create-checkout-session"
    // - "https://example.com/api/stripe/create-checkout-session"
    const needle = '/api/stripe/'
    const idx = rawUrl.lastIndexOf(needle)
    if (idx === -1) return ''
    const after = rawUrl.slice(idx + needle.length)
    const first = after.split('?')[0] ?? ''
    return decodeURIComponent(first).replace(/\/$/, '')
  })()

  const route = routeFromUrl || routeFromQuery

  if (route === 'create-checkout-session') return handleStripeCheckout(req, res)
  if (route === 'create-portal-session') return handleStripePortal(req, res)
  if (route === 'list-invoices') return handleStripeInvoices(req, res)

  res.setHeader('Allow', 'POST')
  return res.status(404).json({
    error: `Unknown Stripe route: "${route}" (query="${routeFromQuery}", url="${routeFromUrl}")`,
    route,
    from: { query: routeFromQuery, url: routeFromUrl },
  })
}

