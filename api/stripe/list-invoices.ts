import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleStripeInvoices } from '../../server/stripeJsonHandlers'

export default async function handler (req: VercelRequest, res: VercelResponse) {
  return handleStripeInvoices(req, res)
}
