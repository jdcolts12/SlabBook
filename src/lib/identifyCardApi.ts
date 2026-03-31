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

function friendlyNonJsonError (raw: string, status: number): string {
  const s = raw.trim()
  if (status === 413 || /413|payload too large|request entity too large/i.test(s)) {
    return 'Photo is too large for the server. Try again with a smaller image or retake the photo.'
  }
  if (
    /FUNCTION_INVOCATION_FAILED|A server error has occurred|502:\s*Bad Gateway/i.test(
      s,
    )
  ) {
    return 'Card identification is temporarily unavailable. Please try again in a moment.'
  }
  if (s.length > 0 && s.length < 280) return s
  return `Identify failed (HTTP ${status})`
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

  const raw = await res.text()
  let data: IdentifyCardResponse & { error?: string }
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : {}
  } catch {
    return { error: friendlyNonJsonError(raw, res.status) }
  }

  if (!res.ok) {
    return { error: data.error ?? friendlyNonJsonError(raw, res.status) }
  }
  return data
}
