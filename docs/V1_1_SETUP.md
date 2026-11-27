# ZeroDev Studio v1.1 — Development setup and release checklist

This document is for the adult project owner or authorized adult supervising the project. The v1.1 ZIP is shipped in demo mode. Keep production separate and unchanged while validating the new version.

## 1. Keep the source safe

- Open the inner `ZeroDevStudio` folder.
- Keep `js/backend-config.js` at `mode: 'demo'` during local preview.
- Never paste service-role keys, SMTP passwords, Resend API keys, database passwords, worker secrets, or access tokens into browser JavaScript or a public repository.
- The only Supabase values permitted in `backend-config.js` after an adult-reviewed development setup are the project URL and publishable key. RLS must protect every exposed table.
- Review `supabase/migrations/20261127000000_v11_workspace_features.sql` before applying it.

## 2. Apply the migration

The earlier development project in the v1.0 audit already had the first three migrations applied. For that project, apply **only**:

`supabase/migrations/20261127000000_v11_workspace_features.sql`

For a brand-new development project, apply in this order:

1. `20261126000000_profiles.sql`
2. `20261126010000_promo_code_redemptions.sql`
3. `20261126020000_v10_ticket_system.sql`
4. `20261127000000_v11_workspace_features.sql`

The v1.1 migration:

- Expands allowed budget/quotation currencies to the list presented by the website.
- Adds `ticket_drafts` with per-user RLS; attachments are not stored in drafts.
- Refines message notification fan-out so ordinary developers/designers receive client-message alerts only for assigned tickets, while management roles receive the management queue alerts.
- Defines `can_access_ticket()` and tightens ticket, staff, message, attachment-metadata, and ticket-event RLS to client ownership, management roles, or a developer/designer assignment as appropriate. Internal notes remain management-only.
- Tightens private Storage read/write policies to ticket access and an exact `ticket-id/user-id/file-name` path. The staff UI does not include staff-side file uploads.
- Records assignment changes in ticket events and alerts a newly assigned staff member.
- Adds `notification_preferences`, with `email_enabled=false` by default.
- Adds a private `email_notification_jobs` outbox and an atomic `claim_v11_email_jobs()` function for the worker. Browser roles have no outbox privileges.

After applying it, check that the migration succeeded, the draft/preferences tables have RLS enabled, the outbox is not readable by `anon` or `authenticated`, and only `service_role` can execute the job-claim function. Do not add public staff enrollment.

## 3. Configure Supabase Auth email verification

A responsible adult should own the Supabase organization/project and email sender.

1. Enable email confirmations in Supabase Auth.
2. Install `supabase/templates/confirm-signup.html` in Authentication → Email Templates → Confirm signup. Keep the `{{ .Token }}` placeholder intact.
3. Set the correct development Site URL and explicit redirect allow-list entries for the account page and the development site. Add the eventual production URL only after review.
4. Configure custom SMTP using credentials entered directly in the Supabase dashboard/provider console. Verify the sender domain and configure SPF/DKIM/DMARC with the domain host.
5. Set the Supabase password policy to match or exceed the website's 12-character front-end minimum. Enable bot/CAPTCHA protection and provider-side Auth rate limits where appropriate.
6. Test signup OTP, resend, wrong/expired code, sign-in, password recovery, password update, and email change using adult-owned test inboxes.

The built-in Supabase email sender is for trial use, sends only to pre-authorized organization-team addresses, and currently has a limit of 2 emails per hour. Configure custom SMTP before testing with arbitrary inboxes or using real customers. Check current provider limits again before launch.

## 4. Configure the development front end

Only after the above project settings and migration have been reviewed, an adult can set the **development copy only** of `js/backend-config.js` to the development Supabase URL and publishable key and change mode to `live` for supervised tests. Do not copy any secret/service-role key into this file. Keep the public production site in its existing demo state until a separate release approval.

Redirect URL examples should match the actual deployment. The account page is `/account/index.html`; confirm password-recovery redirects return to that exact origin/path.

## 5. Optional transactional project-email notifications

This is separate from Supabase Auth verification emails. It sends opted-in project updates from the private outbox. Preferences default to off. Historical notifications are not backfilled; only new notification rows created after opt-in are queued.

### Provider

The included worker uses Resend's email API. An adult project owner must own the provider account, verify the sending domain, and confirm that its terms and sending limits suit the project. The worker re-checks the current preference and verified email before sending, retries failures up to five attempts, and leaves the job record in a private table.

### Deploy the Edge Function

From the project directory, the adult project owner can use the Supabase CLI, link to the correct **development** project, and deploy only this function:

```bash
supabase functions deploy send-notification-emails --project-ref YOUR_DEVELOPMENT_PROJECT_REF
```

The included `supabase/config.toml` sets `verify_jwt = false` for this service-to-service worker. That setting is safe only because the handler checks a separate high-entropy `x-worker-secret` header before it reads the queue. Do not remove that check, share the secret, or call the endpoint from browser code.

### Edge Function secrets

In the development Supabase dashboard → Edge Function Secrets, the adult owner sets:

- `RESEND_API_KEY` — secret from the adult-controlled Resend account.
- `EMAIL_FROM` — verified sender formatted like `ZeroDev Studio <notify@YOUR_VERIFIED_DOMAIN>`.
- `NOTIFICATION_WORKER_SECRET` — a unique, high-entropy secret (at least 32 random characters), generated and stored securely by the adult owner.

Supabase injects project environment values such as `SUPABASE_URL` and its service-role key into the Edge Function runtime. Never put any of these server values in the front end, workflow YAML, or a chat message.

### Optional GitHub Actions scheduler

The included `.github/workflows/send-notification-emails.yml` calls the worker every ten minutes and supports manual dispatch. GitHub scheduled workflows run from the repository's default branch, so this file must be present on that branch before the schedule becomes active.

An adult with repository administration access should add these two GitHub Actions repository secrets:

- `SUPABASE_NOTIFICATION_FUNCTION_URL` — `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-notification-emails`
- `NOTIFICATION_WORKER_SECRET` — the same worker secret stored in Supabase Edge Function Secrets.

Keep the repository private if the adult owner prefers, restrict who can edit workflow files, and do not add a Supabase service-role key or Resend API key to GitHub. The workflow only needs the function URL and its dedicated worker header secret. Confirm that the Action succeeds before enabling account preferences. If email delivery is not configured, leave the preference switch off.

## 6. Currency and country behavior

- Country detection uses the browser's time zone first, then the browser language region; it does not request precise GPS. It is approximate and may be wrong when a person travels, uses a proxy, or has different device settings.
- A manual country picker is available for the curated supported-country set. A currency override can be selected, or reset to the country's suggested default. The detected browser region is also retained when it is outside the curated set, but its currency falls back to USD until a user selects another supported display currency.
- Country/currency preference is stored in that browser's local storage, not synchronized to another device/account.
- Indicative currency conversions use ExchangeRate-API's open access endpoint, cache the response in the browser, and show the provider's update timestamp when available. The visible pages attribute ExchangeRate-API. The API provider states open-access rates update daily, require attribution, permit end-use commercial conversion, and do not permit redistribution of raw rate data.
- The conversion is for convenience only. It is not a payment rate, accounting rate, tax determination, or binding quotation. The submitted project budget and studio quotation remain in their originally selected currencies. The client portal may show an additional indicative display-currency equivalent beside the original quotation. Any accepted price should be documented as the agreed amount/currency, not recalculated later using display FX.
- A user's browser makes a request to the exchange-rate provider, so that provider receives ordinary request metadata such as the device's IP address. Include this in the privacy notice after adult review.

## 7. Staff membership and role testing

Staff enrollment remains manual and must be performed by the adult project owner using a reviewed server-side process. Do not add a public form or allow staff to choose their own role. Test at least:

- Owner/administrator/project-manager/support: may manage statuses, quotations, assignments, and internal notes.
- Developer/designer: may access assigned tickets and send client-visible replies, but may not manage ticket fields or view internal notes.
- Inactive/non-staff account: cannot access staff workspace data.

The staff workload panel is based on tickets visible to management roles. The activity panel shows database-recorded ticket events; it is not a comprehensive audit of every authentication, file, or administrative action. A global administrator/security-event audit trail is not included in v1.1.

## 8. Required test plan

Use synthetic test data and at least two adult-supervised client accounts.

### Authentication

- Sign up with a valid test inbox; verify the newest OTP.
- Refresh the account page while verification is pending; the pending verification view should resume in that browser tab.
- Try an incorrect/expired OTP; resend should show cooldown and provider errors without leaking account existence.
- Sign in with correct and incorrect credentials; an unverified account must not pass protected routes.
- Test forgot password, expired recovery session, password change, and email change confirmations.
- Confirm sign-out clears access and protected routes redirect to sign-in.

### Client data isolation

- Client A saves/loads/deletes drafts and creates a ticket.
- Client B must not read A's drafts, tickets, messages, attachments, events, or notifications.
- Confirm client-supplied fields cannot set `client_id`, `ticket_number`, or `promo_discount_percent`.
- Test five attachments maximum, 8 MiB per file, MIME allow-list, signed-link expiry, and retry behavior. The browser and Storage bucket check declared MIME type and size, but this release does not perform server-side file-content sniffing or malware scanning; add a reviewed scanning/validation service before accepting sensitive customer files at scale.

### Staff and notifications

- Verify management can assign tickets and update approved fields.
- Verify developers/designers can see assigned tickets only, cannot make manager updates, and cannot create/read internal notes.
- Verify client-visible replies create notifications for the client; client messages alert management and the assigned staff member only.
- Open a ticket thread and confirm unread message counts clear only for the signed-in client.
- Keep email preference off and confirm no worker job is created; opt in for a test account and verify a new job is sent, retried, or skipped after opt-out.

### Locale and currencies

- Confirm timezone/browser-region detection is displayed as approximate and can be overridden.
- Test all currency codes against database check constraints for budgets and quotations.
- Confirm currency changes update only display conversion and never mutate a saved request/quote amount or currency.
- Test with FX endpoint unavailable; the original request should still work and show an unavailable conversion notice.

## 9. Legal, operations, and deployment gate

Before collecting real customer information, a parent/guardian or qualified adviser must review the business arrangements, service eligibility, privacy notice, retention and deletion process, customer terms, refund/cancellation rules, provider accounts, and any applicable local requirements. The legal pages in this package are drafts, not legal advice. The registration checkbox is a front-end acknowledgement only; v1.1 does not yet retain a versioned, server-side record of terms/privacy acceptance. Before collecting real customer information, add a reviewed consent record (document version and timestamp) with an appropriate server-side audit trail. Payment remains outside the platform; no payment credentials or OTPs should be requested or stored.

Do not deploy v1.1 to production until the separate development tests pass, database policies/functions are reviewed, SMTP/domain delivery is confirmed, the email worker has been tested (or remains disabled), backups/rollback are planned, and the adult project owner approves the release.
