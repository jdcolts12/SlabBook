import type { VercelRequest, VercelResponse } from '@vercel/node'

function safeJson500 (res: VercelResponse, message: string) {
  const r = res as VercelResponse & { headersSent?: boolean; writableEnded?: boolean }
  if (r.headersSent || r.writableEnded) return
  return res.status(500).json({ error: message })
}

/**
 * Dynamic-import the handler so a bad cold-start in `server/*` returns JSON instead of
 * a platform “function crashed” page when possible.
 */
export default async function handler (req: VercelRequest, res: VercelResponse) {
  try {
    const { handleStripeCheckout } = await import('../../server/stripeJsonHandlers')
    await handleStripeCheckout(req, res)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Checkout failed'
    console.error('[create-checkout-session]', e)
    safeJson500(res, message)
  }
}
