-- Stripe billing columns (idempotent)
alter table public.users
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_id text,
  add column if not exists subscription_status text default 'free',
  add column if not exists current_period_end timestamptz,
  add column if not exists lifetime_access boolean default false;

comment on column public.users.stripe_customer_id is 'Stripe Customer id (cus_...)';
comment on column public.users.subscription_id is 'Stripe Subscription id (sub_...) when applicable';
comment on column public.users.subscription_status is 'free | active | trialing | past_due | cancelled | canceled';
comment on column public.users.current_period_end is 'End of current Stripe billing period';
comment on column public.users.lifetime_access is 'True for Founding / lifetime promos';
