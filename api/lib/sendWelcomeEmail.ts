/**
 * Optional welcome email after successful checkout. Set RESEND_API_KEY + RESEND_FROM in production.
 */
export async function sendWelcomeEmail (to: string, tierLabel: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    console.info('[SlabBook] Welcome email skipped (RESEND_API_KEY not set)', { to, tierLabel })
    return
  }
  const from = process.env.RESEND_FROM?.trim() ?? 'SlabBook <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Welcome to SlabBook',
      text: `Thanks for upgrading — your ${tierLabel} plan is active. Open SlabBook to manage your collection.\n\n— SlabBook`,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    console.warn('[SlabBook] Resend error', res.status, t)
  }
}
