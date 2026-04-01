-- Pokémon TCG slabs: separate from sports `cards` table.

create table if not exists public.pokemon_cards (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.users (id) on delete cascade,
  pokemon_name text not null,
  language text not null default 'en'
    check (language in ('en', 'jp')),
  set_name text,
  card_number text,
  variation text,
  is_graded boolean not null default false,
  grade text,
  grading_company text,
  condition text,
  image_front_url text,
  image_back_url text,
  purchase_price numeric(12, 2),
  purchase_date date,
  current_value numeric(12, 2),
  created_at timestamptz not null default now ()
);

create index if not exists pokemon_cards_user_id_idx on public.pokemon_cards (user_id);
create index if not exists pokemon_cards_created_at_idx on public.pokemon_cards (created_at desc);

alter table public.pokemon_cards enable row level security;

drop policy if exists "Users manage own pokemon cards" on public.pokemon_cards;
create policy "Users manage own pokemon cards"
  on public.pokemon_cards for all
  using (auth.uid () = user_id)
  with check (auth.uid () = user_id);
