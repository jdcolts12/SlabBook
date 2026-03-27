-- SlabBook — run in Supabase SQL Editor (single transaction recommended)
-- Creates profile row on signup and secures tables with RLS.

-- ---------------------------------------------------------------------------
-- Profiles (app "users" table; id matches auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  tier text not null default 'free'
    check (tier in ('free', 'pro', 'enterprise'))
);

create index if not exists users_email_idx on public.users (email);

-- New auth user → public.users row
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.users (id) on delete cascade,
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
  purchase_price numeric(12, 2),
  purchase_date date,
  current_value numeric(12, 2),
  last_updated timestamptz default now (),
  created_at timestamptz not null default now ()
);

create index if not exists cards_user_id_idx on public.cards (user_id);
create index if not exists cards_player_name_idx on public.cards (player_name);

-- ---------------------------------------------------------------------------
-- Price alerts
-- ---------------------------------------------------------------------------
create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  target_price numeric(12, 2) not null,
  direction text not null check (direction in ('above', 'below')),
  is_active boolean not null default true,
  created_at timestamptz not null default now ()
);

create index if not exists price_alerts_user_id_idx on public.price_alerts (user_id);
create index if not exists price_alerts_card_id_idx on public.price_alerts (card_id);

-- ---------------------------------------------------------------------------
-- AI insights cache / history
-- ---------------------------------------------------------------------------
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now (),
  is_read boolean not null default false
);

create index if not exists ai_insights_user_id_idx on public.ai_insights (user_id);
create index if not exists ai_insights_created_at_idx on public.ai_insights (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.cards enable row level security;
alter table public.price_alerts enable row level security;
alter table public.ai_insights enable row level security;

-- users: own row only
drop policy if exists "Users select own profile" on public.users;
create policy "Users select own profile"
  on public.users for select
  using (auth.uid () = id);

drop policy if exists "Users update own profile" on public.users;
create policy "Users update own profile"
  on public.users for update
  using (auth.uid () = id);

-- cards
drop policy if exists "Users manage own cards" on public.cards;
create policy "Users manage own cards"
  on public.cards for all
  using (auth.uid () = user_id)
  with check (auth.uid () = user_id);

-- price_alerts
drop policy if exists "Users manage own alerts" on public.price_alerts;
create policy "Users manage own alerts"
  on public.price_alerts for all
  using (auth.uid () = user_id)
  with check (auth.uid () = user_id);

-- ai_insights
drop policy if exists "Users manage own insights" on public.ai_insights;
create policy "Users manage own insights"
  on public.ai_insights for all
  using (auth.uid () = user_id)
  with check (auth.uid () = user_id);
