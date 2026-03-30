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

/** Pull a human-readable message from API/Stripe/PostgREST-style bodies. */
function extractErrorMessage (data: unknown): string | undefined {
  if (data == null || typeof data !== 'object') return undefined
  const o = data as Record<string, unknown>

  const direct = o.error
  if (typeof direct === 'string') {
    const t = direct.trim()
    if (!t || /^error$/i.test(t)) return undefined
    return t
  }
  if (direct && typeof direct === 'object') {
    const nested = direct as Record<string, unknown>
    if (typeof nested.message === 'string' && nested.message.trim()) {
      return nested.message.trim()
    }
    if (typeof nested.msg === 'string' && nested.msg.trim()) {
      return nested.msg.trim()
    }
  }

  if (typeof o.message === 'string' && o.message.trim()) {
    return o.message.trim()
  }

  return undefined
}

function normalizeValidateBody (data: unknown, httpOk: boolean): ValidatePromoResponse {
  if (data == null || typeof data !== 'object') {
    return { valid: false, error: 'Invalid response from promo service. Try again.' }
  }

  const o = data as Record<string, unknown>

  if (o.valid === true) {
    const discount_type = typeof o.discount_type === 'string' ? o.discount_type : ''
    const discount_value =
      typeof o.discount_value === 'number' || o.discount_value === null ? o.discount_value : null
    const message = typeof o.message === 'string' && o.message.trim() ? o.message.trim() : 'Promo applied!'
    return {
      valid: true,
      discount_type,
      discount_value,
      message,
    }
  }

  if (o.valid === false) {
    return { valid: false, error: extractErrorMessage(data) ?? 'Invalid code' }
  }

  if (!httpOk) {
    const err = extractErrorMessage(data) ?? 'Promo request failed. Try again.'
    return { valid: false, error: err }
  }

  const err = extractErrorMessage(data)
  if (err) {
    return { valid: false, error: err }
  }

  return { valid: false, error: 'Invalid code' }
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

    return normalizeValidateBody(data, res.ok)
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
    let data: unknown = {}
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = {}
    }

    const obj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}

    if (!res.ok) {
      const err =
        extractErrorMessage(data) ??
        (typeof obj.error === 'string' && obj.error.trim() ? obj.error.trim() : undefined) ??
        `Redeem failed (${res.status}).`
      return { error: err }
    }

    if (obj.ok === true) {
      const message =
        typeof obj.message === 'string' && obj.message.trim()
          ? obj.message.trim()
          : 'Promo code applied successfully.'
      return { ok: true, message }
    }

    const err = extractErrorMessage(data) ?? 'Redeem failed. Please try again.'
    return { error: err }
  } catch {
    return { error: 'Redeem failed. Please try again.' }
  }
}
