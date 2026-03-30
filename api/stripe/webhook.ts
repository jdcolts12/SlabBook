import type { VercelRequest, VercelResponse } from '@vercel/node'
import getRawBody from 'raw-body'
import { createSupabaseAdmin } from '../../server/supabaseAdmin'
import { redeemPromoAfterCheckout } from '../../server/promoRedeemFromStripe'
import { sendWelcomeEmail } from '../../server/sendWelcomeEmail'

export const config = {
  api: {
    bodyParser: false,
  },
}

type StripeSubscription = import('stripe').Stripe.Subscription
type StripeEvent = import('stripe').Stripe.Event
type StripeCheckoutSession = import('stripe').Stripe.Checkout.Session
type StripeInvoice = import('stripe').Stripe.Invoice
type StripeSubStatus = import('stripe').Stripe.Subscription.Status

function subscriptionPeriodEndIso (sub: StripeSubscription): string {
  const raw = (sub as unknown as { current_period_end?: number }).current_period_end
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return new Date().toISOString()
  }
  return new Date(raw * 1000).toISOString()
}

function mapStripeSubStatus (s: StripeSubStatus): string {
  switch (s) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'unpaid':
      return 'cancelled'
    default:
      return s
  }
}

async function userIdForCustomer (
  admin: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
  customerId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return data && typeof (data as { id: string }).id === 'string' ? (data as { id: string }).id : null
}

export default async function handler (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret || !webhookSecret) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET.' })
  }

  const sig = req.headers['stripe-signature']
  if (!sig || typeof sig !== 'string') {
    return res.status(400).json({ error: 'Missing stripe-signature' })
  }

  let rawBody: Buffer
  try {
    rawBody = await getRawBody(req as NodeJS.ReadableStream, {
      length: req.headers['content-length'],
      limit: '2mb',
    })
  } catch {
    return res.status(400).json({ error: 'Invalid body' })
  }

  const { default: Stripe } = await import('stripe')
  const stripe = new Stripe(secret)
  let event: StripeEvent
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (e) {
    console.warn('[Stripe webhook] signature verification failed', e)
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  const admin = createSupabaseAdmin()
  if (!admin) {
    return res.status(500).json({ error: 'Server misconfiguration.' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as StripeCheckoutSession
        const userId = session.metadata?.user_id
        const tier = (session.metadata?.tier ?? '').toLowerCase()
        const promo = session.metadata?.promo_code ?? ''

        if (!userId) {
          console.warn('[Stripe webhook] checkout.session.completed missing user_id metadata')
          break
        }

        if (session.mode === 'payment' && tier === 'founding') {
          await admin
            .from('users')
            .update({
              subscription_tier: 'lifetime',
              subscription_status: 'active',
              subscription_id: null,
              lifetime_access: true,
              current_period_end: null,
            } as Record<string, unknown>)
            .eq('id', userId)

          if (promo.trim()) {
            await redeemPromoAfterCheckout(admin, userId, promo)
          }

          const { data: authUser } = await admin.auth.admin.getUserById(userId)
          const email = authUser?.user?.email
          if (email) {
            await sendWelcomeEmail(email, 'Founding Member')
          }
          break
        }

        if (session.mode === 'subscription') {
          const subRef = session.subscription
          const subId = typeof subRef === 'string' ? subRef : subRef?.id
          if (!subId) {
            console.warn('[Stripe webhook] subscription checkout missing subscription id')
            break
          }

          const retrieved = await stripe.subscriptions.retrieve(subId)
          const sub = retrieved as StripeSubscription
          const st = mapStripeSubStatus(sub.status)
          const tierDb = 'pro'

          await admin
            .from('users')
            .update({
              subscription_tier: tierDb,
              subscription_status: st,
              subscription_id: sub.id,
              lifetime_access: false,
              current_period_end: subscriptionPeriodEndIso(sub),
            } as Record<string, unknown>)
            .eq('id', userId)

          if (promo.trim()) {
            await redeemPromoAfterCheckout(admin, userId, promo)
          }

          const { data: authWelcome } = await admin.auth.admin.getUserById(userId)
          const welcomeEmail = authWelcome?.user?.email
          if (welcomeEmail) {
            await sendWelcomeEmail(welcomeEmail, 'Pro')
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as StripeSubscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
        if (!customerId) break

        const uid =
          sub.metadata?.user_id ||
          (await userIdForCustomer(admin, customerId))
        if (!uid) {
          const { data: row } = await admin
            .from('users')
            .select('id')
            .eq('subscription_id', sub.id)
            .maybeSingle()
          if (row && typeof (row as { id: string }).id === 'string') {
            await admin
              .from('users')
              .update({
                subscription_status: mapStripeSubStatus(sub.status),
                current_period_end: subscriptionPeriodEndIso(sub),
              } as Record<string, unknown>)
              .eq('id', (row as { id: string }).id)
          }
          break
        }

        await admin
          .from('users')
          .update({
            subscription_tier: 'pro',
            subscription_status: mapStripeSubStatus(sub.status),
            subscription_id: sub.id,
            current_period_end: subscriptionPeriodEndIso(sub),
          } as Record<string, unknown>)
          .eq('id', uid)
        break
      }

      case 'customer.subscription.deleted': {
        const subDel = event.data.object as StripeSubscription
        const { data: row } = await admin
          .from('users')
          .select('id')
          .eq('subscription_id', subDel.id)
          .maybeSingle()

        const uid = row && typeof (row as { id: string }).id === 'string' ? (row as { id: string }).id : null
        if (!uid) break

        await admin
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: 'cancelled',
            subscription_id: null,
            current_period_end: null,
          } as Record<string, unknown>)
          .eq('id', uid)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as StripeInvoice
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) break

        const uid = await userIdForCustomer(admin, customerId)
        if (!uid) break

        await admin
          .from('users')
          .update({ subscription_status: 'past_due' } as Record<string, unknown>)
          .eq('id', uid)

        const { data: authUser3 } = await admin.auth.admin.getUserById(uid)
        const email = authUser3?.user?.email
        if (email && process.env.RESEND_API_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM ?? 'SlabBook <onboarding@resend.dev>',
              to: [email],
              subject: 'SlabBook — payment failed',
              text: 'We could not process your subscription payment. Please update your card in the billing portal to keep your plan active.',
            }),
          }).catch(() => {})
        }
        break
      }

      default:
        break
    }
  } catch (e) {
    console.error('[Stripe webhook] handler error', e)
    return res.status(500).json({ error: 'Webhook handler failed' })
  }

  return res.status(200).json({ received: true })
}
