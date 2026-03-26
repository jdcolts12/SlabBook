/** Row shape from `public.cards` */
export type Card = {
  id: string
  user_id: string
  player_name: string
  year: number | null
  set_name: string | null
  card_number: string | null
  variation: string | null
  is_graded: boolean
  grade: string | null
  grading_company: string | null
  condition: string | null
  purchase_price: number | null
  purchase_date: string | null
  current_value: number | null
  last_updated: string | null
  created_at: string
}
