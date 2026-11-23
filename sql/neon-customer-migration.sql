-- Customer authentication/profile, order, and inquiry foundation for Neon.
-- Apply only after reviewing docs/neon-customer-migration.md and confirming
-- the Neon Data API exposes the `authenticated` role and `hansol_catalog` table.
-- This file does not touch Supabase or Storage.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.hansol_member_profiles (
  user_id text primary key,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hansol_member_profile_object check (jsonb_typeof(profile) = 'object')
);

create table if not exists public.hansol_shop_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  customer_id text not null,
  recipient text not null,
  phone text not null,
  address text not null,
  customs text not null default '',
  lines jsonb not null,
  total_krw bigint not null check (total_krw >= 0),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint hansol_order_lines_array check (jsonb_typeof(lines) = 'array')
);

create index if not exists hansol_shop_orders_customer_created_idx
  on public.hansol_shop_orders(customer_id, created_at desc);

create table if not exists public.hansol_shop_inquiries (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  customer_id text not null,
  subject text not null,
  message text not null,
  reply text,
  replied_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hansol_shop_inquiries_customer_created_idx
  on public.hansol_shop_inquiries(customer_id, created_at desc);

create or replace function public.hansol_current_user_id()
returns text
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  claims jsonb;
  subject text;
begin
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  subject := coalesce(claims ->> 'sub', current_setting('request.jwt.claim.sub', true));
  if subject is null or subject = '' then
    raise exception using message = 'AUTH_REQUIRED', errcode = '42501';
  end if;
  return subject;
end;
$$;

create or replace function public.hansol_signup_ready()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select to_regclass('public.hansol_member_profiles') is not null
     and to_regclass('public.hansol_shop_orders') is not null
     and to_regclass('public.hansol_shop_inquiries') is not null
$$;

create or replace function public.hansol_shop_ready()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select to_regclass('public.hansol_catalog') is not null
     and to_regclass('public.hansol_shop_orders') is not null
     and to_regclass('public.hansol_shop_inquiries') is not null
$$;

create or replace function public.hansol_complete_signup(p_profile jsonb)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  claims jsonb;
  member_id text := public.hansol_current_user_id();
begin
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  if coalesce(claims ->> 'email_verified', claims ->> 'emailVerified', 'false') <> 'true' then
    raise exception using message = 'EMAIL_REQUIRED', errcode = '42501';
  end if;
  if jsonb_typeof(p_profile) <> 'object'
     or coalesce(trim(p_profile ->> 'shop_name'), '') = ''
     or coalesce(trim(p_profile ->> 'shop_phone'), '') = ''
     or coalesce(trim(p_profile ->> 'shop_addr'), '') = '' then
    raise exception using message = 'INVALID_PROFILE', errcode = '22023';
  end if;
  insert into public.hansol_member_profiles(user_id, profile)
  values (member_id, p_profile || jsonb_build_object('hansol_member', true))
  on conflict (user_id) do update
    set profile = excluded.profile, updated_at = now();
  return true;
end;
$$;

create or replace function public.hansol_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((select profile from public.hansol_member_profiles
                   where user_id = public.hansol_current_user_id()), '{}'::jsonb)
$$;

create or replace function public.hansol_submit_order(
  p_id uuid,
  p_lines jsonb,
  p_recipient text,
  p_phone text,
  p_address text,
  p_customs text default ''
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  member_id text := public.hansol_current_user_id();
  catalog_row public.hansol_catalog%rowtype;
  requested jsonb;
  item jsonb;
  saved_lines jsonb := '[]'::jsonb;
  updated_items jsonb;
  item_id bigint;
  qty integer;
  unit_price bigint;
  available integer;
  total bigint := 0;
  order_id uuid;
begin
  if p_id is null then raise exception using message = 'INVALID_ORDER', errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select id into order_id from public.hansol_shop_orders where request_id = p_id and customer_id = member_id;
  if order_id is not null then return order_id; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception using message = 'INVALID_ORDER', errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) < 1
     or jsonb_array_length(p_lines) > 50
     or coalesce(trim(p_recipient), '') = ''
     or coalesce(trim(p_phone), '') = ''
     or length(coalesce(p_address, '')) < 5
     or length(p_address) > 350
     or (coalesce(p_customs, '') <> '' and upper(p_customs) !~ '^P[0-9]{12}$') then
    raise exception using message = 'INVALID_ORDER', errcode = '22023';
  end if;

  -- Lock the catalog row so two concurrent orders cannot oversell the same stock.
  select * into catalog_row from public.hansol_catalog where id = 1 for update;
  if not found then raise exception using message = 'SHOP_NOT_READY', errcode = '55000'; end if;
  updated_items := catalog_row.items;

  for requested in select value from jsonb_array_elements(p_lines) loop
    begin
      item_id := (requested ->> 'id')::bigint;
      qty := (requested ->> 'qty')::integer;
    exception when others then
      raise exception using message = 'INVALID_ORDER', errcode = '22023';
    end;
    if qty is null or qty < 1 or qty > 999 then raise exception using message = 'INVALID_ORDER', errcode = '22023'; end if;

    select value into item from jsonb_array_elements(updated_items) where (value ->> 'id')::bigint = item_id;
    if item is null then raise exception using message = 'INVALID_ORDER', errcode = '22023'; end if;
    if coalesce((item ->> 'soldOut')::boolean, false) then
      raise exception using message = 'OUT_OF_STOCK', errcode = 'P0001';
    end if;
    if coalesce(item ->> 'price', '') !~ '^[0-9]+$' then
      raise exception using message = 'PRICE_CHANGED', errcode = 'P0001';
    end if;
    unit_price := (item ->> 'price')::bigint;
    if coalesce((requested ->> 'price')::bigint, -1) <> unit_price then
      raise exception using message = 'PRICE_CHANGED', errcode = 'P0001';
    end if;
    if coalesce(item ->> 'stock', '') !~ '^[0-9]+$' then
      raise exception using message = 'OUT_OF_STOCK', errcode = 'P0001';
    end if;
    available := (item ->> 'stock')::integer;
    if available < qty then raise exception using message = 'OUT_OF_STOCK', errcode = 'P0001'; end if;

    total := total + unit_price * qty;
    saved_lines := saved_lines || jsonb_build_array(jsonb_build_object(
      'id', item_id, 'name', item ->> 'name', 'qty', qty, 'price', unit_price
    ));
    updated_items := (
      select jsonb_agg(case when (value ->> 'id')::bigint = item_id
        then jsonb_set(value, '{stock}', to_jsonb(available - qty), true)
        else value end order by ordinality)
      from jsonb_array_elements(updated_items) with ordinality
    );
  end loop;

  update public.hansol_catalog set items = updated_items, revision = revision + 1 where id = 1;
  insert into public.hansol_shop_orders(request_id, customer_id, recipient, phone, address,
    customs, lines, total_krw)
  values (p_id, member_id, trim(p_recipient), trim(p_phone), p_address,
    upper(coalesce(p_customs, '')), saved_lines, total)
  returning id into order_id;
  return order_id;
end;
$$;

create or replace function public.hansol_submit_inquiry(p_id uuid, p_subject text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  member_id text := public.hansol_current_user_id();
  inquiry_id uuid;
begin
  if p_id is null then raise exception using message = 'INVALID_INQUIRY', errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  select id into inquiry_id from public.hansol_shop_inquiries where request_id = p_id and customer_id = member_id;
  if inquiry_id is not null then return inquiry_id; end if;
  if length(trim(coalesce(p_subject, ''))) not between 1 and 100
     or length(trim(coalesce(p_message, ''))) not between 1 and 2000 then
    raise exception using message = 'INVALID_INQUIRY', errcode = '22023';
  end if;
  if exists (select 1 from public.hansol_shop_inquiries
             where customer_id = member_id and created_at > now() - interval '1 minute') then
    raise exception using message = 'INQUIRY_RATE_LIMIT', errcode = 'P0001';
  end if;
  insert into public.hansol_shop_inquiries(request_id, customer_id, subject, message)
  values (p_id, member_id, trim(p_subject), trim(p_message)) returning id into inquiry_id;
  return inquiry_id;
end;
$$;

-- Keep direct table access closed. The UI calls the narrowly scoped RPCs only.
alter table public.hansol_member_profiles enable row level security;
alter table public.hansol_shop_orders enable row level security;
alter table public.hansol_shop_inquiries enable row level security;
revoke all on function public.hansol_signup_ready() from public;
revoke all on function public.hansol_shop_ready() from public;
revoke all on public.hansol_member_profiles, public.hansol_shop_orders,
  public.hansol_shop_inquiries from public;
revoke all on function public.hansol_current_user_id() from public;
revoke all on function public.hansol_complete_signup(jsonb) from public;
revoke all on function public.hansol_my_profile() from public;
revoke all on function public.hansol_submit_order(uuid, jsonb, text, text, text, text) from public;
revoke all on function public.hansol_submit_inquiry(uuid, text, text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on public.hansol_member_profiles, public.hansol_shop_orders,
      public.hansol_shop_inquiries from authenticated;
    grant execute on function public.hansol_signup_ready() to authenticated;
    grant execute on function public.hansol_shop_ready() to authenticated;
    grant execute on function public.hansol_complete_signup(jsonb) to authenticated;
    grant execute on function public.hansol_my_profile() to authenticated;
    grant execute on function public.hansol_submit_order(uuid, jsonb, text, text, text, text) to authenticated;
    grant execute on function public.hansol_submit_inquiry(uuid, text, text) to authenticated;
  end if;
end;
$$;

commit;
