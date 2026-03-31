import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function safeJson500 (res: VercelResponse, message: string) {
  const r = res as VercelResponse & { headersSent?: boolean; writableEnded?: boolean }
  if (r.headersSent || r.writableEnded) return
  return res.status(500).json({ error: message })
}

function appOrigin (): string {
  const o = process.env.APP_ORIGIN?.trim()
  if (o) return o.replace(/\/$/, '')
  const v = process.env.VERCEL_URL?.trim()
  if (v) return `https://${v.replace(/^https?:\/\//, '')}`
  return 'http://localhost:5173'
}

function bearerToken (authHeader?: string): string | null {
  if (!authHeader) return null
  const [scheme, token] = authHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export default async function handler (req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'POST, OPTIONS')
      return res.status(200).json({ ok: true })
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const secret = process.env.STRIPE_SECRET_KEY?.trim()
    const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL)?.trim()
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!secret || !supabaseUrl || !serviceRole) {
      return res.status(500).json({ error: 'Missing server configuration.' })
    }

    const auth = req.headers.authorization
    const token = bearerToken(typeof auth === 'string' ? auth : Array.isArray(auth) ? auth[0] : undefined)
    if (!token) return res.status(401).json({ error: 'Missing bearer token.' })

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token)
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired auth token.' })
    }

    const body = (req.body && typeof req.body === 'object') ? (req.body as Record<string, unknown>) : {}
    const tierRaw = typeof body.tier === 'string' ? body.tier.toLowerCase() : ''
    const promoRaw = typeof body.promo_code === 'string' ? body.promo_code.trim().toUpperCase() : ''
    if (!['pro', 'founding', 'collector', 'investor'].includes(tierRaw)) {
      return res.status(400).json({ error: 'Invalid tier.' })
    }

    const priceId =
      tierRaw === 'founding'
        ? process.env.STRIPE_PRICE_FOUNDING?.trim()
        : process.env.STRIPE_PRICE_PRO?.trim() ?? process.env.STRIPE_PRICE_COLLECTOR?.trim()
    if (!priceId) return res.status(500).json({ error: `Missing Stripe price env for tier: ${tierRaw}` })

    const { data: profile } = await admin.from('users').select('email, stripe_customer_id').eq('id', user.id).maybeSingle()
    const stripe = new Stripe(secret)
    let customerId = (profile && typeof (profile as { stripe_customer_id?: string }).stripe_customer_id === 'string')
      ? (profile as { stripe_customer_id: string }).stripe_customer_id
      : null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (typeof profile?.email === 'string' && profile.email) || user.email || undefined,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
      await admin.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const origin = appOrigin()
    let mode: Stripe.Checkout.SessionCreateParams.Mode = 'subscription'
    if (tierRaw === 'founding') {
      // Support both one-time and recurring founding prices from env.
      const price = await stripe.prices.retrieve(priceId)
      mode = price.type === 'one_time' ? 'payment' : 'subscription'
    }
    const params: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      success_url: `${origin}/dashboard?upgrade=success`,
      cancel_url: `${origin}/pricing`,
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: { user_id: user.id, tier: tierRaw, promo_code: promoRaw },
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
    }
    if (mode === 'subscription') {
      params.subscription_data = { metadata: { user_id: user.id, tier: tierRaw, promo_code: promoRaw } }
    } else {
      params.payment_intent_data = { metadata: { user_id: user.id, tier: tierRaw, promo_code: promoRaw } }
    }

    const session = await stripe.checkout.sessions.create(params)
    if (!session.url) return res.status(500).json({ error: 'Stripe did not return a session URL.' })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Checkout failed'
    console.error('[create-checkout-session]', e)
    safeJson500(res, message)
  }
}
