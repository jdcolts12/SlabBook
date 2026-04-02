alter table public.watchlist_items
  add column if not exists image_front_url text;
