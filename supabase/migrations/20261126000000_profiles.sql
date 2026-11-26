
-- ZeroDev Studio v1.0
-- Client profile table and automatic profile creation.
-- Development project only. Reviewed with adult project owner.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

-- Enable row-level security.
alter table public.profiles enable row level security;

-- Deny direct browser writes and begin with no table access.
revoke all on table public.profiles
from public, anon, authenticated;

-- Authenticated users may read their own profile only.
grant select on table public.profiles to authenticated;

drop policy if exists profiles_select_own
on public.profiles;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);


-- Automatically create a profile when a new Auth user is created.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      ''
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


drop trigger if exists on_auth_user_created_profile
on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();


-- Restrict direct execution of this trigger-only function.
revoke all on function public.handle_new_user_profile()
from public, anon, authenticated;


-- Backfill profiles for Auth accounts that already exist.
insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    ''
  )
from auth.users u
on conflict (id) do nothing;
