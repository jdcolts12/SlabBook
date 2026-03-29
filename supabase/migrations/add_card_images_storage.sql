-- Card images: public URLs on cards + Supabase Storage bucket "card-images"
-- Paths: {user_id}/{card_id}-front.{ext} and {user_id}/{card_id}-back.{ext} (ext jpg|png|webp)

alter table public.cards
  add column if not exists image_front_url text,
  add column if not exists image_back_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-images',
  'card-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "card_images_select_public" on storage.objects;
drop policy if exists "card_images_insert_own" on storage.objects;
drop policy if exists "card_images_update_own" on storage.objects;
drop policy if exists "card_images_delete_own" on storage.objects;

create policy "card_images_select_public"
on storage.objects for select
using (bucket_id = 'card-images');

create policy "card_images_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'card-images'
  and (storage.foldername (name))[1] = auth.uid()::text
);

create policy "card_images_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'card-images'
  and (storage.foldername (name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'card-images'
  and (storage.foldername (name))[1] = auth.uid()::text
);

create policy "card_images_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'card-images'
  and (storage.foldername (name))[1] = auth.uid()::text
);
