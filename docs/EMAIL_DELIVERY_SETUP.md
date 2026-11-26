# ZeroDev Studio v0.9 — automated verification email setup

## What the email bot is

The account page uses **Supabase Auth** to send the confirmation email automatically after someone submits the registration form. Supabase generates and validates the one-time code. This project does not generate codes in the browser and does not contain SMTP credentials.

This package is still set to `mode: 'demo'`. A real message will not be sent until the project owner configures a Supabase development project, enables email confirmations, installs the branded template, configures SMTP, and deliberately enables test mode.

## Branded confirmation template

1. Open the Supabase dashboard for the development project.
2. Go to **Authentication → Email Templates → Confirm signup**.
3. Set the subject to: `Your ZeroDev Studio verification code`.
4. Paste the HTML from `supabase/templates/confirm-signup.html` into the template body.
5. Keep `{{ .Token }}` unchanged. Supabase substitutes the generated, one-time code. The browser submits it through `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
6. Keep email confirmations enabled. If confirmations are off, signup can complete without sending a confirmation email.

The template contains only account-security content. Do not add NEW26 or marketing promotions to authentication emails.

## SMTP delivery

A parent/guardian or authorized adult should own and supervise the email provider and Supabase project settings.

1. Choose an email service that supports SMTP and verify the sender domain/address.
2. Configure its SMTP host, port, username, and password directly in **Supabase → Authentication → SMTP Settings**.
3. Set the sender name to `ZeroDev Studio` and use a sender address belonging to the verified domain.
4. Configure sender-domain authentication (SPF, DKIM, and DMARC) with the domain provider.
5. Keep SMTP credentials only in the Supabase dashboard/provider. Never place them in this repository, `backend-config.js`, browser JavaScript, or a public Git repository.
6. Test with adult-owned test inboxes and confirm delivery, spam placement, expired codes, invalid codes, and resend behavior.

Supabase's built-in email sender is for trial use: it restricts delivery to authorized organization-team email addresses and currently has a low project-wide limit of 2 messages per hour. Custom SMTP is needed for testing delivery to arbitrary external addresses and for real usage. Review the current Supabase limits before testing.

## Frontend configuration after backend review

Only after the adult project owner has completed the setup and security review, edit `js/backend-config.js`:

```js
window.ZERO_DEV_BACKEND_CONFIG = Object.freeze({
  provider: 'supabase',
  mode: 'live', // Only for a supervised test project after setup is complete.
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabasePublishableKey: 'YOUR-PUBLISHABLE-KEY'
});
```

Only a project URL and publishable key belong in this browser configuration. Never add a Supabase secret/service-role key, SMTP password, email-provider API key, access token, or private credential.

## How the flow works

1. The visitor submits name, email, and password.
2. The frontend calls `supabase.auth.signUp()`.
3. Supabase Auth sends the Confirm signup email using the configured template and SMTP sender.
4. The visitor enters the code on the ZeroDev account page.
5. The frontend calls `supabase.auth.verifyOtp()` with `type: 'email'`.
6. Supabase validates the code and creates the authenticated session.
7. Resend uses `supabase.auth.resend({ type: 'signup', email })`, with a 60-second UI cooldown. Server-side rate limits still apply.

## Before any public launch

- Keep confirmation enabled; never disable verification just to make testing easier.
- Configure CAPTCHA/bot protection and sensible Auth rate limits.
- Keep the project in demo mode until the backend has been tested.
- Confirm RLS on every table and ensure private portal routes are not exposed to anonymous visitors.
- Test signup, resend throttling, expired codes, wrong codes, duplicate registrations, password recovery, and sign-out.
- Publish and review account terms and a privacy notice before collecting real customer information.
- Do not ask users to tell a support agent their verification code. Support will never need it.

## Official documentation

- Supabase email templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase sign-up: https://supabase.com/docs/reference/javascript/auth-signup
- Supabase OTP verification: https://supabase.com/docs/reference/javascript/auth-verifyotp
- Supabase resend confirmation: https://supabase.com/docs/reference/javascript/auth-resend
