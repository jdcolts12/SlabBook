import type { EstimateCardValueResponse } from './estimateCardValueApi'

export type InstantEstimateRequest = {
  card_kind: 'sports' | 'pokemon_tcg' | 'other_tcg'
  sport: string | null
  player_name: string
  year: string | null
  set_name: string | null
  card_number: string | null
  variation: string | null
  is_graded: boolean
  grade: string | null
  grading_company: string | null
  condition: string | null
}

export async function postInstantEstimateCardValue (
  accessToken: string,
  payload: InstantEstimateRequest,
): Promise<EstimateCardValueResponse & { error?: string }> {
  const res = await fetch('/api/instant-estimate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  const raw = await res.text()
  let data: (EstimateCardValueResponse & { error?: string }) = {
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
    if (raw) data = JSON.parse(raw) as typeof data
  } catch {
    // fall through
  }

  if (!res.ok) {
    return { ...data, error: data.error ?? `Instant estimate failed (${res.status}).` }
  }

  return data
}

