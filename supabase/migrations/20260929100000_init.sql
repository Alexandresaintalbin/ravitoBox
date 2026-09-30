-- ravitoBox : schéma initial, rôles et politiques RLS.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;
end $$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

do $$ begin
  create type public.sport as enum ('course', 'trail', 'cyclisme', 'triathlon');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.session_type as enum ('entrainement', 'course_intermediaire', 'objectif_principal');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_type as enum ('gel', 'boisson', 'barre', 'compote', 'pate_de_fruit', 'capsule_sel', 'eau', 'autre');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_scope as enum ('catalog', 'custom');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.app_role as enum ('user', 'admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null check (char_length(pseudo) between 2 and 40),
  weight_kg numeric(5, 2) check (weight_kg is null or (weight_kg > 0 and weight_kg < 400)),
  primary_sport public.sport,
  tolerance_g_per_h numeric(5, 1) not null default 60 check (tolerance_g_per_h >= 0 and tolerance_g_per_h <= 200),
  preferred_flavors text[] not null default '{}',
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  brand text check (brand is null or char_length(brand) <= 80),
  product_type public.product_type not null,
  flavor text,
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  sodium_mg numeric(7, 1) not null default 0 check (sodium_mg >= 0),
  caffeine_mg numeric(6, 1) not null default 0 check (caffeine_mg >= 0),
  volume_ml numeric(7, 1) check (volume_ml is null or volume_ml >= 0),
  scope public.product_scope not null,
  owner_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_scope_owner check (
    (scope = 'catalog' and owner_id is null) or (scope = 'custom' and owner_id is not null)
  )
);

create table if not exists public.box_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0 and quantity <= 9999),
  excluded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  sport public.sport not null,
  session_type public.session_type not null,
  parameters jsonb not null,
  targets jsonb not null,
  generated_plan jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debriefs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  energy smallint not null check (energy between 1 and 5),
  stomach smallint not null check (stomach between 1 and 5),
  thirst smallint not null check (thirst between 1 and 5),
  notes text check (notes is null or char_length(notes) <= 2000),
  consumed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.badges (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index if not exists products_owner_idx on public.products (owner_id);
create index if not exists plans_user_idx on public.plans (user_id, created_at desc);
create index if not exists debriefs_plan_idx on public.debriefs (plan_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists box_items_updated_at on public.box_items;
create trigger box_items_updated_at before update on public.box_items
for each row execute function public.set_updated_at();

drop trigger if exists plans_updated_at on public.plans;
create trigger plans_updated_at before update on public.plans
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen text;
begin
  chosen := left(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'pseudo', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'athlete'
    ),
    40
  );
  if char_length(chosen) < 2 then
    chosen := chosen || 'x';
  end if;
  insert into public.profiles (id, pseudo, role)
  values (new.id, chosen, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.role is distinct from 'user' and coalesce(auth.role(), '') is distinct from 'service_role' then
    new.role := 'user';
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if coalesce(auth.role(), '') is distinct from 'service_role' then
      raise exception 'role immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

create or replace function public.protect_product_owner()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and (new.scope is distinct from old.scope or new.owner_id is distinct from old.owner_id) then
    raise exception 'ownership immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists products_protect_owner on public.products;
create trigger products_protect_owner
  before update on public.products
  for each row execute function public.protect_product_owner();

create or replace function public.debrief_same_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.plans
    where id = new.plan_id and user_id = new.user_id
  ) then
    raise exception 'plan mismatch' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists debriefs_same_owner on public.debriefs;
create trigger debriefs_same_owner
  before insert or update on public.debriefs
  for each row execute function public.debrief_same_owner();

create or replace function public.product_visible(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.products
    where id = target and (scope = 'catalog' or owner_id = auth.uid())
  );
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

create or replace function public.sync_my_badges()
returns setof public.user_badges
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.user_badges (user_id, badge_id)
  select uid, badge.id
  from public.badges badge
  where (
    (badge.id = 'premiere-sortie' and exists (select 1 from public.plans where user_id = uid))
    or (badge.id = 'premier-debrief' and exists (select 1 from public.debriefs where user_id = uid))
    or (
      badge.id = 'soixante-grammes'
      and exists (
        select 1 from public.plans
        where user_id = uid
          and coalesce((parameters ->> 'durationMinutes')::numeric, 0) > 120
          and coalesce((targets ->> 'carbsGPerHour')::numeric, 0) >= 60
      )
    )
    or (
      badge.id = 'estomac-solide'
      and (select count(*) from public.debriefs where user_id = uid and stomach >= 4) >= 3
    )
    or (badge.id = 'triathlon' and exists (select 1 from public.plans where user_id = uid and sport = 'triathlon'))
    or (
      badge.id = 'box-equipee'
      and (select count(*) from public.box_items where user_id = uid and quantity > 0 and not excluded) >= 5
    )
    or (badge.id = 'objectif' and exists (select 1 from public.plans where user_id = uid and session_type = 'objectif_principal'))
    or (
      badge.id = 'sortie-longue'
      and exists (
        select 1 from public.plans
        where user_id = uid and coalesce((parameters ->> 'durationMinutes')::numeric, 0) >= 180
      )
    )
  )
  on conflict do nothing;

  return query select * from public.user_badges where user_id = uid;
end;
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.box_items enable row level security;
alter table public.favorites enable row level security;
alter table public.plans enable row level security;
alter table public.debriefs enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated
using (scope = 'catalog' or owner_id = auth.uid());

drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated
with check (
  (scope = 'custom' and owner_id = auth.uid())
  or (scope = 'catalog' and owner_id is null and public.is_admin())
);

drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated
using ((scope = 'custom' and owner_id = auth.uid()) or (scope = 'catalog' and public.is_admin()))
with check ((scope = 'custom' and owner_id = auth.uid()) or (scope = 'catalog' and public.is_admin()));

drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete to authenticated
using ((scope = 'custom' and owner_id = auth.uid()) or (scope = 'catalog' and public.is_admin()));

drop policy if exists box_select on public.box_items;
create policy box_select on public.box_items for select to authenticated using (user_id = auth.uid());

drop policy if exists box_insert on public.box_items;
create policy box_insert on public.box_items for insert to authenticated
with check (user_id = auth.uid() and public.product_visible(product_id));

drop policy if exists box_update on public.box_items;
create policy box_update on public.box_items for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists box_delete on public.box_items;
create policy box_delete on public.box_items for delete to authenticated using (user_id = auth.uid());

drop policy if exists favorites_select on public.favorites;
create policy favorites_select on public.favorites for select to authenticated using (user_id = auth.uid());

drop policy if exists favorites_insert on public.favorites;
create policy favorites_insert on public.favorites for insert to authenticated
with check (user_id = auth.uid() and public.product_visible(product_id));

drop policy if exists favorites_delete on public.favorites;
create policy favorites_delete on public.favorites for delete to authenticated using (user_id = auth.uid());

drop policy if exists plans_all on public.plans;
create policy plans_select on public.plans for select to authenticated using (user_id = auth.uid());
create policy plans_insert on public.plans for insert to authenticated with check (user_id = auth.uid());
create policy plans_update on public.plans for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy plans_delete on public.plans for delete to authenticated using (user_id = auth.uid());

drop policy if exists debriefs_select on public.debriefs;
create policy debriefs_select on public.debriefs for select to authenticated using (user_id = auth.uid());
create policy debriefs_insert on public.debriefs for insert to authenticated with check (user_id = auth.uid());
create policy debriefs_update on public.debriefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy debriefs_delete on public.debriefs for delete to authenticated using (user_id = auth.uid());

drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges for select to authenticated using (true);
create policy badges_write on public.badges for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges for select to authenticated using (user_id = auth.uid());

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.sync_my_badges() to authenticated;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.product_visible(uuid) to authenticated;

alter function public.handle_new_user() owner to postgres;
alter function public.delete_own_account() owner to postgres;
alter function public.sync_my_badges() owner to postgres;
alter function public.is_admin() owner to postgres;
alter function public.protect_profile_role() owner to postgres;
alter function public.debrief_same_owner() owner to postgres;
alter function public.product_visible(uuid) owner to postgres;

do $$
begin
  execute 'alter role service_role bypassrls';
exception when undefined_object then null;
end $$;
