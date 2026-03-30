import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleStripePortal } from '../../server/stripeJsonHandlers'

export default async function handler (req: VercelRequest, res: VercelResponse) {
  return handleStripePortal(req, res)
}
