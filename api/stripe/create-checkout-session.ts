import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleStripeCheckout } from '../../server/stripeJsonHandlers'

/** Explicit route — avoids catch-all `req.query.path` issues on some Vercel builds. */
export default async function handler (req: VercelRequest, res: VercelResponse) {
  return handleStripeCheckout(req, res)
}
