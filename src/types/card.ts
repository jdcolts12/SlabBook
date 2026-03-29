/** Row shape from `public.cards` */
export type Card = {
  id: string
  user_id: string
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
  image_front_url: string | null
  image_back_url: string | null
  purchase_price: number | null
  purchase_date: string | null
  current_value: number | null
  value_low: number | null
  value_high: number | null
  confidence: string | null
  trend: string | null
  value_note: string | null
  pricing_source: string | null
  last_updated: string | null
  created_at: string
}
