import Stripe from 'stripe'
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
