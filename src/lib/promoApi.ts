export type ValidatePromoResponse =
  | {
      valid: true
      discount_type: string
      discount_value: number | null
      message: string
    }
  | { valid: false; error: string }

export async function validatePromoRequest (
  code: string,
  opts?: { tier?: string; userId?: string | null },
): Promise<ValidatePromoResponse> {
  const res = await fetch('/api/validate-promo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      tier: opts?.tier,
      user_id: opts?.userId ?? undefined,
    }),
  })
  return (await res.json()) as ValidatePromoResponse
}

export async function redeemPromoRequest (
  code: string,
  accessToken: string,
  tier?: string,
): Promise<{ ok?: boolean; error?: string; message?: string }> {
  const res = await fetch('/api/redeem-promo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ code, tier }),
  })
  const data = (await res.json()) as { ok?: boolean; error?: string; message?: string }
  if (!res.ok) return { error: data.error ?? 'Redeem failed' }
  return data
}
