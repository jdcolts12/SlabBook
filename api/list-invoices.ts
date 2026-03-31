import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function safeJson500 (res: VercelResponse, message: string) {
  const r = res as VercelResponse & { headersSent?: boolean; writableEnded?: boolean }
  if (r.headersSent || r.writableEnded) return
  return res.status(500).json({ error: message })
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
    if (userError || !user) return res.status(401).json({ error: 'Invalid or expired auth token.' })

    const { data: profile } = await admin.from('users').select('stripe_customer_id').eq('id', user.id).maybeSingle()
    const customerId = profile && typeof (profile as { stripe_customer_id?: string }).stripe_customer_id === 'string'
      ? (profile as { stripe_customer_id: string }).stripe_customer_id
      : null
    if (!customerId) return res.status(200).json({ invoices: [] })

    const stripe = new Stripe(secret)
    const list = await stripe.invoices.list({ customer: customerId, limit: 24 })
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
    const message = e instanceof Error ? e.message : 'Invoices failed'
    console.error('[list-invoices]', e)
    safeJson500(res, message)
  }
}
