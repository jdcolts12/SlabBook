import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleStripeCheckout } from '../server/stripeJsonHandlers'

function safeJson500 (res: VercelResponse, message: string) {
  const r = res as VercelResponse & { headersSent?: boolean; writableEnded?: boolean }
  if (r.headersSent || r.writableEnded) return
  return res.status(500).json({ error: message })
}

export default async function handler (req: VercelRequest, res: VercelResponse) {
  try {
    await handleStripeCheckout(req, res)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Checkout failed'
    console.error('[create-checkout-session]', e)
    safeJson500(res, message)
  }
}
