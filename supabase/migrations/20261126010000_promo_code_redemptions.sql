-- ZeroDev Studio v0.7: NEW26 one-time-per-account promotion.
-- Run in a separate test Supabase project only after the adult project owner
-- has reviewed the offer terms and authentication settings.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  public_label text not null,
  discount_percent integer not null check (discount_percent between 1 and 100),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint promo_code_valid_window check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  discount_percent integer not null check (discount_percent between 1 and 100),
  redeemed_at timestamptz not null default now(),
  unique (promo_code_id, user_id)
);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
revoke all on table public.promo_codes from anon, authenticated;
revoke all on table public.promo_redemptions from anon, authenticated;

-- The public easter egg intentionally reveals the label. The database stores
-- only its SHA-256 hash, and the browser cannot read the promo tables directly.
insert into public.promo_codes (code_hash, public_label, discount_percent, is_active)
values (
  encode(extensions.digest('NEW26', 'sha256'), 'hex'),
  'NEW26',
  10,
  true
)
on conflict (code_hash) do nothing;

create or replace function public.redeem_promo_code(p_code text)
returns table (discount_percent integer, redeemed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code_hash text;
  v_promo_id uuid;
  v_discount_percent integer;
  v_redeemed_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Sign in with a verified account to redeem this code';
  end if;

  if not exists (
    select 1
      from auth.users as u
     where u.id = v_user_id
       and u.email_confirmed_at is not null
  ) then
    raise exception 'Verify your email address before redeeming this code';
  end if;

  if p_code is null or length(btrim(p_code)) < 3 or length(btrim(p_code)) > 32 then
    raise exception 'Invalid promotion code';
  end if;

  v_code_hash := encode(extensions.digest(upper(btrim(p_code)), 'sha256'), 'hex');

  select pc.id, pc.discount_percent
    into v_promo_id, v_discount_percent
    from public.promo_codes as pc
   where pc.code_hash = v_code_hash
     and pc.is_active = true
     and pc.starts_at <= now()
     and (pc.ends_at is null or pc.ends_at > now());

  if v_promo_id is null then
    raise exception 'Invalid, inactive, or expired promotion code';
  end if;

  insert into public.promo_redemptions (promo_code_id, user_id, discount_percent)
  values (v_promo_id, v_user_id, v_discount_percent)
  on conflict (promo_code_id, user_id) do nothing
  returning public.promo_redemptions.redeemed_at into v_redeemed_at;

  if v_redeemed_at is null then
    raise exception 'This account has already redeemed this promotion';
  end if;

  return query select v_discount_percent, v_redeemed_at;
end;
$$;

create or replace function public.get_my_promo_status()
returns table (code_label text, discount_percent integer, redeemed_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select pc.public_label, pr.discount_percent, pr.redeemed_at
    from public.promo_redemptions as pr
    join public.promo_codes as pc on pc.id = pr.promo_code_id
   where pr.user_id = auth.uid()
   order by pr.redeemed_at desc
   limit 1;
$$;

revoke all on function public.redeem_promo_code(text) from public, anon;
revoke all on function public.get_my_promo_status() from public, anon;
grant execute on function public.redeem_promo_code(text) to authenticated;
grant execute on function public.get_my_promo_status() to authenticated;
