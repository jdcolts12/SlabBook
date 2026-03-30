/** Same-origin absolute URL — avoids bad relative resolution on some hosts. */
function apiUrl (path: string): string {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).href
}

function errorFromStripeBody (status: number, text: string): string {
  try {
    const j = JSON.parse(text) as { error?: string }
    if (typeof j.error === 'string' && j.error.trim()) return j.error
  } catch {
    /* not JSON */
  }
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 280)
  if (snippet) return `HTTP ${status}: ${snippet}`
  return `HTTP ${status} (empty body)`
}

function checkoutError (status: number, message: string): string {
  const m = message.trim()
  if (!m) return `Checkout failed (HTTP ${status}).`
  if (m.includes('HTTP ')) return m
  return `${m} (HTTP ${status})`
}

export async function createCheckoutSession (
  accessToken: string,
  tier: 'pro' | 'founding',
  promoCode?: string,
): Promise<string> {
  let res: Response
  try {
    res = await fetch(apiUrl('/api/create-checkout-session'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        tier,
        promo_code: (promoCode ?? '').trim(),
        user_id: '',
      }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `Network error starting checkout (${msg}). Check connection and that the site URL is correct.`,
    )
  }

  const text = await res.text()
  let data: { error?: string; url?: string } = {}
  try {
    data = JSON.parse(text) as { error?: string; url?: string }
  } catch {
    if (!res.ok) throw new Error(checkoutError(res.status, errorFromStripeBody(res.status, text)))
    throw new Error('Checkout returned invalid JSON.')
  }
  if (!res.ok) {
    throw new Error(
      checkoutError(res.status, data.error ?? errorFromStripeBody(res.status, text)),
    )
  }
  if (!data.url) {
    throw new Error('Checkout did not return a URL. Check Stripe Dashboard and Vercel env (STRIPE_SECRET_KEY, STRIPE_PRICE_PRO).')
  }
  return data.url
}

export async function createPortalSession (accessToken: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(apiUrl('/api/create-portal-session'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ user_id: '' }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Network error opening billing portal (${msg}).`)
  }

  const text = await res.text()
  let data: { error?: string; url?: string } = {}
  try {
    data = JSON.parse(text) as { error?: string; url?: string }
  } catch {
    if (!res.ok) throw new Error(errorFromStripeBody(res.status, text))
    throw new Error('Portal returned invalid JSON.')
  }
  if (!res.ok) {
    throw new Error(data.error ?? errorFromStripeBody(res.status, text))
  }
  if (!data.url) {
    throw new Error('Portal did not return a URL.')
  }
  return data.url
}

export type StripeInvoiceRow = {
  id: string | null
  number: string | null
  status: string | null
  amount_paid: number
  currency: string
  created: number
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  description: string | null
}

export async function listStripeInvoices (accessToken: string): Promise<StripeInvoiceRow[]> {
  let res: Response
  try {
    res = await fetch(apiUrl('/api/list-invoices'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ user_id: '' }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Network error loading invoices (${msg}).`)
  }

  const text = await res.text()
  let data: { error?: string; invoices?: StripeInvoiceRow[] } = {}
  try {
    data = JSON.parse(text) as { error?: string; invoices?: StripeInvoiceRow[] }
  } catch {
    if (!res.ok) throw new Error(errorFromStripeBody(res.status, text))
    throw new Error('Invoices returned invalid JSON.')
  }
  if (!res.ok) {
    throw new Error(data.error ?? errorFromStripeBody(res.status, text))
  }
  return data.invoices ?? []
}
