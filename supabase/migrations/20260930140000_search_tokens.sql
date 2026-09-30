-- La recherche accepte chaque mot du nom, de la marque ou du type,
-- et confond une lettre doublée (patte / pâte).

create or replace function public.loose(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(public.fold(value), '(.)\1+', '\1', 'g');
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
        or not exists (
          select 1
          from regexp_split_to_table(regexp_replace(public.fold(q), '[^a-z0-9]+', ' ', 'g'), '\s+') as token
          where token <> ''
            and not exists (
              select 1
              from regexp_split_to_table(regexp_replace(public.fold(
                p.name || ' ' || coalesce(p.brand, '') || ' ' ||
                case p.product_type
                  when 'pate_de_fruit' then 'pate de fruits'
                  when 'capsule_sel' then 'capsule sel'
                  when 'autre' then ''
                  else p.product_type::text
                end
              ), '[^a-z0-9]+', ' ', 'g'), '\s+') as word
              where word <> ''
                and (
                  word = token
                  or (char_length(token) >= 4 and word = regexp_replace(token, '(.)\1+', '\1', 'g'))
                  or (char_length(token) >= 5 and similarity(word, token) > 0.55)
                )
            )
        )
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
      select jsonb_agg(to_jsonb(page_row) order by page_row.ord, page_row.id)
      from (
        select f.*,
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
      ) page_row
    ), '[]'::jsonb)
  ) into payload;
  return payload;
end;
$$;

grant execute on function public.loose(text) to authenticated, service_role;
grant execute on function public.search_products(
  text, text, text, text, numeric, numeric, boolean, boolean, boolean, boolean, boolean, text, text, integer, integer
) to authenticated, service_role;
