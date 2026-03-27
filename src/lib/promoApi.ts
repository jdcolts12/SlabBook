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
  try {
    const res = await fetch('/api/validate-promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        tier: opts?.tier,
        user_id: opts?.userId ?? undefined,
      }),
    })

    const raw = await res.text()
    let data: unknown = null
    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      data = null
    }

    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        error: `Promo endpoint error (${res.status}).`,
      }
    }

    const parsed = data as ValidatePromoResponse
    if (!res.ok && 'error' in parsed) {
      return { valid: false, error: parsed.error }
    }
    return parsed
  } catch {
    return { valid: false, error: 'Promo service unavailable. Try again shortly.' }
  }
}

export async function redeemPromoRequest (
  code: string,
  accessToken: string,
  tier?: string,
): Promise<{ ok?: boolean; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/redeem-promo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code, tier }),
    })

    const raw = await res.text()
    let data: { ok?: boolean; error?: string; message?: string } = {}
    try {
      data = raw ? (JSON.parse(raw) as { ok?: boolean; error?: string; message?: string }) : {}
    } catch {
      data = { error: `Redeem endpoint error (${res.status}).` }
    }

    if (!res.ok) return { error: data.error ?? 'Redeem failed' }
    return data
  } catch {
    return { error: 'Redeem failed. Please try again.' }
  }
}
