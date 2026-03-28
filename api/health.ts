import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Minimal probe so you can verify /api routes return JSON on Vercel. */
export default function handler (_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, route: 'health' })
}
