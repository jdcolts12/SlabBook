-- Saved from scan flow (not in collection yet). Text + estimate snapshot only.

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.users (id) on delete cascade,
  detected_card_kind text not null default 'sports',
  sport text,
  player_name text not null,
  year integer,
  set_name text,
  card_number text,
  variation text,
  is_graded boolean not null default false,
  grade text,
  grading_company text,
  condition text,
  current_value numeric(12, 2),
  value_low numeric(12, 2),
  value_high numeric(12, 2),
  confidence text,
  trend text,
  value_note text,
  created_at timestamptz not null default now ()
);

create index if not exists watchlist_items_user_id_idx on public.watchlist_items (user_id);
create index if not exists watchlist_items_created_at_idx on public.watchlist_items (created_at desc);

alter table public.watchlist_items enable row level security;

drop policy if exists "Users manage own watchlist" on public.watchlist_items;
create policy "Users manage own watchlist"
  on public.watchlist_items for all
  using (auth.uid () = user_id)
  with check (auth.uid () = user_id);
