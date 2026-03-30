-- Two-tier pricing: merge collector + investor → pro; keep free + lifetime.
-- Run after backup. Adjust constraint names if your DB differs.

-- 1) Data migration (before new CHECK constraints)
update public.users
set subscription_tier = 'pro'
where subscription_tier in ('collector', 'investor');

update public.promo_codes
set applicable_tier = 'pro'
where applicable_tier in ('collector', 'investor');

-- 2) Replace subscription_tier check on users
alter table public.users drop constraint if exists users_subscription_tier_check;

alter table public.users
  add constraint users_subscription_tier_check
  check (subscription_tier in ('free', 'pro', 'lifetime'));

-- 3) Replace applicable_tier check on promo_codes
alter table public.promo_codes drop constraint if exists promo_codes_applicable_tier_check;

alter table public.promo_codes
  add constraint promo_codes_applicable_tier_check
  check (applicable_tier in ('pro', 'lifetime', 'any'));
