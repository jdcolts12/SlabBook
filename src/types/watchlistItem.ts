/** Row from `public.watchlist_items` */
export type WatchlistItem = {
  id: string
  user_id: string
  detected_card_kind: string
  sport: string | null
  player_name: string
  year: number | null
  set_name: string | null
  card_number: string | null
  variation: string | null
  is_graded: boolean
  grade: string | null
  grading_company: string | null
  condition: string | null
  current_value: number | null
  value_low: number | null
  value_high: number | null
  confidence: string | null
  trend: string | null
  value_note: string | null
  /** Present after migration + save from scan with a front photo. */
  image_front_url?: string | null
  created_at: string
}
