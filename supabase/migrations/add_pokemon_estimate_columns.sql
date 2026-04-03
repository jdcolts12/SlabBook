-- AI estimate metadata on Pokémon collection rows (parity with public.cards pricing fields)
alter table public.pokemon_cards
  add column if not exists value_low numeric(12, 2),
  add column if not exists value_high numeric(12, 2),
  add column if not exists confidence text,
  add column if not exists trend text,
  add column if not exists value_note text,
  add column if not exists pricing_source text,
  add column if not exists last_updated timestamptz;
