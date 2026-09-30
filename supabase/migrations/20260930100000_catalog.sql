-- Catalogue Open Food Facts : portions, qualité, recherche, modération.

create extension if not exists pg_trgm;

alter table public.products alter column carbs_g drop not null;
alter table public.products alter column carbs_g drop default;
alter table public.products alter column sodium_mg drop not null;
alter table public.products alter column sodium_mg drop default;
alter table public.products alter column caffeine_mg drop not null;
alter table public.products alter column caffeine_mg drop default;

alter table public.products drop constraint if exists products_name_check;
alter table public.products add constraint products_name_check check (char_length(name) between 1 and 160);

alter table public.products drop constraint if exists products_brand_check;
alter table public.products add constraint products_brand_check check (brand is null or char_length(brand) <= 120);

alter table public.products
  add column if not exists barcode text,
  add column if not exists serving_label text,
  add column if not exists serving_size numeric(8, 2),
  add column if not exists serving_unit text,
  add column if not exists carbs_per_100 numeric(6, 2),
  add column if not exists sugars_g numeric(6, 2),
  add column if not exists sugars_per_100 numeric(6, 2),
  add column if not exists energy_kj numeric(8, 1),
  add column if not exists energy_kj_per_100 numeric(8, 1),
  add column if not exists sodium_per_100 numeric(8, 2),
  add column if not exists caffeine_per_100 numeric(8, 2),
  add column if not exists image_path text,
  add column if not exists image_credit text,
  add column if not exists source text not null default 'manual',
  add column if not exists source_url text,
  add column if not exists data_quality text not null default 'incomplete',
  add column if not exists verified boolean not null default false,
  add column if not exists buy_url text,
  add column if not exists indicative_price_eur numeric(8, 2),
  add column if not exists off_last_modified timestamptz,
  add column if not exists origin_id uuid references public.products (id) on delete set null,
  add column if not exists carbs_known boolean not null default true;

alter table public.products drop constraint if exists products_serving_unit_check;
alter table public.products add constraint products_serving_unit_check
  check (serving_unit is null or serving_unit in ('g', 'ml'));

alter table public.products drop constraint if exists products_source_check;
alter table public.products add constraint products_source_check
  check (source in ('off', 'manual', 'user'));

alter table public.products drop constraint if exists products_data_quality_check;
alter table public.products add constraint products_data_quality_check
  check (data_quality in ('complete', 'incomplete'));

alter table public.products drop constraint if exists products_price_check;
alter table public.products add constraint products_price_check
  check (indicative_price_eur is null or indicative_price_eur >= 0);

alter table public.products drop constraint if exists products_buy_url_check;
alter table public.products add constraint products_buy_url_check
  check (buy_url is null or char_length(buy_url) <= 300);

create unique index if not exists products_catalog_barcode_uidx
  on public.products (barcode)
  where scope = 'catalog' and barcode is not null;

create or replace function public.fold(value text)
returns text
language sql
immutable
as $$
  select translate(
    lower(coalesce(value, '')),
    'àâäéèêëïîôùûüçœæ',
    'aaaeeeeiioouucoa'
  );
$$;

create index if not exists products_name_trgm_idx on public.products using gin (public.fold(name) gin_trgm_ops);
create index if not exists products_brand_trgm_idx on public.products using gin (public.fold(coalesce(brand, '')) gin_trgm_ops);
create index if not exists products_catalog_type_idx on public.products (product_type) where scope = 'catalog';
create index if not exists products_review_idx on public.products (data_quality, verified) where scope = 'catalog';

update public.products
set carbs_known = true
where carbs_known is distinct from true;

update public.products
set serving_size = volume_ml,
    serving_unit = 'ml',
    serving_label = '1 portion de ' || trim(to_char(volume_ml, 'FM9990.0')) || ' ml',
    data_quality = 'complete'
where scope = 'catalog'
  and volume_ml is not null
  and serving_size is null
  and sodium_mg is not null
  and caffeine_mg is not null
  and carbs_g is not null;

create or replace function public.protect_product_owner()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.catalog_promote', true) = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' and (new.scope is distinct from old.scope or new.owner_id is distinct from old.owner_id) then
    raise exception 'ownership immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.search_products(
  q text default null,
  p_type text default null,
  p_brand text default null,
  p_flavor text default null,
  p_carbs_min numeric default null,
  p_carbs_max numeric default null,
  p_has_sodium boolean default false,
  p_has_caffeine boolean default false,
  p_verified_only boolean default false,
  p_in_box boolean default false,
  p_review boolean default false,
  p_scope text default 'catalog',
  p_sort text default 'name',
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 24), 1), 48);
  off integer := greatest(coalesce(p_offset, 0), 0);
  sort_key text := case when p_sort in ('name', 'brand', 'carbs') then p_sort else 'name' end;
  payload jsonb;
begin
  with filtered as (
    select p.*
    from public.products p
    where (p_scope is null or p_scope = '' or p_scope = 'all' or p.scope::text = p_scope)
      and (p_type is null or p_type = '' or p.product_type::text = p_type)
      and (
        p_brand is null or btrim(p_brand) = ''
        or position(public.fold(p_brand) in public.fold(coalesce(p.brand, ''))) > 0
        or similarity(public.fold(coalesce(p.brand, '')), public.fold(p_brand)) > 0.3
      )
      and (
        p_flavor is null or btrim(p_flavor) = ''
        or position(public.fold(p_flavor) in public.fold(coalesce(p.flavor, ''))) > 0
        or similarity(public.fold(coalesce(p.flavor, '')), public.fold(p_flavor)) > 0.3
      )
      and (
        q is null or btrim(q) = ''
        or position(public.fold(q) in public.fold(p.name)) > 0
        or position(public.fold(q) in public.fold(coalesce(p.brand, ''))) > 0
        or similarity(public.fold(p.name), public.fold(q)) > 0.3
        or similarity(public.fold(coalesce(p.brand, '')), public.fold(q)) > 0.3
      )
      and (p_carbs_min is null or (p.carbs_g is not null and p.carbs_g >= p_carbs_min))
      and (p_carbs_max is null or (p.carbs_g is not null and p.carbs_g <= p_carbs_max))
      and (not p_has_sodium or p.sodium_mg is not null)
      and (not p_has_caffeine or p.caffeine_mg is not null)
      and (not p_verified_only or p.verified)
      and (
        not p_in_box
        or exists (
          select 1 from public.box_items b
          where b.product_id = p.id and b.user_id = auth.uid()
        )
      )
      and (not p_review or p.verified = false or p.data_quality = 'incomplete')
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((
      select jsonb_agg(to_jsonb(row) order by row.ord, row.id)
      from (
        select f.*,
          case
            when sort_key = 'carbs' then f.carbs_g
            else null
          end as carb_sort,
          case
            when sort_key = 'brand' then public.fold(coalesce(f.brand, ''))
            else public.fold(f.name)
          end as text_sort,
          row_number() over (
            order by
              case when sort_key = 'carbs' then f.carbs_g end asc nulls last,
              case when sort_key = 'brand' then public.fold(coalesce(f.brand, '')) end asc,
              public.fold(f.name) asc,
              f.id asc
          ) as ord
        from filtered f
        order by
          case when sort_key = 'carbs' then f.carbs_g end asc nulls last,
          case when sort_key = 'brand' then public.fold(coalesce(f.brand, '')) end asc,
          public.fold(f.name) asc,
          f.id asc
        limit lim offset off
      ) row
    ), '[]'::jsonb)
  ) into payload;
  return payload;
end;
$$;

create or replace function public.upsert_catalog_product(payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.products%rowtype;
  bc text := nullif(payload->>'barcode', '');
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' and not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if bc is null then
    raise exception 'barcode required';
  end if;
  select * into existing from public.products
  where barcode = bc and scope = 'catalog'
  limit 1;
  if found and existing.verified then
    return 'skipped_verified';
  end if;
  if found then
    update public.products set
      name = left(payload->>'name', 160),
      brand = nullif(left(coalesce(payload->>'brand', ''), 120), ''),
      product_type = (payload->>'product_type')::public.product_type,
      flavor = nullif(payload->>'flavor', ''),
      carbs_g = nullif(payload->>'carbs_g', '')::numeric,
      sodium_mg = nullif(payload->>'sodium_mg', '')::numeric,
      caffeine_mg = nullif(payload->>'caffeine_mg', '')::numeric,
      volume_ml = nullif(payload->>'volume_ml', '')::numeric,
      serving_label = nullif(payload->>'serving_label', ''),
      serving_size = nullif(payload->>'serving_size', '')::numeric,
      serving_unit = nullif(payload->>'serving_unit', ''),
      carbs_per_100 = nullif(payload->>'carbs_per_100', '')::numeric,
      sugars_g = nullif(payload->>'sugars_g', '')::numeric,
      sugars_per_100 = nullif(payload->>'sugars_per_100', '')::numeric,
      energy_kj = nullif(payload->>'energy_kj', '')::numeric,
      energy_kj_per_100 = nullif(payload->>'energy_kj_per_100', '')::numeric,
      sodium_per_100 = nullif(payload->>'sodium_per_100', '')::numeric,
      caffeine_per_100 = nullif(payload->>'caffeine_per_100', '')::numeric,
      image_path = coalesce(nullif(payload->>'image_path', ''), existing.image_path),
      image_credit = coalesce(nullif(payload->>'image_credit', ''), existing.image_credit),
      source = 'off',
      source_url = nullif(payload->>'source_url', ''),
      data_quality = case when payload->>'data_quality' = 'complete' then 'complete' else 'incomplete' end,
      off_last_modified = nullif(payload->>'off_last_modified', '')::timestamptz,
      carbs_known = coalesce((payload->>'carbs_known')::boolean, true)
    where id = existing.id;
    return 'updated';
  end if;
  insert into public.products (
    name, brand, barcode, product_type, flavor, carbs_g, sodium_mg, caffeine_mg, volume_ml,
    scope, owner_id, serving_label, serving_size, serving_unit, carbs_per_100, sugars_g, sugars_per_100,
    energy_kj, energy_kj_per_100, sodium_per_100, caffeine_per_100, image_path, image_credit,
    source, source_url, data_quality, verified, off_last_modified, carbs_known
  ) values (
    left(payload->>'name', 160),
    nullif(left(coalesce(payload->>'brand', ''), 120), ''),
    bc,
    (payload->>'product_type')::public.product_type,
    nullif(payload->>'flavor', ''),
    nullif(payload->>'carbs_g', '')::numeric,
    nullif(payload->>'sodium_mg', '')::numeric,
    nullif(payload->>'caffeine_mg', '')::numeric,
    nullif(payload->>'volume_ml', '')::numeric,
    'catalog',
    null,
    nullif(payload->>'serving_label', ''),
    nullif(payload->>'serving_size', '')::numeric,
    nullif(payload->>'serving_unit', ''),
    nullif(payload->>'carbs_per_100', '')::numeric,
    nullif(payload->>'sugars_g', '')::numeric,
    nullif(payload->>'sugars_per_100', '')::numeric,
    nullif(payload->>'energy_kj', '')::numeric,
    nullif(payload->>'energy_kj_per_100', '')::numeric,
    nullif(payload->>'sodium_per_100', '')::numeric,
    nullif(payload->>'caffeine_per_100', '')::numeric,
    nullif(payload->>'image_path', ''),
    nullif(payload->>'image_credit', ''),
    'off',
    nullif(payload->>'source_url', ''),
    case when payload->>'data_quality' = 'complete' then 'complete' else 'incomplete' end,
    false,
    nullif(payload->>'off_last_modified', '')::timestamptz,
    true
  );
  return 'inserted';
end;
$$;

create or replace function public.fork_catalog_product(source_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.products%rowtype;
  created uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into source from public.products where id = source_id and scope = 'catalog';
  if not found then
    raise exception 'Produit introuvable.';
  end if;
  insert into public.products (
    name, brand, barcode, product_type, flavor, carbs_g, sodium_mg, caffeine_mg, volume_ml,
    scope, owner_id, serving_label, serving_size, serving_unit, carbs_per_100, sugars_g, sugars_per_100,
    energy_kj, energy_kj_per_100, sodium_per_100, caffeine_per_100, image_path, image_credit,
    source, source_url, data_quality, verified, buy_url, indicative_price_eur, origin_id, carbs_known
  ) values (
    left(source.name || ' (ma version)', 160),
    source.brand, source.barcode, source.product_type, source.flavor, source.carbs_g, source.sodium_mg,
    source.caffeine_mg, source.volume_ml, 'custom', auth.uid(), source.serving_label, source.serving_size,
    source.serving_unit, source.carbs_per_100, source.sugars_g, source.sugars_per_100, source.energy_kj,
    source.energy_kj_per_100, source.sodium_per_100, source.caffeine_per_100, source.image_path, source.image_credit,
    'user', source.source_url, source.data_quality, false, source.buy_url, source.indicative_price_eur, source.id,
    source.carbs_known
  ) returning id into created;
  return created;
end;
$$;

create or replace function public.admin_promote_product(product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform set_config('app.catalog_promote', 'on', true);
  update public.products
  set scope = 'catalog', owner_id = null, verified = true
  where id = product_id and scope = 'custom';
  if not found then
    raise exception 'Version privée introuvable.';
  end if;
end;
$$;

create or replace function public.admin_merge_products(keep_id uuid, drop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  keep public.products%rowtype;
  gone public.products%rowtype;
  item record;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if keep_id = drop_id then
    raise exception 'Choisissez deux produits différents.';
  end if;
  select * into keep from public.products where id = keep_id and scope = 'catalog';
  select * into gone from public.products where id = drop_id and scope = 'catalog';
  if keep.id is null or gone.id is null then
    raise exception 'Seuls des produits du catalogue peuvent être fusionnés.';
  end if;
  if not (
    (keep.barcode is not null and keep.barcode = gone.barcode)
    or (public.fold(keep.name) = public.fold(gone.name) and public.fold(coalesce(keep.brand, '')) = public.fold(coalesce(gone.brand, '')))
  ) then
    raise exception 'Fusion refusée : code-barres ou nom et marque différents.';
  end if;
  for item in select * from public.box_items where product_id = drop_id loop
    if exists (select 1 from public.box_items where user_id = item.user_id and product_id = keep_id) then
      update public.box_items
      set quantity = least(9999, quantity + item.quantity)
      where user_id = item.user_id and product_id = keep_id;
      delete from public.box_items where user_id = item.user_id and product_id = drop_id;
    else
      update public.box_items set product_id = keep_id where user_id = item.user_id and product_id = drop_id;
    end if;
  end loop;
  delete from public.favorites f
  where f.product_id = drop_id
    and exists (select 1 from public.favorites k where k.user_id = f.user_id and k.product_id = keep_id);
  update public.favorites set product_id = keep_id where product_id = drop_id;
  update public.products set origin_id = keep_id where origin_id = drop_id;
  delete from public.products where id = drop_id;
end;
$$;

create or replace function public.admin_list_forks()
returns setof public.products
language sql
stable
security definer
set search_path = public
as $$
  select * from public.products
  where public.is_admin() and scope = 'custom' and origin_id is not null
  order by updated_at desc
  limit 100;
$$;

grant execute on function public.fold(text) to authenticated, service_role;
grant execute on function public.search_products(
  text, text, text, text, numeric, numeric, boolean, boolean, boolean, boolean, boolean, text, text, integer, integer
) to authenticated, service_role;
grant execute on function public.upsert_catalog_product(jsonb) to authenticated, service_role;
grant execute on function public.fork_catalog_product(uuid) to authenticated;
grant execute on function public.admin_promote_product(uuid) to authenticated;
grant execute on function public.admin_merge_products(uuid, uuid) to authenticated;
grant execute on function public.admin_list_forks() to authenticated;
