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

    if (!getSupabaseUrl() || !getServiceRole()) {
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
