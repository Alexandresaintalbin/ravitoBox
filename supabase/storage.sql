-- Bucket public et politiques. Appliqué après le démarrage de Storage.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists product_images_insert_own on storage.objects;
create policy product_images_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists product_images_update_own on storage.objects;
create policy product_images_update_own on storage.objects
for update to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists product_images_delete_own on storage.objects;
create policy product_images_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists product_images_admin_catalog on storage.objects;
create policy product_images_admin_catalog on storage.objects
for all to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'catalog'
  and public.is_admin()
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = 'catalog'
  and public.is_admin()
);
