export async function createCheckoutSession (
  accessToken: string,
  tier: 'pro' | 'founding',
  promoCode?: string,
): Promise<string> {
  const res = await fetch('/api/stripe/create-checkout-session', {
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
  const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string }
  if (!res.ok) {
    throw new Error(data.error ?? 'Unable to start checkout.')
  }
  if (!data.url) {
    throw new Error('Checkout did not return a URL.')
  }
  return data.url
}

export async function createPortalSession (accessToken: string): Promise<string> {
  const res = await fetch('/api/stripe/create-portal-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ user_id: '' }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string }
  if (!res.ok) {
    throw new Error(data.error ?? 'Unable to open billing portal.')
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
  const res = await fetch('/api/stripe/list-invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ user_id: '' }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; invoices?: StripeInvoiceRow[] }
  if (!res.ok) {
    throw new Error(data.error ?? 'Unable to load invoices.')
  }
  return data.invoices ?? []
}
