# ZeroDev Studio v1.0 — Release and backend setup

v1.0 is the first complete **backend-ready ticketing release**. The source includes the public website, verified-account sign-in, registered-client project requests, private ticket messaging, a role-gated staff workspace, in-app notifications, ticket activity history, and private attachment storage.

It is deliberately shipped in `demo` mode. A ZIP file cannot provision a live Supabase project, SMTP sender, public domain, or real staff accounts. Do not switch to live mode until every step below has been reviewed and tested by the adult project owner.

## 1. What is operational in the source

- Public website, sample pricing tiers, NEW26 promo interface, light/dark/system appearance, support knowledge base, and the three sample websites.
- Account registration, email OTP verification, sign-in, password reset, and sign-out through Supabase Auth when live settings are configured.
- Registered and email-verified clients can submit a project ticket with a title, service type, budget range/currency, optional deadline, description, and up to five PDF/JPG/PNG/WEBP attachments (maximum 8 MiB each).
- Tickets receive a server-generated reference such as `ZD-2026-000001`.
- Clients can view only their own tickets, send client-visible messages, open signed links to their private attachments, and see ticket/quotation updates and in-app notifications.
- Active staff members can see tickets and messages. Owner, administrator, project manager, and support roles can update status and quotations. Developer and designer roles can review and reply but cannot change ticket status or quotation fields.
- Staff-only messages are hidden from clients through row-level security.
- NEW26 redemptions can be attached to one eligible ticket through a database function. The client cannot set the discount percentage directly.

## 2. Features intentionally not enabled in this release

- Guest tickets and guest-access email links. The account page still displays the guest-access concept, but the secure token-delivery flow is not enabled. Use a verified account for real submissions.
- Ticket email alerts and browser push notifications. In-app notifications are generated in the database. Email is currently used for Supabase account verification/recovery only, after SMTP setup.
- Automatic GCash collection, PayPal, payment checkout, or payment confirmation. GCash is currently the only accepted method and any actual transaction must be supervised by a parent/guardian. Never collect MPINs, OTPs, PINs, passwords, or banking credentials.
- Automatic quote acceptance or contract signing. A staff member can enter a quote/status, but the scope and terms must be confirmed outside the app before work/payment.
- Self-service staff enrollment or role changes. Staff membership is added manually by the owner in the database after verifying the person and their account.
- A live human support chat. The Support Center is a searchable help/FAQ area, not a real-time agent chat.

## 3. Prepare a separate Supabase project

1. Have a parent/guardian or authorized adult create and own a separate Supabase development project.
2. In Authentication settings, enable email confirmations and configure the branded confirmation template at `supabase/templates/confirm-signup.html`.
3. Configure custom SMTP in Supabase using an email provider account controlled by the adult project owner. Do not place SMTP credentials or provider API keys in this website.
4. Add the local test origins and the eventual HTTPS website URL to the Supabase Auth redirect allow list. Include the exact account path for password recovery.
5. In the SQL Editor, apply the migrations in this order:
   - `supabase/migrations/20261126000000_profiles.sql`
   - `supabase/migrations/20261126010000_promo_code_redemptions.sql`
   - `supabase/migrations/20261126020000_v10_ticket_system.sql`
6. Review the resulting tables, policies, private storage bucket, and database functions before using real customer data.

The v1 migration assumes the existing v0.6 profile table and v0.7 promotion tables have already been created.

## 4. Add the owner account safely

1. Register the intended owner account through the account page after the test project is configured.
2. Verify that email address using the delivered OTP.
3. The adult project owner must run the following SQL in the Supabase SQL Editor, replacing the sample address with the exact owner account email:

```sql
insert into public.staff_members (user_id, role, is_active)
select id, 'owner', true
from auth.users
where lower(email) = lower('owner@example.com')
on conflict (user_id) do update
set role = 'owner', is_active = true;
```

To add another staff account, first have that person create and verify their own account. Then the owner can insert the matching `auth.users.id` into `public.staff_members` with one of these roles: `administrator`, `project_manager`, `developer`, `designer`, or `support`.

Never add a staff-enrollment form to the public client signup process. Membership changes are intentionally unavailable to browser users.

## 5. Configure the browser-safe settings

Edit `js/backend-config.js` only after the database and email setup have been checked:

```js
window.ZERO_DEV_BACKEND_CONFIG = Object.freeze({
  provider: 'supabase',
  mode: 'live',
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabasePublishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY'
});
```

A Supabase publishable/anon key is intended for browser use. This does **not** make the database public: the row-level security policies in the migrations are the access-control boundary. Never add a service-role key, database password, SMTP password, or email-provider secret to this file, source code, screenshots, or a public repository.

For a first test, keep the URL and publishable key from the separate development project only. Confirm the page is served over localhost/HTTPS rather than opening the HTML via `file://`.

## 6. Test checklist before a real launch

- [ ] Registration sends a confirmation message to a controlled test inbox.
- [ ] Invalid/expired OTPs are rejected; verified accounts can sign in.
- [ ] Unverified accounts cannot create tickets.
- [ ] Client A cannot read Client B's tickets, messages, notifications, or attachments.
- [ ] Client A cannot create internal notes or change ticket status/quotation values.
- [ ] A non-staff account cannot access the staff workspace or staff ticket data.
- [ ] A developer/designer account can read/reply but cannot update status or quotation fields.
- [ ] A project manager/administrator/owner can update ticket status and quotation fields.
- [ ] Staff-only notes do not appear in the client message list.
- [ ] Private attachment URLs require authentication and expire.
- [ ] NEW26 attaches to no more than one project per account; the ticket discount cannot be browser-forged.
- [ ] In-app notifications are generated for new tickets, replies, status changes, and quote updates.
- [ ] Privacy notice, account terms, contact details, retention expectations, and adult-supervised payment arrangements have been reviewed.

Use two separate test client accounts and at least two staff roles to check the access boundaries. Do not use real customer files or details during development.

## 7. Deployment

The public pages can be hosted as static files on an HTTPS static host. The Supabase project remains a separately managed backend. Configure the real domain under Supabase Auth redirect settings, check all internal links, and test the live auth callback before inviting anyone.

The project is not a substitute for legal, accounting, or privacy advice. As the developer is under 18, a parent/guardian should own or supervise hosting, provider accounts, contracts, customer communications, and any real payments.
