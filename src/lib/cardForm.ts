import type { DetectedCardKind } from './identifyCardApi'
import type { Sport } from '../data/sports'

export type CardFormValues = {
  /** From scan identify, or sports for manual add / edit. */
  detected_card_kind: DetectedCardKind
  sport: Sport
  player_name: string
  year: string
  set_name: string
  card_number: string
  variation_preset: string
  variation_extra: string
  condition: string
  is_graded: boolean
  grade: string
  grading_company: string
  purchase_price: string
  purchase_date: string
  current_value: string

  /**
   * Optional instant estimate outputs (used for pre-save estimate).
   * Only set for scan/pro flows; not manually editable today.
   */
  instant_value_low?: string
  instant_value_high?: string
  instant_confidence?: string
  instant_trend?: string
  instant_value_note?: string
}

export function variationFromFormValues (f: CardFormValues): string | null {
  const extra = f.variation_extra.trim()
  if (f.variation_preset === 'Other') {
    return extra || null
  }
  if (!f.variation_preset) {
    return extra || null
  }
  return [f.variation_preset, extra].filter(Boolean).join(' ').trim() || null
}

export function validateCardForm (f: CardFormValues): string | null {
  if (f.detected_card_kind === 'sports') {
    if (!f.sport) return 'Select a sport.'
  }
  if (!f.player_name.trim()) {
    return f.detected_card_kind === 'sports'
      ? 'Player name is required.'
      : 'Name on card is required.'
  }
  if (f.is_graded) {
    if (!f.grading_company) return 'Select a grading company.'
    if (!f.grade) return 'Select a grade.'
  } else {
    if (!f.condition) return 'Select a card condition.'
  }
  const pp = f.purchase_price.trim()
  if (pp && !Number.isFinite(Number.parseFloat(pp.replace(/,/g, '')))) {
    return 'Purchase price must be a valid number.'
  }
  const cv = f.current_value.trim()
  if (cv && !Number.isFinite(Number.parseFloat(cv.replace(/,/g, '')))) {
    return 'Current value must be a valid number.'
  }
  const y = f.year.trim()
  if (y) {
    const n = Number.parseInt(y, 10)
    if (!Number.isFinite(n) || n < 1800 || n > 2100) return 'Year must be between 1800 and 2100.'
  }
  return null
}
