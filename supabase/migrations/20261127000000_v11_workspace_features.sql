-- ZeroDev Studio v1.1 — saved drafts, notification preferences, email queue,
-- and broader currency support. Review with the adult project owner and apply
-- only to the separate development Supabase project after the v1.0 migration.

-- 0. Canonical ticket-access helper. The original v1.0 migration used
-- broad active-staff policies; v1.1 replaces them with assigned-ticket access.
create or replace function public.can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.tickets t
     where t.id = p_ticket_id
       and (
         t.client_id = auth.uid()
         or exists (
           select 1
             from public.staff_members sm
            where sm.user_id = auth.uid()
              and sm.is_active = true
              and (
                sm.role in ('owner','administrator','project_manager','support')
                or (sm.role in ('developer','designer') and t.assigned_staff_id = auth.uid())
              )
         )
       )
  );
$$;
revoke all on function public.can_access_ticket(uuid) from public, anon;
grant execute on function public.can_access_ticket(uuid) to authenticated;

-- 0b. Tighten the v1.0 row policies to the access model already reviewed
-- during the v1.0 security audit. Clients see only their own tickets;
-- developers/designers see only tickets assigned to them; management roles
-- can manage the wider queue. Internal notes remain management-only.
drop policy if exists staff_select_own_or_staff on public.staff_members;
create policy staff_select_own_or_staff on public.staff_members
  for select to authenticated
  using (user_id = auth.uid() or public.can_manage_tickets());

drop policy if exists tickets_select_client_or_staff on public.tickets;
create policy tickets_select_client_or_staff on public.tickets
  for select to authenticated using (public.can_access_ticket(id));

drop policy if exists messages_select_ticket_member on public.ticket_messages;
create policy messages_select_ticket_member on public.ticket_messages
  for select to authenticated
  using (public.can_access_ticket(ticket_id) and (is_internal = false or public.can_manage_tickets()));

drop policy if exists messages_insert_member on public.ticket_messages;
create policy messages_insert_member on public.ticket_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      (public.is_active_staff() and public.can_access_ticket(ticket_id)
        and (is_internal = false or public.can_manage_tickets()))
      or
      (not public.is_active_staff() and is_internal = false and exists (
        select 1 from public.tickets t
         where t.id = ticket_messages.ticket_id
           and t.client_id = auth.uid()
           and t.status <> 'closed'
      ))
    )
  );

drop policy if exists attachments_select_ticket_member on public.ticket_attachments;
create policy attachments_select_ticket_member on public.ticket_attachments
  for select to authenticated using (public.can_access_ticket(ticket_id));

drop policy if exists attachments_insert_owner on public.ticket_attachments;
create policy attachments_insert_owner on public.ticket_attachments
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and storage_path like ticket_id::text || '/' || auth.uid()::text || '/%'
    and split_part(storage_path, '/', 3) <> ''
    and cardinality(string_to_array(storage_path, '/')) = 3
    and public.can_access_ticket(ticket_id)
  );

drop policy if exists events_select_ticket_member on public.ticket_events;
create policy events_select_ticket_member on public.ticket_events
  for select to authenticated using (public.can_access_ticket(ticket_id));

-- 1. Support the ISO currencies offered by the v1.1 country/currency selector.
alter table public.tickets drop constraint if exists tickets_budget_currency_check;
alter table public.tickets add constraint tickets_budget_currency_check
  check (budget_currency in ('PHP','USD','EUR','GBP','CAD','AUD','NZD','SGD','MYR','IDR','THB','VND','JPY','KRW','CNY','INR','AED','SAR','BRL','MXN','ZAR','CHF','HKD','TWD','TRY'));

alter table public.tickets drop constraint if exists tickets_quoted_currency_check;
alter table public.tickets add constraint tickets_quoted_currency_check
  check (quoted_currency in ('PHP','USD','EUR','GBP','CAD','AUD','NZD','SGD','MYR','IDR','THB','VND','JPY','KRW','CNY','INR','AED','SAR','BRL','MXN','ZAR','CHF','HKD','TWD','TRY'));

-- 1b. Make Storage reads follow ticket-level access, not blanket active-staff access.
-- Management can access the queue; developers/designers only their assigned tickets.
drop policy if exists ticket_files_upload_owner on storage.objects;
create policy ticket_files_upload_owner on storage.objects
for insert to authenticated
with check (
  bucket_id = 'ticket-attachments'
  and cardinality(string_to_array(name, '/')) = 3
  and split_part(name, '/', 1) <> ''
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) <> ''
  and exists (
    select 1 from public.tickets t
     where t.id::text = split_part(name, '/', 1)
       and public.can_access_ticket(t.id)
  )
);

drop policy if exists ticket_files_read_member on storage.objects;
create policy ticket_files_read_member on storage.objects
for select to authenticated
using (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1 from public.tickets t
     where t.id::text = split_part(name, '/', 1)
       and public.can_access_ticket(t.id)
  )
);

-- 2. Private server-side drafts. Attachments are intentionally not saved here.
create table if not exists public.ticket_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  service text check (service is null or service in ('business_website','landing_page','portfolio','ecommerce','custom','other')),
  budget_min numeric(12,2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(12,2) check (budget_max is null or budget_max >= 0),
  budget_currency text not null default 'PHP' check (budget_currency in ('PHP','USD','EUR','GBP','CAD','AUD','NZD','SGD','MYR','IDR','THB','VND','JPY','KRW','CNY','INR','AED','SAR','BRL','MXN','ZAR','CHF','HKD','TWD','TRY')),
  requested_deadline date,
  description text not null default '' check (char_length(description) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_drafts_budget_range check (budget_min is null or budget_max is null or budget_max >= budget_min)
);

create index if not exists ticket_drafts_user_updated_idx
  on public.ticket_drafts(user_id, updated_at desc);

alter table public.ticket_drafts enable row level security;
revoke all on table public.ticket_drafts from anon, authenticated;
grant select, delete on public.ticket_drafts to authenticated;
grant insert (user_id,title,service,budget_min,budget_max,budget_currency,requested_deadline,description) on public.ticket_drafts to authenticated;
grant update (title,service,budget_min,budget_max,budget_currency,requested_deadline,description) on public.ticket_drafts to authenticated;

drop policy if exists ticket_drafts_select_own on public.ticket_drafts;
create policy ticket_drafts_select_own on public.ticket_drafts
  for select to authenticated using (user_id = auth.uid());
drop policy if exists ticket_drafts_insert_verified on public.ticket_drafts;
create policy ticket_drafts_insert_verified on public.ticket_drafts
  for insert to authenticated with check (user_id = auth.uid() and public.is_verified_account());
drop policy if exists ticket_drafts_update_own on public.ticket_drafts;
create policy ticket_drafts_update_own on public.ticket_drafts
  for update to authenticated using (user_id = auth.uid() and public.is_verified_account())
  with check (user_id = auth.uid() and public.is_verified_account());
drop policy if exists ticket_drafts_delete_own on public.ticket_drafts;
create policy ticket_drafts_delete_own on public.ticket_drafts
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.touch_v11_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_v11_updated_at() from public, anon, authenticated;

drop trigger if exists ticket_drafts_touch_updated_at on public.ticket_drafts;
create trigger ticket_drafts_touch_updated_at
  before update on public.ticket_drafts
  for each row execute function public.touch_v11_updated_at();


-- 3a. Keep staff inbox metadata limited to roles that can access the ticket.
-- Developers/designers receive client-message alerts only when assigned.
create or replace function public.handle_ticket_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket_row record;
  staff_row record;
begin
  select t.id, t.client_id, t.ticket_number, t.title, t.assigned_staff_id
    into ticket_row
    from public.tickets t
   where t.id = new.ticket_id;

  if ticket_row.id is null then return new; end if;

  if exists (
    select 1 from public.staff_members sm
     where sm.user_id = new.sender_id and sm.is_active = true
  ) then
    if new.is_internal = false then
      insert into public.notifications(user_id,ticket_id,kind,title,body)
      values (ticket_row.client_id,ticket_row.id,'new_message','New project message',
              'ZeroDev Studio replied to ' || ticket_row.ticket_number);
    end if;
  else
    for staff_row in
      select sm.user_id
        from public.staff_members sm
       where sm.is_active = true
         and (
           sm.role in ('owner','administrator','project_manager','support')
           or sm.user_id = ticket_row.assigned_staff_id
         )
    loop
      insert into public.notifications(user_id,ticket_id,kind,title,body)
      values (staff_row.user_id,ticket_row.id,'new_message','New client message',
              ticket_row.ticket_number || ' · ' || ticket_row.title);
    end loop;
  end if;

  return new;
end;
$$;
revoke all on function public.handle_ticket_message_notification() from public, anon, authenticated;
drop trigger if exists messages_after_insert_notification on public.ticket_messages;
create trigger messages_after_insert_notification
  after insert on public.ticket_messages
  for each row execute function public.handle_ticket_message_notification();

-- 3b. Ensure assignment changes are consistently recorded and notify the
-- newly assigned active staff member. Existing status and quotation events
-- remain database generated and use the authenticated actor context.
create or replace function public.handle_ticket_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.ticket_events(ticket_id,actor_id,event_type,description)
    values (new.id,auth.uid(),'status_changed','Status changed from ' || old.status || ' to ' || new.status);
    insert into public.notifications(user_id,ticket_id,kind,title,body)
    values (new.client_id,new.id,'ticket_updated','Project status updated',new.ticket_number || ' is now ' || replace(new.status,'_',' '));
  end if;

  if new.quote_status is distinct from old.quote_status
     or new.quoted_amount is distinct from old.quoted_amount
     or new.quoted_currency is distinct from old.quoted_currency then
    insert into public.ticket_events(ticket_id,actor_id,event_type,description)
    values (new.id,auth.uid(),'quote_updated','Project quotation updated');
    insert into public.notifications(user_id,ticket_id,kind,title,body)
    values (new.client_id,new.id,'ticket_updated','Quotation updated','A quotation update is available for ' || new.ticket_number);
  end if;

  if new.assigned_staff_id is distinct from old.assigned_staff_id then
    insert into public.ticket_events(ticket_id,actor_id,event_type,description)
    values (new.id,auth.uid(),'assignment_changed','Project assignment updated');
    if new.assigned_staff_id is not null then
      insert into public.notifications(user_id,ticket_id,kind,title,body)
      values (new.assigned_staff_id,new.id,'ticket_updated','Project assigned to you','You have been assigned ' || new.ticket_number);
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.handle_ticket_status_event() from public, anon, authenticated;

-- 3. Optional email notification preferences. Email delivery is disabled by
-- default and only becomes operational after the private Edge Function worker
-- and provider secrets have been configured by the project owner.
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  email_on_messages boolean not null default true,
  email_on_project_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
revoke all on table public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (user_id,email_enabled,email_on_messages,email_on_project_updates) on public.notification_preferences to authenticated;
grant update (user_id,email_enabled,email_on_messages,email_on_project_updates) on public.notification_preferences to authenticated;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid() and public.is_verified_account());
drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated using (user_id = auth.uid() and public.is_verified_account())
  with check (user_id = auth.uid() and public.is_verified_account());

drop trigger if exists notification_preferences_touch_updated_at on public.notification_preferences;
create trigger notification_preferences_touch_updated_at
  before update on public.notification_preferences
  for each row execute function public.touch_v11_updated_at();

-- 4. Private email outbox. Browser roles receive no privileges at all.
create table if not exists public.email_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','skipped')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Safe for repeated/overlapping scheduler runs: claim jobs atomically and
-- recover a worker that stopped while holding a processing lease.
alter table public.email_notification_jobs
  drop constraint if exists email_notification_jobs_status_check;
alter table public.email_notification_jobs
  add constraint email_notification_jobs_status_check
  check (status in ('pending','processing','sent','failed','skipped'));
alter table public.email_notification_jobs
  add column if not exists locked_at timestamptz;

create index if not exists email_notification_jobs_pending_idx
  on public.email_notification_jobs(status, next_attempt_at, created_at);

alter table public.email_notification_jobs enable row level security;
revoke all on table public.email_notification_jobs from public, anon, authenticated;
grant all on table public.email_notification_jobs to service_role;

create or replace function public.claim_v11_email_jobs(p_limit integer default 25)
returns setof public.email_notification_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_notification_jobs j
     set status = 'failed', locked_at = null,
         last_error = coalesce(j.last_error, 'Worker lease expired after the final attempt.')
   where j.status = 'processing'
     and j.attempts >= 5
     and j.locked_at < now() - interval '15 minutes';

  return query
  with picked as (
    select j.id
      from public.email_notification_jobs j
     where (j.status = 'pending' and j.next_attempt_at <= now() and j.attempts < 5)
        or (j.status = 'processing' and j.attempts < 5 and j.locked_at < now() - interval '15 minutes')
     order by j.created_at asc
     limit greatest(1, least(coalesce(p_limit, 25), 25))
     for update skip locked
  )
  update public.email_notification_jobs j
     set status = 'processing', locked_at = now(), attempts = j.attempts + 1
    from picked
   where j.id = picked.id
  returning j.*;
end;
$$;
revoke all on function public.claim_v11_email_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_v11_email_jobs(integer) to service_role;

create or replace function public.queue_v11_email_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prefs public.notification_preferences%rowtype;
  is_verified boolean;
begin
  select * into prefs
    from public.notification_preferences np
   where np.user_id = new.user_id;

  if not found or prefs.email_enabled is not true then
    return new;
  end if;

  if new.kind = 'new_message' and prefs.email_on_messages is not true then
    return new;
  end if;

  if new.kind in ('ticket_created','ticket_updated') and prefs.email_on_project_updates is not true then
    return new;
  end if;

  select (u.email_confirmed_at is not null) into is_verified
    from auth.users u where u.id = new.user_id;

  if coalesce(is_verified,false) is not true then
    return new;
  end if;

  insert into public.email_notification_jobs(notification_id,recipient_user_id)
  values (new.id,new.user_id)
  on conflict (notification_id) do nothing;

  return new;
end;
$$;
revoke all on function public.queue_v11_email_notification() from public, anon, authenticated;

drop trigger if exists notifications_queue_email_v11 on public.notifications;
create trigger notifications_queue_email_v11
  after insert on public.notifications
  for each row execute function public.queue_v11_email_notification();

comment on table public.ticket_drafts is 'Private per-account project drafts. Attachments are not stored in drafts.';
comment on table public.notification_preferences is 'Per-account email update preferences; delivery requires the private worker.';
comment on table public.email_notification_jobs is 'Private transactional email outbox with atomic worker claims; consumed only by the service-role Edge Function.';
