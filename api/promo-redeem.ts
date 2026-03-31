import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePromoRedeem } from '../server/promoRouteHandlers'

function safeJson500 (res: VercelResponse, message: string) {
  const r = res as VercelResponse & { headersSent?: boolean; writableEnded?: boolean }
  if (r.headersSent || r.writableEnded) return
  return res.status(500).json({ error: message })
}

/** POST /api/promo-redeem — avoids Vercel issues with /api/promo/[action] for some deployments. */
export default async function handler (req: VercelRequest, res: VercelResponse) {
  try {
    await handlePromoRedeem(req, res)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Promo redeem failed'
    console.error('[promo-redeem]', e)
    safeJson500(res, message)
  }
}
