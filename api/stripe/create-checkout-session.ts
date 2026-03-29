import Stripe from 'stripe'
import { validatePromoCode } from '../lib/promo'
import { createSupabaseAdmin, getServiceRole, getSupabaseUrl } from '../lib/supabaseAdmin'
import { getBearerToken, getJson } from '../lib/http'

type ApiRequest = {
  method?: string
  headers?: Record<string, string | undefined>
  body?: unknown
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

function appOrigin (): string {
  const o = process.env.APP_ORIGIN?.trim()
  if (o) return o.replace(/\/$/, '')
  const v = process.env.VERCEL_URL?.trim()
  if (v) return `https://${v.replace(/^https?:\/\//, '')}`
  return 'http://localhost:5173'
}

function priceIdForTier (tier: string): string | null {
  const t = tier.toLowerCase()
  if (t === 'collector') return process.env.STRIPE_PRICE_COLLECTOR?.trim() ?? null
  if (t === 'investor') return process.env.STRIPE_PRICE_INVESTOR?.trim() ?? null
  if (t === 'founding') return process.env.STRIPE_PRICE_FOUNDING?.trim() ?? null
  return null
}

export default async function handler (req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const secret = process.env.STRIPE_SECRET_KEY?.trim()
    if (!secret) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY.' })
    }

    const supabaseUrl = getSupabaseUrl()
    const serviceRole = getServiceRole()
    if (!supabaseUrl || !serviceRole) {
      return res.status(500).json({ error: 'Missing Supabase server configuration.' })
    }

    const token = getBearerToken(req.headers?.authorization)
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token.' })
    }

    const admin = createSupabaseAdmin()
    if (!admin) {
      return res.status(500).json({ error: 'Server misconfiguration.' })
    }

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token)

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired auth token.' })
    }

    const json = getJson(req.body)
    const tierRaw = typeof json.tier === 'string' ? json.tier.toLowerCase() : ''
    const userIdBody = typeof json.user_id === 'string' ? json.user_id : ''
    const promoRaw = typeof json.promo_code === 'string' ? json.promo_code : ''

    if (userIdBody && userIdBody !== user.id) {
      return res.status(403).json({ error: 'User mismatch.' })
    }

    if (!['collector', 'investor', 'founding'].includes(tierRaw)) {
      return res.status(400).json({ error: 'Invalid tier.' })
    }

    const priceId = priceIdForTier(tierRaw)
    if (!priceId) {
      return res.status(500).json({ error: `Missing Stripe price env for tier: ${tierRaw}` })
    }

    let promoNormalized = ''
    if (promoRaw.trim()) {
      const v = await validatePromoCode(admin, promoRaw, {
        tier: tierRaw === 'founding' ? 'lifetime' : tierRaw,
        userId: user.id,
      })
      if (!v.valid) {
        return res.status(400).json({ error: v.error })
      }
      promoNormalized = promoRaw.trim().toUpperCase()
    }

    const { data: profile } = await admin
      .from('users')
      .select('email, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    const email =
      (typeof profile?.email === 'string' && profile.email) ||
      user.email ||
      undefined

    const stripe = new Stripe(secret)

    let customerId = typeof profile?.stripe_customer_id === 'string' ? profile.stripe_customer_id : null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
      await admin.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const origin = appOrigin()
    const successUrl = `${origin}/dashboard?upgrade=success`
    const cancelUrl = `${origin}/pricing`

    const mode: Stripe.Checkout.SessionCreateParams['mode'] =
      tierRaw === 'founding' ? 'payment' : 'subscription'

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        tier: tierRaw,
        promo_code: promoNormalized,
      },
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
    }

    if (mode === 'subscription') {
      sessionParams.subscription_data = {
        metadata: {
          user_id: user.id,
          tier: tierRaw,
          promo_code: promoNormalized,
        },
      }
    }

    if (mode === 'payment') {
      sessionParams.payment_intent_data = {
        metadata: {
          user_id: user.id,
          tier: tierRaw,
          promo_code: promoNormalized,
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    const url = session.url
    if (!url) {
      return res.status(500).json({ error: 'Stripe did not return a session URL.' })
    }

    return res.status(200).json({ url })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Checkout failed'
    return res.status(500).json({ error: message })
  }
}
