export type ValidatePromoResponse =
  | {
      valid: true
      discount_type: string
      discount_value: number | null
      message: string
    }
  | { valid: false; error: string }

function apiUrl (path: string): string {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

export async function validatePromoRequest (
  code: string,
  opts?: { tier?: string; userId?: string | null },
): Promise<ValidatePromoResponse> {
  try {
    const res = await fetch(apiUrl('/api/promo-validate'), {
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
      const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, 200)
      const hint =
        res.status === 404
          ? 'Promo API not found. Hard-refresh the page (clear cache) or try again later.'
          : res.status >= 500
            ? snippet
              ? `Promo request failed (${res.status}): ${snippet}`
              : 'Promo service is busy. Try again in a moment.'
            : `Promo request failed (${res.status}). Check your connection and try again.`
      return { valid: false, error: hint }
    }

    const parsed = data as ValidatePromoResponse & { error?: string }
    if (!res.ok && typeof parsed.error === 'string') {
      return { valid: false, error: parsed.error }
    }
    return parsed as ValidatePromoResponse
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
    const res = await fetch(apiUrl('/api/promo-redeem'), {
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
