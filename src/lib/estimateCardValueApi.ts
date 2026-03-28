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
    return { ...data, error: `Invalid response (${res.status})` }
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
