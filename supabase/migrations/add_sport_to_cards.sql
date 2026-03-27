-- Run once in Supabase SQL Editor if you already created `cards` without `sport`.
alter table public.cards add column if not exists sport text;
