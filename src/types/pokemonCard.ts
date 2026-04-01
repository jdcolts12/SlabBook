/** Row shape from `public.pokemon_cards` */
export type PokemonCard = {
  id: string
  user_id: string
  pokemon_name: string
  language: 'en' | 'jp'
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
  created_at: string
}
