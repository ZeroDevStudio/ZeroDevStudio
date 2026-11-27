# ZeroDev Studio v1.1 package QA report

## Scope

Static source review and local package checks only. No live Supabase migration was applied, no real emails were sent, no user data was accessed, and no production deployment was performed.

## Reviewed in source

- Front-end configuration remains `mode: 'demo'` with empty Supabase URL/publishable key.
- Supabase JS dependency is pinned to `2.119.2` in browser modules and the Edge Function.
- The account flow uses Supabase Auth OTP/recovery/email-change calls and protects routes through verified-user checks.
- Drafts/preferences use own-account RLS in the v1.1 migration; email queue is private and service-role only. The migration also defines `can_access_ticket()` and tightens ticket, staff, message, attachment metadata, ticket-event, and Storage access to the audited ownership/assignment model.
- Notification worker checks its dedicated request secret, claims queue jobs atomically, checks the user's current preferences and verified email, and does not embed provider/service-role keys.
- Country/currency preferences are local browser preferences; FX conversions are informational and do not change submitted budget/quote amounts.
- Staff UI controls are role-aware, with database RLS still being the enforcement boundary.

## Local static checks completed

- `node --check` passed for all 12 JavaScript files.
- All 12 HTML files parsed, and local script, stylesheet, and image references resolved.
- The GitHub Actions workflow YAML parsed successfully.
- The Edge Function TypeScript passed a local `tsc --noEmit` syntax/type pass using minimal Deno/Supabase environment declarations; this is not a Deno deploy/bundle test.
- A source scan found no obvious service-role, JWT, or provider-secret literals in client/worker code.

These checks do not execute SQL or test real provider behavior. The v1.1 migration has not been applied or executed in this environment.

## Must be tested in a separate development Supabase project

- Apply the new migration and verify its constraints, grants, triggers, functions, and RLS.
- Use multiple client accounts to verify ticket/draft/message/storage/notification isolation.
- Test each staff role, assignment restrictions, client-visible messages, and internal notes.
- Test signup, OTP, resend limits, recovery, password update, email change, session expiry, and sign-out.
- Configure test SMTP and Resend only with adult-owned provider accounts; test notification opt-in/opt-out, queue retry, skipped jobs, and scheduler runs.
- Test currency list against the DB constraint and verify that source amounts remain unchanged during display conversion.

## Release status

**Development package assembled; not production-certified.** The included source has not been validated against a live Supabase project or provider account in this run. Keep demo mode enabled until the adult project owner completes `V1_1_SETUP.md` and records successful test results.
