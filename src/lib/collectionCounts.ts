import type { SupabaseClient } from '@supabase/supabase-js'

/** Total rows in sports `cards` plus `pokemon_cards` for tier limits. */
export async function fetchTotalCardCount (
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const [sports, pokemon] = await Promise.all([
    supabase.from('cards').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('pokemon_cards').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  if (sports.error) throw new Error(sports.error.message)
  if (pokemon.error) throw new Error(pokemon.error.message)
  return (sports.count ?? 0) + (pokemon.count ?? 0)
}
