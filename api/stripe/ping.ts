import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Minimal route — no deps. GET /api/stripe/ping */
export default function handler (_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, route: 'stripe/ping' })
}
