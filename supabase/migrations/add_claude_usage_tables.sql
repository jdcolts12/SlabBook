-- App-wide Claude API usage (UTC day cap). Accessed only with service role from Vercel functions.

create table if not exists public.claude_api_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  route text not null default ''
);

create index if not exists claude_api_calls_created_at_idx on public.claude_api_calls (created_at desc);

-- One row per UTC day when we emailed the owner about hitting the cap (dedupe).
create table if not exists public.claude_cap_alert_sent (
  day date primary key,
  sent_at timestamptz not null default now()
);

alter table public.claude_api_calls enable row level security;
alter table public.claude_cap_alert_sent enable row level security;
