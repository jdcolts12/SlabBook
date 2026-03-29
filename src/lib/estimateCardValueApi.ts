import type { Card } from '../types/card'

export type EstimateCardValueResponse = {
  cached?: boolean
  error?: string
  current_value: number | null
  value_low: number | null
  value_high: number | null
  confidence: string | null
  trend: string | null
  value_note: string | null
  pricing_source: string | null
  last_updated: string | null
  data_source?: string
}

export async function postEstimateCardValue (
  accessToken: string,
  cardId: string,
  opts?: { force_refresh?: boolean },
): Promise<EstimateCardValueResponse> {
  const res = await fetch('/api/estimate-card-value', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      card_id: cardId,
      force_refresh: opts?.force_refresh === true,
    }),
  })

  const raw = await res.text()
  let data: EstimateCardValueResponse = {
    current_value: null,
    value_low: null,
    value_high: null,
    confidence: null,
    trend: null,
    value_note: null,
    pricing_source: null,
    last_updated: null,
  }
  try {
    data = raw ? (JSON.parse(raw) as EstimateCardValueResponse) : data
  } catch {
    const looksLikeHtml = /^\s*</.test(raw)
    const empty = raw.trim().length === 0
    let hint: string
    if (empty) {
      hint =
        'Empty response from server (often Vercel function crash, cold-start failure, or timeout before any body). Check Vercel → Functions → /api/estimate-card-value logs.'
    } else if (looksLikeHtml) {
      hint =
        'Server returned HTML instead of JSON (timeout or platform error). Vercel project Settings → Functions: max duration; check deployment logs.'
    } else {
      const t = raw.trim()
      if (/internal server error|function_invocation|invocation failed|bad gateway|gateway timeout/i.test(t)) {
        hint =
          'Server error (non-JSON body — often function crash, timeout, or Vercel platform error). Check Vercel → Deployments → Functions logs for /api/estimate-card-value.'
      } else {
        hint = 'Response was not valid JSON.'
      }
    }
    return { ...data, error: `${hint} HTTP ${res.status}.` }
  }

  if (!res.ok) {
    return { ...data, error: data.error ?? `Request failed (${res.status})` }
  }
  return data
}

export function mergeEstimateIntoCard (card: Card, est: EstimateCardValueResponse): Card {
  return {
    ...card,
    current_value: est.current_value,
    value_low: est.value_low,
    value_high: est.value_high,
    confidence: est.confidence,
    trend: est.trend,
    value_note: est.value_note,
    pricing_source: est.pricing_source,
    last_updated: est.last_updated,
  }
}
