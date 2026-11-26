# ZeroDev Studio v0.6 — backend setup plan

## Current state

The project contains an optional Supabase Auth adapter, but **it is disabled by default**. `js/backend-config.js` is set to `mode: 'demo'` and has empty project settings. With this configuration, forms do not transmit or save submitted data.

Do not enable real registrations or accept customer information yet. A parent/guardian or other authorized adult must own and supervise any hosted backend, email provider, customer arrangements, and payment accounts. Build and test with a separate, non-production project first.

## Architecture selected

- Frontend: existing vanilla HTML, CSS, and JavaScript.
- Authentication: Supabase Auth using the official `supabase-js` v2 client loaded only when live mode is explicitly configured.
- Email verification: Supabase Auth confirmation email with a one-time code in the email template.
- Database: Supabase Postgres. The first migration creates a minimal `profiles` table with row-level security (RLS).
- Email delivery: custom SMTP provider configured in the Supabase dashboard by the adult project owner. SMTP credentials stay in the provider/Supabase settings and never go into this website.

## Adult-owner setup checklist

1. Have a parent/guardian or authorized adult create and manage the Supabase organization and a separate development project.
2. In Supabase project settings, copy the **Project URL** and **publishable key**. A publishable key is intended for browser use; it is not a replacement for database security. Never copy a secret key or `service_role` key into this folder.
3. In the Supabase SQL editor, review and apply `supabase/migrations/20261126000000_profiles.sql` to the development project.
4. In Authentication settings, require email confirmation. Keep confirmation enabled; otherwise new registrations can become active without the requested email verification.
5. Customize the **Confirm sign up** email template to show the one-time code using `{{ .Token }}`. Keep the code type aligned with the `verifyOtp({ email, token, type: 'email' })` call in `js/auth.js`.
6. Configure the project's Site URL and allowed redirect URLs for the exact development address used by Live Server. Do not use a wildcard redirect for production.
7. For real external recipients, configure a custom SMTP provider in Supabase Auth settings. Do not put the SMTP host password, API secret, or mailbox password in `backend-config.js` or any frontend file. Configure sender-domain authentication (SPF, DKIM, and DMARC) with the adult domain owner.
8. Test signup, code verification, sign-in, sign-out, password recovery, expired codes, invalid codes, and resend throttling using only test email accounts.
9. Review privacy notices, account terms, access controls, data retention, backups, and incident handling before any real person is invited.
10. Keep `mode: 'demo'` until all items above are completed and reviewed. Only then should the adult project owner decide whether to change the mode to `live` and supply the project URL and publishable key.

## Configure the front end after the checklist

Edit `js/backend-config.js`:

```js
window.ZERO_DEV_BACKEND_CONFIG = Object.freeze({
  provider: 'supabase',
  mode: 'demo', // Keep demo until all setup and reviews are finished.
  supabaseUrl: '',
  supabasePublishableKey: ''
});
```

The only values that belong in the browser config are the project's URL and publishable key. If using a publishable key, RLS and least-privilege database grants are mandatory. Never add a `service_role` key, secret API key, SMTP credential, password, or access token here.

The account page loads the Supabase SDK from a CDN only when `mode` is `live` and both settings are present. Internet access is therefore required in live mode. Keep demo mode while working offline or using the interface prototype.

## What v0.6 actually supports when configured

- Email/password sign-up.
- Supabase-managed confirmation email and one-time code verification.
- Email/password sign-in and sign-out.
- Password-reset email request and password update after the provider returns a recovery session.
- Basic `profiles` row creation via an Auth database trigger and read-own-profile RLS policy.

## Not implemented / not safe to launch yet

- Client portal route protection and data access policies.
- Ticket, project, message, notification, attachment, or staff-role tables.
- Guest-access token issuance and verification.
- Staff permissions, admin dashboards, audit logs, or support workflows.
- Payment records or payment handling.
- Published account terms and privacy notice.

A successful sign-in does **not** grant access to the sample portal. The portal is still fictional demo content. Do not link it as a live private workspace until server-side data authorization and route/session checks are developed and tested.

## Email-delivery note

Supabase's default email sender is intended for trial/testing and has delivery restrictions and low rate limits. A custom SMTP sender is needed for reliable delivery to ordinary users. The owner should review current provider limits and configure sending-domain authentication before production.

## Official references

- Supabase Auth sign up: https://supabase.com/docs/reference/javascript/auth-signup
- Supabase OTP verification: https://supabase.com/docs/reference/javascript/auth-verifyotp
- Supabase resend confirmation: https://supabase.com/docs/reference/javascript/auth-resend
- Supabase email templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase production checklist: https://supabase.com/docs/guides/deployment/going-into-prod


## v0.7 — one-time NEW26 promotion

After reviewing the promotion terms, apply `supabase/migrations/20261126010000_promo_code_redemptions.sql` to the test project. It creates private promo/redemption tables and two authenticated RPC functions:

- `redeem_promo_code(p_code)` — validates the code, requires a verified email, and records one redemption for the signed-in user. A unique `(promo_code_id, user_id)` constraint is the enforcement boundary.
- `get_my_promo_status()` — returns only the signed-in user's own promotion status.

The browser frontend calls these RPC functions; it has no direct table access. Keep the app in demo mode until the migration and authentication settings are tested. Demo mode only stores a local preview in the current browser and does not enforce account-level one-use limits.


## v0.9 — branded automated verification email

The frontend calls Supabase Auth's `signUp`, `verifyOtp`, and `resend` APIs. Install the branded confirmation email body from `supabase/templates/confirm-signup.html` in the **Confirm signup** template. Keep the `{{ .Token }}` template variable unchanged. Configure custom SMTP directly in the Supabase dashboard; do not store any SMTP credentials in frontend files. Full steps are in `docs/EMAIL_DELIVERY_SETUP.md`.

Supabase's built-in SMTP sender is restricted to authorized organization-team addresses and currently permits only a small number of messages per hour. Use a supervised custom SMTP configuration for reliable testing to ordinary inboxes.
