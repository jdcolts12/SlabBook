-- Claude AI pricing estimate fields + price history

alter table public.cards
  add column if not exists value_low numeric(12, 2),
  add column if not exists value_high numeric(12, 2),
  add column if not exists confidence text,
  add column if not exists trend text,
  add column if not exists value_note text,
  add column if not exists pricing_source text default 'claude_estimate';

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid (),
  card_id uuid not null references public.cards (id) on delete cascade,
  recorded_value numeric(12, 2) not null,
  recorded_at timestamptz not null default now (),
  source text not null default 'claude_estimate'
);

create index if not exists price_history_card_id_idx on public.price_history (card_id);
create index if not exists price_history_recorded_at_idx on public.price_history (recorded_at desc);

alter table public.price_history enable row level security;

drop policy if exists "Users select own card price history" on public.price_history;
create policy "Users select own card price history"
  on public.price_history for select
  using (
    exists (
      select 1
      from public.cards c
      where c.id = price_history.card_id
        and c.user_id = auth.uid ()
    )
  );

-- Refresh PostgREST schema cache so the API sees new columns (fixes "schema cache" errors)
notify pgrst, 'reload schema';
