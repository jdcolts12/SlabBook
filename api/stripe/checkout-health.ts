import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * GET — whether checkout *can* run server-side (booleans only, no secrets).
 * No imports from `server/*` so module load cannot pull in Stripe/Supabase client trees.
 * Open: /api/stripe/checkout-health
 */
export default function handler (req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const stripeSecret = Boolean(process.env.STRIPE_SECRET_KEY?.trim())
    const pricePro = Boolean(
      process.env.STRIPE_PRICE_PRO?.trim() ?? process.env.STRIPE_PRICE_COLLECTOR?.trim(),
    )
    const priceFounding = Boolean(process.env.STRIPE_PRICE_FOUNDING?.trim())
    const supabaseUrl = Boolean(
      (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim(),
    )
    const supabaseService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
    const appOrigin = Boolean(process.env.APP_ORIGIN?.trim() ?? process.env.VERCEL_URL?.trim())

    const ready = stripeSecret && pricePro && supabaseUrl && supabaseService

    return res.status(200).json({
      ok: true,
      checkout_ready: ready,
      env: {
        STRIPE_SECRET_KEY: stripeSecret,
        STRIPE_PRICE_PRO_or_COLLECTOR: pricePro,
        STRIPE_PRICE_FOUNDING: priceFounding,
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: supabaseService,
        APP_ORIGIN_or_VERCEL_URL: appOrigin,
      },
      hint: ready
        ? 'Server config looks present. If checkout still fails, check Stripe test vs live key/price match and Vercel function logs.'
        : 'Set missing env vars in Vercel (Production), then Redeploy.',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'checkout-health failed'
    return res.status(500).json({ ok: false, error: message })
  }
}
