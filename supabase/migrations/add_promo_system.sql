-- Promo codes + user subscription fields (run after base schema)

-- ---------------------------------------------------------------------------
-- Users: subscription + promo tracking
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'collector', 'investor', 'lifetime'));

alter table public.users
  add column if not exists promo_code_used text;

alter table public.users
  add column if not exists trial_ends_at timestamptz;

alter table public.users
  add column if not exists subscription_ends_at timestamptz;

-- Map legacy tier → subscription_tier (one-time)
update public.users set subscription_tier = 'collector' where tier = 'pro';
update public.users set subscription_tier = 'investor' where tier = 'enterprise';

-- ---------------------------------------------------------------------------
-- Promo codes
-- ---------------------------------------------------------------------------
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid (),
  code text unique not null,
  type text not null
    check (type in ('percent_off', 'fixed_off', 'free_months', 'lifetime_free')),
  value numeric,
  applicable_tier text not null default 'any'
    check (applicable_tier in ('collector', 'investor', 'lifetime', 'any')),
  max_uses integer,
  uses_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now (),
  notes text
);

create index if not exists promo_codes_code_lower_idx on public.promo_codes (lower(code));

-- ---------------------------------------------------------------------------
-- Redemptions
-- ---------------------------------------------------------------------------
create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid (),
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  redeemed_at timestamptz not null default now (),
  discount_applied text not null,
  unique (promo_code_id, user_id)
);

create index if not exists promo_redemptions_user_id_idx on public.promo_redemptions (user_id);
create index if not exists promo_redemptions_promo_code_id_idx on public.promo_redemptions (promo_code_id);

-- ---------------------------------------------------------------------------
-- RLS: no direct client access (API uses service role)
-- ---------------------------------------------------------------------------
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

drop policy if exists "No direct promo_codes access" on public.promo_codes;
create policy "No direct promo_codes access"
  on public.promo_codes for all
  using (false)
  with check (false);

drop policy if exists "No direct promo_redemptions access" on public.promo_redemptions;
create policy "No direct promo_redemptions access"
  on public.promo_redemptions for all
  using (false)
  with check (false);

-- Service role bypasses RLS — app uses serverless APIs only.

-- ---------------------------------------------------------------------------
-- Seed starter codes (idempotent)
-- ---------------------------------------------------------------------------
insert into public.promo_codes (code, type, value, applicable_tier, max_uses, expires_at, notes)
values
  ('FOUNDING50', 'percent_off', 50, 'lifetime', null, null, 'Reddit launch / founding 50% off lifetime'),
  ('SLABFREE', 'free_months', 3, 'any', 100, null, '3 months free any tier'),
  ('REDDIT100', 'percent_off', 100, 'any', 50, null, '100% off first month'),
  ('EARLYBIRD', 'lifetime_free', null, 'any', 10, null, 'Lifetime free — friends/testers'),
  ('SLABVIP', 'lifetime_free', null, 'any', null, null, 'Personal unlimited lifetime')
on conflict (code) do nothing;
