import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  handleStripeCheckout,
  handleStripeInvoices,
  handleStripePortal,
} from '../lib/stripeJsonHandlers'

/**
 * Single serverless function for /api/stripe/* JSON routes (Hobby plan function limit).
 * Paths: create-checkout-session, create-portal-session, list-invoices
 * Webhook stays in api/stripe/webhook.ts (needs raw body).
 */
export default async function handler (req: VercelRequest, res: VercelResponse) {
  const raw = req.query.path
  const segments = Array.isArray(raw) ? raw : raw != null ? [String(raw)] : []
  const route = segments.join('/')

  if (route === 'create-checkout-session') {
    return handleStripeCheckout(req, res)
  }
  if (route === 'create-portal-session') {
    return handleStripePortal(req, res)
  }
  if (route === 'list-invoices') {
    return handleStripeInvoices(req, res)
  }

  res.setHeader('Allow', 'POST')
  return res.status(404).json({ error: 'Unknown Stripe route.' })
}
