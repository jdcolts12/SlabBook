export type IdentifyConfidence = 'high' | 'medium' | 'low'

export type IdentifyCardResponse = {
  player_name?: string
  year?: string
  set_name?: string
  card_number?: string
  variation?: string
  sport?: string
  grading_company?: string | null
  grade?: string | null
  is_graded?: boolean
  confidence?: IdentifyConfidence
  notes?: string
  error?: string
}

export async function identifyCardFromImage (
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  accessToken: string,
): Promise<IdentifyCardResponse> {
  const res = await fetch('/api/identify-card', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ image_base64: imageBase64, media_type: mediaType }),
  })
  const data = (await res.json()) as IdentifyCardResponse & { error?: string }
  if (!res.ok) {
    return { error: data.error ?? `Identify failed (${res.status})` }
  }
  return data
}
