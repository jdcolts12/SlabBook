import type { CardFormValues } from './cardForm'
import { variationFromFormValues } from './cardForm'

function parseOptionalInt (raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

function parseOptionalNumber (raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number.parseFloat(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Insert payload for `watchlist_items` from scan / form values. */
export function formValuesToWatchlistInsert (
  userId: string,
  v: CardFormValues,
): Record<string, unknown> {
  const variation = variationFromFormValues(v)
  const sports = v.detected_card_kind === 'sports'
  return {
    user_id: userId,
    detected_card_kind: v.detected_card_kind,
    sport: sports ? v.sport.trim() || null : null,
    player_name: v.player_name.trim(),
    year: parseOptionalInt(v.year),
    set_name: v.set_name.trim() || null,
    card_number: v.card_number.trim() || null,
    variation: variation?.trim() || null,
    is_graded: v.is_graded,
    grade: v.is_graded && v.grade.trim() ? v.grade.trim() : null,
    grading_company: v.is_graded && v.grading_company.trim() ? v.grading_company.trim() : null,
    condition: v.is_graded ? null : v.condition.trim() || null,
    current_value: parseOptionalNumber(v.current_value),
    value_low: v.instant_value_low ? parseOptionalNumber(v.instant_value_low) : null,
    value_high: v.instant_value_high ? parseOptionalNumber(v.instant_value_high) : null,
    confidence: v.instant_confidence?.trim() || null,
    trend: v.instant_trend?.trim() || null,
    value_note: v.instant_value_note?.trim() || null,
  }
}
