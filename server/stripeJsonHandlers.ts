import Stripe from 'stripe'
import type { IncomingHttpHeaders } from 'node:http'
import { validatePromoCode } from './promo'
import { createSupabaseAdmin, getServiceRole, getSupabaseUrl } from './supabaseAdmin'
import { bearerFromHeaders, getJson } from './http'

type ApiRequest = {
  method?: string
  headers?: IncomingHttpHeaders
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
  if (t === 'pro' || t === 'collector' || t === 'investor') {
    return (
      process.env.STRIPE_PRICE_PRO?.trim() ??
      process.env.STRIPE_PRICE_COLLECTOR?.trim() ??
      null
    )
  }
  if (t === 'founding') return process.env.STRIPE_PRICE_FOUNDING?.trim() ?? null
  return null
}

export async function handleStripeCheckout (req: ApiRequest, res: ApiResponse) {
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

    const token = bearerFromHeaders(req.headers)
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

    if (!['pro', 'collector', 'investor', 'founding'].includes(tierRaw)) {
      return res.status(400).json({ error: 'Invalid tier.' })
    }

    const priceId = priceIdForTier(tierRaw)
    if (!priceId) {
      return res.status(500).json({ error: `Missing Stripe price env for tier: ${tierRaw}` })
    }

    const promoTierKey = tierRaw === 'founding' ? 'lifetime' : 'pro'

    let promoNormalized = ''
    if (promoRaw.trim()) {
      const v = await validatePromoCode(admin, promoRaw, {
        tier: promoTierKey,
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

export async function handleStripePortal (req: ApiRequest, res: ApiResponse) {
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

    const token = bearerFromHeaders(req.headers)
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
    const userIdBody = typeof json.user_id === 'string' ? json.user_id : ''
    if (userIdBody && userIdBody !== user.id) {
      return res.status(403).json({ error: 'User mismatch.' })
    }

    const { data: profile } = await admin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    const customerId =
      profile && typeof (profile as { stripe_customer_id?: string }).stripe_customer_id === 'string'
        ? (profile as { stripe_customer_id: string }).stripe_customer_id
        : null

    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer on file. Subscribe from pricing first.' })
    }

    const stripe = new Stripe(secret)
    const origin = appOrigin()
    const returnUrl = `${origin}/dashboard/settings/billing`

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return res.status(200).json({ url: portal.url })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Portal session failed'
    return res.status(500).json({ error: message })
  }
}

export async function handleStripeInvoices (req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const secret = process.env.STRIPE_SECRET_KEY?.trim()
    if (!secret) {
      return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY.' })
    }

    if (!getSupabaseUrl() || !getServiceRole()) {
      return res.status(500).json({ error: 'Missing Supabase server configuration.' })
    }

    const token = bearerFromHeaders(req.headers)
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
    const userIdBody = typeof json.user_id === 'string' ? json.user_id : ''
    if (userIdBody && userIdBody !== user.id) {
      return res.status(403).json({ error: 'User mismatch.' })
    }

    const { data: profile } = await admin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    const customerId =
      profile && typeof (profile as { stripe_customer_id?: string }).stripe_customer_id === 'string'
        ? (profile as { stripe_customer_id: string }).stripe_customer_id
        : null

    if (!customerId) {
      return res.status(200).json({ invoices: [] })
    }

    const stripe = new Stripe(secret)
    const list = await stripe.invoices.list({
      customer: customerId,
      limit: 24,
    })

    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      description: inv.description,
    }))

    return res.status(200).json({ invoices })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unable to list invoices'
    return res.status(500).json({ error: message })
  }
}
