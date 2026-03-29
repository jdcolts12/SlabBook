import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePromoRedeem, handlePromoValidate } from '../lib/promoRouteHandlers'

/**
 * /api/promo/validate and /api/promo/redeem — single function for Hobby plan limit.
 */
export default async function handler (req: VercelRequest, res: VercelResponse) {
  const raw = req.query.action
  const action = Array.isArray(raw) ? raw[0] : raw

  if (action === 'validate') {
    return handlePromoValidate(req, res)
  }
  if (action === 'redeem') {
    return handlePromoRedeem(req, res)
  }

  res.setHeader('Allow', 'POST')
  return res.status(404).json({ error: 'Unknown promo action.' })
}
