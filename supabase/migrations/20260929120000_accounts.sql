-- Inscriptions, codes d'invitation et actions d'administration des comptes.
-- Les fonctions qui touchent auth.users sont SECURITY DEFINER : le navigateur
-- n'utilise jamais la clé service_role.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('signup_mode', 'closed'), ('email_autoconfirm', 'false')
on conflict (key) do nothing;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 6 and 40),
  note text check (note is null or char_length(note) <= 200),
  active boolean not null default true,
  max_uses integer not null default 1 check (max_uses between 1 and 1000),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
alter table public.invitations enable row level security;

drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings
  for select to authenticated
  using (public.is_admin());

drop policy if exists invitations_admin on public.invitations;
create policy invitations_admin on public.invitations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.signup_policy()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'mode', coalesce((select value from public.app_settings where key = 'signup_mode'), 'closed'),
    'email_confirmation', coalesce((select value from public.app_settings where key = 'email_autoconfirm'), 'false') <> 'true'
  );
$$;

create or replace function public.enforce_signup_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mode text;
  invite_code text;
  consumed uuid;
begin
  if coalesce(current_setting('app.account_source', true), '') = 'admin' then
    return new;
  end if;

  select value into mode from public.app_settings where key = 'signup_mode';
  mode := coalesce(mode, 'closed');

  if mode = 'invite' then
    invite_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'invitation_code', '')));
    update public.invitations
      set use_count = use_count + 1
      where code = invite_code
        and active
        and use_count < max_uses
        and (expires_at is null or expires_at > now())
      returning id into consumed;
    if consumed is null then
      raise exception 'invitation invalide' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists auth_enforce_signup_policy on auth.users;
create trigger auth_enforce_signup_policy
  before insert on auth.users
  for each row execute function public.enforce_signup_policy();

create or replace function public.admin_list_accounts()
returns table (
  id uuid,
  email text,
  pseudo text,
  role public.app_role,
  active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select users.id, users.email::text, profiles.pseudo, profiles.role,
    (users.banned_until is null or users.banned_until <= now()),
    users.created_at
  from auth.users as users
  join public.profiles as profiles on profiles.id = users.id
  order by users.created_at desc;
end;
$$;

create or replace function public.admin_create_account(p_email text, p_password text, p_pseudo text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_id uuid := gen_random_uuid();
  clean_email text := lower(trim(p_email));
  clean_pseudo text := trim(p_pseudo);
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email invalide' using errcode = '22023';
  end if;
  if char_length(p_password) < 8 or char_length(p_password) > 72 then
    raise exception 'mot de passe invalide' using errcode = '22023';
  end if;
  if char_length(clean_pseudo) < 2 or char_length(clean_pseudo) > 40 then
    raise exception 'pseudo invalide' using errcode = '22023';
  end if;

  perform set_config('app.account_source', 'admin', true);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_id,
    'authenticated',
    'authenticated',
    clean_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('pseudo', clean_pseudo),
    now(),
    now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    new_id,
    jsonb_build_object('sub', new_id::text, 'email', clean_email),
    'email',
    new_id::text,
    now(),
    now(),
    now()
  );

  return new_id;
end;
$$;

create or replace function public.admin_set_account_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'action impossible sur votre propre compte' using errcode = '42501';
  end if;
  update auth.users
    set banned_until = case when p_active then null else 'infinity'::timestamptz end,
        updated_at = now()
    where id = p_user_id;
  if not found then
    raise exception 'compte introuvable' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.tables_without_rls()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity
  order by c.relname;
$$;

revoke all on function public.signup_policy() from public;
revoke all on function public.admin_list_accounts() from public;
revoke all on function public.admin_create_account(text, text, text) from public;
revoke all on function public.admin_set_account_active(uuid, boolean) from public;
revoke all on function public.tables_without_rls() from public;
revoke all on function public.enforce_signup_policy() from public;

grant execute on function public.signup_policy() to anon, authenticated;
grant execute on function public.admin_list_accounts() to authenticated;
grant execute on function public.admin_create_account(text, text, text) to authenticated;
grant execute on function public.admin_set_account_active(uuid, boolean) to authenticated;
grant execute on function public.tables_without_rls() to service_role;

alter function public.signup_policy() owner to postgres;
alter function public.enforce_signup_policy() owner to postgres;
alter function public.admin_list_accounts() owner to postgres;
alter function public.admin_create_account(text, text, text) owner to postgres;
alter function public.admin_set_account_active(uuid, boolean) owner to postgres;
alter function public.tables_without_rls() owner to postgres;
