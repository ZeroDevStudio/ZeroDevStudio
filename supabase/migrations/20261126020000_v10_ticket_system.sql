
-- ============================================================
-- ZeroDev Studio v1.0
-- Ticketing, staff access, messages, events, notifications,
-- private attachments, and promotion-to-ticket linking.
--
-- Development project only.
-- Requires migrations 1 and 2 to be applied first.
-- Review with the adult project owner before execution.
-- ============================================================


-- ============================================================
-- 1. EXTENSION AND SEQUENCE
-- ============================================================

create schema if not exists extensions;

create extension if not exists pgcrypto
with schema extensions;

do $$
declare
  v_extension_schema text;
begin
  select n.nspname
  into v_extension_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';

  if v_extension_schema is distinct from 'extensions' then
    raise exception
      'pgcrypto must be installed in the extensions schema. Current schema: %',
      coalesce(v_extension_schema, 'not installed');
  end if;
end;
$$;

create sequence if not exists public.ticket_number_seq;

revoke all on sequence public.ticket_number_seq
from public, anon, authenticated;


-- ============================================================
-- 2. STAFF MEMBERS
-- ============================================================

create table if not exists public.staff_members (
  user_id uuid primary key
    references auth.users(id) on delete cascade,

  role text not null check (
    role in (
      'owner',
      'administrator',
      'project_manager',
      'developer',
      'designer',
      'support'
    )
  ),

  is_active boolean not null default true,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 3. STAFF AND ACCOUNT HELPERS
-- ============================================================

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members sm
    where sm.user_id = auth.uid()
      and sm.is_active = true
  );
$$;


create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select sm.role
  from public.staff_members sm
  where sm.user_id = auth.uid()
    and sm.is_active = true
  limit 1;
$$;


-- Only management roles may change ticket status, assignments,
-- and quotations.
create or replace function public.can_manage_tickets()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_staff_role() in (
      'owner',
      'administrator',
      'project_manager',
      'support'
    ),
    false
  );
$$;


create or replace function public.is_verified_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;


-- ============================================================
-- 4. PROJECT TICKETS
-- ============================================================

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),

  ticket_number text unique,

  client_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  title text not null
    check (char_length(title) between 4 and 120),

  service text not null
    check (
      service in (
        'business_website',
        'landing_page',
        'portfolio',
        'ecommerce',
        'custom',
        'other'
      )
    ),

  budget_min numeric(12,2),
  budget_max numeric(12,2),

  budget_currency text not null default 'PHP'
    check (budget_currency in ('PHP', 'USD')),

  requested_deadline date,

  description text not null
    check (char_length(description) between 20 and 5000),

  status text not null default 'new'
    check (
      status in (
        'new',
        'under_review',
        'awaiting_client',
        'in_progress',
        'completed',
        'closed'
      )
    ),

  assigned_staff_id uuid
    references public.staff_members(user_id) on delete set null,

  quoted_amount numeric(12,2)
    check (quoted_amount is null or quoted_amount >= 0),

  quoted_currency text not null default 'PHP'
    check (quoted_currency in ('PHP', 'USD')),

  quote_status text not null default 'not_sent'
    check (
      quote_status in (
        'not_sent',
        'sent',
        'accepted',
        'declined'
      )
    ),

  promo_discount_percent integer not null default 0
    check (promo_discount_percent between 0 and 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tickets_budget_range
    check (
      budget_min is null
      or budget_max is null
      or budget_max >= budget_min
    )
);


-- ============================================================
-- 5. TICKET ACCESS HELPER
-- ============================================================

-- Clients can access their own tickets.
-- Management staff can access all tickets.
-- Developers and Designers can access assigned tickets only.

create or replace function public.can_access_ticket(
  p_ticket_id uuid
)
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
              sm.role in (
                'owner',
                'administrator',
                'project_manager',
                'support'
              )
              or (
                sm.role in ('developer', 'designer')
                and t.assigned_staff_id = auth.uid()
              )
            )
        )
      )
  );
$$;


-- ============================================================
-- 6. TICKET NUMBER GENERATION
-- ============================================================

create or replace function public.assign_ticket_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ticket_number is null then
    new.ticket_number :=
      'ZD-' ||
      to_char(now(), 'YYYY') ||
      '-' ||
      lpad(
        nextval('public.ticket_number_seq')::text,
        6,
        '0'
      );
  end if;

  new.updated_at := now();

  return new;
end;
$$;


drop trigger if exists tickets_assign_reference
on public.tickets;

create trigger tickets_assign_reference
before insert on public.tickets
for each row
execute function public.assign_ticket_number();


-- ============================================================
-- 7. UPDATED AT TRIGGER
-- ============================================================

create or replace function public.touch_ticket_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


drop trigger if exists tickets_touch_updated_at
on public.tickets;

create trigger tickets_touch_updated_at
before update on public.tickets
for each row
execute function public.touch_ticket_updated_at();


-- ============================================================
-- 8. VALIDATE STAFF ASSIGNMENTS
-- ============================================================

create or replace function public.validate_ticket_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_staff_id is not null
     and not exists (
       select 1
       from public.staff_members sm
       where sm.user_id = new.assigned_staff_id
         and sm.is_active = true
     ) then

    raise exception
      'Tickets can only be assigned to active staff members';

  end if;

  return new;
end;
$$;


drop trigger if exists tickets_validate_assignee
on public.tickets;

create trigger tickets_validate_assignee
before insert or update of assigned_staff_id
on public.tickets
for each row
execute function public.validate_ticket_assignment();


-- ============================================================
-- 9. TICKET MESSAGES
-- ============================================================

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),

  ticket_id uuid not null
    references public.tickets(id) on delete cascade,

  sender_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  body text not null
    check (char_length(body) between 1 and 5000),

  is_internal boolean not null default false,

  created_at timestamptz not null default now()
);


-- ============================================================
-- 10. TICKET ATTACHMENTS
-- ============================================================

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),

  ticket_id uuid not null
    references public.tickets(id) on delete cascade,

  uploaded_by uuid not null default auth.uid()
    references auth.users(id) on delete cascade,

  file_name text not null
    check (char_length(file_name) between 1 and 180),

  storage_path text not null unique,

  content_type text not null
    check (
      content_type in (
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
      )
    ),

  byte_size bigint not null
    check (byte_size between 1 and 8388608),

  created_at timestamptz not null default now()
);

-- The content_type and byte_size columns are supplied as metadata.
-- They do not independently prove the actual file contents.
-- The private Storage bucket enforces its configured upload limits.
-- Stronger file inspection requires server-side validation.


-- ============================================================
-- 11. TICKET EVENTS
-- ============================================================

create table if not exists public.ticket_events (
  id uuid primary key default gen_random_uuid(),

  ticket_id uuid not null
    references public.tickets(id) on delete cascade,

  actor_id uuid
    references auth.users(id) on delete set null,

  event_type text not null,
  description text not null,

  created_at timestamptz not null default now()
);


-- ============================================================
-- 12. NOTIFICATIONS
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  ticket_id uuid
    references public.tickets(id) on delete cascade,

  kind text not null
    check (
      kind in (
        'ticket_created',
        'ticket_updated',
        'new_message',
        'system'
      )
    ),

  title text not null,
  body text not null,

  read_at timestamptz,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 13. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.staff_members enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_events enable row level security;
alter table public.notifications enable row level security;


-- ============================================================
-- 14. REMOVE DEFAULT TABLE PERMISSIONS
-- ============================================================

revoke all on table public.staff_members
from public, anon, authenticated;

revoke all on table public.tickets
from public, anon, authenticated;

revoke all on table public.ticket_messages
from public, anon, authenticated;

revoke all on table public.ticket_attachments
from public, anon, authenticated;

revoke all on table public.ticket_events
from public, anon, authenticated;

revoke all on table public.notifications
from public, anon, authenticated;


-- ============================================================
-- 15. GRANT REQUIRED CLIENT PERMISSIONS
-- ============================================================

grant select on public.staff_members to authenticated;

grant select on public.tickets to authenticated;

grant insert (
  title,
  service,
  budget_min,
  budget_max,
  budget_currency,
  requested_deadline,
  description
)
on public.tickets to authenticated;

grant update (
  status,
  assigned_staff_id,
  quoted_amount,
  quoted_currency,
  quote_status
)
on public.tickets to authenticated;

grant select on public.ticket_messages to authenticated;

grant insert (
  ticket_id,
  body,
  is_internal
)
on public.ticket_messages to authenticated;

grant select on public.ticket_attachments to authenticated;

grant insert (
  ticket_id,
  file_name,
  storage_path,
  content_type,
  byte_size
)
on public.ticket_attachments to authenticated;

grant select on public.ticket_events to authenticated;

grant select on public.notifications to authenticated;

grant update (read_at)
on public.notifications to authenticated;


-- ============================================================
-- 16. HELPER FUNCTION EXECUTION PERMISSIONS
-- ============================================================

revoke all on function public.is_active_staff()
from public, anon, authenticated;

revoke all on function public.current_staff_role()
from public, anon, authenticated;

revoke all on function public.can_manage_tickets()
from public, anon, authenticated;

revoke all on function public.is_verified_account()
from public, anon, authenticated;

revoke all on function public.can_access_ticket(uuid)
from public, anon, authenticated;

grant execute on function public.is_active_staff()
to authenticated;

grant execute on function public.current_staff_role()
to authenticated;

grant execute on function public.can_manage_tickets()
to authenticated;

grant execute on function public.is_verified_account()
to authenticated;

grant execute on function public.can_access_ticket(uuid)
to authenticated;


-- ============================================================
-- 17. STAFF DIRECTORY POLICY
-- ============================================================

drop policy if exists staff_select_own_or_staff
on public.staff_members;

create policy staff_select_own_or_staff
on public.staff_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_tickets()
);


-- ============================================================
-- 18. TICKET ACCESS POLICIES
-- ============================================================

drop policy if exists tickets_select_client_or_staff
on public.tickets;

create policy tickets_select_client_or_staff
on public.tickets
for select
to authenticated
using (
  public.can_access_ticket(id)
);


drop policy if exists tickets_insert_verified_client
on public.tickets;

create policy tickets_insert_verified_client
on public.tickets
for insert
to authenticated
with check (
  client_id = auth.uid()
  and public.is_verified_account()
);


drop policy if exists tickets_update_manager
on public.tickets;

create policy tickets_update_manager
on public.tickets
for update
to authenticated
using (
  public.can_manage_tickets()
)
with check (
  public.can_manage_tickets()
);


-- ============================================================
-- 19. MESSAGE ACCESS POLICIES
-- ============================================================

drop policy if exists messages_select_ticket_member
on public.ticket_messages;

create policy messages_select_ticket_member
on public.ticket_messages
for select
to authenticated
using (
  public.can_access_ticket(ticket_id)
  and (
    is_internal = false
    or public.can_manage_tickets()
  )
);


drop policy if exists messages_insert_member
on public.ticket_messages;

create policy messages_insert_member
on public.ticket_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    (
      public.is_active_staff()
      and public.can_access_ticket(ticket_id)
      and (
        is_internal = false
        or public.can_manage_tickets()
      )
    )
    or
    (
      not public.is_active_staff()
      and is_internal = false
      and exists (
        select 1
        from public.tickets t
        where t.id = ticket_id
          and t.client_id = auth.uid()
          and t.status <> 'closed'
      )
    )
  )
);


-- ============================================================
-- 20. ATTACHMENT METADATA POLICIES
-- ============================================================

drop policy if exists attachments_select_ticket_member
on public.ticket_attachments;

create policy attachments_select_ticket_member
on public.ticket_attachments
for select
to authenticated
using (
  public.can_access_ticket(ticket_id)
);


drop policy if exists attachments_insert_owner
on public.ticket_attachments;

create policy attachments_insert_owner
on public.ticket_attachments
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and storage_path like
    ticket_id::text || '/' || auth.uid()::text || '/%'
  and split_part(storage_path, '/', 3) <> ''
  and public.can_access_ticket(ticket_id)
);


-- ============================================================
-- 21. EVENT ACCESS POLICY
-- ============================================================

drop policy if exists events_select_ticket_member
on public.ticket_events;

create policy events_select_ticket_member
on public.ticket_events
for select
to authenticated
using (
  public.can_access_ticket(ticket_id)
);


-- ============================================================
-- 22. NOTIFICATION POLICIES
-- ============================================================

drop policy if exists notifications_select_own
on public.notifications;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
);


drop policy if exists notifications_update_own
on public.notifications;

create policy notifications_update_own
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


-- ============================================================
-- 23. NEW TICKET EVENT AND MANAGEMENT NOTIFICATIONS
-- ============================================================

create or replace function public.handle_ticket_insert_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_row record;
begin

  insert into public.ticket_events (
    ticket_id,
    actor_id,
    event_type,
    description
  )
  values (
    new.id,
    new.client_id,
    'ticket_created',
    'Project request submitted'
  );

  -- Notify management staff, not every developer or designer.
  for staff_row in
    select sm.user_id
    from public.staff_members sm
    where sm.is_active = true
      and sm.role in (
        'owner',
        'administrator',
        'project_manager',
        'support'
      )
  loop

    insert into public.notifications (
      user_id,
      ticket_id,
      kind,
      title,
      body
    )
    values (
      staff_row.user_id,
      new.id,
      'ticket_created',
      'New project request',
      new.ticket_number || ' · ' || new.title
    );

  end loop;

  return new;
end;
$$;


drop trigger if exists tickets_after_insert_event
on public.tickets;

create trigger tickets_after_insert_event
after insert on public.tickets
for each row
execute function public.handle_ticket_insert_event();


-- ============================================================
-- 24. STATUS, QUOTATION AND ASSIGNMENT EVENTS
-- ============================================================

create or replace function public.handle_ticket_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  if new.status is distinct from old.status then

    insert into public.ticket_events (
      ticket_id,
      actor_id,
      event_type,
      description
    )
    values (
      new.id,
      auth.uid(),
      'status_changed',
      'Status changed from ' || old.status || ' to ' || new.status
    );

    insert into public.notifications (
      user_id,
      ticket_id,
      kind,
      title,
      body
    )
    values (
      new.client_id,
      new.id,
      'ticket_updated',
      'Project status updated',
      new.ticket_number || ' is now ' ||
        replace(new.status, '_', ' ')
    );

  end if;


  if new.quote_status is distinct from old.quote_status
     or new.quoted_amount is distinct from old.quoted_amount
     or new.quoted_currency is distinct from old.quoted_currency then

    insert into public.ticket_events (
      ticket_id,
      actor_id,
      event_type,
      description
    )
    values (
      new.id,
      auth.uid(),
      'quote_updated',
      'Project quotation updated'
    );

    insert into public.notifications (
      user_id,
      ticket_id,
      kind,
      title,
      body
    )
    values (
      new.client_id,
      new.id,
      'ticket_updated',
      'Quotation updated',
      'A quotation update is available for ' || new.ticket_number
    );

  end if;


  if new.assigned_staff_id is distinct from old.assigned_staff_id then

    insert into public.ticket_events (
      ticket_id,
      actor_id,
      event_type,
      description
    )
    values (
      new.id,
      auth.uid(),
      'assignment_changed',
      'Project assignment updated'
    );

    if new.assigned_staff_id is not null then
      insert into public.notifications (
        user_id,
        ticket_id,
        kind,
        title,
        body
      )
      values (
        new.assigned_staff_id,
        new.id,
        'ticket_updated',
        'Project assigned to you',
        'You have been assigned ' || new.ticket_number
      );
    end if;

  end if;

  return new;
end;
$$;


drop trigger if exists tickets_after_update_event
on public.tickets;

create trigger tickets_after_update_event
after update on public.tickets
for each row
execute function public.handle_ticket_status_event();


-- ============================================================
-- 25. MESSAGE NOTIFICATIONS
-- ============================================================

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

  select
    t.id,
    t.client_id,
    t.ticket_number,
    t.title,
    t.assigned_staff_id
  into ticket_row
  from public.tickets t
  where t.id = new.ticket_id;

  if ticket_row.id is null then
    return new;
  end if;


  -- A staff reply visible to the client triggers a client notification.
  if exists (
    select 1
    from public.staff_members sm
    where sm.user_id = new.sender_id
      and sm.is_active = true
  ) then

    if new.is_internal = false then

      insert into public.notifications (
        user_id,
        ticket_id,
        kind,
        title,
        body
      )
      values (
        ticket_row.client_id,
        ticket_row.id,
        'new_message',
        'New project message',
        'ZeroDev Studio replied to ' || ticket_row.ticket_number
      );

    end if;


  -- A client reply notifies management and the assigned staff member.
  else

    for staff_row in
      select sm.user_id
      from public.staff_members sm
      where sm.is_active = true
        and (
          sm.role in (
            'owner',
            'administrator',
            'project_manager',
            'support'
          )
          or sm.user_id = ticket_row.assigned_staff_id
        )
    loop

      insert into public.notifications (
        user_id,
        ticket_id,
        kind,
        title,
        body
      )
      values (
        staff_row.user_id,
        ticket_row.id,
        'new_message',
        'New client message',
        ticket_row.ticket_number || ' · ' || ticket_row.title
      );

    end loop;

  end if;

  return new;
end;
$$;


drop trigger if exists messages_after_insert_notification
on public.ticket_messages;

create trigger messages_after_insert_notification
after insert on public.ticket_messages
for each row
execute function public.handle_ticket_message_notification();


-- ============================================================
-- 26. PRIVATE ATTACHMENT STORAGE
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  8388608,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id)
do update set
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = excluded.allowed_mime_types;


-- Files use this structure:
-- ticket UUID / uploading user's UUID / filename
--
-- Clients can upload to their own ticket.
-- Management and assigned staff can upload to accessible tickets.

drop policy if exists ticket_files_upload_owner
on storage.objects;

create policy ticket_files_upload_owner
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ticket-attachments'
  and split_part(name, '/', 1) <> ''
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) <> ''
  and exists (
    select 1
    from public.tickets t
    where t.id::text = split_part(name, '/', 1)
      and public.can_access_ticket(t.id)
  )
);


drop policy if exists ticket_files_read_member
on storage.objects;

create policy ticket_files_read_member
on storage.objects
for select
to authenticated
using (
  bucket_id = 'ticket-attachments'
  and exists (
    select 1
    from public.tickets t
    where t.id::text = split_part(name, '/', 1)
      and public.can_access_ticket(t.id)
  )
);


-- ============================================================
-- 27. CONNECT PROMOTION REDEMPTIONS TO PROJECT TICKETS
-- ============================================================

alter table public.promo_redemptions
add column if not exists ticket_id uuid unique
references public.tickets(id) on delete set null;


-- ============================================================
-- 28. ATTACH A REDEEMED NEW26 PROMOTION
-- ============================================================

create or replace function public.attach_promo_to_ticket(
  p_ticket_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_redemption_id uuid;
  v_percent integer;
begin

  if v_user_id is null then
    raise exception 'Sign in before using a promotion';
  end if;

  if not public.is_verified_account() then
    raise exception
      'Verify your email before applying a promotion';
  end if;

  if not exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and t.client_id = v_user_id
  ) then
    raise exception
      'Project ticket not found for this account';
  end if;

  if exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and t.promo_discount_percent <> 0
  ) then
    raise exception
      'A promotion has already been attached to this ticket';
  end if;


  -- Only an already-redeemed NEW26 promotion may be attached.
  -- Lock the redemption row so two concurrent requests cannot reuse it.

  select
    pr.id,
    pr.discount_percent
  into
    v_redemption_id,
    v_percent
  from public.promo_redemptions pr
  join public.promo_codes pc
    on pc.id = pr.promo_code_id
  where pr.user_id = v_user_id
    and pr.ticket_id is null
    and pc.code_hash = encode(
      extensions.digest('NEW26', 'sha256'),
      'hex'
    )
  order by pr.redeemed_at asc
  limit 1
  for update of pr;


  if v_redemption_id is null then
    return 0;
  end if;


  update public.promo_redemptions
  set ticket_id = p_ticket_id
  where id = v_redemption_id;


  update public.tickets
  set promo_discount_percent = v_percent
  where id = p_ticket_id
    and client_id = v_user_id;


  return v_percent;

end;
$$;


-- ============================================================
-- 29. FUNCTION EXECUTION PERMISSIONS
-- ============================================================

-- Trigger-only functions must not be exposed as browser RPCs.

revoke all on function public.assign_ticket_number()
from public, anon, authenticated;

revoke all on function public.touch_ticket_updated_at()
from public, anon, authenticated;

revoke all on function public.validate_ticket_assignment()
from public, anon, authenticated;

revoke all on function public.handle_ticket_insert_event()
from public, anon, authenticated;

revoke all on function public.handle_ticket_status_event()
from public, anon, authenticated;

revoke all on function public.handle_ticket_message_notification()
from public, anon, authenticated;


-- Only authenticated users may invoke this function.
-- It checks account ownership inside the function.

revoke all on function public.attach_promo_to_ticket(uuid)
from public, anon, authenticated;

grant execute on function public.attach_promo_to_ticket(uuid)
to authenticated;


-- ============================================================
-- 30. STAFF ENROLLMENT
-- ============================================================

-- Never permit public staff self-registration.
-- The first owner and additional staff must be enrolled manually
-- by the adult project owner using reviewed administrative SQL.
--
-- See docs/V1_RELEASE_SETUP.md.


-- ============================================================
-- END OF ZERO DEV STUDIO V1.0 TICKET MIGRATION
-- ============================================================
