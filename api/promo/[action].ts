import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * /api/promo/validate and /api/promo/redeem — single function for Hobby plan limit.
 * Derives `action` from the path as well as query, since some runtimes omit dynamic `query.action`.
 */
function promoActionFromRequest (req: VercelRequest): string | undefined {
  const raw = req.query?.action
  const q = Array.isArray(raw) ? raw[0] : raw
  if (typeof q === 'string' && q.trim()) return q.trim().toLowerCase()

  const path = (req.url ?? '').split('?')[0]
  const parts = path.split('/').filter(Boolean)
  const i = parts.indexOf('promo')
  const seg = i >= 0 ? parts[i + 1] : undefined
  if (typeof seg === 'string' && seg.trim()) return seg.trim().toLowerCase()
  return undefined
}

export default async function handler (req: VercelRequest, res: VercelResponse) {
  try {
    const action = promoActionFromRequest(req)

    if (action === 'validate') {
      const { handlePromoValidate } = await import('../../server/promoRouteHandlers')
      return await handlePromoValidate(req, res)
    }
    if (action === 'redeem') {
      const { handlePromoRedeem } = await import('../../server/promoRouteHandlers')
      return await handlePromoRedeem(req, res)
    }

    res.setHeader('Allow', 'POST')
    return res.status(404).json({ error: 'Unknown promo action.', valid: false })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Promo route failed'
    return res.status(500).json({ error: message, valid: false })
  }
}
